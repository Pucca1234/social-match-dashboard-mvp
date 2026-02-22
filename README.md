# Kevin Dashboard (MVP)

플랩풋볼 운영/매칭 데이터를 주간 단위로 분석하는 내부 대시보드입니다.

## 핵심 목적
- 최근 8/12/24주 성과 추이 확인
- 측정단위(`all`, `area_group`, `area`, `stadium_group`, `stadium`)별 비교
- 지표 기반 의사결정 및 AI 요약/질문 응답 지원

## 기술 스택
- Frontend: Next.js 14, React, TypeScript
- Data: Supabase(Postgres, schema `bigquery`)
- Source Tables:
  - `bigquery.data_mart_1_social_match`
  - `bigquery.metric_store_native`
- Supporting Views:
  - `bigquery.weeks_view`
  - `bigquery.weekly_agg_mv`

## API
- `GET /api/metrics`
- `GET /api/weeks?n=8|12|24`
- `GET /api/filter-options?measureUnit=...`
- `POST /api/heatmap`
- `POST /api/ai/summary`
- `POST /api/ai/chat`

## 데이터 집계 규칙
- `cnt` 계열: `MAX(value)`
- `rate` 계열: `AVG(value)`
- 집계 그레인: `(week, measure_unit, filter_value, metric_id)`

## 최근 반영 사항 (2026-02)
- `weekly_agg_mv` 재구성:
  - `dimension_type` 기반으로 단위별(`all/area_group/area/stadium_group/stadium`) 집계
  - 기존 `stadium_group/stadium` 누락 이슈 해소
- 지표 처리 확장:
  - 고정 6개 지표에서 벗어나, `metric_store_native`와 원천 컬럼 교집합 기준의 동적 지표 지원
- 조회 효율화:
  - Heatmap API 요청 시 선택 지표만 조회
- 운영 안정화:
  - `HEATMAP_ALLOW_BASE_FALLBACK=1`일 때만 원천 fallback 허용(기본 OFF)
- 자동 검증:
  - 전체 지원 지표 대상 원천 vs MV 정합성 검증 스크립트 추가
  - PR마다 GitHub Actions에서 자동 검증

## 실행
1. 의존성 설치
```bash
npm install
```

2. 환경변수 설정 (`.env.local`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

3. 개발 실행
```bash
npm run dev
```

## 데이터 검증
- 로컬 전체 지표 검증
```bash
npm run data:validate-mv
```

- PR 자동 검증
  - 워크플로: `.github/workflows/data-validation.yml`
  - 필요한 GitHub Secrets:
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_ROLE_KEY`

## Supabase 배포 워크플로
- 마이그레이션: `supabase/migrations/202602210001_weekly_agg_mv_v2.sql`
- 빠른 실행 가이드: `SUPABASE_CLI_WORKFLOW.md`

## 참고 문서
- 요구사항/운영 기준: `PRD.md`
- 성능/SQL 참고: `PERF_OPTIMIZATION.md`
