-- Validation queries for weekly_agg_mv v2
-- Focus: source vs MV consistency at each measurement unit.

-- 1) Unit coverage check
select
  measure_unit,
  count(*) as row_count
from bigquery.weekly_agg_mv
group by measure_unit
order by measure_unit;

-- 2) Recent 8-week coverage for total_match_cnt on stadium/stadium_group
with w as (
  select week
  from bigquery.weeks_view
  order by week_start_date desc
  limit 8
),
expected as (
  select
    s.week,
    s.dimension_type as measure_unit,
    case
      when s.dimension_type = 'stadium_group' then s.stadium_group
      when s.dimension_type = 'stadium' then s.stadium
      else null
    end as filter_value,
    max(s.total_match_cnt) as expected_value
  from bigquery.data_mart_1_social_match s
  where s.period_type = 'week'
    and s.day is null
    and s.yoil is null
    and s.yoil_group is null
    and s.hour is null
    and s.time is null
    and s.week in (select week from w)
    and s.dimension_type in ('stadium_group', 'stadium')
  group by 1, 2, 3
),
actual as (
  select
    week,
    measure_unit,
    filter_value,
    value as actual_value
  from bigquery.weekly_agg_mv
  where metric_id = 'total_match_cnt'
    and measure_unit in ('stadium_group', 'stadium')
    and week in (select week from w)
)
select
  e.week,
  e.measure_unit,
  e.filter_value,
  e.expected_value,
  a.actual_value,
  (a.actual_value - e.expected_value) as diff
from expected e
left join actual a
  on a.week = e.week
 and a.measure_unit = e.measure_unit
 and a.filter_value = e.filter_value
where a.actual_value is null
   or abs(a.actual_value - e.expected_value) > 1e-9
order by e.week desc, e.measure_unit, e.filter_value;

-- 3) Summary counts for mismatches in query #2
with w as (
  select week
  from bigquery.weeks_view
  order by week_start_date desc
  limit 8
),
expected as (
  select
    s.week,
    s.dimension_type as measure_unit,
    case
      when s.dimension_type = 'stadium_group' then s.stadium_group
      when s.dimension_type = 'stadium' then s.stadium
      else null
    end as filter_value,
    max(s.total_match_cnt) as expected_value
  from bigquery.data_mart_1_social_match s
  where s.period_type = 'week'
    and s.day is null
    and s.yoil is null
    and s.yoil_group is null
    and s.hour is null
    and s.time is null
    and s.week in (select week from w)
    and s.dimension_type in ('stadium_group', 'stadium')
  group by 1, 2, 3
),
actual as (
  select
    week,
    measure_unit,
    filter_value,
    value as actual_value
  from bigquery.weekly_agg_mv
  where metric_id = 'total_match_cnt'
    and measure_unit in ('stadium_group', 'stadium')
    and week in (select week from w)
),
joined as (
  select
    e.week,
    e.measure_unit,
    e.filter_value,
    e.expected_value,
    a.actual_value
  from expected e
  left join actual a
    on a.week = e.week
   and a.measure_unit = e.measure_unit
   and a.filter_value = e.filter_value
)
select
  count(*) as expected_rows,
  count(actual_value) as actual_rows,
  sum(case when actual_value is null then 1 else 0 end) as missing_rows,
  sum(case when actual_value is not null and abs(actual_value - expected_value) > 1e-9 then 1 else 0 end) as mismatch_rows
from joined;
