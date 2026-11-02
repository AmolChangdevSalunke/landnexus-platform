# LandNexus - audit / login history / geographic scope smoke test (backend running on port 8080).
# Needs LANDNEXUS_ADMIN_USERNAME and LANDNEXUS_ADMIN_PASSWORD. Creates synthetic TEST records with a random suffix.
# Note: audit and login-history rows are append-only by design, so this script leaves a few rows behind.
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
        if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 5) }
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
}

$suffix = Get-Random -Maximum 99999
$name = "smoke2b-$suffix"
$password = "Smoke-Passw0rd-$suffix"

$admin = Invoke-Api POST "/auth/login" @{ username = $AdminUser; password = $AdminPassword } $null
Show-Result "Administrator login" "OK" $admin
if ($admin.Status -ne "OK") { exit 1 }
$t = $admin.Data.accessToken

$stateA = Invoke-Api POST "/administration/states" @{ code = "SA$suffix"; name = "Smoke State A" } $t
Show-Result "Create state A" "OK" $stateA
$stateB = Invoke-Api POST "/administration/states" @{ code = "SB$suffix"; name = "Smoke State B" } $t
Show-Result "Create state B" "OK" $stateB
$distA = Invoke-Api POST "/administration/districts" @{ code = "DA$suffix"; name = "Smoke District A"; stateId = $stateA.Data.id } $t
Show-Result "Create district in state A" "OK" $distA
$distB = Invoke-Api POST "/administration/districts" @{ code = "DB$suffix"; name = "Smoke District B"; stateId = $stateB.Data.id } $t
Show-Result "Create district in state B" "OK" $distB

$audit = Invoke-Api GET "/administration/audit-events?entityType=State&entityId=$($stateA.Data.id)" $null $t
Show-Result "Audit trail has the state creation" "OK" $audit
if ($audit.Status -eq "OK") {
    Write-Host "    events = $($audit.Data.totalElements), action = $($audit.Data.content[0].action), actor = $($audit.Data.content[0].actorUsername)"
}

$user = Invoke-Api POST "/administration/users" @{
    username = $name; email = "$name@test.invalid"; fullName = "Smoke State Admin";
    password = $password; roles = @("STATE_ADMIN")
} $t
Show-Result "Create STATE_ADMIN user" "OK" $user

$bad = Invoke-Api PUT "/administration/users/$($user.Data.id)/scopes" @{ scopes = @(@{ stateId = $stateA.Data.id; districtId = $distA.Data.id }) } $t
Show-Result "Scope entry with two ids is refused" 400 $bad

$ok = Invoke-Api PUT "/administration/users/$($user.Data.id)/scopes" @{ scopes = @(@{ stateId = $stateA.Data.id }) } $t
Show-Result "Assign state A as scope" "OK" $ok

$list = Invoke-Api GET "/administration/users/$($user.Data.id)/scopes" $null $t
Show-Result "List the user's scopes" "OK" $list

$login = Invoke-Api POST "/auth/login" @{ username = $name; password = $password } $null
Show-Result "State admin login" "OK" $login
if ($login.Status -ne "OK") { exit 1 }

$mine = Invoke-Api GET "/administration/my-districts" $null $login.Data.accessToken
Show-Result "State admin sees only own districts" "OK" $mine
if ($mine.Status -eq "OK") { Write-Host "    totalElements = $($mine.Data.totalElements) (expected 1)" }

$all = Invoke-Api GET "/administration/my-districts" $null $t
Show-Result "Administrator sees districts nationwide" "OK" $all
if ($all.Status -eq "OK") { Write-Host "    totalElements = $($all.Data.totalElements) (at least 2 expected)" }

$denied = Invoke-Api GET "/administration/audit-events" $null $login.Data.accessToken
Show-Result "State admin cannot read the audit trail" 403 $denied

$wrong = Invoke-Api POST "/auth/login" @{ username = $name; password = "Wrong-Passw0rd-999" } $null
Show-Result "Wrong password refused" 401 $wrong

$hist = Invoke-Api GET "/administration/login-history?username=$name" $null $t
Show-Result "Login history lists the attempts" "OK" $hist
if ($hist.Status -eq "OK") {
    foreach ($row in $hist.Data.content) { Write-Host ("    success={0} reason={1} ip={2}" -f $row.success, $row.failureReason, $row.ipAddress) }
}

$off = Invoke-Api POST "/administration/users/$($user.Data.id)/disable" $null $t
Show-Result "Disable the smoke-test user" "OK" $off
