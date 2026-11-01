# LandNexus - Administration module smoke test (run while the backend is running on port 8080).
# It creates synthetic TEST records with a random suffix, so it can be re-run safely.
param(
    [string]$BaseUrl = "http://localhost:8080/api/v1/administration",
    [string]$AuthUrl = "http://localhost:8080/api/v1/auth",
    [string]$AdminUser = $env:LANDNEXUS_ADMIN_USERNAME,
    [string]$AdminPassword = $env:LANDNEXUS_ADMIN_PASSWORD
)

if (-not $AdminUser -or -not $AdminPassword) {
    Write-Host "Set LANDNEXUS_ADMIN_USERNAME and LANDNEXUS_ADMIN_PASSWORD (or pass -AdminUser / -AdminPassword)."
    exit 1
}
$login = Invoke-RestMethod -Method Post -Uri "$AuthUrl/login" -ContentType "application/json" `
    -Body (@{ username = $AdminUser; password = $AdminPassword } | ConvertTo-Json)
$script:Token = $login.accessToken

$suffix = Get-Random -Maximum 99999

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body)
    try {
        $params = @{ Method = $Method; Uri = "$BaseUrl$Path"; ContentType = "application/json";
                     Headers = @{ Authorization = "Bearer $script:Token" } }
        if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json) }
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
}

$ministry = Invoke-Api POST "/ministries" @{ code = "TESTMIN$suffix"; name = "Test Ministry of Roads $suffix" }
Show-Result "Create ministry" "OK" $ministry

$state = Invoke-Api POST "/states" @{ code = "TS$suffix"; name = "Test State $suffix" }
Show-Result "Create state" "OK" $state

$division = Invoke-Api POST "/divisions" @{ code = "DV$suffix"; name = "Test Division"; stateId = $state.Data.id }
Show-Result "Create division" "OK" $division

$district = Invoke-Api POST "/districts" @{ code = "DT$suffix"; name = "Test District"; stateId = $state.Data.id; divisionId = $division.Data.id }
Show-Result "Create district (with division)" "OK" $district

$taluka = Invoke-Api POST "/talukas" @{ code = "TK$suffix"; name = "Test Taluka"; districtId = $district.Data.id }
Show-Result "Create taluka" "OK" $taluka

$village = Invoke-Api POST "/villages" @{ code = "VL$suffix"; name = "Test Village"; talukaId = $taluka.Data.id }
Show-Result "Create village" "OK" $village

$dept = Invoke-Api POST "/departments" @{ code = "TESTDEP$suffix"; name = "Test Roads Department"; ministryId = $ministry.Data.id; level = "STATE" }
Show-Result "Create department" "OK" $dept

$dup = Invoke-Api POST "/states" @{ code = "ts$suffix"; name = "Another Name" }
Show-Result "Duplicate state code (case-insensitive)" 409 $dup

$bad = Invoke-Api POST "/states" @{ code = ""; name = "" }
Show-Result "Blank fields rejected" 400 $bad

$missing = Invoke-Api GET "/districts/$([guid]::NewGuid())" $null
Show-Result "Unknown district id" 404 $missing

$badParent = Invoke-Api POST "/villages" @{ code = "VX$suffix"; name = "Orphan"; talukaId = [guid]::NewGuid().ToString() }
Show-Result "Village with unknown taluka" 404 $badParent

$list = Invoke-Api GET "/districts?stateId=$($state.Data.id)&page=0&size=10" $null
Show-Result "List districts of the state" "OK" $list
if ($list.Status -eq "OK") { Write-Host "    totalElements = $($list.Data.totalElements)" }

$off = Invoke-Api POST "/villages/$($village.Data.id)/deactivate" $null
Show-Result "Deactivate village" "OK" $off
if ($off.Status -eq "OK") { Write-Host "    status = $($off.Data.status)" }
