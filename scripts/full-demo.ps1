# LandNexus - end-to-end DEMO of Modules 1 to 7. ALL DATA IS SYNTHETIC AND LABELLED "DEMO".
# Needs: the backend built from the CURRENT code running on :8080, LANDNEXUS_ADMIN_USERNAME / LANDNEXUS_ADMIN_PASSWORD, curl.exe (Windows 10+).
# Audit and history rows are append-only by design, so a re-run leaves earlier DEMO rows behind (names carry a random suffix).
param(
    [string]$BaseUrl = "http://localhost:8080/api/v1",
    [string]$AdminUser = $env:LANDNEXUS_ADMIN_USERNAME,
    [string]$AdminPassword = $env:LANDNEXUS_ADMIN_PASSWORD,
    [switch]$ShowCredentials
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

# For GeoJSON: the body is sent exactly as written (no re-serialising).
function Invoke-RawJson {
    param([string]$Method, [string]$Path, [string]$Json, [string]$Token)
    try {
        $rp = @{ Method = $Method; Uri = "$BaseUrl$Path"; ContentType = "application/json"; Body = $Json; Headers = @{ Authorization = "Bearer $Token" } }
        return @{ Status = "OK"; Data = (Invoke-RestMethod @rp) }
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

# Tokens last 15 minutes: take new ones for every demo user and the administrator.
function Update-Tokens {
    foreach ($k in @($t.Keys)) {
        $l = Invoke-Api POST "/auth/login" @{ username = "demo-$k-$s"; password = $pw } $null
        if ($l.Status -ne "OK") { Write-Host "Could not log in again as demo-$k-$s"; exit 1 }
        $t[$k] = $l.Data.accessToken
    }
    $al = Invoke-Api POST "/auth/login" @{ username = $AdminUser; password = $AdminPassword } $null
    if ($al.Status -ne "OK") { Write-Host "Could not log in again as the administrator"; exit 1 }
    $script:a = $al.Data.accessToken
}

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

# Preflight: the running backend must be built from the current code (Modules 6 and 7 present).
$pre = Invoke-Api GET "/monitoring/settings" $null $a
if ($pre.Status -ne "OK") {
    Write-Host "`nThe running backend does not know the Module 6/7 routes (got $($pre.Status))." -ForegroundColor Red
    Write-Host "It is probably an OLD process on port 8080. Stop it, run '.\mvnw.cmd clean verify -DskipTests' and start the new jar, then run this script again." -ForegroundColor Red
    exit 1
}

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
foreach ($person in $people) {
    $name = "demo-$($person.key)-$s"
    $u = Invoke-Api POST "/administration/users" @{ username = $name; email = "$name@demo.invalid"; fullName = "DEMO $($person.key)"; password = $pw; roles = @($person.role) } $a
    $sc = Invoke-Api PUT "/administration/users/$($u.Data.id)/scopes" @{ scopes = @(@{ districtId = $dist.Data.id }) } $a
    $l = Invoke-Api POST "/auth/login" @{ username = $name; password = $pw } $null
    Check "$($person.role) user created, scoped and logged in" "OK" $l
    $t[$person.key] = $l.Data.accessToken
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
$projectCode = $r.Data.projectCode
Write-Host "    PROJECT CREATED: $projectCode"
$hist = Invoke-Api GET "/projects/proposals/$id/history" $null $t.officer
Write-Host "    history: $((@($hist.Data) | ForEach-Object { $_.action }) -join ' > ')"

# ---------------------------------------------------------------- Module 3: land records
Step "Module 3 - parcels in the project's villages (Gat numbers are DEMO)"
$LR = "/land-records"
$parcel = { param($village, $gat, $area) @{ villageId = $village; gatNumber = $gat; areaHa = $area; classification = "AGRICULTURAL_DRY"; landUse = "CULTIVATION" } }
$parcel1 = Invoke-Api POST "$LR/parcels" (& $parcel $v1.Data.id "DEMO-101" 1.25) $t.field
$parcel2 = Invoke-Api POST "$LR/parcels" (& $parcel $v2.Data.id "DEMO-102" 2.5) $t.field
Check "Field officer creates parcel DEMO-101" "OK" $parcel1
Check "Field officer creates parcel DEMO-102" "OK" $parcel2
Check "The same Gat number again is refused" 409 (Invoke-Api POST "$LR/parcels" (& $parcel $v1.Data.id "demo-101" 3) $t.field)
Check "A consultant cannot create parcels" 403 (Invoke-Api POST "$LR/parcels" (& $parcel $v1.Data.id "DEMO-999" 3) $t.consultant)
$pid1 = $parcel1.Data.id

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

# ---------------------------------------------------------------- Module 4: acquisition
Step "Module 4 - acquisition case from the approved project (all DEMO)"
$proj = Invoke-Api GET "/projects?districtId=$($dist.Data.id)&size=50" $null $t.officer
$projectId = (@($proj.Data.content) | Where-Object { $_.code -eq $projectCode } | Select-Object -First 1).id
Assert "The approved project is found ($projectCode)" ($null -ne $projectId)
$AQ = "/acquisition"
$case = Invoke-Api POST "$AQ/cases" @{ projectId = $projectId; framework = "LARR_2013"; description = "DEMO acquisition" } $t.officer
Check "Scrutiny officer opens an acquisition case" "OK" $case
Check "A field officer cannot open a case" 403 (Invoke-Api POST "$AQ/cases" @{ projectId = $projectId; framework = "LARR_2013" } $t.field)
$cid = $case.Data.id
Write-Host "    case number: $($case.Data.caseNumber)"
Check "Affected village chosen from the project's villages" "OK" (Invoke-Api PUT "$AQ/cases/$cid/villages" @{ villageIds = @($v1.Data.id) } $t.officer)
$cp = Invoke-Api POST "$AQ/cases/$cid/parcels" @{ parcelId = $pid1; areaToAcquireHa = 1.0 } $t.officer
Check "Parcel DEMO-101 identified (owners snapshotted)" "OK" $cp
Write-Host "    owners in the snapshot: $(@($cp.Data.owners).Count)"
$case2 = Invoke-Api POST "$AQ/cases" @{ projectId = $projectId; framework = "LARR_2013" } $t.officer
Invoke-Api PUT "$AQ/cases/$($case2.Data.id)/villages" @{ villageIds = @($v1.Data.id) } $t.officer | Out-Null
Check "The same parcel cannot join a second open case" 409 (Invoke-Api POST "$AQ/cases/$($case2.Data.id)/parcels" @{ parcelId = $pid1; areaToAcquireHa = 0.5 } $t.officer)
$me = Invoke-Api GET "/auth/me" $null $t.field
Check "Surveyor assigned" "OK" (Invoke-Api POST "$AQ/cases/$cid/parcels/$($cp.Data.id)/assign" @{ surveyorUserId = $me.Data.id } $t.officer)
Check "Survey started" "OK" (Invoke-Api POST "$AQ/cases/$cid/start-survey" $null $t.officer)
$sv = Invoke-Api POST "$AQ/cases/$cid/parcels/$($cp.Data.id)/surveys" @{ surveyedOn = (Get-Date).ToString("yyyy-MM-dd"); measuredAreaHa = 1.28; gpsLatitude = 19.8762; gpsLongitude = 75.3433; fieldNotes = "DEMO field notes" } $t.field
Check "Field officer records the survey (GPS, measured area)" "OK" $sv
Write-Host "    variance against the record: $($sv.Data.variancePercent)%"
$png = Join-Path $work "DEMO-site.png"
[System.IO.File]::WriteAllBytes($png, [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0))
$ph = Invoke-Upload "$AQ/cases/$cid/surveys/$($sv.Data.id)/photos" $png "image/png" @{ latitude = "19.8762"; longitude = "75.3433" } $t.field
Check "Geo-tagged photo uploaded" "OK" $ph
Check "A fake photo (.exe) is rejected" 400 (Invoke-Upload "$AQ/cases/$cid/surveys/$($sv.Data.id)/photos" $fake "image/png" @{ latitude = "19.8762"; longitude = "75.3433" } $t.field)
Check "The surveyor cannot verify their own survey" 403 (Invoke-Api POST "$AQ/cases/$cid/surveys/$($sv.Data.id)/verify" $null $t.field)
Check "Scrutiny officer verifies the survey" "OK" (Invoke-Api POST "$AQ/cases/$cid/surveys/$($sv.Data.id)/verify" @{ remarks = "DEMO: checked" } $t.officer)
Check "Verification complete" "OK" (Invoke-Api POST "$AQ/cases/$cid/complete-verification" $null $t.officer)
$vrep = Invoke-Api GET "$AQ/cases/$cid/verification-report" $null $t.finance
Write-Host "    report: $($vrep.Data.verified) of $($vrep.Data.totalParcels) parcels verified, area to acquire $($vrep.Data.totalAreaToAcquireHa) ha"

Step "Module 4 - legal notice, objection period, award, possession"
$issued = (Get-Date).AddDays(-60).ToString("yyyy-MM-dd"); $deadline = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
Check "Preliminary notification recorded (DEMO, already published)" "OK" (Invoke-Api POST "$AQ/cases/$cid/notices" @{ noticeType = "PRELIMINARY_NOTIFICATION"; referenceNumber = "DEMO-GZ-$s"; issuedOn = $issued; objectionDeadline = $deadline } $t.officer)
Check "Competent authority issues the notification" "OK" (Invoke-Api POST "$AQ/cases/$cid/issue-notification" $null $t.authority)
$obj = Invoke-Api POST "$AQ/cases/$cid/objections" @{ caseParcelId = $cp.Data.id; receivedOn = (Get-Date).AddDays(-45).ToString("yyyy-MM-dd"); grounds = "DEMO grounds"; objectorReference = "DEMO objector" } $t.officer
Check "An objection is registered inside the period" "OK" $obj
Check "The objection window cannot close while an objection is open" 400 (Invoke-Api POST "$AQ/cases/$cid/close-objection-window" $null $t.officer)
Check "The registrar cannot decide their own objection" 403 (Invoke-Api POST "$AQ/cases/$cid/objections/$($obj.Data.id)/decide" @{ outcome = "DISMISSED"; remarks = "x" } $t.officer)
Check "Competent authority dismisses it" "OK" (Invoke-Api POST "$AQ/cases/$cid/objections/$($obj.Data.id)/decide" @{ outcome = "DISMISSED"; remarks = "DEMO: no merit" } $t.authority)
Check "Objection window closed" "OK" (Invoke-Api POST "$AQ/cases/$cid/close-objection-window" $null $t.officer)
$aw = Invoke-Api POST "$AQ/cases/$cid/award" @{ awardNumber = "DEMO-AW-$s"; awardDate = (Get-Date).AddDays(-10).ToString("yyyy-MM-dd") } $t.authority
Check "Award declared" "OK" $aw
Check "Possession cannot be completed without records" 400 (Invoke-Api POST "$AQ/cases/$cid/complete-possession" $null $t.officer)
Check "Possession recorded" "OK" (Invoke-Api POST "$AQ/cases/$cid/possessions" @{ caseParcelId = $cp.Data.id; possessionDate = (Get-Date).AddDays(-5).ToString("yyyy-MM-dd"); possessionType = "PHYSICAL" } $t.officer)
Check "Possession completed" "OK" (Invoke-Api POST "$AQ/cases/$cid/complete-possession" $null $t.officer)

# ---------------------------------------------------------------- Module 5: valuation, compensation, simulated payments, R&R
Step "Module 5 - people: a rule maker (CENTRAL_ADMIN); the bootstrap SUPER_ADMIN is the second person who approves"
Update-Tokens
$COMP = "/compensation"
$rmName = "demo-rulemaker-$s"
$rmUser = Invoke-Api POST "/administration/users" @{ username = $rmName; email = "$rmName@demo.invalid"; fullName = "DEMO rule maker"; password = $pw; roles = @("CENTRAL_ADMIN") } $a
Check "A CENTRAL_ADMIN user is created" "OK" $rmUser
$rmLogin = Invoke-Api POST "/auth/login" @{ username = $rmName; password = $pw } $null
Check "Rule maker logs in" "OK" $rmLogin
$rm = $rmLogin.Data.accessToken

Step "Module 5 - market value rate and rule set (DEMO numbers: illustrative, NOT any real law or state rule)"
$rate = Invoke-Api POST "$COMP/rates" @{ villageId = $v1.Data.id; classification = "AGRICULTURAL_DRY"; ratePerHa = 1000000; effectiveFrom = "2020-01-01"; sourceNote = "DEMO illustrative rate" } $rm
Check "Rule maker enters a market value rate" "OK" $rate
Check "The rate's maker cannot approve it" 403 (Invoke-Api POST "$COMP/rates/$($rate.Data.id)/approve" $null $rm)
Check "A second person (SUPER_ADMIN) approves the rate" "OK" (Invoke-Api POST "$COMP/rates/$($rate.Data.id)/approve" $null $a)
$rs = Invoke-Api POST "$COMP/rule-sets" @{ name = "DEMO-RULES-$s"; framework = "LARR_2013"; districtId = $dist.Data.id; effectiveFrom = "2020-01-01"; description = "DEMO illustrative rule set, not a real law";
    components = @(
        @{ code = "LAND"; name = "Land value"; type = "LAND_VALUE"; factor = 1.5 },
        @{ code = "ASSETS"; name = "Assets"; type = "ASSET_VALUE" },
        @{ code = "SOLATIUM"; name = "Solatium"; type = "PERCENT_OF"; factor = 100; baseCodes = @("LAND", "ASSETS") }) } $rm
Check "Rule maker drafts a versioned rule set" "OK" $rs
Check "A multiplier of 11 is refused" 400 (Invoke-Api POST "$COMP/rule-sets" @{ name = "DEMO-BAD-$s"; framework = "LARR_2013"; effectiveFrom = "2020-01-01";
    components = @(@{ code = "LAND"; name = "Land"; type = "LAND_VALUE"; factor = 11 }) } $rm)
Check "The drafter cannot approve the rule set" 403 (Invoke-Api POST "$COMP/rule-sets/$($rs.Data.id)/approve" $null $rm)
Check "A second person approves the rule set" "OK" (Invoke-Api POST "$COMP/rule-sets/$($rs.Data.id)/approve" $null $a)

Step "Module 5 - assets and the compensation estimate (reproducible, explained line by line)"
$asset = Invoke-Api POST "$COMP/cases/$cid/parcels/$($cp.Data.id)/assets" @{ category = "BUILDING"; description = "DEMO shed"; quantity = 2; unit = "nos"; unitValue = 50000.50 } $t.officer
Check "Scrutiny officer records an asset" "OK" $asset
Check "A field officer cannot record assets" 403 (Invoke-Api POST "$COMP/cases/$cid/parcels/$($cp.Data.id)/assets" @{ category = "TREE"; description = "x"; quantity = 1; unit = "nos"; unitValue = 1 } $t.field)
Check "Finance cannot compute estimates" 403 (Invoke-Api POST "$COMP/cases/$cid/parcels/$($cp.Data.id)/valuations" $null $t.finance)
$val = Invoke-Api POST "$COMP/cases/$cid/parcels/$($cp.Data.id)/valuations" $null $t.officer
Check "Scrutiny officer computes the estimate" "OK" $val
Write-Host "    rules used: $($val.Data.ruleSetName) v$($val.Data.ruleSetVersion), reference date $($val.Data.referenceDate), rate $($val.Data.ratePerHa) per ha, area $($val.Data.awardedAreaHa) ha"
foreach ($l in @($val.Data.lines)) { Write-Host ("      {0,-9} {1,15:N2}   {2}" -f $l.code, $l.amount, $l.basis) }
Write-Host ("      TOTAL     {0:N2}" -f $val.Data.totalAmount)
Assert "The total is exactly 3,200,002.00 (1.5 x 1,000,000 + 100,001 + 100% solatium)" ([math]::Round([decimal]$val.Data.totalAmount, 2) -eq 3200002)
$again = Invoke-Api POST "$COMP/cases/$cid/parcels/$($cp.Data.id)/valuations" $null $t.officer
Check "Recomputing gives version 2 (the old one is kept as history)" "OK" $again
Assert "...with exactly the same total (reproducible)" ([math]::Round([decimal]$again.Data.totalAmount, 2) -eq 3200002 -and $again.Data.versionNo -eq 2)
$vid = $again.Data.id
Check "Scrutiny officer submits the estimate" "OK" (Invoke-Api POST "$COMP/valuations/$vid/submit" $null $t.officer)
Check "A submitted estimate is frozen (no recompute)" 409 (Invoke-Api POST "$COMP/cases/$cid/parcels/$($cp.Data.id)/valuations" $null $t.officer)
Check "The preparer cannot approve it" 403 (Invoke-Api POST "$COMP/valuations/$vid/approve" $null $t.officer)
Check "Competent authority approves it" "OK" (Invoke-Api POST "$COMP/valuations/$vid/approve" @{ remarks = "DEMO: checked" } $t.authority)
$csum = Invoke-Api GET "$COMP/cases/$cid/compensation-summary" $null $t.finance
Write-Host ("    approved compensation of the case: {0:N2} ({1} of {2} parcels approved)" -f $csum.Data.approvedTotal, $csum.Data.approved, $csum.Data.parcels)

Step "Module 5 - payments (ALWAYS SIMULATED: nothing real is paid, no bank details exist in the system)"
Check "A scrutiny officer cannot generate payments" 403 (Invoke-Api POST "$COMP/valuations/$vid/payments" $null $t.officer)
$pay = Invoke-Api POST "$COMP/valuations/$vid/payments" $null $t.finance
Check "Finance officer generates one payment per owner (60% / 40%)" "OK" $pay
foreach ($x in @($pay.Data)) { Write-Host ("      share {0,5}%  amount {1,15:N2}  status {2}  mode {3}" -f $x.sharePercent, $x.amount, $x.status, $x.mode) }
$sumOfParts = [math]::Round([decimal](@($pay.Data) | Measure-Object -Property amount -Sum).Sum, 2)
Assert "The two payments add up to the approved total exactly" ($sumOfParts -eq 3200002)
Assert "Every payment says SIMULATED" ((@($pay.Data) | Where-Object { $_.mode -ne "SIMULATED" }).Count -eq 0)
Check "Payments cannot be generated twice" 409 (Invoke-Api POST "$COMP/valuations/$vid/payments" $null $t.finance)
$pay1 = @($pay.Data)[0].id; $pay2 = @($pay.Data)[1].id
Check "The estimate's approver cannot release payments" 403 (Invoke-Api POST "$COMP/payments/$pay1/release" $null $t.authority)
$sent = Invoke-Api POST "$COMP/payments/$pay1/release" $null $t.finance
Check "Finance releases payment 1 (simulated)" "OK" $sent
Write-Host "    reference: $($sent.Data.reference)"
Check "A failed answer needs a reason" 400 (Invoke-Api POST "$COMP/payments/$pay1/simulate-response" @{ outcome = "FAILED" } $t.finance)
Check "Simulated answer: payment 1 FAILED" "OK" (Invoke-Api POST "$COMP/payments/$pay1/simulate-response" @{ outcome = "FAILED"; reason = "DEMO: simulated rejection" } $t.finance)
$retry = Invoke-Api POST "$COMP/payments/$pay1/release" $null $t.finance
Check "Finance retries payment 1" "OK" $retry
Assert "...it is now attempt number 2" ($retry.Data.attemptCount -eq 2)
Check "Simulated answer: payment 1 CONFIRMED" "OK" (Invoke-Api POST "$COMP/payments/$pay1/simulate-response" @{ outcome = "CONFIRMED" } $t.finance)
Check "Finance releases payment 2" "OK" (Invoke-Api POST "$COMP/payments/$pay2/release" $null $t.finance)
Check "Simulated answer: payment 2 CONFIRMED" "OK" (Invoke-Api POST "$COMP/payments/$pay2/simulate-response" @{ outcome = "CONFIRMED" } $t.finance)
$pev = Invoke-Api GET "$COMP/payments/$pay1/events" $null $t.finance
Write-Host "    payment 1 history: $((@($pev.Data) | ForEach-Object { $_.event }) -join ' > ')"
$psum = Invoke-Api GET "$COMP/cases/$cid/payment-summary" $null $t.authority
Write-Host ("    payment summary: mode {0}, confirmed {1:N2} of {2:N2}" -f $psum.Data.mode, $psum.Data.confirmedAmount, $psum.Data.totalAmount)
Assert "All money is confirmed and the mode is SIMULATED" ($psum.Data.mode -eq "SIMULATED" -and [math]::Round([decimal]$psum.Data.confirmedAmount, 2) -eq 3200002)

Step "Module 5 - R&R (neutral facts only: home lost, livelihood lost; no caste, religion or bank data)"
$bt1 = Invoke-Api POST "$COMP/rr/benefit-types" @{ code = "DEMO_RELOC_$s"; name = "DEMO relocation grant"; kind = "ONE_TIME_CASH"; defaultAmount = 50000; requiresDisplaced = $true } $a
$bt2 = Invoke-Api POST "$COMP/rr/benefit-types" @{ code = "DEMO_LIVEL_$s"; name = "DEMO livelihood allowance"; kind = "MONTHLY_ALLOWANCE"; defaultAmount = 3000; defaultMonths = 12; requiresLivelihoodLost = $true } $a
Check "Administrator maintains the R&R benefit catalogue" "OK" $bt2
$rr = Invoke-Api POST "$COMP/cases/$cid/rr-cases" @{ landownerId = $oa.Data.id; displaced = $true; livelihoodLost = $false; notes = "DEMO family" } $t.officer
Check "Scrutiny officer identifies an R&R case for DEMO Owner One's family" "OK" $rr
Check "A landowner outside the case is refused" 400 (Invoke-Api POST "$COMP/cases/$cid/rr-cases" @{ landownerId = [guid]::NewGuid().ToString(); displaced = $true; livelihoodLost = $true } $t.officer)
Check "A livelihood benefit is refused for a family that kept its livelihood" 400 (Invoke-Api POST "$COMP/rr-cases/$($rr.Data.id)/entitlements" @{ benefitTypeId = $bt2.Data.id } $t.officer)
$ent = Invoke-Api POST "$COMP/rr-cases/$($rr.Data.id)/entitlements" @{ benefitTypeId = $bt1.Data.id } $t.officer
Check "The relocation grant is assessed" "OK" $ent
Check "The identifier cannot approve the assessment" 403 (Invoke-Api POST "$COMP/rr-cases/$($rr.Data.id)/approve" $null $t.officer)
Check "Competent authority approves the assessment" "OK" (Invoke-Api POST "$COMP/rr-cases/$($rr.Data.id)/approve" $null $t.authority)
Check "The case cannot complete while a benefit is undelivered" 400 (Invoke-Api POST "$COMP/rr-cases/$($rr.Data.id)/complete" $null $t.officer)
$entId = @($ent.Data.entitlements)[0].id
$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
Check "The grant is delivered" "OK" (Invoke-Api POST "$COMP/rr-cases/$($rr.Data.id)/entitlements/$entId/deliver" @{ deliveredOn = $yesterday; remarks = "DEMO: handed over" } $t.officer)
$done = Invoke-Api POST "$COMP/rr-cases/$($rr.Data.id)/complete" $null $t.officer
Check "The R&R case is completed" "OK" $done
Write-Host "    R&R status: $($done.Data.status)"

# ---------------------------------------------------------------- Module 6: GIS (the case is still open, so the conflict report compares with it)
Step "Module 6 - parcel boundaries (PostGIS checks every shape; nothing is generated or fetched)"
Update-Tokens
$G = "/gis"
$g1 = $pid1
$g2 = @((Invoke-Api GET "$LR/parcels?number=DEMO-102&districtId=$($dist.Data.id)" $null $t.field).Data.content)[0].id
$sq1 = '{"type":"Polygon","coordinates":[[[75.3430,19.8760],[75.3440,19.8760],[75.3440,19.8770],[75.3430,19.8770],[75.3430,19.8760]]]}'
$sq2 = '{"type":"Polygon","coordinates":[[[75.3445,19.8760],[75.3465,19.8760],[75.3465,19.8770],[75.3445,19.8770],[75.3445,19.8760]]]}'
$sq3 = '{"type":"Polygon","coordinates":[[[75.3436,19.8762],[75.3443,19.8762],[75.3443,19.8768],[75.3436,19.8768],[75.3436,19.8762]]]}'
$bowtie = '{"type":"Polygon","coordinates":[[[75.343,19.876],[75.344,19.877],[75.344,19.876],[75.343,19.877],[75.343,19.876]]]}'
$swapped = '{"type":"Polygon","coordinates":[[[19.8760,75.3430],[19.8770,75.3430],[19.8770,75.3440],[19.8760,75.3440],[19.8760,75.3430]]]}'
Check "A self-crossing (bow-tie) shape is refused" 400 (Invoke-RawJson PUT "$G/parcels/$g1/boundary" $bowtie $t.field)
Check "Swapped latitude and longitude are refused" 400 (Invoke-RawJson PUT "$G/parcels/$g1/boundary" $swapped $t.field)
Check "Finance cannot enter boundaries" 403 (Invoke-RawJson PUT "$G/parcels/$g1/boundary" $sq1 $t.finance)
$b1 = Invoke-RawJson PUT "$G/parcels/$g1/boundary?sourceNote=DEMO%20survey" $sq1 $t.field
Check "Field officer enters the boundary of DEMO-101" "OK" $b1
Write-Host "    drawn area $($b1.Data.areaHa) ha, land record says $($b1.Data.recordedAreaHa) ha, difference $($b1.Data.variancePercent)%"
Check "Field officer enters the boundary of DEMO-102" "OK" (Invoke-RawJson PUT "$G/parcels/$g2/boundary?sourceNote=DEMO%20survey" $sq2 $t.field)
$forest = Invoke-Api POST "$LR/parcels" @{ villageId = $v1.Data.id; gatNumber = "DEMO-103"; areaHa = 0.5; classification = "FOREST"; landUse = "VACANT" } $t.field
Check "A DEMO forest parcel DEMO-103 is created" "OK" $forest
Check "...and its (partly overlapping) boundary is entered" "OK" (Invoke-RawJson PUT "$G/parcels/$($forest.Data.id)/boundary" $sq3 $t.field)

Step "Module 6 - project alignment and the spatial conflict report"
$line = '{"type":"LineString","coordinates":[[75.3420,19.8765],[75.3470,19.8765]]}'
Check "A report without an alignment is refused" 404 (Invoke-Api GET "$G/projects/$projectId/conflicts" $null $t.officer)
$al = Invoke-RawJson PUT "$G/projects/$projectId/alignment?corridorWidthM=60&sourceNote=DEMO" $line $t.field
Check "Field officer enters the project alignment (60 m corridor)" "OK" $al
Write-Host "    alignment length $($al.Data.lengthKm) km, version $($al.Data.versionNo)"
$conf = Invoke-Api GET "$G/projects/$projectId/conflicts" $null $t.officer
Check "Scrutiny officer opens the conflict report" "OK" $conf
Write-Host "    corridor $($conf.Data.corridorAreaHa) ha; crosses $($conf.Data.affectedParcelCount) parcels ($($conf.Data.totalAffectedHa) ha); $($conf.Data.warnings) warnings, $($conf.Data.infos) infos"
Write-Host "    boundaries: $($conf.Data.parcelsWithBoundary) of $($conf.Data.parcelsInProjectVillages) parcels in the project's villages"
foreach ($f in @($conf.Data.findings)) { Write-Host ("      [{0}] {1}: {2}" -f $f.severity, $f.code, $f.message) }
Assert "The corridor crosses the three DEMO parcels" ($conf.Data.affectedParcelCount -ge 3)
Assert "The forest parcel is flagged" (@($conf.Data.findings | Where-Object { $_.code -eq "FOREST_LAND" }).Count -ge 1)
Assert "The overlapping boundaries are flagged" (@($conf.Data.findings | Where-Object { $_.code -eq "PARCEL_OVERLAP" }).Count -ge 1)
Assert "DEMO-102 is reported as not in the acquisition case" (@($conf.Data.findings | Where-Object { $_.code -eq "NOT_IN_ACQUISITION_CASE" }).Count -ge 1)
Assert "The report states its limitations" (@($conf.Data.limitations).Count -ge 3)
$gmap = Invoke-Api GET "$G/projects/$projectId/map" $null $t.finance
Check "Finance officer loads the map layers (GeoJSON)" "OK" $gmap
Assert "The map has the corridor, the alignment and the parcels" (@($gmap.Data.features).Count -ge 5)
Check "A consultant cannot see the map" 403 (Invoke-Api GET "$G/projects/$projectId/map" $null $t.consultant)

Step "Module 6 - a corrected boundary becomes a new version (the old one is kept)"
$sq1b = '{"type":"Polygon","coordinates":[[[75.3430,19.8760],[75.3441,19.8760],[75.3441,19.8770],[75.3430,19.8770],[75.3430,19.8760]]]}'
$b1b = Invoke-RawJson PUT "$G/parcels/$g1/boundary?sourceNote=DEMO%20resurvey" $sq1b $t.field
Check "The boundary of DEMO-101 is corrected" "OK" $b1b
Assert "It is now version 2" ($b1b.Data.versionNo -eq 2)
$bhist = Invoke-Api GET "$G/parcels/$g1/boundary/history" $null $t.finance
Assert "The history keeps both versions" (@($bhist.Data).Count -eq 2)

# ---------------------------------------------------------------- close the case
Step "Module 4 - closure"
$cl = Invoke-Api POST "$AQ/cases/$cid/close" @{ reason = "DEMO: acquisition completed" } $t.authority
Check "Competent authority closes the case" "OK" $cl
$ch = Invoke-Api GET "$AQ/cases/$cid/history" $null $t.officer
Write-Host "    case history: $((@($ch.Data) | ForEach-Object { $_.action }) -join ' > ')"

# ---------------------------------------------------------------- Module 7: dashboards and MIS reports
Step "Module 7 - dashboards (every number is limited to the caller's geographic scope)"
Update-Tokens
$M = "/monitoring"
$dash = Invoke-Api GET "$M/dashboard?districtId=$($dist.Data.id)" $null $t.authority
Check "Competent authority opens the district dashboard" "OK" $dash
$payLine = (@($dash.Data.finance.payments) | ForEach-Object { "{0} {1} = {2:N2}" -f $_.status, $_.count, $_.amount }) -join "; "
$trendLine = (@($dash.Data.trend) | ForEach-Object { "{0}: {1} proposals, {2} cases" -f $_.month, $_.proposalsSubmitted, $_.casesOpened }) -join " | "
Write-Host "    level: $($dash.Data.level)"
Write-Host "    proposals: $($dash.Data.proposals.total) (approved $($dash.Data.proposals.approved)); projects: $($dash.Data.projects.total), land $($dash.Data.projects.estimatedLandAreaHa) ha"
Write-Host "    land records: $($dash.Data.land.activeParcels) parcels, $($dash.Data.land.totalAreaHa) ha, boundary coverage $($dash.Data.land.boundaryCoveragePercent)%, documents waiting for verification: $($dash.Data.land.documentsPendingVerification)"
Write-Host "    acquisition: $($dash.Data.acquisition.totalCases) cases ($($dash.Data.acquisition.openCases) open), area to acquire $($dash.Data.acquisition.areaToAcquireHa) ha, awards $($dash.Data.acquisition.awardsDeclared), possessions $($dash.Data.acquisition.possessionsRecorded)"
Write-Host "    compensation (SIMULATED): $payLine"
Write-Host "    last six months: $trendLine"
Assert "The dashboard counts the demo proposal and project" ($dash.Data.proposals.total -ge 1 -and $dash.Data.projects.total -ge 1)
Assert "The dashboard counts the awarded and possessed case" ($dash.Data.acquisition.awardsDeclared -ge 1 -and $dash.Data.acquisition.possessionsRecorded -ge 1)
Assert "The dashboard counts the DEMO parcels" ($dash.Data.land.activeParcels -ge 3)
Assert "Payment figures are marked SIMULATED" ($dash.Data.finance.paymentMode -eq "SIMULATED")
$fieldDash = Invoke-Api GET "$M/dashboard" $null $t.field
Check "A field officer opens the dashboard" "OK" $fieldDash
Assert "...but sees no compensation money (no permission)" ($null -eq $fieldDash.Data.finance)
Assert "...and its level is SCOPED to the demo district" ($fieldDash.Data.level -eq "SCOPED")
Check "A consultant cannot open dashboards" 403 (Invoke-Api GET "$M/dashboard" $null $t.consultant)
$nat = Invoke-Api GET "$M/dashboard" $null $a
Check "The national dashboard (SUPER_ADMIN)" "OK" $nat
Write-Host "    national level: $($nat.Data.level), districts with activity: $(@($nat.Data.districts).Count)"
Check "A random district is 'not found'" 404 (Invoke-Api GET "$M/dashboard?districtId=$([guid]::NewGuid())" $null $t.authority)

Step "Module 7 - MIS reports and CSV export (every export is audited)"
$cat = Invoke-Api GET "$M/reports" $null $t.finance
Check "Finance officer sees the report catalogue" "OK" $cat
Write-Host "    reports: $((@($cat.Data) | ForEach-Object { $_.code }) -join ', ')"
$fcat = Invoke-Api GET "$M/reports" $null $t.field
Assert "A field officer's catalogue has no compensation report" (@($fcat.Data | Where-Object { $_.code -eq "COMPENSATION" }).Count -eq 0)
$misCases = Invoke-Api GET "$M/reports/ACQUISITION_CASES?districtId=$($dist.Data.id)" $null $t.finance
Check "Finance runs the acquisition cases report" "OK" $misCases
foreach ($row in @($misCases.Data.rows)) { Write-Host ("      {0}  {1,-18} parcels {2}  area {3} ha  possessions {4}" -f $row.case_number, $row.status, $row.parcels, $row.area_to_acquire_ha, $row.possessions) }
$misComp = Invoke-Api GET "$M/reports/COMPENSATION?districtId=$($dist.Data.id)" $null $t.finance
Check "Finance runs the compensation report" "OK" $misComp
foreach ($row in @($misComp.Data.rows)) { Write-Host ("      {0}  {1,-12} v{2}  {3,-9} total {4:N2}  confirmed (simulated) {5:N2}" -f $row.case_number, $row.parcel_label, $row.version_no, $row.estimate_status, $row.total_amount, $row.confirmed_amount) }
Check "A field officer cannot run the compensation report" 403 (Invoke-Api GET "$M/reports/COMPENSATION" $null $t.field)
Check "A hostile status filter is refused" 400 (Invoke-Api GET "$M/reports/PROJECTS?status=x%27%3B%20DROP%20TABLE%20users" $null $t.finance)
$csv = Join-Path $work "projects.csv"
Check "Finance exports the projects report as CSV" "OK" (Get-File "$M/reports/PROJECTS/export.csv?districtId=$($dist.Data.id)" $csv $t.finance)
$bytes = [System.IO.File]::ReadAllBytes($csv)
Assert "The CSV starts with a UTF-8 byte order mark (Excel shows Marathi correctly)" ($bytes.Length -gt 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
Write-Host "    CSV first line: $((Get-Content $csv -Encoding UTF8 -TotalCount 1) -replace [char]0xFEFF, '')"
Check "A field officer cannot export" 403 (Get-File "$M/reports/PROJECTS/export.csv" (Join-Path $work "no.csv") $t.field)

# ---------------------------------------------------------------- Module 7b: SLA, escalation and system settings
Step "Module 7b - SLA limits (DEMO defaults, not official policy) and a proposal that is already 'late'"
Update-Tokens
$slaRules = Invoke-Api GET "$M/sla/rules" $null $t.authority
Check "Everyone with SLA access can read the SLA rules" "OK" $slaRules
$slaRule = @($slaRules.Data) | Where-Object { $_.itemType -eq "PROPOSAL_AWAITING_SCRUTINY" } | Select-Object -First 1
Write-Host "    $(@($slaRules.Data).Count) rules, e.g. $($slaRule.title): warning after $($slaRule.warnAfterHours) h, breach after $($slaRule.breachAfterHours) h"
$ruleBody = { param($warn, $breach, $ver) @{ warnAfterHours = $warn; breachAfterHours = $breach; responsibleRole = $slaRule.responsibleRole; escalateRole = $slaRule.escalateRole; active = $true; rowVersion = $ver } }
try {
    Check "A scrutiny officer cannot change SLA limits" 403 (Invoke-Api PUT "$M/sla/rules/PROPOSAL_AWAITING_SCRUTINY" (& $ruleBody 0 1 $slaRule.rowVersion) $t.officer)
    Check "A breach limit that is not longer than the warning limit is refused" 400 (Invoke-Api PUT "$M/sla/rules/PROPOSAL_AWAITING_SCRUTINY" (& $ruleBody 5 5 $slaRule.rowVersion) $a)
    Check "A stale rule version is refused (someone else changed it)" 409 (Invoke-Api PUT "$M/sla/rules/PROPOSAL_AWAITING_SCRUTINY" (& $ruleBody 0 1 ($slaRule.rowVersion + 50)) $a)
    Check "Administrator sets a DEMO limit: warning at once, breach after 1 hour" "OK" (Invoke-Api PUT "$M/sla/rules/PROPOSAL_AWAITING_SCRUTINY" (& $ruleBody 0 1 $slaRule.rowVersion) $a)

    $prop2Body = @{ title = "DEMO Bypass Road (waiting for scrutiny)"; projectType = "STATE_HIGHWAY"; districtId = $dist.Data.id; talukaId = $tal.Data.id;
        departmentId = $dep.Data.id; lengthKm = 12; estimatedLandAreaHa = 30; villageIds = @($v1.Data.id);
        description = "DEMO: a proposal that nobody has picked up"; plannedStartDate = "2027-02-01"; plannedEndDate = "2028-02-01" }
    $prop2 = Invoke-Api POST "/projects/proposals" $prop2Body $t.consultant
    Check "Consultant creates a second DEMO proposal" "OK" $prop2
    $sub2 = Invoke-Api POST "/projects/proposals/$($prop2.Data.id)/submit" $null $t.consultant
    Check "...and submits it, then nobody picks it up" "OK" $sub2

    Step "Module 7b - the monitoring page: what is waiting, and for how long"
    $sl = Invoke-Api GET "$M/sla?districtId=$($dist.Data.id)" $null $t.authority
    Check "Competent authority opens the SLA status of the district" "OK" $sl
    Write-Host "    on time $($sl.Data.onTime), warning $($sl.Data.warning), breach $($sl.Data.breach)"
    foreach ($i in @($sl.Data.items)) { Write-Host ("      [{0}] {1}: {2} (waiting {3} h, responsible {4})" -f $i.level, $i.title, $i.reference, $i.ageHours, $i.responsibleRole) }
    Assert "The new proposal shows up as overdue" (@($sl.Data.items | Where-Object { $_.itemType -eq "PROPOSAL_AWAITING_SCRUTINY" -and $_.reference -eq $sub2.Data.proposalNumber }).Count -eq 1)
    Check "A consultant cannot see SLA status" 403 (Invoke-Api GET "$M/sla" $null $t.consultant)
    Check "A random district is 'not found'" 404 (Invoke-Api GET "$M/sla?districtId=$([guid]::NewGuid())" $null $t.authority)

    Step "Module 7b - escalation: only notifications, sent once, logged"
    Check "A scrutiny officer cannot run a scan" 403 (Invoke-Api POST "$M/sla/scan?districtId=$($dist.Data.id)" $null $t.officer)
    $scan = Invoke-Api POST "$M/sla/scan?districtId=$($dist.Data.id)" $null $a
    Check "Administrator runs a scan of the demo district" "OK" $scan
    Write-Host "    warnings raised $($scan.Data.warningsRaised), breaches raised $($scan.Data.breachesRaised), notifications sent $($scan.Data.notificationsSent)"
    Assert "The scan raised at least one alert" ($scan.Data.warningsRaised -ge 1 -and $scan.Data.notificationsSent -ge 1)
    $scan2 = Invoke-Api POST "$M/sla/scan?districtId=$($dist.Data.id)" $null $a
    Assert "A second scan sends nothing again (no duplicate alerts)" ($scan2.Data.warningsRaised -eq 0 -and $scan2.Data.breachesRaised -eq 0 -and $scan2.Data.notificationsSent -eq 0)
    $elog = Invoke-Api GET "$M/sla/escalations?districtId=$($dist.Data.id)" $null $t.authority
    Check "The escalation log is readable" "OK" $elog
    foreach ($e in @($elog.Data.rows) | Select-Object -First 5) { Write-Host ("      {0} {1} {2}: limit {3} h, triggered by {4}" -f $e.level, $e.itemType, $e.reference, $e.thresholdHours, $e.triggeredBy) }
    Assert "The proposal's status was NOT changed by escalation" ((Invoke-Api GET "/projects/proposals/$($prop2.Data.id)" $null $t.officer).Data.status -eq "SUBMITTED")
}
finally {
    Step "Module 7b - put the SLA limit back (always, even after a failure)"
    $cur = @((Invoke-Api GET "$M/sla/rules" $null $a).Data) | Where-Object { $_.itemType -eq "PROPOSAL_AWAITING_SCRUTINY" } | Select-Object -First 1
    Check "Administrator restores the original limit" "OK" (Invoke-Api PUT "$M/sla/rules/PROPOSAL_AWAITING_SCRUTINY" (& $ruleBody $slaRule.warnAfterHours $slaRule.breachAfterHours $cur.rowVersion) $a)
}
$set = Invoke-Api GET "$M/settings" $null $a
Check "Administrator opens the system settings (read-only)" "OK" $set
Write-Host "    payments: $($set.Data.paymentMode); uploads: $($set.Data.allowedUploadTypes -join ', ') up to $($set.Data.maxUploadMb) MB; export limit $($set.Data.exportMaxRows) rows; SLA scheduler enabled: $($set.Data.slaSchedulerEnabled)"
Assert "Payments are SIMULATED in the settings" ($set.Data.paymentMode -eq "SIMULATED")
Check "A scrutiny officer cannot open the system settings" 403 (Invoke-Api GET "$M/settings" $null $t.officer)

# ---------------------------------------------------------------- audit
Step "Audit trail of the document (administrator)"
$au = Invoke-Api GET "/administration/audit-events?entityType=LandDocument&entityId=$docId" $null $a
Check "Audit trail readable" "OK" $au
Write-Host "    $((@($au.Data.content) | Sort-Object occurredAt | ForEach-Object { "$($_.action) by $($_.actorUsername)" }) -join '  |  ')"

Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "`n=== RESULT: $script:Pass passed, $script:Fail failed ==="

if ($ShowCredentials) {
    Write-Host "`nDEMO accounts of this run (synthetic, local only: do not paste in chat, do not commit):"
    foreach ($k in $t.Keys) { Write-Host "    demo-$k-$s   /   $pw" }
    Write-Host "    demo district id: $($dist.Data.id)"
}
if ($script:Fail -eq 0) { Write-Host "`nLandNexus demo completed: every check passed." -ForegroundColor Green } else { Write-Host "`nLandNexus demo finished with failures: send me the first [FAIL] lines." -ForegroundColor Yellow }
if ($script:Fail -gt 0) { exit 1 }