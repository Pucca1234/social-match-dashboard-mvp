## Kevin Dashboard (MVP)

Supabase(BigQuery schema) 데이터를 기반으로 주간 소셜매치 지표를 조회/비교/해석하는 단일 페이지 대시보드입니다.

---

## 1. 프로젝트 목적과 배경
- 목적:
  - 운영/분석 담당자가 주간 지표를 빠르게 비교하고 이상 구간을 확인
  - 측정단위(전체/지역그룹/지역/구장그룹/구장) 단위로 추이를 읽고 의사결정 지원
- 배경:
  - 원천 데이터는 BigQuery 성격의 스키마를 Supabase(Postgres)로 적재해 사용
  - 초기에는 heatmap API가 원천 테이블 직접 조회로 느렸고, 중복 그레인으로 cnt 과대집계 이슈가 있었음
  - 현재는 MV + 인덱스 + 캐시 + 집계 규칙 정리로 성능/정확도 안정화 완료

---

## 2. 기술 스택
- Frontend/Server:
  - Next.js 14 (App Router), TypeScript, React
- Data:
  - Supabase (schema: `bigquery`)
- 주요 API:
  - `GET /api/metrics`
  - `GET /api/weeks?n=8|12|24`
  - `GET /api/filter-options?measureUnit=...`
  - `POST /api/heatmap`
  - `POST /api/ai/summary`
  - `POST /api/ai/chat`

---

## 3. 데이터 연결 구조
- 원천(읽기 전용):
  - `bigquery.data_mart_1_social_match`
  - `bigquery.metric_store_native`
- 보조 View:
  - `bigquery.weeks_view`
    - `week` 문자열에서 `week_start_date` 계산
    - KST 기준 미래 주차 제외
- 집계 MV:
  - `bigquery.weekly_agg_mv`
    - heatmap 조회용
    - 그레인: `(week, measure_unit, filter_value, metric_id)` 유일
    - 집계 규칙:
      - cnt 계열: `MAX`
      - rate 계열(`progress_match_rate`, `match_open_rate`, `match_loss_rate`): `AVG`

---

## 4. 현재 동작 방향(핵심 결정사항)
- 기간:
  - week only
  - 최근 8/12/24주는 `weeks_view` 기준으로 조회
- 전체(all) 정의:
  - `all` 값은 최종적으로 `area_group` 합과 정합하도록 검증됨
- heatmap 응답:
  - 응답 shape는 유지
  - 내부적으로 MV 조회 결과를 프론트가 쓰는 형태로 매핑
- 성능/운영:
  - `/api/weeks` 강캐시
  - `/api/metrics`, `/api/heatmap` TTL 캐시
  - request_id 기반 perf 로그(query/process/total)

---

## 5. 실행 방법 (다른 컴퓨터 온보딩용)
1. 저장소 clone
2. 의존성 설치
   - `npm install`
3. 환경변수 설정 (`.env.local`)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. 실행
   - `npm run dev`
5. 접속
   - `http://localhost:3000`

참고:
- `predev`, `prebuild`에서 UTF-8 검사 스크립트가 실행됨
- 문서/코드 인코딩이 깨지면 빌드 전에 실패하도록 설정됨

---

## 6. 운영 체크리스트
- 데이터 최신성:
  - `weeks_view` 최신 주차 확인
- MV 상태:
  - `weekly_agg_mv` refresh 여부 확인
- 성능:
  - `/api/heatmap` 로그에서 `queryMs` 확인
  - 캐시 히트 시 `queryMs/processMs`는 null로 기록됨
- 정확도:
  - `total_match_cnt`가 비정상 과대인지 주기적으로 샘플 검증

---

## 7. 변경 이력 요약
- 주차 정확도:
  - Node 문자열 파싱 제거, `weeks_view` 중심으로 정렬/필터
- 성능:
  - heatmap 원천 테이블 직조회 -> `weekly_agg_mv` 전환
  - MV 인덱스/unique index 구성
  - API 캐시 도입
- 정확도:
  - 원천 그레인 중복으로 인한 cnt 과대집계 이슈 해결
  - 집계 규칙 `cnt=MAX`, `rate=AVG` 확정
- 안정성:
  - request_id/perf 로그 체계화
  - UTF-8 검사 자동화 강화

---

## 8. 관련 문서
- 상세 요구/정책: `PRD.md`
- 성능/SQL 절차: `PERF_OPTIMIZATION.md`

