# LandNexus - DEMO seed with real PLACE names and illustrative projects. Parcels, owners, rates and amounts are SYNTHETIC.
# The road line and the dam axis are APPROXIMATE (drawn near the named places), not surveyed. See docs/DEMO_GUIDE.md.
param(
    [string]$BaseUrl = "http://localhost:8080/api/v1",
    [string]$AdminUser = $env:LANDNEXUS_ADMIN_USERNAME,
    [string]$AdminPassword = $env:LANDNEXUS_ADMIN_PASSWORD,
    [ValidateSet("None", "Start", "Verified", "Awarded")][string]$DamStage = "Start",
    [switch]$ApproveRoad,          # also run the road proposal to a project (for a dry run); leave off for the live story
    [string]$RoadLineFile,         # optional: a GeoJSON LineString file (bare geometry or a Feature) to replace the approximate road
    [string]$DamAxisFile           # optional: same for the dam axis
)
if (-not $AdminUser -or -not $AdminPassword) { Write-Host "Set LANDNEXUS_ADMIN_USERNAME and LANDNEXUS_ADMIN_PASSWORD."; exit 1 }
$inv = [Globalization.CultureInfo]::InvariantCulture

# ---------------------------------------------------------------- places (verify the village names against the official list)
$stateName = "Maharashtra"; $districtName = "Pune"
$roadTaluka = "Ambegaon"; $roadVillages = @("Manchar", "Dhamani", "Awasari Khurd")
$damTaluka = "Mulshi";   $damVillages = @("Mulshi", "Paud", "Tamhini")
# approximate [longitude, latitude] points near Manchar (NOT the real alignment) and across a valley in Mulshi taluka
$roadPoints = @(@(73.9120, 19.0180), @(73.9240, 19.0070), @(73.9380, 18.9990), @(73.9520, 18.9890))
$damPoints = @(@(73.5200, 18.5150), @(73.5290, 18.5180))

# ---------------------------------------------------------------- helpers
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
function F6($x) { ([double]$x).ToString("F6", $inv) }
function Get-Mpd($lat) { @{ lat = 111320.0; lon = 111320.0 * [math]::Cos($lat * [math]::PI / 180.0) } }
function Get-LineLength($pts) {
    $sum = 0.0
    for ($i = 0; $i -lt $pts.Count - 1; $i++) {
        $m = Get-Mpd $pts[$i][1]
        $dx = ($pts[$i + 1][0] - $pts[$i][0]) * $m.lon; $dy = ($pts[$i + 1][1] - $pts[$i][1]) * $m.lat
        $sum += [math]::Sqrt($dx * $dx + $dy * $dy)
    }
    return $sum
}
function Get-AlongPoints($pts, [double]$spacing, [double]$first) {
    $out = @(); $carry = $first
    for ($i = 0; $i -lt $pts.Count - 1; $i++) {
        $a = $pts[$i]; $b = $pts[$i + 1]; $m = Get-Mpd $a[1]
        $dx = ($b[0] - $a[0]) * $m.lon; $dy = ($b[1] - $a[1]) * $m.lat
        $len = [math]::Sqrt($dx * $dx + $dy * $dy)
        if ($len -le 0) { continue }
        $ux = $dx / $len; $uy = $dy / $len
        while ($carry -le $len) {
            $f = $carry / $len
            $out += [pscustomobject]@{ lon = $a[0] + ($b[0] - $a[0]) * $f; lat = $a[1] + ($b[1] - $a[1]) * $f; ux = $ux; uy = $uy }
            $carry += $spacing
        }
        $carry -= $len
    }
    return $out
}
function Get-Center($p, [double]$offset) {
    $m = Get-Mpd $p.lat
    return [pscustomobject]@{ lon = $p.lon + ($offset * (-$p.uy)) / $m.lon; lat = $p.lat + ($offset * $p.ux) / $m.lat }
}
function New-RectGeoJson($p, [double]$halfAlong, [double]$halfAcross, [double]$offset) {
    $m = Get-Mpd $p.lat
    $vx = -$p.uy; $vy = $p.ux
    $ring = foreach ($k in @(@(-1, -1), @(1, -1), @(1, 1), @(-1, 1), @(-1, -1))) {
        $dx = $offset * $vx + $k[0] * $halfAlong * $p.ux + $k[1] * $halfAcross * $vx
        $dy = $offset * $vy + $k[0] * $halfAlong * $p.uy + $k[1] * $halfAcross * $vy
        "[{0},{1}]" -f (F6 ($p.lon + $dx / $m.lon)), (F6 ($p.lat + $dy / $m.lat))
    }
    return '{"type":"Polygon","coordinates":[[' + ($ring -join ',') + ']]}'
}
function Get-LineJson($pts) {
    return '{"type":"LineString","coordinates":[' + ((@($pts) | ForEach-Object { "[{0},{1}]" -f (F6 $_[0]), (F6 $_[1]) }) -join ',') + ']}'
}
function Read-LinePoints($file) {
    $j = Get-Content -Raw $file | ConvertFrom-Json
    if ($j.type -eq "Feature") { $j = $j.geometry }
    if ($j.type -eq "MultiLineString") { return @($j.coordinates[0]) }
    if ($j.type -ne "LineString") { Write-Host "$file must hold a GeoJSON LineString" -ForegroundColor Red; exit 1 }
    return @($j.coordinates)
}
function LandUseOf($c) {
    switch ($c) { "RESIDENTIAL" { "RESIDENTIAL" } "COMMERCIAL" { "COMMERCIAL" } "FOREST" { "VACANT" } "GOVERNMENT" { "VACANT" } "WASTE_LAND" { "VACANT" } default { "CULTIVATION" } }
}

if ($RoadLineFile) { $roadPoints = Read-LinePoints $RoadLineFile }
if ($DamAxisFile) { $damPoints = Read-LinePoints $DamAxisFile }

# ---------------------------------------------------------------- login and preflight
$adm = Need "administrator login" (Invoke-Api POST "/auth/login" @{ username = $AdminUser; password = $AdminPassword } $null)
$a = $adm.Data.accessToken
if ((Invoke-Api GET "/monitoring/settings" $null $a).Status -ne "OK") { Write-Host "The running backend is an OLD build (no Module 7 routes). Stop it and start the new jar." -ForegroundColor Red; exit 1 }
$s = Get-Random -Maximum 99999
$pw = "Demo-Passw0rd-$s"
$script:ownerSeq = 0

# ---------------------------------------------------------------- master data (real public names)
Write-Host "Creating master data..."
$state = Need "state" (Invoke-Api POST "/administration/states" @{ code = "MH$s"; name = $stateName } $a)
$dist = Need "district" (Invoke-Api POST "/administration/districts" @{ code = "PN$s"; name = $districtName; stateId = $state.Data.id } $a)
$talA = Need "taluka" (Invoke-Api POST "/administration/talukas" @{ code = "AMB$s"; name = $roadTaluka; districtId = $dist.Data.id } $a)
$talD = Need "taluka" (Invoke-Api POST "/administration/talukas" @{ code = "MUL$s"; name = $damTaluka; districtId = $dist.Data.id } $a)
$rv = @(); $i = 1
foreach ($n in $roadVillages) { $rv += (Need "village $n" (Invoke-Api POST "/administration/villages" @{ code = "RV$i"; name = $n; talukaId = $talA.Data.id } $a)).Data.id; $i++ }
$dv = @(); $i = 1
foreach ($n in $damVillages) { $dv += (Need "village $n" (Invoke-Api POST "/administration/villages" @{ code = "DV$i"; name = $n; talukaId = $talD.Data.id } $a)).Data.id; $i++ }
$min = Need "ministry" (Invoke-Api POST "/administration/ministries" @{ code = "GOM$s"; name = "Government of Maharashtra (DEMO grouping)" } $a)
$depRoad = Need "department" (Invoke-Api POST "/administration/departments" @{ code = "PWD$s"; name = "Public Works Department"; ministryId = $min.Data.id; level = "STATE" } $a)
$depDam = Need "department" (Invoke-Api POST "/administration/departments" @{ code = "WRD$s"; name = "Water Resources Department"; ministryId = $min.Data.id; level = "STATE" } $a)

# ---------------------------------------------------------------- one user per role, all scoped to Pune district
Write-Host "Creating users..."
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

# ---------------------------------------------------------------- land records: synthetic parcels with owners and drawn boundaries along each line
$LR = "/land-records"
function Add-DemoParcel($point, [double]$offset, [double]$halfAlong, [double]$halfAcross, $villageId, $gat, $class, $errFactor, [int]$ownerCount, $landUse) {
    $drawn = [math]::Round(4 * $halfAlong * $halfAcross / 10000.0, 4)
    $recorded = [math]::Round($drawn * (1 + $errFactor), 4)
    if (-not $landUse) { $landUse = LandUseOf $class }
    $p = Need "parcel $gat" (Invoke-Api POST "$LR/parcels" @{ villageId = $villageId; gatNumber = $gat; areaHa = $recorded; classification = $class; landUse = $landUse } $t.field)
    $shares = switch ($ownerCount) { 1 { @(100) } 2 { @(60, 40) } default { @(50, 30, 20) } }
    foreach ($share in $shares) {
        $script:ownerSeq++
        $o = Need "owner" (Invoke-Api POST "$LR/landowners" @{ districtId = $dist.Data.id; ownerType = "INDIVIDUAL"; fullName = ("DEMO Owner {0:00}" -f $script:ownerSeq) } $t.field)
        Need "ownership" (Invoke-Api POST "$LR/parcels/$($p.Data.id)/ownerships" @{ landownerId = $o.Data.id; sharePercent = $share; basis = "ORIGINAL"; fromDate = "2015-01-01" } $t.field) | Out-Null
    }
    $b = Need "boundary $gat" (Invoke-RawJson PUT "/gis/parcels/$($p.Data.id)/boundary?sourceNote=DEMO%20survey" (New-RectGeoJson $point $halfAlong $halfAcross $offset) $t.field)
    $c = Get-Center $point $offset
    return [pscustomobject]@{ Id = $p.Data.id; Gat = $gat; Class = $class; Recorded = $recorded; Drawn = $b.Data.areaHa; Lon = $c.lon; Lat = $c.lat; VillageId = $villageId }
}

# road: 14 parcels along the line plus one that overlaps its neighbour (a boundary mistake the conflict report will find)
Write-Host "Creating road parcels (about 1 minute)..."
$roadLen = Get-LineLength $roadPoints
$spacing = [math]::Max(190.0, $roadLen / 15.0)
$rp = @(Get-AlongPoints $roadPoints $spacing ($spacing / 2.0)) | Select-Object -First 14
$rClass = @("AGRICULTURAL_IRRIGATED", "AGRICULTURAL_DRY", "AGRICULTURAL_DRY", "AGRICULTURAL_IRRIGATED", "AGRICULTURAL_DRY", "RESIDENTIAL", "AGRICULTURAL_DRY", "GOVERNMENT", "AGRICULTURAL_DRY", "FOREST", "AGRICULTURAL_IRRIGATED", "AGRICULTURAL_DRY", "COMMERCIAL", "AGRICULTURAL_DRY")
$rOff = @(0, 40, -40, 0, 140, -40, 40, 0, 0, -40, 140, 40, 0, -40)
$rErr = @(0.02, 0.03, -0.04, 0.25, 0.0, 0.05, 0.0, -0.02, 0.01, 0.0, 0.03, -0.03, 0.0, 0.02)
$rOwn = @(2, 1, 3, 2, 1, 1, 2, 1, 2, 1, 3, 1, 1, 2)
$roadParcels = @()
for ($k = 0; $k -lt $rp.Count; $k++) {
    $vi = [math]::Min(2, [int][math]::Floor($k * 3 / $rp.Count))
    $roadParcels += Add-DemoParcel $rp[$k] $rOff[$k] 80 60 $rv[$vi] ("DEMO-R-{0}" -f (101 + $k)) $rClass[$k] $rErr[$k] $rOwn[$k] $null
}
if ($rp.Count -gt 6) {
    $m = Get-Mpd $rp[6].lat
    $shifted = [pscustomobject]@{ lon = $rp[6].lon + 100 * $rp[6].ux / $m.lon; lat = $rp[6].lat + 100 * $rp[6].uy / $m.lat; ux = $rp[6].ux; uy = $rp[6].uy }
    $roadParcels += Add-DemoParcel $shifted 0 80 60 $rv[1] "DEMO-R-199" "AGRICULTURAL_DRY" 0.0 1 $null
}

# dam: 12 parcels on both banks and the stream bed, with forest, government land, waste land and a water body
Write-Host "Creating dam parcels (about 1 minute)..."
$damLen = Get-LineLength $damPoints
$dSpacing = $damLen / 4.0
$dp = @(Get-AlongPoints $damPoints $dSpacing ($dSpacing / 2.0)) | Select-Object -First 4
$dClass = @("AGRICULTURAL_DRY", "GOVERNMENT", "FOREST", "AGRICULTURAL_DRY", "WASTE_LAND", "AGRICULTURAL_DRY", "AGRICULTURAL_DRY", "OTHER", "AGRICULTURAL_DRY", "AGRICULTURAL_DRY", "WASTE_LAND", "FOREST")
$dUse = @($null, $null, $null, $null, $null, $null, $null, "WATER_BODY", $null, $null, $null, $null)
$dOwn = @(2, 1, 1, 2, 1, 2, 3, 1, 2, 1, 1, 1)
$rows = @(-230, 0, 230); $rowVillage = @($dv[0], $dv[1], $dv[2])
$damParcels = @(); $n = 0
for ($k = 0; $k -lt $dp.Count; $k++) {
    for ($r = 0; $r -lt 3; $r++) {
        $damParcels += Add-DemoParcel $dp[$k] $rows[$r] 100 100 $rowVillage[$r] ("DEMO-D-{0}" -f (201 + $n)) $dClass[$n] 0.0 $dOwn[$n] $dUse[$n]
        $n++
    }
}

# ---------------------------------------------------------------- compensation set-up: approved rates, an approved rule set, one pending rate and R&R benefits
Write-Host "Creating DEMO rates and rules..."
$COMP = "/compensation"
foreach ($vid in ($rv + $dv)) {
    foreach ($cls in @("AGRICULTURAL_DRY", "AGRICULTURAL_IRRIGATED")) {
        $rate = Need "rate" (Invoke-Api POST "$COMP/rates" @{ villageId = $vid; classification = $cls; ratePerHa = $(if ($cls -eq "AGRICULTURAL_DRY") { 1000000 } else { 1400000 }); effectiveFrom = "2020-01-01"; sourceNote = "DEMO illustrative rate" } $rm)
        Need "approve rate" (Invoke-Api POST "$COMP/rates/$($rate.Data.id)/approve" $null $a) | Out-Null
    }
}
$rs = Need "rule set" (Invoke-Api POST "$COMP/rule-sets" @{ name = "DEMO-RULES-$s"; framework = "LARR_2013"; districtId = $dist.Data.id; effectiveFrom = "2020-01-01"; description = "DEMO illustrative rule set, not a real law";
    components = @(@{ code = "LAND"; name = "Land value"; type = "LAND_VALUE"; factor = 1.5 }, @{ code = "ASSETS"; name = "Assets"; type = "ASSET_VALUE" },
                   @{ code = "SOLATIUM"; name = "Solatium"; type = "PERCENT_OF"; factor = 100; baseCodes = @("LAND", "ASSETS") }) } $rm)
Need "approve rule set" (Invoke-Api POST "$COMP/rule-sets/$($rs.Data.id)/approve" $null $a) | Out-Null
Need "pending rate" (Invoke-Api POST "$COMP/rates" @{ villageId = $rv[0]; classification = "AGRICULTURAL_DRY"; ratePerHa = 1150000; effectiveFrom = "2024-04-01"; sourceNote = "DEMO new-year rate, left PENDING for the live approval" } $rm) | Out-Null
Need "benefit 1" (Invoke-Api POST "$COMP/rr/benefit-types" @{ code = "DEMO_RELOC_$s"; name = "DEMO relocation grant"; kind = "ONE_TIME_CASH"; defaultAmount = 50000; requiresDisplaced = $true } $a) | Out-Null
Need "benefit 2" (Invoke-Api POST "$COMP/rr/benefit-types" @{ code = "DEMO_LIVEL_$s"; name = "DEMO livelihood allowance"; kind = "MONTHLY_ALLOWANCE"; defaultAmount = 3000; defaultMonths = 12; requiresLivelihoodLost = $true } $a) | Out-Null

# ---------------------------------------------------------------- proposal -> project helper

function Approve-Proposal($body, $types) {
    $prop = $null

    foreach ($withLength in @($false, $true)) {
        foreach ($type in $types) {
            $b = $body.Clone()
            $b.projectType = $type

            if ($withLength -and -not $b.ContainsKey("lengthKm")) {
                $b.lengthKm = 1
            }

            $r = Invoke-Api POST "/projects/proposals" $b $t.consultant

            if ($r.Status -eq "OK") {
                $prop = $r
                Write-Host "    project type accepted: $type"
                break
            }

            $script:lastError = $r.Data
        }

        if ($prop) { break }
    }

    if (-not $prop) {
        Write-Host "SEED FAILED: no project type was accepted. Last answer: $script:lastError" -ForegroundColor Red
        exit 1
    }

    # FIX: Do not use $pid (reserved PowerShell variable).
    $projectId = $prop.Data.id

    Need "submit" (Invoke-Api POST "/projects/proposals/$projectId/submit" $null $t.consultant) | Out-Null

    Need "start scrutiny" (Invoke-Api POST "/projects/proposals/$projectId/start-scrutiny" $null $t.officer) | Out-Null

    Need "recommend" (Invoke-Api POST "/projects/proposals/$projectId/recommend" @{ reason = "DEMO: complete" } $t.officer) | Out-Null

    $ap = Need "approve" (Invoke-Api POST "/projects/proposals/$projectId/approve" @{ reason = "DEMO: approved" } $t.authority)

    $list = Need "projects" (Invoke-Api GET "/projects?districtId=$($dist.Data.id)&size=50" $null $t.officer)

    $proj = @($list.Data.content) |
        Where-Object { $_.code -eq $ap.Data.projectCode } |
        Select-Object -First 1

    if (-not $proj) {
        Write-Host "SEED FAILED: approved project not found in project listing." -ForegroundColor Red
        exit 1
    }

    return [pscustomobject]@{
        Code = $ap.Data.projectCode
        Id = $proj.id
    }
}

$roadProposalBody = @{ title = "DEMO Manchar Bypass, four-laning (illustrative)"; districtId = $dist.Data.id; talukaId = $talA.Data.id; departmentId = $depRoad.Data.id;
    lengthKm = [math]::Round($roadLen / 1000.0, 1); estimatedLandAreaHa = 45; villageIds = $rv;
    description = "DEMO: widening of a highway bypass near Manchar. Illustrative scenario, not an official project."; plannedStartDate = "2027-02-01"; plannedEndDate = "2029-01-31" }
$roadProject = $null
if ($ApproveRoad) {
    Write-Host "Running the road proposal to a project..."
    $roadProject = Approve-Proposal $roadProposalBody @("STATE_HIGHWAY")
    Need "road alignment" (Invoke-RawJson PUT "/gis/projects/$($roadProject.Id)/alignment?corridorWidthM=60&sourceNote=DEMO%20approximate" (Get-LineJson $roadPoints) $t.field) | Out-Null
}

# ---------------------------------------------------------------- the dam: an approved project with its axis and an acquisition case at the chosen stage
Write-Host "Creating the dam project..."
$damProposalBody = @{ title = "DEMO Valley Dam, Mulshi taluka (illustrative)"; districtId = $dist.Data.id; talukaId = $talD.Data.id; departmentId = $depDam.Data.id;
    estimatedLandAreaHa = 85; villageIds = $dv; description = "DEMO: a fictional minor dam at a real location. Illustrative scenario, not an official project.";
    plannedStartDate = "2027-03-01"; plannedEndDate = "2030-03-31" }
$damProject = Approve-Proposal $damProposalBody @("DAM", "IRRIGATION", "IRRIGATION_PROJECT", "WATER_SUPPLY", "OTHER")
Need "dam axis" (Invoke-RawJson PUT "/gis/projects/$($damProject.Id)/alignment?corridorWidthM=400&sourceNote=DEMO%20approximate%20dam%20axis" (Get-LineJson $damPoints) $t.field) | Out-Null

$damCase = $null
if ($DamStage -ne "None") {
    Write-Host "Creating the dam acquisition case ($DamStage)..."
    $AQ = "/acquisition"
    $rank = @{ Start = 0; Verified = 1; Awarded = 2 }[$DamStage]
    $pick = @($damParcels | Where-Object { $_.VillageId -eq $dv[0] -and $_.Class -eq "AGRICULTURAL_DRY" } | Select-Object -First 2)
    # V16: the approval already created exactly one case for this project, so reuse it.
    $caseList = Need "case lookup" (Invoke-Api GET "$AQ/cases?projectId=$($damProject.Id)&size=5" $null $t.officer)
    $damCase = [pscustomobject]@{ Data = (@($caseList.Data.content) | Select-Object -First 1) }
    if (-not $damCase.Data) {
        $damCase = Need "case" (Invoke-Api POST "$AQ/cases" @{ projectId = $damProject.Id; framework = "LARR_2013"; description = "DEMO dam acquisition" } $t.officer)
    }
    $cid = $damCase.Data.id
    Need "villages" (Invoke-Api PUT "$AQ/cases/$cid/villages" @{ villageIds = @($dv[0]) } $t.officer) | Out-Null
    $cps = @()
    foreach ($pc in $pick) {
        $cps += [pscustomobject]@{ cp = (Need "identify $($pc.Gat)" (Invoke-Api POST "$AQ/cases/$cid/parcels" @{ parcelId = $pc.Id; areaToAcquireHa = [math]::Round($pc.Recorded * 0.9, 4) } $t.officer)); parcel = $pc }
    }
    if ($rank -ge 1) {
        $me = Need "field me" (Invoke-Api GET "/auth/me" $null $t.field)
        foreach ($x in $cps) { Need "assign" (Invoke-Api POST "$AQ/cases/$cid/parcels/$($x.cp.Data.id)/assign" @{ surveyorUserId = $me.Data.id } $t.officer) | Out-Null }
        Need "start survey" (Invoke-Api POST "$AQ/cases/$cid/start-survey" $null $t.officer) | Out-Null
        foreach ($x in $cps) {
            $sv = Need "survey" (Invoke-Api POST "$AQ/cases/$cid/parcels/$($x.cp.Data.id)/surveys" @{ surveyedOn = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd"); measuredAreaHa = [math]::Round($x.parcel.Recorded * 1.03, 4);
                gpsLatitude = [math]::Round($x.parcel.Lat, 6); gpsLongitude = [math]::Round($x.parcel.Lon, 6); fieldNotes = "DEMO field notes" } $t.field)
            Need "verify survey" (Invoke-Api POST "$AQ/cases/$cid/surveys/$($sv.Data.id)/verify" @{ remarks = "DEMO: checked" } $t.officer) | Out-Null
        }
        Need "complete verification" (Invoke-Api POST "$AQ/cases/$cid/complete-verification" $null $t.officer) | Out-Null
    }
    if ($rank -ge 2) {
        Need "notice" (Invoke-Api POST "$AQ/cases/$cid/notices" @{ noticeType = "PRELIMINARY_NOTIFICATION"; referenceNumber = "DEMO-GZ-$s"; issuedOn = (Get-Date).AddDays(-60).ToString("yyyy-MM-dd"); objectionDeadline = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd") } $t.officer) | Out-Null
        Need "issue" (Invoke-Api POST "$AQ/cases/$cid/issue-notification" $null $t.authority) | Out-Null
        Need "close window" (Invoke-Api POST "$AQ/cases/$cid/close-objection-window" $null $t.officer) | Out-Null
        Need "award" (Invoke-Api POST "$AQ/cases/$cid/award" @{ awardNumber = "DEMO-AW-$s"; awardDate = (Get-Date).AddDays(-10).ToString("yyyy-MM-dd") } $t.authority) | Out-Null
        foreach ($x in $cps) { Need "possession" (Invoke-Api POST "$AQ/cases/$cid/possessions" @{ caseParcelId = $x.cp.Data.id; possessionDate = (Get-Date).AddDays(-5).ToString("yyyy-MM-dd"); possessionType = "PHYSICAL" } $t.officer) | Out-Null }
        Need "complete possession" (Invoke-Api POST "$AQ/cases/$cid/complete-possession" $null $t.officer) | Out-Null
    }
}

# ---------------------------------------------------------------- files for the presenter (no passwords in them)
$dir = Join-Path ([Environment]::GetFolderPath("Desktop")) "LandNexus-demo-files"
New-Item -ItemType Directory -Force $dir | Out-Null
[System.IO.File]::WriteAllText((Join-Path $dir "DEMO-survey-map.pdf"), "%PDF-1.4`n% DEMO sample document - synthetic`n%%EOF`n", [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllBytes((Join-Path $dir "DEMO-fake.pdf"), [byte[]](0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00))
[System.IO.File]::WriteAllBytes((Join-Path $dir "DEMO-site-photo.png"), [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0))
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $dir "road-alignment.geojson"), (Get-LineJson $roadPoints), $utf8)
[System.IO.File]::WriteAllText((Join-Path $dir "dam-axis.geojson"), (Get-LineJson $damPoints), $utf8)
$sheet = @"
LANDNEXUS DEMO CHEAT SHEET (synthetic data; geometry is approximate, not surveyed)
State/district: $stateName / $districtName
ROAD proposal to submit LIVE
  Title: DEMO Manchar Bypass, four-laning (illustrative)    Type: State Highway    Taluka: $roadTaluka
  Villages: $($roadVillages -join ', ')    Length (km): $([math]::Round($roadLen / 1000.0, 1))    Land (ha): 45
  Department: Public Works Department    Dates: 2027-02-01 to 2029-01-31
  After approval, paste the file road-alignment.geojson in the project's Alignment panel, corridor width 60 m.
DAM (already approved): $($damProject.Code)  Case: $(if ($damCase) { $damCase.Data.caseNumber } else { "none" })  Stage: $DamStage
Survey values: date yesterday, measured area = recorded x 1.03, notes 'DEMO field notes'
Notice: issued 60 days ago, objection deadline 30 days ago, reference DEMO-GZ-$s
Award: DEMO-AW-$s dated 10 days ago. Possession: 5 days ago, PHYSICAL.
Asset: BUILDING 'DEMO shed', quantity 2, unit nos, unit value 50000.50
Pending rate to approve live (as admin): $($roadVillages[0]), AGRICULTURAL_DRY, 1150000 from 2024-04-01
"@
[System.IO.File]::WriteAllText((Join-Path $dir "cheat-sheet.txt"), $sheet, $utf8)

# ---------------------------------------------------------------- summary
Write-Host "`n================ DEMO READY ================" -ForegroundColor Green
Write-Host "Frontend http://localhost:5173    Backend http://localhost:8080"
Write-Host "Road parcels: $($roadParcels.Count) (DEMO-R-*, one overlapping on purpose)    Dam parcels: $($damParcels.Count) (DEMO-D-*)"
Write-Host "Dam project: $($damProject.Code)    Dam case: $(if ($damCase) { $damCase.Data.caseNumber } else { 'none' }) ($DamStage)"
Write-Host "Road project: $(if ($roadProject) { $roadProject.Code } else { 'NOT created yet: submit the proposal live' })"
Write-Host "`nLOGINS (one password for all, synthetic, local only: do not paste it anywhere, do not commit it)"
Write-Host "  password: $pw"
foreach ($k in @("consultant", "officer", "authority", "field", "finance", "rulemaker")) { Write-Host ("  {0,-11} {1,-30} {2}" -f $k, $names[$k].user, $names[$k].role) }
Write-Host "  admin       $AdminUser   (SUPER_ADMIN: the second person for approvals)"
Write-Host "`nFILES for the presenter: $dir  (road-alignment.geojson, dam-axis.geojson, cheat-sheet.txt, sample PDF and photo)"