param(
  [string]$DbPassword = $env:SUPABASE_DB_PASSWORD
)

$ErrorActionPreference = "Stop"

if (-not $DbPassword) {
  Write-Host "SUPABASE_DB_PASSWORD is not set." -ForegroundColor Yellow
  Write-Host "Example: `$env:SUPABASE_DB_PASSWORD='your-db-password'" -ForegroundColor Yellow
  exit 1
}

$env:SUPABASE_DB_PASSWORD = $DbPassword

Write-Host "[supabase] pushing local migrations to linked project..." -ForegroundColor Cyan
$SupabaseCmd = "supabase"
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  $SupabaseCmd = "npx supabase"
}
Invoke-Expression "$SupabaseCmd db push"

if ($LASTEXITCODE -ne 0) {
  Write-Host "[supabase] db push failed." -ForegroundColor Red
  exit 1
}

Write-Host "[supabase] db push complete." -ForegroundColor Green
