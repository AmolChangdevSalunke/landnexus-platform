$env:Path += ";C:\Program Files\PostgreSQL\18\bin"
psql -U postgres -h localhost -c "DROP DATABASE IF EXISTS landnexus_demo WITH (FORCE);"
psql -U postgres -h localhost -c "CREATE DATABASE landnexus_demo;"
if ($env:LANDNEXUS_STORAGE_DIR -and (Test-Path $env:LANDNEXUS_STORAGE_DIR)) {
    Get-ChildItem $env:LANDNEXUS_STORAGE_DIR | Remove-Item -Recurse -Force
}
Write-Host "Demo database recreated. Now start the backend (it creates the tables), then run demo-seed-real.ps1."