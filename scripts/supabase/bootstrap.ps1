param(
  [string]$ProjectRef = $(if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF } else { $env:SUPABASE_REF }),
  [string]$DbPassword = $env:SUPABASE_DB_PASSWORD
)

$ErrorActionPreference = "Stop"

if (-not $ProjectRef) {
  Write-Host "Project ref is required." -ForegroundColor Yellow
  Write-Host "Usage: .\\scripts\\supabase\\bootstrap.ps1 -ProjectRef <project_ref> -DbPassword <db_password>" -ForegroundColor Yellow
  exit 1
}

if (-not $DbPassword) {
  Write-Host "DB password is required." -ForegroundColor Yellow
  Write-Host "Usage: .\\scripts\\supabase\\bootstrap.ps1 -ProjectRef <project_ref> -DbPassword <db_password>" -ForegroundColor Yellow
  exit 1
}

& "$PSScriptRoot\\doctor.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:SUPABASE_PROJECT_REF = $ProjectRef
$env:SUPABASE_REF = $ProjectRef
$env:SUPABASE_DB_PASSWORD = $DbPassword

& "$PSScriptRoot\\link.ps1" -ProjectRef $ProjectRef
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& "$PSScriptRoot\\push.ps1" -DbPassword $DbPassword
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[supabase] bootstrap complete." -ForegroundColor Green
