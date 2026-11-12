param([string]$BaseUrl = "http://localhost:8080/api/v1", [string]$AdminUser = $env:LANDNEXUS_ADMIN_USERNAME, [string]$AdminPassword = $env:LANDNEXUS_ADMIN_PASSWORD)
$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body (@{ username = $AdminUser; password = $AdminPassword } | ConvertTo-Json)
$doc = Invoke-RestMethod -Uri "$BaseUrl/meta/openapi.json" -Headers @{ Authorization = "Bearer $($login.accessToken)" }
$target = Join-Path (Split-Path $PSScriptRoot -Parent) "docs\openapi.json"
[System.IO.File]::WriteAllText($target, ($doc | ConvertTo-Json -Depth 100), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Saved $target ($(@($doc.paths.PSObject.Properties).Count) paths). Open it in Swagger Editor, Postman or Insomnia."
