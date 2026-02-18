# Kevin MVP - Project Overview & PRD

## 1. Project Overview
Kevin is a single-page analytics dashboard built with Next.js (App Router) to analyze social match data stored in Supabase (BigQuery schema). The MVP focuses on metric-centric analysis, fast filtering, and readable trend tables with heatmap intensity and sparkline trends.

### Core Goals
- Provide a clean, guided workflow: select options -> fetch -> read insights.
- Make recent-week analysis correct (today-based weeks, no future weeks).
- Show multi-metric insights with clear visual cues (sparklines, deltas, heatmap).
- Keep the UI lightweight and debuggable (error log, deterministic AI summary).

### Non-Goals
- Complex forecasting or ML prediction.
- High-scale performance optimization (index tuning, cache layers).
- Multi-tenant or role-based authorization (out of scope for MVP).

## 2. Users & Use Cases
### Primary Users
- Operations managers / regional owners monitoring match activity.
- Analysts comparing weekly trends across regions/stadiums.

### Key Use Cases
1. Compare weekly trends for multiple metrics in a selected period.
2. Drill into region/group/stadium entities with the same metric set.
3. Identify anomalies and interpret deltas.
4. Ask quick questions via AI summary/chat panel.

## 3. Data Scope & Sources
### Data Source
- Supabase PostgREST with BigQuery schema.
- Tables:
  - `bigquery.data_mart_1_social_match`
  - `bigquery.metric_store_native`
  - `bigquery.weeks_view` (week_start_date 계산 및 KST 기준 과거 주차 필터용 VIEW)
  - `bigquery.weekly_agg_mv` (heatmap 성능 최적화용 MV, 원천 테이블 변경 없음)

### Period Rules
- Period type is week only.
- “Recent N weeks” is based on today’s week start.
- Future weeks are excluded.

## 4. Information Architecture
### Layout
- Top horizontal control bar (period/unit/filter/metrics).
- Main panel: results table.
- Floating CTA opens AI report modal (chat-style).

### Controls
- Period unit: fixed to “week”.
- Period range: recent 8/12/24 weeks.
- Measurement unit: all / area_group / area / stadium_group / stadium.
- Metrics: multi-select (at least 1 required).

### Outputs
- Heatmap-style table with:
  - entity
  - metric name
  - sparkline
  - weekly values + deltas
- AI summary + chat inside a right-bottom modal.

## 5. Functional Requirements
### 5.1 Metrics Loading
- Fetch `/api/metrics` on load.
- Timeout protection: fallback metrics list if request fails.
- UI must not remain blocked.

### 5.2 Weeks Loading
- `/api/weeks?n=8|12|24` returns most recent weeks only.
- Uses `bigquery.weeks_view` so week_start_date는 DB에서 계산/필터링됨.

### 5.3 Heatmap Query
- `/api/heatmap` accepts `weeks`, `measureUnit`, `filterValue`, `metrics`.
- Server must apply `period_type = week` and `week IN weeks`.
- Heatmap 조회는 MV(`weekly_agg_mv`) 기반으로 수행해 병목을 최소화한다.

### 5.4 Table Rendering
- Columns: entity / metric / sparkline / weeks.
- Heatmap intensity is normalized per row.
- Deltas are computed vs previous week (latest → past).
- UI does not surface anomaly icons (calculation may remain internal).

### 5.5 UI Feedback
- Loading overlay on fetch.
- Error log panel (bottom right).

### 5.6 AI Summary
- Deterministic summary from current table context.
- Chat requests use same context payload.

## 6. API Endpoints
- `GET /api/metrics`
- `GET /api/weeks?n=...`
- `GET /api/filter-options?measureUnit=...`
- `POST /api/heatmap`
- `POST /api/ai/summary`
- `POST /api/ai/chat`

## 7. UX & Visual Guidelines
- Light, card-based layout.
- Heatmap values with blue intensity.
- Sparklines: blue only (no trend-based color change).
- Compact row height for dense tables.

## 8. Validation Rules
- At least one metric must be selected.
- Weeks must be within recent range only.
- If metrics fail to load, fallback list must render.

## 9. Risks & Mitigations
- UTF-8 encoding breaks build -> enforced via check script + editor config.
- Query timeouts -> minimize columns and enforce week filter.
- Heatmap query bottleneck -> MV + MV index + concurrently refresh 운영.
- Large payloads -> limit context size for AI endpoints.

## 10. Future Enhancements (Optional)
- Entity grouping with row-span style for readability.
- Export to CSV.
- Saved filters/presets.
- Server-side caching for hot queries.
