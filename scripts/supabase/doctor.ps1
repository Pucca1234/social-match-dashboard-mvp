$ErrorActionPreference = "Stop"

Write-Host "[supabase] checking CLI..." -ForegroundColor Cyan

$SupabaseCmd = "supabase"
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  $SupabaseCmd = "npx supabase"
  Write-Host "[supabase] global CLI not found. Falling back to npx." -ForegroundColor Yellow
}

Invoke-Expression "$SupabaseCmd --version"
if ($LASTEXITCODE -ne 0) {
  Write-Host "[supabase] CLI command is not available." -ForegroundColor Red
  Write-Host "Install: winget install Supabase.CLI (or use npx with Node.js)" -ForegroundColor Yellow
  exit 1
}

Write-Host "[supabase] checking login status..." -ForegroundColor Cyan
$status = Invoke-Expression "$SupabaseCmd projects list 2>&1"
if ($LASTEXITCODE -ne 0) {
  Write-Host "[supabase] not logged in (or access issue)." -ForegroundColor Yellow
  Write-Host "Run: $SupabaseCmd login" -ForegroundColor Yellow
  exit 1
}

Write-Host "[supabase] login OK" -ForegroundColor Green
