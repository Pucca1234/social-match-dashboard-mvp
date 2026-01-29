# Kevin Dashboard AI Context

This repo is a Next.js (App Router) single-page analytics dashboard for social match data, backed by Supabase (BigQuery schema). It is a metric-centric dashboard with a guided flow: select options -> fetch -> read results. This file is a compact context so AI tools can quickly understand the current system and UX expectations.

## Product Summary
- Name: Kevin
- Purpose: Weekly KPI analysis across overall and entity units (region group, region, stadium group, stadium).
- Core UX: left option panel, main results table, AI summary/chat section at the bottom.

## Data Sources
- Supabase (PostgREST) with BigQuery schema.
- Tables:
  - `bigquery.data_mart_1_social_match`
  - `bigquery.metric_store_native`

## API Endpoints
- `GET /api/metrics`
- `GET /api/weeks?n=...`
- `GET /api/filter-options?measureUnit=...`
- `POST /api/heatmap`
- `POST /api/ai/summary`
- `POST /api/ai/chat`

## Core Logic
- Weeks are filtered to recent N weeks based on today’s week start; future weeks excluded.
- Metrics are multi-select; at least one metric is required.
- Heatmap intensity is normalized per row (per metric row) and now in blue tone.
- Sparkline color: blue for upward trend, red for downward trend.
- Anomaly flag (⚠️) shown on entity/metric if z-score >= 2.

## Table Structure (Entity Unit)
Columns: Entity / Metric / Sparkline / Week values
- Entity name shown once per group (sub-rows hide entity label).
- Metric column shows only metric name (no description).
- Week columns show value + delta.

## UI Notes
- Measurement unit buttons are laid out in 1/2/2 grid.
- Left panel should not scroll vertically.
- Table rows are compact; header row slightly darker than before.
- Horizontal scroll is on the bottom of the table only.
- Floating button jumps to AI summary section after results load.

## Error Handling
- Metrics loading has a timeout; fallback metrics are shown if API hangs.
- Error log panel captures console errors.

## Files of Interest
- `app/page.tsx`: main page, data fetching, state, layout, AI summary/chat.
- `app/components/EntityMetricTable.tsx`: entity table rendering (grouped entities).
- `app/components/MetricTable.tsx`: overall metrics table.
- `app/components/Sparkline.tsx`: trend chart with dynamic color.
- `app/api/ai/summary/route.ts` and `app/api/ai/chat/route.ts`: deterministic AI.
- `app/lib/dataQueries.ts`: week selection, metrics dictionary, heatmap queries.
- `app/globals.css`: UI styling.

## Environment Variables (names only)
- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or equivalent service role key)

## Encoding / Build Safety
- UTF-8 enforced via `.editorconfig`, `.gitattributes`, and `scripts/check-utf8.mjs` (runs in predev/prebuild).
