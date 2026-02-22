param(
  [string]$CommitMessage = "chore: data validation and dashboard updates",
  [string]$BaseBranch = "main",
  [switch]$Push,
  [switch]$CreatePr,
  [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"

function Run-Step([string]$Command) {
  Write-Host ">> $Command" -ForegroundColor Cyan
  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command"
  }
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $branch) {
  throw "Could not detect current git branch."
}

Write-Host "[release] current branch: $branch" -ForegroundColor Green

if (-not $SkipChecks) {
  Run-Step "npm run build"
  Run-Step "npm run data:validate-mv"
} else {
  Write-Host "[release] checks skipped." -ForegroundColor Yellow
}

Run-Step "git add -A"

$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Host "[release] nothing to commit." -ForegroundColor Yellow
} else {
  Run-Step "git commit -m ""$CommitMessage"""
}

if ($Push) {
  Run-Step "git push -u origin $branch"
} else {
  Write-Host "[release] push skipped. Use -Push to push automatically." -ForegroundColor Yellow
}

if ($CreatePr) {
  $gh = Get-Command gh -ErrorAction SilentlyContinue
  if (-not $gh) {
    Write-Host "[release] gh CLI not found. PR auto-create skipped." -ForegroundColor Yellow
    Write-Host "Create PR manually: compare '$branch' -> '$BaseBranch'" -ForegroundColor Yellow
  } else {
    if (-not $Push) {
      Write-Host "[release] -CreatePr requires branch push first. Pushing now..." -ForegroundColor Yellow
      Run-Step "git push -u origin $branch"
    }
    Run-Step "gh pr create --base $BaseBranch --head $branch --fill"
  }
}

Write-Host "[release] done." -ForegroundColor Green
