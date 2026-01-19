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

### 3. UI (단일 페이지)
- 주 단위 데이터가 **우측으로 펼쳐지는 히트맵 테이블**
- 측정단위 드릴다운 구조
  - 전체 → Area group → Area → Stadium group → Stadium
- 이상치 기반 점수 계산 및 정렬
- Insights 패널 (요약 / 다음 드릴다운 제안)

### 4. 현재 확인된 상태
- Supabase 실데이터 정상 조회 확인
- `/api/weeks`, `/api/metrics` 정상 응답
- Heatmap 데이터 렌더링 정상
- 일부 지표 값(진행률 등)이 100%로만 표시되는 현상 → **SQL 검증 예정**

---

## 🔧 로컬 실행 방법

```bash
npm install
npm run dev
