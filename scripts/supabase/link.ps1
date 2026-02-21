param(
  [string]$ProjectRef = $(if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF } else { $env:SUPABASE_REF })
)

$ErrorActionPreference = "Stop"

if (-not $ProjectRef) {
  Write-Host "Usage: .\\scripts\\supabase\\link.ps1 -ProjectRef <project_ref>" -ForegroundColor Yellow
  Write-Host "Or set env var SUPABASE_PROJECT_REF (or SUPABASE_REF) first." -ForegroundColor Yellow
  exit 1
}

Write-Host "[supabase] linking project: $ProjectRef" -ForegroundColor Cyan
$SupabaseCmd = "supabase"
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  $SupabaseCmd = "npx supabase"
}
Invoke-Expression "$SupabaseCmd link --project-ref $ProjectRef"

if ($LASTEXITCODE -ne 0) {
  Write-Host "[supabase] link failed." -ForegroundColor Red
  exit 1
}

Write-Host "[supabase] link complete." -ForegroundColor Green
