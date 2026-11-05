# LandNexus - consultant proposal workflow demo (backend running on port 8080).
# Creates clearly labelled DEMO geography, three DEMO users (consultant, scrutiny officer, competent authority),
# then walks one proposal through the whole workflow and prints every step.
# Needs LANDNEXUS_ADMIN_USERNAME and LANDNEXUS_ADMIN_PASSWORD. Audit and history rows are append-only, so they stay.
param(
    [string]$BaseUrl = "http://localhost:8080/api/v1",
    [string]$AdminUser = $env:LANDNEXUS_ADMIN_USERNAME,
    [string]$AdminPassword = $env:LANDNEXUS_ADMIN_PASSWORD
)

if (-not $AdminUser -or -not $AdminPassword) {
    Write-Host "Set LANDNEXUS_ADMIN_USERNAME and LANDNEXUS_ADMIN_PASSWORD (or pass -AdminUser / -AdminPassword)."
    exit 1
}

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body, [string]$Token)
    try {
        $params = @{ Method = $Method; Uri = "$BaseUrl$Path"; ContentType = "application/json" }
        if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 6) }
        if ($Token) { $params.Headers = @{ Authorization = "Bearer $Token" } }
        $data = Invoke-RestMethod @params
        return @{ Status = "OK"; Data = $data }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        return @{ Status = $code; Data = $_.ErrorDetails.Message }
    }
}

function Show-Result($label, $expected, $result) {
    $ok = ("$($result.Status)" -eq "$expected")
    $mark = if ($ok) { "PASS" } else { "FAIL" }
    Write-Host ("[{0}] {1}  (expected {2}, got {3})" -f $mark, $label, $expected, $result.Status)
    if (-not $ok) { Write-Host "      $($result.Data)" }
}

function Show-Status($label, $result, $expectedStatus) {
    $got = $result.Data.status
    $mark = if ($got -eq $expectedStatus) { "PASS" } else { "FAIL" }
    Write-Host ("[{0}] {1} -> status {2} (expected {3})" -f $mark, $label, $got, $expectedStatus)
}

$s = Get-Random -Maximum 99999
$pw = "Demo-Passw0rd-$s"

$admin = Invoke-Api POST "/auth/login" @{ username = $AdminUser; password = $AdminPassword } $null
Show-Result "Administrator login" "OK" $admin
if ($admin.Status -ne "OK") { exit 1 }
$a = $admin.Data.accessToken

Write-Host "`n--- DEMO master data ---"
$state = Invoke-Api POST "/administration/states" @{ code = "DM$s"; name = "DEMO State $s" } $a
$dist = Invoke-Api POST "/administration/districts" @{ code = "DD$s"; name = "DEMO District"; stateId = $state.Data.id } $a
$tal = Invoke-Api POST "/administration/talukas" @{ code = "DT$s"; name = "DEMO Taluka"; districtId = $dist.Data.id } $a
$vil1 = Invoke-Api POST "/administration/villages" @{ code = "V1"; name = "DEMO Village 1"; talukaId = $tal.Data.id } $a
$vil2 = Invoke-Api POST "/administration/villages" @{ code = "V2"; name = "DEMO Village 2"; talukaId = $tal.Data.id } $a
$min = Invoke-Api POST "/administration/ministries" @{ code = "DMIN$s"; name = "DEMO Ministry of Roads" } $a
$dep = Invoke-Api POST "/administration/departments" @{ code = "DDEP$s"; name = "DEMO Public Works Department"; ministryId = $min.Data.id; level = "STATE" } $a
Show-Result "Geography and department created" "OK" $vil2

Write-Host "`n--- DEMO users (each scoped to the demo district) ---"
$people = @(
    @{ key = "consultant"; role = "CONSULTANT" },
    @{ key = "officer"; role = "SCRUTINY_OFFICER" },
    @{ key = "authority"; role = "COMPETENT_AUTHORITY" })
$tokens = @{}
foreach ($p in $people) {
    $name = "demo-$($p.key)-$s"
    $u = Invoke-Api POST "/administration/users" @{
        username = $name; email = "$name@demo.invalid"; fullName = "DEMO $($p.key)"; password = $pw; roles = @($p.role) } $a
    Show-Result "Create $($p.role) user" "OK" $u
    $sc = Invoke-Api PUT "/administration/users/$($u.Data.id)/scopes" @{ scopes = @(@{ districtId = $dist.Data.id }) } $a
    Show-Result "Assign district scope to $name" "OK" $sc
    $l = Invoke-Api POST "/auth/login" @{ username = $name; password = $pw } $null
    $tokens[$p.key] = $l.Data.accessToken
}
$c = $tokens["consultant"]; $o = $tokens["officer"]; $z = $tokens["authority"]

Write-Host "`n--- Proposal workflow ---"
$proposalBody = @{
    title = "DEMO State Highway Expansion"; projectType = "STATE_HIGHWAY"; districtId = $dist.Data.id; talukaId = $tal.Data.id;
    departmentId = $dep.Data.id; lengthKm = 60; estimatedLandAreaHa = 150; villageIds = @($vil1.Data.id, $vil2.Data.id);
    alignmentDescription = "Along the existing alignment"; description = "Expansion of existing state highway";
    plannedStartDate = "2027-01-01"; plannedEndDate = "2028-12-31" }
$p = Invoke-Api POST "/projects/proposals" $proposalBody $c
Show-Status "Consultant creates a draft" $p "DRAFT"
$id = $p.Data.id
Write-Host "    available actions for the consultant: $($p.Data.availableActions -join ', ')"

$r = Invoke-Api POST "/projects/proposals/$id/submit" $null $c
Show-Status "Consultant submits" $r "SUBMITTED"
Write-Host "    proposal number: $($r.Data.proposalNumber), version $($r.Data.versionNo)"

$r = Invoke-Api POST "/projects/proposals/$id/approve" $null $c
Show-Result "Consultant cannot approve" 403 $r

$r = Invoke-Api POST "/projects/proposals/$id/start-scrutiny" $null $o
Show-Status "Officer starts scrutiny" $r "UNDER_SCRUTINY"

$r = Invoke-Api POST "/projects/proposals/$id/clarification" @{ reason = "Please add the survey numbers" } $o
Show-Status "Officer requests clarification" $r "CLARIFICATION_REQUESTED"

$proposalBody.description = "Expansion of existing state highway; survey numbers attached"
$r = Invoke-Api PUT "/projects/proposals/$id" $proposalBody $c
Show-Status "Consultant updates the proposal" $r "CLARIFICATION_REQUESTED"

$r = Invoke-Api POST "/projects/proposals/$id/resubmit" $null $c
Show-Status "Consultant resubmits" $r "SUBMITTED"
Write-Host "    now version $($r.Data.versionNo), number unchanged: $($r.Data.proposalNumber)"

$r = Invoke-Api POST "/projects/proposals/$id/start-scrutiny" $null $o
Show-Status "Officer starts scrutiny again" $r "UNDER_SCRUTINY"

$r = Invoke-Api POST "/projects/proposals/$id/approve" $null $z
Show-Result "Authority cannot approve before a recommendation" 409 $r

$r = Invoke-Api POST "/projects/proposals/$id/recommend" @{ reason = "Complete and viable" } $o
Show-Status "Officer recommends" $r "RECOMMENDED"

$r = Invoke-Api POST "/projects/proposals/$id/approve" @{ reason = "Approved for acquisition" } $z
Show-Status "Competent authority approves" $r "APPROVED"
Write-Host "    PROJECT CREATED: $($r.Data.projectCode)"

Write-Host "`n--- Records ---"
$h = Invoke-Api GET "/projects/proposals/$id/history" $null $o
Show-Result "History" "OK" $h
foreach ($e in $h.Data) { Write-Host ("    {0,-22} {1,-24} {2}" -f $e.action, $e.toStatus, $e.actorUsername) }
$v = Invoke-Api GET "/projects/proposals/$id/versions" $null $o
Write-Host "    versions kept: $(@($v.Data).Count)"
$n = Invoke-Api GET "/notifications/unread-count" $null $c
Write-Host "    consultant unread notifications: $($n.Data.unread)"
$pr = Invoke-Api GET "/projects" $null $c
Write-Host "    consultant sees projects: $($pr.Data.totalElements)"
