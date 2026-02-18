## 📊 Social Match Analytics Dashboard (MVP)

Supabase(BigQuery 연결)를 기반으로 한  
소셜 매치 데이터 이상 탐지/분석용 MVP 대시보드입니다.

---

## ✅ 현재 구현된 기능 (2026-01 기준)

### 1. 데이터 소스
- Supabase + BigQuery 연동
- schema: `bigquery`
- 주요 테이블:
  - `data_mart_1_social_match`
  - `metric_store_native`

### 2. API 엔드포인트
- `GET /api/weeks`
  - 주 단위(`week`) 라벨 전체 목록 반환
- `GET /api/metrics`
  - 지표 사전 (metric id / 한글명 / 설명)
- `POST /api/heatmap`
  - 측정단위 / 필터 / 주 목록 기준 히트맵 데이터 반환

### 2-1. 주차 조회 개선 (2026-02)
- `/api/weeks`는 `bigquery.weeks_view`를 조회
- VIEW에서 KST 기준 과거 주차만 필터링 + 정렬
- week 문자열 파싱을 Node에서 제거하여 환경 차이 이슈 방지

### 3. UI (단일 페이지)
- 상단 가로형 조회 옵션 바 (좌측 패널 제거)
- 주 단위 데이터가 **좌: 최신 → 우: 과거** 순서로 펼쳐지는 히트맵 테이블
- 측정단위 드릴다운 구조
  - 전체 → Area group → Area → Stadium group → Stadium
- 스파크라인/증감/히트맵 기반 시계열 요약
- 우측 하단 **AI 분석 리포트** 플로팅 버튼 + 모달(채널톡 스타일)

### 4. 현재 확인된 상태
- Supabase 실데이터 정상 조회 확인
- `/api/weeks`, `/api/metrics`, `/api/heatmap` 정상 응답
- Heatmap/스파크라인 렌더링 정상
- 최근 N주(8/12/24) 조회는 오늘 기준으로 필터링됨

---

## 🔧 로컬 실행 방법

```bash
npm install
npm run dev
```

## ? 오늘 작업 (2026-02-18)

이번 작업은 heatmap 병목을 해소하고, 운영 안정성을 높이는 데 집중했습니다.  
아래는 변경의 이유/내용/방식 요약입니다.

### 1) 왜
- `/api/heatmap`의 DB 쿼리가 3초 수준으로 느려 실사용에 병목이 발생했습니다.
- 캐시/계측 로그만으로는 근본적인 쿼리 병목을 해소하기 어려웠습니다.

### 2) 무엇을
- heatmap 조회를 **materialized view(weekly_agg_mv)** 기반으로 전환
- **cnt 계열 MAX / rate 계열 AVG** 집계 규칙으로 과대 집계 제거
- MV 인덱스/unique index를 통해 **concurrently refresh 가능**하게 구성
- `/api/heatmap`, `/api/metrics` 성능 로그에 캐시 히트 여부를 명확히 표시
- `PERF_OPTIMIZATION.md`에 정확도 검증/운영/SQL 절차 정리

### 3) 어떻게
- MV에서 `week, measure_unit, filter_value, metric_id` 유일 그레인으로 집계
- MV 조회용 인덱스 구성 → `measure_unit/weight/metric_id` 기준 최적화
- 캐시 히트 시 `queryMs/processMs`는 null로 기록해 혼동 제거

### 4) Supabase 연동 주의사항
- `.env.local`에 아래 키를 설정해야 합니다. **민감값은 저장소에 커밋 금지**
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

---
