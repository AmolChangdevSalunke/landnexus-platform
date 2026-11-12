
# LandNexus Satellite Imagery Setup
# Settings apply only to this PowerShell session.

$url = Read-Host "WMS endpoint URL (HTTPS required)"

$layers = Read-Host "Imagery layer names (empty = discover)"
if (-not $layers) {
    $layers = "__discover__"
}

$overlay = Read-Host "Cadastral overlay layer names (optional)"

$version = Read-Host "WMS version [1.1.1]"
if (-not $version) { $version = "1.1.1" }

$mode = Read-Host "Authentication mode NONE, QUERY_PARAM or HEADER [QUERY_PARAM]"
if (-not $mode) { $mode = "QUERY_PARAM" }
$mode = $mode.ToUpper()

$name = "token"

if ($mode -ne "NONE") {
    $name = Read-Host "Authentication parameter/header name [token]"
    if (-not $name) { $name = "token" }

    $secure = Read-Host "Paste access key (hidden)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)

    try {
        $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}
else {
    $secret = ""
}

$attr = Read-Host "Provider attribution"

if ($url -notmatch '^https://') {
    throw "HTTPS URL required. Setup stopped."
}

if ($mode -notin @("NONE", "QUERY_PARAM", "HEADER")) {
    throw "Invalid authentication mode. Setup stopped."
}

$env:LANDNEXUS_IMAGERY_ENABLED = "true"
$env:LANDNEXUS_IMAGERY_URL = $url
$env:LANDNEXUS_IMAGERY_LAYERS = $layers
$env:LANDNEXUS_IMAGERY_OVERLAY_LAYERS = $overlay
$env:LANDNEXUS_IMAGERY_WMS_VERSION = $version
$env:LANDNEXUS_IMAGERY_AUTH = $mode
$env:LANDNEXUS_IMAGERY_AUTH_NAME = $name
$env:LANDNEXUS_IMAGERY_SECRET = $secret

if ($attr) {
    $env:LANDNEXUS_IMAGERY_ATTRIBUTION = $attr
}

Write-Host "`nImagery settings configured for this PowerShell session." -ForegroundColor Green
Write-Host "Access key is not displayed or written to a file."
