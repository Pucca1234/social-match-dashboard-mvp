import "server-only";
import { supabaseServer } from "./supabaseServer";

const METRIC_IDS = [
  "total_match_cnt",
  "setting_match_cnt",
  "progress_match_cnt",
  "progress_match_rate",
  "match_open_rate",
  "match_loss_rate"
] as const;

const ALL_LABEL = "전체";
const SCHEMA_NAME = "bigquery";
const BASE_TABLE = "data_mart_1_social_match";
const METRIC_TABLE = "metric_store_native";
const WEEKLY_AGG_VIEW = "weekly_agg_mv";

type QueryMeasureUnit = "all" | "area_group" | "area" | "stadium_group" | "stadium";

const hasSchemaFn = typeof (supabaseServer as { schema?: (name: string) => unknown }).schema === "function";
const schemaClient = hasSchemaFn
  ? (supabaseServer as unknown as { schema: (name: string) => typeof supabaseServer }).schema(SCHEMA_NAME)
  : supabaseServer;
const tableName = (name: string) => (hasSchemaFn ? name : `${SCHEMA_NAME}.${name}`);

const applyBaseFilters = (query: any) =>
  query
    .eq("period_type", "week")
    .is("day", null)
    .is("yoil", null)
    .is("yoil_group", null)
    .is("hour", null)
    .is("time", null);

const applyWeekOnlyFilter = (query: any) => query.eq("period_type", "week");

const isBlank = (value: unknown) => value === null || value === undefined || String(value).trim() === "";

const WEEK_LIMIT_DEFAULT = 104;

type WeekEntry = { week: string; startDate: string | null };

const buildWeekEntries = async (limit?: number) => {
  const effectiveLimit = typeof limit === "number" && limit > 0 ? limit : WEEK_LIMIT_DEFAULT;

  const { data, error } = await schemaClient
    .from(tableName("weeks_view"))
    .select("week,week_start_date")
    .order("week_start_date", { ascending: false })
    .limit(effectiveLimit);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { week?: string | null; week_start_date?: string | null }[];
  return rows
    .map((row) => ({
      week: typeof row.week === "string" ? row.week.trim() : "",
      startDate: row.week_start_date ?? null
    }))
    .filter((row) => row.week);
};

export async function getWeeksData(options?: { limit?: number; order?: "asc" | "desc" }) {
  const limit = options?.limit ?? WEEK_LIMIT_DEFAULT;
  const order = options?.order ?? "asc";
  const entries = await buildWeekEntries(limit);
  const limited =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? entries.slice(0, limit) : entries;
  return order === "desc" ? limited : limited.slice().reverse();
}

export async function getWeeks(limit = WEEK_LIMIT_DEFAULT) {
  const entries = await getWeeksData({ limit, order: "asc" });
  return entries.map((entry) => entry.week);
}

export async function getLatestWeek() {
  const entries = await getWeeksData({ limit: 1, order: "desc" });
  return entries[0]?.week ?? null;
}

export async function getMetricDictionary(timings?: { queryMs?: number; processMs?: number }) {
  const queryStart = Date.now();
  const { data, error } = await schemaClient
    .from(tableName(METRIC_TABLE))
    .select("metric,korean_name,description")
    .in("metric", METRIC_IDS as unknown as string[]);
  if (timings) timings.queryMs = Date.now() - queryStart;

  if (error) throw new Error(error.message);

  const processStart = Date.now();
  const rows = (data ?? []) as { metric: string; korean_name: string; description: string | null }[];
  const result = METRIC_IDS.map((metric) => rows.find((row) => row.metric === metric)).filter(Boolean);
  if (timings) timings.processMs = Date.now() - processStart;
  return result;
}

export async function getFilterOptions(measureUnit: QueryMeasureUnit) {
  if (measureUnit === "all") return [ALL_LABEL];

  const columnByUnit: Record<Exclude<QueryMeasureUnit, "all">, string> = {
    area_group: "area_group",
    area: "area",
    stadium_group: "stadium_group",
    stadium: "stadium"
  };

  const column = columnByUnit[measureUnit];
  const { data, error } = await applyBaseFilters(
    schemaClient.from(tableName(BASE_TABLE)).select(column)
  );
  if (error) throw new Error(error.message);

  const values = (data ?? [])
    .map((row: any) => (row as Record<string, string | null>)[column])
    .filter((value: unknown) => !isBlank(value)) as string[];

  return Array.from(new Set(values)).sort();
}

type HeatmapParams = {
  measureUnit: QueryMeasureUnit;
  filterValue: string | null;
  weeks: string[];
  metrics?: string[];
};

export async function getHeatmap(
  { measureUnit, filterValue, weeks, metrics }: HeatmapParams,
  timings?: { queryMs?: number; processMs?: number }
) {
  const weekIndex = new Map(weeks.map((week, index) => [week, index]));
  const metricIds = (metrics && metrics.length > 0 ? metrics : [...METRIC_IDS]).filter(
    (metric) => METRIC_IDS.includes(metric as (typeof METRIC_IDS)[number])
  );
  let query = schemaClient
    .from(tableName(WEEKLY_AGG_VIEW))
    .select("week,measure_unit,filter_value,metric_id,value");

  if (weeks.length > 0) {
    query = query.in("week", weeks);
  }

  if (measureUnit === "all") {
    query = query.eq("measure_unit", "all").eq("filter_value", ALL_LABEL);
  } else {
    query = query.eq("measure_unit", measureUnit);
    if (filterValue) {
      query = query.eq("filter_value", filterValue);
    } else {
      query = query.not("filter_value", "is", null);
    }
  }

  if (metricIds.length > 0) {
    query = query.in("metric_id", metricIds);
  }

  const queryStart = Date.now();
  const { data, error } = await query;
  if (timings) timings.queryMs = Date.now() - queryStart;
  if (error) throw new Error(error.message);

  const processStart = Date.now();
  const rows = (data ?? []) as {
    week: string | null;
    measure_unit: string | null;
    filter_value: string | null;
    metric_id: string | null;
    value: number | string | null;
  }[];

  const byEntity = new Map<string, Map<string, Record<string, number>>>();
  for (const row of rows) {
    const week = row.week ?? "";
    if (!week) continue;
    const entity =
      measureUnit === "all"
        ? ALL_LABEL
        : String(row.filter_value ?? "").trim();
    if (!entity) continue;
    const metricId = String(row.metric_id ?? "").trim();
    if (!metricId) continue;

    const value = typeof row.value === "number" ? row.value : Number(row.value ?? 0);
    if (!byEntity.has(entity)) {
      byEntity.set(entity, new Map());
    }
    const byWeek = byEntity.get(entity)!;
    if (!byWeek.has(week)) {
      const initial: Record<string, number> = {};
      metricIds.forEach((metric) => {
        initial[metric] = 0;
      });
      byWeek.set(week, initial);
    }
    const metricsForWeek = byWeek.get(week)!;
    metricsForWeek[metricId] = value;
  }

  const mapped: { entity: string; week: string; metrics: Record<string, number> }[] = [];
  for (const [entity, byWeek] of byEntity.entries()) {
    for (const week of weeks) {
      if (!byWeek.has(week)) {
        const emptyMetrics: Record<string, number> = {};
        metricIds.forEach((metric) => {
          emptyMetrics[metric] = 0;
        });
        mapped.push({ entity, week, metrics: emptyMetrics });
      } else {
        mapped.push({ entity, week, metrics: byWeek.get(week)! });
      }
    }
  }

  const sorted = mapped.sort((a, b) => {
    if (a.entity !== b.entity) {
      return a.entity.localeCompare(b.entity);
    }
    return (weekIndex.get(a.week) ?? 0) - (weekIndex.get(b.week) ?? 0);
  });
  if (timings) timings.processMs = Date.now() - processStart;
  return sorted;
}

export const METRIC_ID_LIST = METRIC_IDS;
export const ALL_ENTITY_LABEL = ALL_LABEL;
