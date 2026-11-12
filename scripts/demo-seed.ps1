# LandNexus - DEMO seed for a live presentation. ALL DATA IS SYNTHETIC AND LABELLED "DEMO".
param(
    [string]$BaseUrl = "http://localhost:8080/api/v1",
    [string]$AdminUser = $env:LANDNEXUS_ADMIN_USERNAME,
    [string]$AdminPassword = $env:LANDNEXUS_ADMIN_PASSWORD,
    [ValidateSet("Start", "Verified", "Awarded")][string]$Stage = "Start"
)
if (-not $AdminUser -or -not $AdminPassword) { Write-Host "Set LANDNEXUS_ADMIN_USERNAME and LANDNEXUS_ADMIN_PASSWORD."; exit 1 }

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
function Invoke-RawJson {
    param([string]$Method, [string]$Path, [string]$Json, [string]$Token)
    try {
        $rp = @{ Method = $Method; Uri = "$BaseUrl$Path"; ContentType = "application/json"; Body = $Json; Headers = @{ Authorization = "Bearer $Token" } }
        return @{ Status = "OK"; Data = (Invoke-RestMethod @rp) }
    } catch {
        return @{ Status = $_.Exception.Response.StatusCode.value__; Data = $_.ErrorDetails.Message }
    }
}
function Need($label, $r) {
    if ("$($r.Status)" -ne "OK") { Write-Host "SEED FAILED at: $label (HTTP $($r.Status)) $($r.Data)" -ForegroundColor Red; exit 1 }
    return $r
}

$s = Get-Random -Maximum 99999
$pw = "Demo-Passw0rd-$s"
$rank = @{ Start = 0; Verified = 1; Awarded = 2 }[$Stage]
$dYesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
$dIssued = (Get-Date).AddDays(-60).ToString("yyyy-MM-dd")
$dDeadline = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
$dObjection = (Get-Date).AddDays(-45).ToString("yyyy-MM-dd")
$dAward = (Get-Date).AddDays(-10).ToString("yyyy-MM-dd")
$dPossession = (Get-Date).AddDays(-5).ToString("yyyy-MM-dd")

$adm = Need "administrator login" (Invoke-Api POST "/auth/login" @{ username = $AdminUser; password = $AdminPassword } $null)
$a = $adm.Data.accessToken
if ((Invoke-Api GET "/monitoring/settings" $null $a).Status -ne "OK") { Write-Host "The running backend is an OLD build (no Module 7 routes). Stop it and start the new jar." -ForegroundColor Red; exit 1 }

# --- geography and department
$state = Need "state" (Invoke-Api POST "/administration/states" @{ code = "DS$s"; name = "DEMO State $s" } $a)
$dist = Need "district" (Invoke-Api POST "/administration/districts" @{ code = "DD$s"; name = "DEMO District"; stateId = $state.Data.id } $a)
$tal = Need "taluka" (Invoke-Api POST "/administration/talukas" @{ code = "DT$s"; name = "DEMO Taluka"; districtId = $dist.Data.id } $a)
$v1 = Need "village 1" (Invoke-Api POST "/administration/villages" @{ code = "V1"; name = "DEMO Village 1"; talukaId = $tal.Data.id } $a)
$v2 = Need "village 2" (Invoke-Api POST "/administration/villages" @{ code = "V2"; name = "DEMO Village 2"; talukaId = $tal.Data.id } $a)
$min = Need "ministry" (Invoke-Api POST "/administration/ministries" @{ code = "DMIN$s"; name = "DEMO Ministry of Roads" } $a)
$dep = Need "department" (Invoke-Api POST "/administration/departments" @{ code = "DDEP$s"; name = "DEMO Public Works Department"; ministryId = $min.Data.id; level = "STATE" } $a)

# --- users (all scoped to the demo district) and a rule maker
$people = @(
    @{ key = "consultant"; role = "CONSULTANT" }, @{ key = "officer"; role = "SCRUTINY_OFFICER" },
    @{ key = "authority"; role = "COMPETENT_AUTHORITY" }, @{ key = "field"; role = "FIELD_OFFICER" },
    @{ key = "finance"; role = "FINANCE_OFFICER" })
$t = @{}; $names = @{}
foreach ($person in $people) {
    $name = "demo-$($person.key)-$s"
    $u = Need "create $name" (Invoke-Api POST "/administration/users" @{ username = $name; email = "$name@demo.invalid"; fullName = "DEMO $($person.key)"; password = $pw; roles = @($person.role) } $a)
    Need "scope $name" (Invoke-Api PUT "/administration/users/$($u.Data.id)/scopes" @{ scopes = @(@{ districtId = $dist.Data.id }) } $a) | Out-Null
    $t[$person.key] = (Need "login $name" (Invoke-Api POST "/auth/login" @{ username = $name; password = $pw } $null)).Data.accessToken
    $names[$person.key] = @{ user = $name; role = $person.role }
}
$rmName = "demo-rulemaker-$s"
Need "rule maker" (Invoke-Api POST "/administration/users" @{ username = $rmName; email = "$rmName@demo.invalid"; fullName = "DEMO rulemaker"; password = $pw; roles = @("CENTRAL_ADMIN") } $a) | Out-Null
$rm = (Need "rule maker login" (Invoke-Api POST "/auth/login" @{ username = $rmName; password = $pw } $null)).Data.accessToken
$names["rulemaker"] = @{ user = $rmName; role = "CENTRAL_ADMIN" }

# --- an already approved project (the live story creates a second proposal)
$proposal = @{ title = "DEMO State Highway Expansion"; projectType = "STATE_HIGHWAY"; districtId = $dist.Data.id; talukaId = $tal.Data.id; departmentId = $dep.Data.id;
    lengthKm = 60; estimatedLandAreaHa = 150; villageIds = @($v1.Data.id, $v2.Data.id); description = "DEMO: expansion of an existing state highway";
    plannedStartDate = "2027-01-01"; plannedEndDate = "2028-12-31" }
$pr = Need "proposal" (Invoke-Api POST "/projects/proposals" $proposal $t.consultant)
Need "submit" (Invoke-Api POST "/projects/proposals/$($pr.Data.id)/submit" $null $t.consultant) | Out-Null
Need "scrutiny" (Invoke-Api POST "/projects/proposals/$($pr.Data.id)/start-scrutiny" $null $t.officer) | Out-Null
Need "recommend" (Invoke-Api POST "/projects/proposals/$($pr.Data.id)/recommend" @{ reason = "DEMO: complete" } $t.officer) | Out-Null
$appr = Need "approve" (Invoke-Api POST "/projects/proposals/$($pr.Data.id)/approve" @{ reason = "DEMO: approved" } $t.authority)
$projectCode = $appr.Data.projectCode
$proj = Need "projects" (Invoke-Api GET "/projects?districtId=$($dist.Data.id)&size=50" $null $t.officer)
$projectId = (@($proj.Data.content) | Where-Object { $_.code -eq $projectCode } | Select-Object -First 1).id

# --- land records: three parcels, two owners (60/40), boundaries and the alignment
$LR = "/land-records"
$parcel = { param($village, $gat, $area, $class) @{ villageId = $village; gatNumber = $gat; areaHa = $area; classification = $class; landUse = "CULTIVATION" } }
$p1 = Need "parcel 101" (Invoke-Api POST "$LR/parcels" (& $parcel $v1.Data.id "DEMO-101" 1.25 "AGRICULTURAL_DRY") $t.field)
$p2 = Need "parcel 102" (Invoke-Api POST "$LR/parcels" (& $parcel $v2.Data.id "DEMO-102" 2.5 "AGRICULTURAL_DRY") $t.field)
$p3 = Need "parcel 103" (Invoke-Api POST "$LR/parcels" @{ villageId = $v1.Data.id; gatNumber = "DEMO-103"; areaHa = 0.5; classification = "FOREST"; landUse = "VACANT" } $t.field)
$oa = Need "owner 1" (Invoke-Api POST "$LR/landowners" @{ districtId = $dist.Data.id; ownerType = "INDIVIDUAL"; fullName = "DEMO Owner One"; phone = "+91 90000 00001" } $t.field)
$ob = Need "owner 2" (Invoke-Api POST "$LR/landowners" @{ districtId = $dist.Data.id; ownerType = "INDIVIDUAL"; fullName = "DEMO Owner Two" } $t.field)
foreach ($o in @(@($oa, 60), @($ob, 40))) {
    Need "ownership" (Invoke-Api POST "$LR/parcels/$($p1.Data.id)/ownerships" @{ landownerId = $o[0].Data.id; sharePercent = $o[1]; basis = "ORIGINAL"; fromDate = "2020-01-01" } $t.field) | Out-Null
}
$sq1 = '{"type":"Polygon","coordinates":[[[75.3430,19.8760],[75.3440,19.8760],[75.3440,19.8770],[75.3430,19.8770],[75.3430,19.8760]]]}'
$sq2 = '{"type":"Polygon","coordinates":[[[75.3445,19.8760],[75.3465,19.8760],[75.3465,19.8770],[75.3445,19.8770],[75.3445,19.8760]]]}'
$sq3 = '{"type":"Polygon","coordinates":[[[75.3436,19.8762],[75.3443,19.8762],[75.3443,19.8768],[75.3436,19.8768],[75.3436,19.8762]]]}'
$line = '{"type":"LineString","coordinates":[[75.3420,19.8765],[75.3470,19.8765]]}'
Need "boundary 101" (Invoke-RawJson PUT "/gis/parcels/$($p1.Data.id)/boundary?sourceNote=DEMO%20survey" $sq1 $t.field) | Out-Null
Need "boundary 102" (Invoke-RawJson PUT "/gis/parcels/$($p2.Data.id)/boundary?sourceNote=DEMO%20survey" $sq2 $t.field) | Out-Null
Need "alignment" (Invoke-RawJson PUT "/gis/projects/$projectId/alignment?corridorWidthM=60&sourceNote=DEMO" $line $t.field) | Out-Null

# --- compensation set-up: an approved rate and rule set; a second rate is left PENDING for the live maker-checker step
$COMP = "/compensation"
$rate = Need "rate" (Invoke-Api POST "$COMP/rates" @{ villageId = $v1.Data.id; classification = "AGRICULTURAL_DRY"; ratePerHa = 1000000; effectiveFrom = "2020-01-01"; sourceNote = "DEMO illustrative rate" } $rm)
Need "approve rate" (Invoke-Api POST "$COMP/rates/$($rate.Data.id)/approve" $null $a) | Out-Null
$rs = Need "rule set" (Invoke-Api POST "$COMP/rule-sets" @{ name = "DEMO-RULES-$s"; framework = "LARR_2013"; districtId = $dist.Data.id; effectiveFrom = "2020-01-01"; description = "DEMO illustrative rule set, not a real law";
    components = @(@{ code = "LAND"; name = "Land value"; type = "LAND_VALUE"; factor = 1.5 }, @{ code = "ASSETS"; name = "Assets"; type = "ASSET_VALUE" },
                   @{ code = "SOLATIUM"; name = "Solatium"; type = "PERCENT_OF"; factor = 100; baseCodes = @("LAND", "ASSETS") }) } $rm)
Need "approve rule set" (Invoke-Api POST "$COMP/rule-sets/$($rs.Data.id)/approve" $null $a) | Out-Null
Need "pending rate" (Invoke-Api POST "$COMP/rates" @{ villageId = $v2.Data.id; classification = "AGRICULTURAL_DRY"; ratePerHa = 900000; effectiveFrom = "2020-01-01"; sourceNote = "DEMO pending rate for live approval" } $rm) | Out-Null
Need "benefit 1" (Invoke-Api POST "$COMP/rr/benefit-types" @{ code = "DEMO_RELOC_$s"; name = "DEMO relocation grant"; kind = "ONE_TIME_CASH"; defaultAmount = 50000; requiresDisplaced = $true } $a) | Out-Null
Need "benefit 2" (Invoke-Api POST "$COMP/rr/benefit-types" @{ code = "DEMO_LIVEL_$s"; name = "DEMO livelihood allowance"; kind = "MONTHLY_ALLOWANCE"; defaultAmount = 3000; defaultMonths = 12; requiresLivelihoodLost = $true } $a) | Out-Null

# --- the acquisition case, as far as the chosen stage (V16: approval already created it)
$AQ = "/acquisition"
$caseList = Need "case lookup" (Invoke-Api GET "$AQ/cases?projectId=$projectId&size=5" $null $t.officer)
$case = [pscustomobject]@{ Data = (@($caseList.Data.content) | Select-Object -First 1) }
if (-not $case.Data) {
    $case = Need "case" (Invoke-Api POST "$AQ/cases" @{ projectId = $projectId; framework = "LARR_2013"; description = "DEMO acquisition" } $t.officer)
}
$cid = $case.Data.id
Need "villages" (Invoke-Api PUT "$AQ/cases/$cid/villages" @{ villageIds = @($v1.Data.id) } $t.officer) | Out-Null
$cp = Need "identify parcel" (Invoke-Api POST "$AQ/cases/$cid/parcels" @{ parcelId = $p1.Data.id; areaToAcquireHa = 1.0 } $t.officer)
if ($rank -ge 1) {
    $me = Need "field me" (Invoke-Api GET "/auth/me" $null $t.field)
    Need "assign surveyor" (Invoke-Api POST "$AQ/cases/$cid/parcels/$($cp.Data.id)/assign" @{ surveyorUserId = $me.Data.id } $t.officer) | Out-Null
    Need "start survey" (Invoke-Api POST "$AQ/cases/$cid/start-survey" $null $t.officer) | Out-Null
    $sv = Need "survey" (Invoke-Api POST "$AQ/cases/$cid/parcels/$($cp.Data.id)/surveys" @{ surveyedOn = $dYesterday; measuredAreaHa = 1.28; gpsLatitude = 19.8762; gpsLongitude = 75.3433; fieldNotes = "DEMO field notes" } $t.field)
    Need "verify survey" (Invoke-Api POST "$AQ/cases/$cid/surveys/$($sv.Data.id)/verify" @{ remarks = "DEMO: checked" } $t.officer) | Out-Null
    Need "complete verification" (Invoke-Api POST "$AQ/cases/$cid/complete-verification" $null $t.officer) | Out-Null
}
if ($rank -ge 2) {
    Need "notice" (Invoke-Api POST "$AQ/cases/$cid/notices" @{ noticeType = "PRELIMINARY_NOTIFICATION"; referenceNumber = "DEMO-GZ-$s"; issuedOn = $dIssued; objectionDeadline = $dDeadline } $t.officer) | Out-Null
    Need "issue" (Invoke-Api POST "$AQ/cases/$cid/issue-notification" $null $t.authority) | Out-Null
    Need "close window" (Invoke-Api POST "$AQ/cases/$cid/close-objection-window" $null $t.officer) | Out-Null
    Need "award" (Invoke-Api POST "$AQ/cases/$cid/award" @{ awardNumber = "DEMO-AW-$s"; awardDate = $dAward } $t.authority) | Out-Null
    Need "possession" (Invoke-Api POST "$AQ/cases/$cid/possessions" @{ caseParcelId = $cp.Data.id; possessionDate = $dPossession; possessionType = "PHYSICAL" } $t.officer) | Out-Null
    Need "complete possession" (Invoke-Api POST "$AQ/cases/$cid/complete-possession" $null $t.officer) | Out-Null
}

# --- sample files for the upload step
$dir = Join-Path ([Environment]::GetFolderPath("Desktop")) "LandNexus-demo-files"
New-Item -ItemType Directory -Force $dir | Out-Null
[System.IO.File]::WriteAllText((Join-Path $dir "DEMO-survey-map.pdf"), "%PDF-1.4`n% DEMO sample document - synthetic`n%%EOF`n", [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllBytes((Join-Path $dir "DEMO-fake.pdf"), [byte[]](0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00))
[System.IO.File]::WriteAllBytes((Join-Path $dir "DEMO-site-photo.png"), [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0))

Write-Host "`n================ DEMO READY (stage: $Stage) ================" -ForegroundColor Green
Write-Host "Frontend http://localhost:5173    Backend http://localhost:8080"
Write-Host "State: DEMO State $s    District: DEMO District    Project: $projectCode    Case: $($case.Data.caseNumber)"
Write-Host "`nLOGINS (one password for all, synthetic, local only: do not paste it anywhere, do not commit it)"
Write-Host "  password: $pw"
foreach ($k in @("consultant", "officer", "authority", "field", "finance", "rulemaker")) { Write-Host ("  {0,-11} {1,-28} {2}" -f $k, $names[$k].user, $names[$k].role) }
Write-Host "  admin       $AdminUser   (SUPER_ADMIN: the second person for approvals)"
Write-Host "`nSAMPLE FILES: $dir"
Write-Host "`nCHEAT SHEET (type these in the forms)"
Write-Host "  Notice: issued $dIssued, objection deadline $dDeadline, reference DEMO-GZ-$s"
Write-Host "  Objection received on $dObjection on the parcel DEMO-101, grounds 'DEMO grounds'"
Write-Host "  Award: number DEMO-AW-$s, date $dAward.  Possession: $dPossession, PHYSICAL"
Write-Host "  Survey: date $dYesterday, measured area 1.28 ha, GPS 19.8762 / 75.3433, notes 'DEMO field notes'"
Write-Host "  Asset: BUILDING 'DEMO shed', quantity 2, unit nos, unit value 50000.50     Expected estimate total: 3,200,002.00"
Write-Host "  Pending rate to approve live: Village 2, AGRICULTURAL_DRY, 900000 (entered by the rule maker, approve as admin)"
Write-Host "  GeoJSON for the forest parcel DEMO-103 (paste in its Boundary tab):"
Write-Host "  $sq3"