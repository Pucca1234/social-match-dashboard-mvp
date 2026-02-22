# Supabase CLI Workflow

This project is prepared for a repeatable `Supabase CLI + migration` flow.

## 1) One-time setup (Windows)

```powershell
winget install Supabase.CLI
supabase --version
```

Login once:

```powershell
supabase login
```

## 2) Project link

Option A: direct command

```powershell
supabase link --project-ref <your_project_ref>
```

Option B: helper script

```powershell
npm run sb:link -- -ProjectRef <your_project_ref>
```

Environment variable fallback is supported:

```powershell
$env:SUPABASE_PROJECT_REF = "<your_project_ref>"
# or
$env:SUPABASE_REF = "<your_project_ref>"
```

## 3) DB password for migration push

Set your DB password in current shell session:

```powershell
$env:SUPABASE_DB_PASSWORD = "<your_db_password>"
```

## 4) Push migrations

```powershell
npm run sb:push
```

Current migration file:

- `supabase/migrations/202602210001_weekly_agg_mv_v2.sql`

## 4-1) One-command bootstrap

After CLI installation and `supabase login`, you can run:

```powershell
npm run sb:bootstrap -- -ProjectRef <your_project_ref> -DbPassword <your_db_password>
```

## 5) Health check helpers

```powershell
npm run sb:doctor
```

## 6) Validation after push

Run these in Supabase SQL Editor:

- `sql/validate_weekly_agg_mv_v2.sql`

Expected for the recent issue:

- `stadium_group` and `stadium` should no longer be zero-row in `weekly_agg_mv`.
- mismatch summary should show `missing_rows = 0` and `mismatch_rows = 0` for `total_match_cnt` recent 8 weeks.

## 7) Full metric validation from local script

This validates source vs `weekly_agg_mv` for all supported metrics in recent 8 weeks:

```powershell
npm run data:validate-mv
```

Optional overrides:

```powershell
$env:MV_VALIDATE_WEEKS="12"
$env:MV_VALIDATE_EPSILON="0.000001"
# comma-separated metrics subset
$env:MV_VALIDATE_METRICS="total_match_cnt,progress_match_rate,sales"
```

## 8) PR auto validation (GitHub Actions)

Workflow file:

- `.github/workflows/data-validation.yml`

Required repository secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Behavior:

- Runs automatically on every `pull_request`
- Runs `npm run data:validate-mv`
- Fails fast if required secrets are missing

## 9) One-command PR preparation

Run build + data validation + commit:

```powershell
npm run release:prepare -- -CommitMessage "chore: update dashboard data pipeline"
```

Run everything above + push:

```powershell
npm run release:prepare -- -CommitMessage "chore: update dashboard data pipeline" -Push
```

Optional auto PR creation (requires `gh` CLI):

```powershell
npm run release:prepare -- -CommitMessage "chore: update dashboard data pipeline" -Push -CreatePr -BaseBranch main
```
