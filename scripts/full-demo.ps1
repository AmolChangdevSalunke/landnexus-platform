# LandNexus - end-to-end DEMO of Modules 1, 2 and 3. ALL DATA IS SYNTHETIC AND LABELLED "DEMO".
# Needs: backend running on :8080, LANDNEXUS_ADMIN_USERNAME / LANDNEXUS_ADMIN_PASSWORD, curl.exe (Windows 10+).
# Audit and history rows are append-only by design, so a re-run leaves earlier DEMO rows behind (names carry a random suffix).
param(
    [string]$BaseUrl = "http://localhost:8080/api/v1",
    [string]$AdminUser = $env:LANDNEXUS_ADMIN_USERNAME,
    [string]$AdminPassword = $env:LANDNEXUS_ADMIN_PASSWORD
)
if (-not $AdminUser -or -not $AdminPassword) { Write-Host "Set LANDNEXUS_ADMIN_USERNAME and LANDNEXUS_ADMIN_PASSWORD."; exit 1 }

$script:Pass = 0; $script:Fail = 0

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body, [string]$Token)
    try {
        $p = @{ Method = $Method; Uri = "$BaseUrl$Path"; ContentType = "application/json" }
        if ($null -ne $Body) { $p.Body = ($Body | ConvertTo-Json -Depth 8) }
        if ($Token) { $p.Headers = @{ Authorization = "Bearer $Token" } }
        return @{ Status = "OK"; Data = (Invoke-RestMethod @p) }
    } catch {
        return @{ Status = $_.Exception.Response.StatusCode.value__; Data = $_.ErrorDetails.Message }
    }
}

function Invoke-Upload {
    param([string]$Path, [string]$File, [string]$Type, [hashtable]$Fields, [string]$Token)
    $tmp = [System.IO.Path]::GetTempFileName()
    $curlArgs = @("-s", "-o", $tmp, "-w", "%{http_code}", "-H", "Authorization: Bearer $Token", "-F", "file=@$File;type=$Type")
    foreach ($k in $Fields.Keys) { $curlArgs += @("-F", "$k=$($Fields[$k])") }
    $curlArgs += "$BaseUrl$Path"
    $code = [int](& curl.exe @curlArgs)
    $body = Get-Content $tmp -Raw -ErrorAction SilentlyContinue
    Remove-Item $tmp -ErrorAction SilentlyContinue
    $data = $null; try { $data = $body | ConvertFrom-Json } catch { }
    $status = if ($code -ge 200 -and $code -lt 300) { "OK" } else { $code }
    return @{ Status = $status; Data = $data; Raw = $body }
}

function Get-File {
    param([string]$Path, [string]$Out, [string]$Token)
    $code = [int](& curl.exe -s -o $Out -w "%{http_code}" -H "Authorization: Bearer $Token" "$BaseUrl$Path")
    return @{ Status = $(if ($code -ge 200 -and $code -lt 300) { "OK" } else { $code }) }
}

function Check($label, $expected, $result) {
    $ok = ("$($result.Status)" -eq "$expected")
    if ($ok) { $script:Pass++ } else { $script:Fail++ }
    Write-Host ("[{0}] {1}  (expected {2}, got {3})" -f $(if ($ok) { "PASS" } else { "FAIL" }), $label, $expected, $result.Status)
    if (-not $ok -and $result.Data) { Write-Host "      $($result.Data)" }
}

function Assert($label, [bool]$condition) {
    if ($condition) { $script:Pass++ } else { $script:Fail++ }
    Write-Host ("[{0}] {1}" -f $(if ($condition) { "PASS" } else { "FAIL" }), $label)
}

function Step($title) { Write-Host "`n=== $title ===" }

$s = Get-Random -Maximum 99999
$pw = "Demo-Passw0rd-$s"
$work = Join-Path $env:TEMP "landnexus-demo-$s"
New-Item -ItemType Directory -Force $work | Out-Null
$pdf = Join-Path $work "DEMO-survey-map.pdf"
[System.IO.File]::WriteAllText($pdf, "%PDF-1.4`n% DEMO sample document - synthetic, not a real land record`n%%EOF`n", [System.Text.Encoding]::ASCII)
$fake = Join-Path $work "evil.pdf"
[System.IO.File]::WriteAllBytes($fake, [byte[]](0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00))

# ---------------------------------------------------------------- Module 1: administration
Step "Module 1 - administrator login and DEMO master data"
$admin = Invoke-Api POST "/auth/login" @{ username = $AdminUser; password = $AdminPassword } $null
Check "Administrator login" "OK" $admin
if ($admin.Status -ne "OK") { exit 1 }
$a = $admin.Data.accessToken

$state = Invoke-Api POST "/administration/states" @{ code = "DM$s"; name = "DEMO State $s" } $a
$dist = Invoke-Api POST "/administration/districts" @{ code = "DD$s"; name = "DEMO District"; stateId = $state.Data.id } $a
$tal = Invoke-Api POST "/administration/talukas" @{ code = "DT$s"; name = "DEMO Taluka"; districtId = $dist.Data.id } $a
$v1 = Invoke-Api POST "/administration/villages" @{ code = "V1"; name = "DEMO Village 1"; talukaId = $tal.Data.id } $a
$v2 = Invoke-Api POST "/administration/villages" @{ code = "V2"; name = "DEMO Village 2"; talukaId = $tal.Data.id } $a
$min = Invoke-Api POST "/administration/ministries" @{ code = "DMIN$s"; name = "DEMO Ministry of Roads" } $a
$dep = Invoke-Api POST "/administration/departments" @{ code = "DDEP$s"; name = "DEMO Public Works Department"; ministryId = $min.Data.id; level = "STATE" } $a
Check "State, district, taluka, 2 villages, ministry and department created" "OK" $dep

Step "Module 1 - DEMO users, each limited to the demo district (geographic scope)"
$people = @(
    @{ key = "consultant"; role = "CONSULTANT" }, @{ key = "officer"; role = "SCRUTINY_OFFICER" },
    @{ key = "authority"; role = "COMPETENT_AUTHORITY" }, @{ key = "field"; role = "FIELD_OFFICER" },
    @{ key = "finance"; role = "FINANCE_OFFICER" })
$t = @{}
foreach ($p in $people) {
    $name = "demo-$($p.key)-$s"
    $u = Invoke-Api POST "/administration/users" @{ username = $name; email = "$name@demo.invalid"; fullName = "DEMO $($p.key)"; password = $pw; roles = @($p.role) } $a
    $sc = Invoke-Api PUT "/administration/users/$($u.Data.id)/scopes" @{ scopes = @(@{ districtId = $dist.Data.id }) } $a
    $l = Invoke-Api POST "/auth/login" @{ username = $name; password = $pw } $null
    Check "$($p.role) user created, scoped and logged in" "OK" $l
    $t[$p.key] = $l.Data.accessToken
}

# ---------------------------------------------------------------- Module 2: proposal -> project
Step "Module 2 - consultant proposal, scrutiny, recommendation, approval"
$body = @{ title = "DEMO State Highway Expansion"; projectType = "STATE_HIGHWAY"; districtId = $dist.Data.id; talukaId = $tal.Data.id;
    departmentId = $dep.Data.id; lengthKm = 60; estimatedLandAreaHa = 150; villageIds = @($v1.Data.id, $v2.Data.id);
    description = "DEMO: expansion of an existing state highway"; plannedStartDate = "2027-01-01"; plannedEndDate = "2028-12-31" }
$pr = Invoke-Api POST "/projects/proposals" $body $t.consultant
Check "Consultant creates a draft" "OK" $pr
$id = $pr.Data.id
$r = Invoke-Api POST "/projects/proposals/$id/submit" $null $t.consultant
Check "Consultant submits (number $($r.Data.proposalNumber))" "OK" $r
Check "Consultant cannot approve" 403 (Invoke-Api POST "/projects/proposals/$id/approve" $null $t.consultant)
Check "Officer starts scrutiny" "OK" (Invoke-Api POST "/projects/proposals/$id/start-scrutiny" $null $t.officer)
Check "Authority cannot approve before a recommendation" 409 (Invoke-Api POST "/projects/proposals/$id/approve" $null $t.authority)
Check "Officer recommends" "OK" (Invoke-Api POST "/projects/proposals/$id/recommend" @{ reason = "DEMO: complete" } $t.officer)
$r = Invoke-Api POST "/projects/proposals/$id/approve" @{ reason = "DEMO: approved" } $t.authority
Check "Competent authority approves" "OK" $r
Write-Host "    PROJECT CREATED: $($r.Data.projectCode)"
$hist = Invoke-Api GET "/projects/proposals/$id/history" $null $t.officer
Write-Host "    history: $((@($hist.Data) | ForEach-Object { $_.action }) -join ' > ')"

# ---------------------------------------------------------------- Module 3: land records
Step "Module 3 - parcels in the project's villages (Gat numbers are DEMO)"
$LR = "/land-records"
$parcel = { param($village, $gat, $area) @{ villageId = $village; gatNumber = $gat; areaHa = $area; classification = "AGRICULTURAL_DRY"; landUse = "CULTIVATION" } }
$p1 = Invoke-Api POST "$LR/parcels" (& $parcel $v1.Data.id "DEMO-101" 1.25) $t.field
$p2 = Invoke-Api POST "$LR/parcels" (& $parcel $v2.Data.id "DEMO-102" 2.5) $t.field
Check "Field officer creates parcel DEMO-101" "OK" $p1
Check "Field officer creates parcel DEMO-102" "OK" $p2
Check "The same Gat number again is refused" 409 (Invoke-Api POST "$LR/parcels" (& $parcel $v1.Data.id "demo-101" 3) $t.field)
Check "A consultant cannot create parcels" 403 (Invoke-Api POST "$LR/parcels" (& $parcel $v1.Data.id "DEMO-999" 3) $t.consultant)
$pid1 = $p1.Data.id

Step "Module 3 - landowners and ownership shares (sensitive data, masked for some roles)"
$oa = Invoke-Api POST "$LR/landowners" @{ districtId = $dist.Data.id; ownerType = "INDIVIDUAL"; fullName = "DEMO Owner One"; phone = "+91 90000 00001" } $t.field
$ob = Invoke-Api POST "$LR/landowners" @{ districtId = $dist.Data.id; ownerType = "INDIVIDUAL"; fullName = "DEMO Owner Two" } $t.field
Check "Two DEMO landowners created" "OK" $ob
$share = { param($owner, $pct) @{ landownerId = $owner; sharePercent = $pct; basis = "ORIGINAL"; fromDate = "2020-01-01" } }
Check "Owner One gets 60%" "OK" (Invoke-Api POST "$LR/parcels/$pid1/ownerships" (& $share $oa.Data.id 60) $t.field)
Check "Owner Two 50% would exceed 100% - refused" 400 (Invoke-Api POST "$LR/parcels/$pid1/ownerships" (& $share $ob.Data.id 50) $t.field)
Check "Owner Two gets 40%" "OK" (Invoke-Api POST "$LR/parcels/$pid1/ownerships" (& $share $ob.Data.id 40) $t.field)
$own = Invoke-Api GET "$LR/parcels/$pid1/ownerships" $null $t.finance
Check "Finance officer sees the ownership shares" "OK" $own
Assert "...but the owner names are hidden from finance" ($null -eq @($own.Data)[0].ownerName)
Check "Finance officer cannot open landowner details" 403 (Invoke-Api GET "$LR/landowners/$($oa.Data.id)" $null $t.finance)
$own2 = Invoke-Api GET "$LR/parcels/$pid1/ownerships" $null $t.field
Assert "A field officer sees the owner names" (@($own2.Data)[0].ownerName -like "DEMO Owner*")

Step "Module 3 - mutation entry and 7/12, 8A records (typed by officers, no OCR)"
Check "Mutation M-77 recorded" "OK" (Invoke-Api POST "$LR/parcels/$pid1/mutations" @{ mutationNumber = "M-77"; mutationDate = "2023-05-01"; mutationType = "SALE"; description = "DEMO" } $t.field)
Check "7/12 extract recorded" "OK" (Invoke-Api POST "$LR/parcels/$pid1/revenue-records" @{ recordType = "SEVEN_TWELVE"; extractDate = "2024-01-01"; particulars = "DEMO particulars" } $t.field)
Check "8A without a khata number is refused" 400 (Invoke-Api POST "$LR/parcels/$pid1/revenue-records" @{ recordType = "EIGHT_A"; extractDate = "2024-01-01"; particulars = "DEMO" } $t.field)

Step "Module 3 - secure documents: validation, hash-checked download, manual verification"
$fields = @{ category = "SURVEY_MAP"; title = "DEMO survey map" }
Check "A fake PDF (really an .exe) is rejected" 400 (Invoke-Upload "$LR/parcels/$pid1/documents" $fake "application/pdf" $fields $t.field)
Check "Finance officer cannot upload" 403 (Invoke-Upload "$LR/parcels/$pid1/documents" $pdf "application/pdf" $fields $t.finance)
$up = Invoke-Upload "$LR/parcels/$pid1/documents" $pdf "application/pdf" $fields $t.field
Check "Field officer uploads the DEMO PDF (version 1)" "OK" $up
$docId = $up.Data.id
Write-Host "    status: $($up.Data.verificationStatus), sha256: $($up.Data.versions[0].sha256)"
$out = Join-Path $work "downloaded.pdf"
Check "Field officer downloads it" "OK" (Get-File "$LR/documents/$docId/versions/1/download" $out $t.field)
$same = (Get-FileHash $pdf -Algorithm SHA256).Hash -eq (Get-FileHash $out -Algorithm SHA256).Hash
Assert "The downloaded file is byte-for-byte identical (SHA-256 match)" $same
Check "Finance officer cannot download" 403 (Get-File "$LR/documents/$docId/versions/1/download" (Join-Path $work "no.pdf") $t.finance)
Check "The uploader's role cannot verify it" 403 (Invoke-Api POST "$LR/documents/$docId/verify" $null $t.field)
$v = Invoke-Api POST "$LR/documents/$docId/verify" @{ remarks = "DEMO: checked against the original" } $t.officer
Check "Scrutiny officer verifies it (a human decision)" "OK" $v
Write-Host "    status now: $($v.Data.verificationStatus)"
$nv = Invoke-Upload "/land-records/documents/$docId/versions" $pdf "application/pdf" @{} $t.field
Check "A new version is uploaded" "OK" $nv
Write-Host "    after the new version: status $($nv.Data.verificationStatus), version $($nv.Data.currentVersionNo) (verification was reset)"

Step "Audit trail of the document (administrator)"
$au = Invoke-Api GET "/administration/audit-events?entityType=LandDocument&entityId=$docId" $null $a
Check "Audit trail readable" "OK" $au
Write-Host "    $((@($au.Data.content) | Sort-Object occurredAt | ForEach-Object { "$($_.action) by $($_.actorUsername)" }) -join '  |  ')"

Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "`n=== RESULT: $script:Pass passed, $script:Fail failed ==="

Write-Host "`nLandNexus demo completed successfully!" -ForegroundColor Green
