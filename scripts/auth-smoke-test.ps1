# LandNexus - login / authorization smoke test (run while the backend is running on port 8080).
# Needs the bootstrap administrator credentials in the same environment variables the backend used:
#   LANDNEXUS_ADMIN_USERNAME, LANDNEXUS_ADMIN_PASSWORD
# It creates one synthetic AUDITOR user (random name) and disables it again at the end.
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
        if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json) }
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
$auditorName = "smoke-auditor-$suffix"
$auditorPassword = "Smoke-Passw0rd-$suffix"

$r = Invoke-Api GET "/administration/states" $null $null
Show-Result "No token is refused" 401 $r

$r = Invoke-Api POST "/auth/login" @{ username = $AdminUser; password = "definitely-wrong-1" } $null
Show-Result "Wrong password is refused" 401 $r

$admin = Invoke-Api POST "/auth/login" @{ username = $AdminUser; password = $AdminPassword } $null
Show-Result "Administrator login" "OK" $admin
if ($admin.Status -ne "OK") { Write-Host "Cannot continue without an administrator login."; exit 1 }
$adminToken = $admin.Data.accessToken

$me = Invoke-Api GET "/auth/me" $null $adminToken
Show-Result "GET /auth/me" "OK" $me
if ($me.Status -eq "OK") { Write-Host "    roles = $($me.Data.roles -join ', ')" }

$roles = Invoke-Api GET "/administration/roles" $null $adminToken
Show-Result "List roles (13 expected)" "OK" $roles
if ($roles.Status -eq "OK") { Write-Host "    role count = $(@($roles.Data).Count)" }

$created = Invoke-Api POST "/administration/users" @{
    username = $auditorName; email = "$auditorName@test.invalid"; fullName = "Smoke Test Auditor";
    password = $auditorPassword; roles = @("AUDITOR")
} $adminToken
Show-Result "Create AUDITOR user" "OK" $created

$weak = Invoke-Api POST "/administration/users" @{
    username = "weak-$suffix"; email = "weak-$suffix@test.invalid"; fullName = "Weak";
    password = "short1"; roles = @("AUDITOR")
} $adminToken
Show-Result "Weak password is refused" 400 $weak

$escalate = Invoke-Api POST "/administration/users" @{
    username = "x-$suffix"; email = "x-$suffix@test.invalid"; fullName = "X";
    password = "Escalate-Passw0rd-1"; roles = @("NO_SUCH_ROLE")
} $adminToken
Show-Result "Unknown role is refused" 400 $escalate

$aud = Invoke-Api POST "/auth/login" @{ username = $auditorName; password = $auditorPassword } $null
Show-Result "Auditor login" "OK" $aud
if ($aud.Status -ne "OK") { exit 1 }

$r = Invoke-Api GET "/administration/states" $null $aud.Data.accessToken
Show-Result "Auditor can read states" "OK" $r

$r = Invoke-Api POST "/administration/states" @{ code = "NOPE$suffix"; name = "Auditor Must Not Create" } $aud.Data.accessToken
Show-Result "Auditor cannot create a state" 403 $r

$rt = Invoke-Api POST "/auth/refresh" @{ refreshToken = $aud.Data.refreshToken } $null
Show-Result "Refresh token works once" "OK" $rt

$reuse = Invoke-Api POST "/auth/refresh" @{ refreshToken = $aud.Data.refreshToken } $null
Show-Result "Reusing the old refresh token is refused" 401 $reuse

$after = Invoke-Api POST "/auth/refresh" @{ refreshToken = $rt.Data.refreshToken } $null
Show-Result "...and the whole session was ended" 401 $after

$off = Invoke-Api POST "/administration/users/$($created.Data.id)/disable" $null $adminToken
Show-Result "Disable the smoke-test user" "OK" $off

$blocked = Invoke-Api POST "/auth/login" @{ username = $auditorName; password = $auditorPassword } $null
Show-Result "Disabled user cannot log in" 401 $blocked
