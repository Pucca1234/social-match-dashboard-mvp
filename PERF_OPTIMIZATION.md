# 성능 최적화 가이드 (Supabase / Next.js)

이 문서는 **백엔드 성능 개선만** 다룹니다. UI/디자인 내용 없음.
원천 테이블 스키마는 변경하지 않습니다.

## 0) 내가 이미 적용한 코드 변경
- /api/metrics, /api/heatmap에 요청별 성능 로그 추가
  - queryMs / processMs / totalMs
- /api/weeks 강캐시, /api/metrics(5분) /api/heatmap(3분) 캐시 적용

---

## (1) 실행 순서 체크리스트 (Supabase SQL Editor)
1. EXPLAIN 템플릿 실행해 병목 확인
2. 1순위 인덱스(week 단일) 생성
3. 2순위 인덱스(필요한 1~2개만) 생성
4. 그래도 느리면 MV 도입(조건부)

---

## (2) EXPLAIN 템플릿 (8/12/24주)

### 2-1. /api/metrics (period_type 조건 제거)
```
EXPLAIN (ANALYZE, BUFFERS)
select
  metric,
  korean_name,
  description
from bigquery.metric_store_native
order by metric;
```

### 2-2. /api/heatmap (실제 호출 형태에 맞춤, 원천 테이블 기준)
**8주**
```
with w as (
  select week
  from bigquery.weeks_view
  order by week_start_date desc
  limit 8
)
EXPLAIN (ANALYZE, BUFFERS)
select
  week,
  area_group,
  area,
  stadium_group,
  stadium,
  total_match_cnt,
  setting_match_cnt,
  progress_match_cnt,
  progress_match_rate,
  match_open_rate,
  match_loss_rate
from bigquery.data_mart_1_social_match
where week in (select week from w)
  -- 아래 조건은 실제 호출에 맞춰 1개만 선택
  -- and area_group is not null
  -- and area_group = '...'
order by week desc;
```

### 2-3. /api/heatmap (MV 기준, 적용 후에 사용)
**8주**
```
with w as (
  select week
  from bigquery.weeks_view
  order by week_start_date desc
  limit 8
)
EXPLAIN (ANALYZE, BUFFERS)
select
  week,
  measure_unit,
  filter_value,
  metric_id,
  value
from bigquery.weekly_agg_mv
where week in (select week from w)
  and measure_unit = 'area_group'
  and metric_id in ('total_match_cnt', 'setting_match_cnt')
  -- optional: and filter_value = '...'
order by week desc;
```

**12주**
```
with w as (
  select week
  from bigquery.weeks_view
  order by week_start_date desc
  limit 12
)
EXPLAIN (ANALYZE, BUFFERS)
select
  week,
  measure_unit,
  filter_value,
  metric_id,
  value
from bigquery.weekly_agg_mv
where week in (select week from w)
  and measure_unit = 'area_group'
  and metric_id in ('total_match_cnt', 'setting_match_cnt')
  -- optional: and filter_value = '...'
order by week desc;
```

**24주**
```
with w as (
  select week
  from bigquery.weeks_view
  order by week_start_date desc
  limit 24
)
EXPLAIN (ANALYZE, BUFFERS)
select
  week,
  measure_unit,
  filter_value,
  metric_id,
  value
from bigquery.weekly_agg_mv
where week in (select week from w)
  and measure_unit = 'area_group'
  and metric_id in ('total_match_cnt', 'setting_match_cnt')
  -- optional: and filter_value = '...'
order by week desc;
```

**12주**
```
with w as (
  select week
  from bigquery.weeks_view
  order by week_start_date desc
  limit 12
)
EXPLAIN (ANALYZE, BUFFERS)
select
  week,
  area_group,
  area,
  stadium_group,
  stadium,
  total_match_cnt,
  setting_match_cnt,
  progress_match_cnt,
  progress_match_rate,
  match_open_rate,
  match_loss_rate
from bigquery.data_mart_1_social_match
where week in (select week from w)
  -- and area_group is not null
  -- and area_group = '...'
order by week desc;
```

**24주**
```
with w as (
  select week
  from bigquery.weeks_view
  order by week_start_date desc
  limit 24
)
EXPLAIN (ANALYZE, BUFFERS)
select
  week,
  area_group,
  area,
  stadium_group,
  stadium,
  total_match_cnt,
  setting_match_cnt,
  progress_match_cnt,
  progress_match_rate,
  match_open_rate,
  match_loss_rate
from bigquery.data_mart_1_social_match
where week in (select week from w)
  -- and area_group is not null
  -- and area_group = '...'
order by week desc;
```

---

## (3) 인덱스 전략 (우선순위 + 롤백)

### 3-1. 1순위 (즉시 적용)
```
create index concurrently if not exists idx_dmart_week
on bigquery.data_mart_1_social_match (week);
```

### 3-2. 2순위 (실제 API에서 자주 쓰는 1~2개만)
- **가장 자주 쓰는 dimension에만 먼저 적용**
- 아래 중 1~2개 선택 실행

```
create index concurrently if not exists idx_dmart_week_area_group
on bigquery.data_mart_1_social_match (week, area_group)
where area_group is not null;

create index concurrently if not exists idx_dmart_week_area
on bigquery.data_mart_1_social_match (week, area)
where area is not null;

create index concurrently if not exists idx_dmart_week_stadium_group
on bigquery.data_mart_1_social_match (week, stadium_group)
where stadium_group is not null;

create index concurrently if not exists idx_dmart_week_stadium
on bigquery.data_mart_1_social_match (week, stadium)
where stadium is not null;
```

### 3-3. metrics (필요시)
```
create index concurrently if not exists idx_metricstore_metric
on bigquery.metric_store_native (metric);
```

### 3-4. 롤백 (인덱스 삭제)
```
drop index concurrently if exists idx_dmart_week;
drop index concurrently if exists idx_dmart_week_area_group;
drop index concurrently if exists idx_dmart_week_area;
drop index concurrently if exists idx_dmart_week_stadium_group;
drop index concurrently if exists idx_dmart_week_stadium;
drop index concurrently if exists idx_metricstore_metric;
```

---

## (4) MV/집계 도입 (인덱스 적용 후에도 느릴 때만)

### 4-1. 안전 가이드 (원천 적재 영향 없음)
- 원천 테이블은 **Read-only**
- 신규 리소스는 **bigquery 스키마 내 별도 네이밍** 사용 (weekly_agg_*, cache_*)
- Refresh/배치 실행은 **오프피크** 권장
- MV refresh는 IO를 유발하므로 **주 1회 or 배치 직후 1회**가 적절

### 4-2. MV 설계 (unpivot, week only, future week 제외, cnt=MAX / rate=AVG)
**정확도 최종 규칙**
- cnt 계열은 **MAX 집계** (원천 그레인 중복으로 인한 더블카운팅 제거 목적)
- rate 계열은 **AVG 집계**
  - 적용 지표: progress_match_rate, match_open_rate, match_loss_rate
```
create materialized view if not exists bigquery.weekly_agg_mv as
select
  week,
  measure_unit,
  filter_value,
  metric_id,
  case
    when metric_id in ('progress_match_rate', 'match_open_rate', 'match_loss_rate')
      then avg(value)
    else max(value)
  end as value
from (
  select
    s.week,
    case
      when s.area_group is not null then 'area_group'
      when s.area is not null then 'area'
      when s.stadium_group is not null then 'stadium_group'
      when s.stadium is not null then 'stadium'
      else 'all'
    end as measure_unit,
    case
      when s.area_group is not null then s.area_group
      when s.area is not null then s.area
      when s.stadium_group is not null then s.stadium_group
      when s.stadium is not null then s.stadium
      else '전체'
    end as filter_value,
    m.metric_id,
    m.value
  from bigquery.data_mart_1_social_match s
  join bigquery.weeks_view w on w.week = s.week
  cross join lateral (
    values
      ('total_match_cnt', s.total_match_cnt),
      ('setting_match_cnt', s.setting_match_cnt),
      ('progress_match_cnt', s.progress_match_cnt),
      ('progress_match_rate', s.progress_match_rate),
      ('match_open_rate', s.match_open_rate),
      ('match_loss_rate', s.match_loss_rate)
  ) as m(metric_id, value)
  where s.period_type = 'week'
) t
group by week, measure_unit, filter_value, metric_id;
```

### 4-2-1. 적용 절차 (drop → create → index → refresh)
**기본 권장: non-concurrently로 순서 실행**
```
drop materialized view if exists bigquery.weekly_agg_mv;

create materialized view bigquery.weekly_agg_mv as
select
  week,
  measure_unit,
  filter_value,
  metric_id,
  case
    when metric_id in ('progress_match_rate', 'match_open_rate', 'match_loss_rate')
      then avg(value)
    else max(value)
  end as value
from (
  select
    s.week,
    case
      when s.area_group is not null then 'area_group'
      when s.area is not null then 'area'
      when s.stadium_group is not null then 'stadium_group'
      when s.stadium is not null then 'stadium'
      else 'all'
    end as measure_unit,
    case
      when s.area_group is not null then s.area_group
      when s.area is not null then s.area
      when s.stadium_group is not null then s.stadium_group
      when s.stadium is not null then s.stadium
      else '전체'
    end as filter_value,
    m.metric_id,
    m.value
  from bigquery.data_mart_1_social_match s
  join bigquery.weeks_view w on w.week = s.week
  cross join lateral (
    values
      ('total_match_cnt', s.total_match_cnt),
      ('setting_match_cnt', s.setting_match_cnt),
      ('progress_match_cnt', s.progress_match_cnt),
      ('progress_match_rate', s.progress_match_rate),
      ('match_open_rate', s.match_open_rate),
      ('match_loss_rate', s.match_loss_rate)
  ) as m(metric_id, value)
  where s.period_type = 'week'
) t
group by week, measure_unit, filter_value, metric_id;

create index if not exists idx_weekly_agg_mv_unit_week_metric
on bigquery.weekly_agg_mv (measure_unit, week, metric_id);

create index if not exists idx_weekly_agg_mv_unit_filter_week_metric
on bigquery.weekly_agg_mv (measure_unit, filter_value, week, metric_id);

create unique index if not exists idx_weekly_agg_mv_uniq
on bigquery.weekly_agg_mv (week, measure_unit, filter_value, metric_id);

refresh materialized view bigquery.weekly_agg_mv;
```

**참고: concurrently 사용 시**
- Supabase SQL Editor에서 `refresh materialized view concurrently`는 트랜잭션 블록 내에서 실행 불가
- 위 unique index가 반드시 필요

### 4-2-2. 대안 (rate도 max로 통일 - 정확도 trade-off)
```
-- 집계 부분만 변경
case
  when metric_id in ('progress_match_rate', 'match_open_rate', 'match_loss_rate')
    then max(value)
  else max(value)
end as value
```

### 4-3. Refresh 방식 2안
**일반 refresh (간단, 락 영향 가능)**
```
refresh materialized view bigquery.weekly_agg_mv;
```

**concurrently refresh (권장, unique index 필요)**
```
create unique index if not exists idx_weekly_agg_mv_uniq
on bigquery.weekly_agg_mv (week, measure_unit, filter_value, metric_id);

refresh materialized view concurrently bigquery.weekly_agg_mv;
```

### 4-3-1. 운영 기준 (권장)
- 권장: **배치 적재 직후 1회 refresh**
- Supabase SQL Editor에서 **concurrently refresh는 트랜잭션 블록 안에서 실행 불가**
  - `begin; ... refresh materialized view concurrently ...;` 형태로 감싸지 않기
- concurrently refresh를 쓰려면 **unique index가 반드시 필요**

### 4-4. MV 조회용 인덱스 (쿼리 조건 최적화)
```
create index concurrently if not exists idx_weekly_agg_mv_unit_week_metric
on bigquery.weekly_agg_mv (measure_unit, week, metric_id);

create index concurrently if not exists idx_weekly_agg_mv_unit_filter_week_metric
on bigquery.weekly_agg_mv (measure_unit, filter_value, week, metric_id);
```

### 4-5. measure_unit/filter_value 우선순위 규칙
- 우선순위: area_group > area > stadium_group > stadium > all
- **확인 필요**: 원천 데이터에서 한 row에 여러 dimension이 동시에 채워지는 구조인지
  - 만약 여러 컬럼이 동시에 not null이면 위 우선순위로만 1개 값이 선택됨
  - 구조가 다르면 별도 규칙 재정의 필요

---

## (5) 아키텍처 정합성 체크
- week only 유지
- future week 제외 (weeks_view 기준)
- 원천 테이블 스키마 변경 없음
- 신규 리소스는 별도 네이밍으로 분리
- 기존 API 응답 구조 유지

## (6) 정확도 검증 SQL (cnt 과대집계 수정 확인)
**대상 주차 예시: 26.02.16 - 02.22**

1) 전체(all) total_match_cnt이 과대에서 정상으로 내려가는지 확인
```
select
  week,
  sum(value) as total_from_all
from bigquery.weekly_agg_mv
where measure_unit = 'all'
  and metric_id = 'total_match_cnt'
  and week = '26.02.16 - 02.22'
group by 1;
```

2) area_group 값이 sum이 아닌 max 기반으로 내려갔는지 확인
```
select
  week,
  filter_value as area_group,
  sum(value) as sum_cnt,
  max(value) as max_cnt
from bigquery.weekly_agg_mv
where measure_unit = 'area_group'
  and metric_id = 'total_match_cnt'
  and week = '26.02.16 - 02.22'
group by 1,2
order by sum_cnt desc;
```

3) all 정의 검증: all = sum(area_group)
```
with ag as (
  select
    week,
    sum(value) as total_from_area_group
  from bigquery.weekly_agg_mv
  where measure_unit = 'area_group'
    and metric_id = 'total_match_cnt'
    and week = '26.02.16 - 02.22'
  group by 1
),
allv as (
  select
    week,
    sum(value) as total_from_all
  from bigquery.weekly_agg_mv
  where measure_unit = 'all'
    and metric_id = 'total_match_cnt'
    and week = '26.02.16 - 02.22'
  group by 1
)
select
  ag.week,
  ag.total_from_area_group,
  allv.total_from_all,
  (ag.total_from_area_group - allv.total_from_all) as diff
from ag
join allv on ag.week = allv.week;
```
**기대값:** diff = 0 (all = area_group 합으로 정합성 확정)
