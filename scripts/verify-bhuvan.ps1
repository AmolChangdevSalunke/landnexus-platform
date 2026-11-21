# Verify the ISRO Bhuvan API against the configured token and a Maharashtra AOI.
#
# The token is read from BHUVAN_API_TOKEN and is never printed, logged or written to a file.
# The provider is called directly so an authenticated success (or refusal) is recorded honestly.
# Optionally, pass backend credentials to verify the LandNexus endpoints as well.
#
# Examples:
#   $env:BHUVAN_API_TOKEN = '<token>'          # do not paste the token into this file or a command line
#   .\scripts\verify-bhuvan.ps1                # synthetic Pune square, direct provider call
#   .\scripts\verify-bhuvan.ps1 -CheckVillage  # also try a Maharashtra village lookup
#   .\scripts\verify-bhuvan.ps1 -BackendBaseUrl http://localhost:8080 -BackendToken $jwt -ProjectId <uuid>
#
# Exit code 0 means every requested check answered as expected. A provider refusal is reported as a failure,
# not as success: the script never invents an authenticated result.

[CmdletBinding()]
param(
    [string]$PolygonWkt = 'POLYGON((73.8500 18.5200,73.8600 18.5200,73.8600 18.5300,73.8500 18.5300,73.8500 18.5200))',
    [string]$BaseUrl = 'https://bhuvan-app1.nrsc.gov.in/api',
    [int]$TimeoutSeconds = 45,
    [switch]$CheckVillage,
    [string]$VillageName = 'Pune',
    [string]$VillageState = 'MH',
    [string]$BackendBaseUrl,
    [string]$BackendToken,
    [string]$ProjectId
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$script:failed = $false
$script:token = $env:BHUVAN_API_TOKEN

function Write-Section([string]$text) {
    Write-Host "`n== $text ==" -ForegroundColor Cyan
}

function Write-Result([string]$label, [bool]$ok, [string]$detail) {
    $colour = if ($ok) { 'Green' } else { 'Red' }
    Write-Host ("{0}: {1}" -f $label, $detail) -ForegroundColor $colour
    if (-not $ok) { $script:failed = $true }
}

function Invoke-BhuvanGet([string]$path, [hashtable]$parameters) {
    if ([string]::IsNullOrWhiteSpace($script:token)) {
        throw 'BHUVAN_API_TOKEN is not set. Set it in the environment for this session; do not put it in a file.'
    }
    $pairs = foreach ($key in $parameters.Keys) {
        '{0}={1}' -f [uri]::EscapeDataString([string]$key), [uri]::EscapeDataString([string]$parameters[$key])
    }
    $url = '{0}{1}?{2}&token={3}' -f $BaseUrl.TrimEnd('/'), $path, ($pairs -join '&'),
        [uri]::EscapeDataString($script:token)

    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
    try {
        $response = $client.GetAsync($url).GetAwaiter().GetResult()
        $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $body }
    }
    catch {
        # The request URI contains the token, so the exception text is deliberately not printed.
        return [pscustomobject]@{ Status = 0; Body = ''; Error = $_.Exception.GetType().Name }
    }
    finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

function Show-ProviderAnswer([string]$label, $answer) {
    if ($answer.Status -eq 0) {
        Write-Result $label $false "request failed before an HTTP answer ($($answer.Error))"
        return
    }
    $preview = $answer.Body
    if ($preview.Length -gt 1200) { $preview = $preview.Substring(0, 1200) + '...' }
    Write-Host "HTTP $($answer.Status)"
    if ($preview) { Write-Host $preview }

    $json = $null
    try { $json = $answer.Body | ConvertFrom-Json } catch { }
    if ($json -and $json.PSObject.Properties.Name -contains 'error') {
        Write-Result $label $false "provider error '$($json.error)' - $($json.error_description)"
        return
    }
    if ($answer.Status -eq 401 -or $answer.Status -eq 403) {
        Write-Result $label $false 'the provider rejected the token (HTTP 401/403)'
        return
    }
    if ($answer.Status -ge 400) {
        Write-Result $label $false "the provider answered with HTTP $($answer.Status)"
        return
    }
    if ([string]::IsNullOrWhiteSpace($answer.Body)) {
        Write-Result $label $false 'the provider returned an empty body'
        return
    }
    Write-Result $label $true 'the provider answered over HTTP without a provider error'
}

Write-Section 'Configuration'
Write-Host "Provider base URL: $BaseUrl"
Write-Host "Token present: $([bool](-not [string]::IsNullOrWhiteSpace($script:token)))"
Write-Host 'AOI: the supplied WKT (default is a synthetic Pune square, not a real project boundary)'
Write-Host 'The token is never displayed by this script.'

if ([string]::IsNullOrWhiteSpace($script:token)) {
    Write-Result 'Token' $false 'BHUVAN_API_TOKEN is not set; no authenticated call was made'
    exit 1
}

Write-Section '1. LULC AOI (Maharashtra coordinates)'
$lulc = Invoke-BhuvanGet '/lulc/curl_aoi.php' @{ geom = $PolygonWkt }
Show-ProviderAnswer 'LULC AOI' $lulc

if ($CheckVillage) {
    Write-Section "2. Village geocoding ($VillageState)"
    $village = Invoke-BhuvanGet '/api_proximity/curl_village_geocode.php' @{ village = $VillageName }
    Show-ProviderAnswer 'Village geocode' $village

    Write-Section '3. Village reverse geocoding (Pune)'
    $reverse = Invoke-BhuvanGet '/api_proximity/curl_reverse_village.php' @{ lat = '18.5204'; lon = '73.8567' }
    Show-ProviderAnswer 'Village reverse geocode' $reverse
}

if ($BackendBaseUrl) {
    Write-Section '4. LandNexus backend endpoints'
    if ([string]::IsNullOrWhiteSpace($BackendToken)) {
        Write-Result 'Backend authentication' $false 'BackendToken is required with BackendBaseUrl'
    }
    else {
        $backend = $BackendBaseUrl.TrimEnd('/')
        $headers = @{ Authorization = "Bearer $BackendToken" }
        try {
            $status = Invoke-RestMethod -Method Get -Uri "$backend/api/v1/gis/bhuvan/status" -Headers $headers
            Write-Host ($status | ConvertTo-Json -Depth 5)
            Write-Result 'Backend status' $true "enabled=$($status.enabled), tokenConfigured=$($status.tokenConfigured)"
        }
        catch {
            Write-Result 'Backend status' $false 'the backend status endpoint did not answer successfully'
        }

        $request = if ($ProjectId) { @{ projectId = $ProjectId } } else { @{ wkt = $PolygonWkt } }
        try {
            $analysis = Invoke-RestMethod -Method Post -Uri "$backend/api/v1/gis/bhuvan/lulc/aoi" -Headers $headers `
                -ContentType 'application/json' -Body ($request | ConvertTo-Json)
            Write-Host ($analysis | ConvertTo-Json -Depth 4)
            Write-Result 'Backend LULC' ($analysis.status -eq 'SUCCESS') "status=$($analysis.status), records=$($analysis.records.Count)"
        }
        catch {
            $detail = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { 'the backend LULC endpoint did not answer successfully' }
            Write-Result 'Backend LULC' $false $detail
        }
    }
}

Write-Section 'Summary'
if ($script:failed) {
    Write-Host 'One or more checks did not succeed. Record the actual output above; do not describe the integration as verified.' -ForegroundColor Red
    exit 1
}
Write-Host 'Every requested check answered successfully. Record the date, AOI and provider output in docs/TESTING_AND_VERIFICATION.md.' -ForegroundColor Green
exit 0
