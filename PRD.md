# Kevin MVP - Product Requirements Document

## 1. 문서 목적
이 문서는 Kevin 대시보드의 제품 목적, 데이터 구조, 핵심 요구사항, 확정된 기술 의사결정, 운영 기준을 한 번에 전달하기 위한 기준 문서다.  
새로운 작업자는 본 문서만 읽고도 현재 상태와 다음 작업 방향을 이해할 수 있어야 한다.

---

## 2. 제품 개요
- 제품명: Kevin
- 형태: Next.js App Router 기반 단일 페이지 대시보드
- 사용자: 운영 담당자, 분석 담당자
- 주요 시나리오:
  - 최근 N주(8/12/24) 지표 추이 조회
  - 측정단위 전환(전체/지역그룹/지역/구장그룹/구장)
  - 지표 다중 선택 후 heatmap + sparkline 기반 비교
  - AI 요약/질문 응답으로 빠른 해석 지원

---

## 3. 문제 배경과 해결 방향
### 3.1 초기 문제
- 최근 주차 계산이 환경에 따라 흔들릴 수 있었음
- heatmap API가 원천 테이블 직접 조회로 느림
- 원천 그레인 중복으로 `total_match_cnt` 과대집계 발생

### 3.2 해결 방향
- 주차 기준은 DB(`weeks_view`)를 단일 소스로 사용
- 성능은 집계 MV(`weekly_agg_mv`) + 인덱스 + 캐시로 개선
- 정확도는 집계 규칙(`cnt=MAX`, `rate=AVG`)으로 고정

---

## 4. 데이터 구조 및 책임 분리
### 4.1 원천 테이블 (Read-only, 변경 금지)
- `bigquery.data_mart_1_social_match`
- `bigquery.metric_store_native`

### 4.2 보조 View
- `bigquery.weeks_view`
  - `week_start_date` 계산
  - KST 기준 미래 주차 제외

### 4.3 집계 Materialized View
- `bigquery.weekly_agg_mv`
- 유일 그레인:
  - `(week, measure_unit, filter_value, metric_id)`
- 집계 규칙(정확도 확정):
  - cnt 계열: `MAX`
  - rate 계열: `AVG`
    - `progress_match_rate`
    - `match_open_rate`
    - `match_loss_rate`

### 4.4 전체(all) 정의
- 검증 결과:
  - 특정 주차에서 `all total_match_cnt == sum(area_group total_match_cnt)` 정합
- 해석:
  - 현재 구조에서 `all`은 하위 단위 총량과 일치해야 하며 이를 운영 검증 항목으로 유지

---

## 5. 기능 요구사항 (현재 기준)
### 5.1 기간/주차
- period는 week only
- 최근 범위: 8/12/24주
- 미래 주차 제외

### 5.2 metrics
- 최소 1개 선택 필수
- 실패 시 fallback metric 사용 가능

### 5.3 heatmap
- 요청 입력:
  - `weeks[]`, `measureUnit`, `filterValue`, `metrics[]`
- 내부 처리:
  - MV 조회
  - 프론트 응답 shape 유지
  - 기존 계산 로직(델타/정규화/정렬) 계약 유지

### 5.4 AI 보조 기능
- `POST /api/ai/summary`
- `POST /api/ai/chat`
- 조회 컨텍스트 기반 요약/응답

---

## 6. API 계약
- `GET /api/metrics`
- `GET /api/weeks?n=...`
- `GET /api/filter-options?measureUnit=...`
- `POST /api/heatmap`
- `POST /api/ai/summary`
- `POST /api/ai/chat`

제약:
- 기존 응답 shape 변경 최소화
- UI 변경 작업과 API 계약 변경을 분리

---

## 7. 성능/운영 요구사항
### 7.1 성능 계측
- `/api/metrics`, `/api/heatmap`:
  - `request_id`
  - `queryMs`
  - `processMs`
  - `totalMs`
- 캐시 히트 시:
  - `queryMs/processMs`는 null
  - `cacheAgeMs`로 판단

### 7.2 캐시 전략
- `/api/weeks`: 강캐시
- `/api/metrics`, `/api/heatmap`: TTL 캐시(수분 단위)

### 7.3 MV refresh 전략
- 기본 권장:
  - 배치 적재 직후 1회 refresh
- `refresh materialized view concurrently` 사용 시:
  - unique index 필수
  - 트랜잭션 블록 내 실행 금지

---

## 8. 정확도 검증 규칙
정기 점검 시 아래를 확인한다.
1. `weekly_agg_mv`에서 `total_match_cnt` 과대 합산 재발 여부
2. 특정 week 기준으로 `all`과 `area_group 합` 일치 여부
3. rate 지표가 비정상 범위인지(AVG 기준)

상세 SQL은 `PERF_OPTIMIZATION.md`를 단일 소스로 사용한다.

---

## 9. 비기능 요구사항
- 인코딩 안정성:
  - UTF-8 강제 검사(predev/prebuild)
- 운영 안전성:
  - 원천 스키마 변경 금지
  - 신규 리소스는 분리 네이밍 사용(`weekly_agg_*`, `cache_*`)
- 디버깅:
  - 에러 로그와 request_id로 요청 단위 추적 가능해야 함

---

## 10. 업데이트 히스토리 요약
### 2026-01 ~ 2026-02
- 주차 조회 정확성 개선 (`weeks_view` 중심)
- heatmap 성능 개선 (원천 조회 -> MV 조회)
- cnt 과대집계 이슈 해결 (`cnt=MAX`, `rate=AVG`)
- 캐시 및 성능 로깅 체계화
- UTF-8 재발 방지 체크 강화

---

## 11. 다음 작업 원칙
- 백엔드 성능/정확도 작업과 UI 작업은 분리 브랜치로 진행
- 작업 완료 시:
  - `README.md`, `PRD.md` 업데이트
  - 운영 영향 포인트(쿼리, 캐시, refresh) 명시
  - 회귀 검증 항목 기록

