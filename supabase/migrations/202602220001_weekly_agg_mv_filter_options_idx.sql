create index if not exists idx_weekly_agg_mv_unit_metric_filter
  on bigquery.weekly_agg_mv (measure_unit, metric_id, filter_value);

