import "server-only";
import { supabaseServer } from "./supabaseServer";

const ALL_LABEL = "전체";
const SCHEMA_NAME = "bigquery";
const BASE_TABLE = "data_mart_1_social_match";
const METRIC_TABLE = "metric_store_native";
const WEEKLY_AGG_VIEW = "weekly_agg_mv";
const WEEK_LIMIT_DEFAULT = 104;

type QueryMeasureUnit = "all" | "area_group" | "area" | "stadium_group" | "stadium";

type WeekEntry = { week: string; startDate: string | null };
type MetricDictRow = { metric: string; korean_name: string; description: string | null };
type HeatmapAggRow = {
  week: string | null;
  measure_unit: string | null;
  filter_value: string | null;
  metric_id: string | null;
  value: number | string | null;
};
type HeatmapMappedRow = { entity: string; week: string; metrics: Record<string, number> };

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

const isBlank = (value: unknown) => value === null || value === undefined || String(value).trim() === "";
const isRateMetric = (metricId: string) => metricId.endsWith("_rate");
const allowBaseFallback = process.env.HEATMAP_ALLOW_BASE_FALLBACK === "1";

const metricColumnBlacklist = new Set([
  "_airbyte_raw_id",
  "_airbyte_extracted_at",
  "_airbyte_meta",
  "_airbyte_generation_id",
  "day",
  "area",
  "hour",
  "time",
  "week",
  "year",
  "yoil",
  "month",
  "quarter",
  "stadium",
  "area_group",
  "yoil_group",
  "period_type",
  "stadium_group",
  "dimension_type"
]);

const columnByUnit: Record<Exclude<QueryMeasureUnit, "all">, string> = {
  area_group: "area_group",
  area: "area",
  stadium_group: "stadium_group",
  stadium: "stadium"
};

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

async function getBaseMetricColumns() {
  const { data, error } = await schemaClient.from(tableName(BASE_TABLE)).select("*").limit(1);
  if (error) throw new Error(error.message);
  const sampleRow = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!sampleRow) return [] as string[];
  return Object.keys(sampleRow).filter((column) => !metricColumnBlacklist.has(column));
}

const mapHeatmapRows = (rows: HeatmapAggRow[], measureUnit: QueryMeasureUnit, metricIds: string[], weeks: string[]) => {
  const weekIndex = new Map(weeks.map((week, index) => [week, index]));
  const byEntity = new Map<string, Map<string, Record<string, number>>>();

  for (const row of rows) {
    const week = row.week ?? "";
    if (!week) continue;

    const entity = measureUnit === "all" ? ALL_LABEL : String(row.filter_value ?? "").trim();
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
    byWeek.get(week)![metricId] = Number.isFinite(value) ? value : 0;
  }

  const mapped: HeatmapMappedRow[] = [];
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

  return mapped.sort((a, b) => {
    if (a.entity !== b.entity) return a.entity.localeCompare(b.entity);
    return (weekIndex.get(a.week) ?? 0) - (weekIndex.get(b.week) ?? 0);
  });
};

const getHeatmapFromBaseTable = async ({
  measureUnit,
  filterValue,
  weeks,
  metricIds
}: {
  measureUnit: Exclude<QueryMeasureUnit, "all">;
  filterValue: string | null;
  weeks: string[];
  metricIds: string[];
}) => {
  const unitColumn = columnByUnit[measureUnit];
  const selectColumns = Array.from(new Set(["week", unitColumn, ...metricIds])).join(",");

  let query = applyBaseFilters(schemaClient.from(tableName(BASE_TABLE)).select(selectColumns));
  if (weeks.length > 0) {
    query = query.in("week", weeks);
  }
  query = query.not(unitColumn, "is", null);
  if (filterValue) {
    query = query.eq(unitColumn, filterValue);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type AggState = { max: number; sum: number; count: number };
  const accumulator = new Map<string, AggState>();
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const week = String(row.week ?? "").trim();
    const entity = String(row[unitColumn] ?? "").trim();
    if (!week || !entity) continue;

    for (const metricId of metricIds) {
      const raw = row[metricId];
      const value = typeof raw === "number" ? raw : Number(raw ?? NaN);
      if (!Number.isFinite(value)) continue;

      const key = `${week}|${entity}|${metricId}`;
      const prev = accumulator.get(key) ?? { max: Number.NEGATIVE_INFINITY, sum: 0, count: 0 };
      prev.max = Math.max(prev.max, value);
      prev.sum += value;
      prev.count += 1;
      accumulator.set(key, prev);
    }
  }

  const rows: HeatmapAggRow[] = [];
  for (const [key, state] of accumulator.entries()) {
    const [week, entity, metricId] = key.split("|");
    const value = isRateMetric(metricId) ? state.sum / Math.max(state.count, 1) : state.max;
    rows.push({
      week,
      measure_unit: measureUnit,
      filter_value: entity,
      metric_id: metricId,
      value
    });
  }

  return rows;
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

export async function getSupportedMetricIds(timings?: { queryMs?: number; processMs?: number }) {
  const queryStart = Date.now();
  const [metricDictResult, baseColumnsResult] = await Promise.all([
    schemaClient.from(tableName(METRIC_TABLE)).select("metric"),
    getBaseMetricColumns()
  ]);
  if (timings) timings.queryMs = Date.now() - queryStart;

  if (metricDictResult.error) throw new Error(metricDictResult.error.message);

  const processStart = Date.now();
  const availableColumns = new Set(baseColumnsResult);
  const metricRows = (metricDictResult.data ?? []) as { metric: string }[];
  const supported = metricRows
    .map((row) => row.metric)
    .filter((metric) => availableColumns.has(metric));
  const uniqueSorted = Array.from(new Set(supported)).sort();
  if (timings) timings.processMs = Date.now() - processStart;
  return uniqueSorted;
}

export async function getMetricDictionary(timings?: { queryMs?: number; processMs?: number }) {
  const queryStart = Date.now();
  const [metricRowsResult, supportedMetricIds] = await Promise.all([
    schemaClient.from(tableName(METRIC_TABLE)).select("metric,korean_name,description"),
    getSupportedMetricIds()
  ]);
  if (timings) timings.queryMs = Date.now() - queryStart;

  if (metricRowsResult.error) throw new Error(metricRowsResult.error.message);

  const processStart = Date.now();
  const allowed = new Set(supportedMetricIds);
  const rows = (metricRowsResult.data ?? []) as MetricDictRow[];
  const result = rows
    .filter((row) => allowed.has(row.metric))
    .sort((a, b) => a.metric.localeCompare(b.metric));
  if (timings) timings.processMs = Date.now() - processStart;
  return result;
}

export async function getFilterOptions(measureUnit: QueryMeasureUnit) {
  if (measureUnit === "all") return [ALL_LABEL];

  const column = columnByUnit[measureUnit];
  const { data, error } = await applyBaseFilters(schemaClient.from(tableName(BASE_TABLE)).select(column));
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
  const supportedMetricIds = await getSupportedMetricIds();
  const allowed = new Set(supportedMetricIds);
  const requested = metrics?.filter((metric) => !isBlank(metric)).map((metric) => String(metric).trim()) ?? [];
  const metricIds = (requested.length > 0 ? requested : supportedMetricIds).filter((metric) => allowed.has(metric));
  if (metricIds.length === 0) return [];

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
  let queryMs = Date.now() - queryStart;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as HeatmapAggRow[];
  if (allowBaseFallback && measureUnit !== "all" && rows.length === 0) {
    const fallbackStart = Date.now();
    rows = await getHeatmapFromBaseTable({
      measureUnit,
      filterValue,
      weeks,
      metricIds
    });
    queryMs += Date.now() - fallbackStart;
  }
  if (timings) timings.queryMs = queryMs;

  const processStart = Date.now();
  const sorted = mapHeatmapRows(rows, measureUnit, metricIds, weeks);
  if (timings) timings.processMs = Date.now() - processStart;
  return sorted;
}

export const ALL_ENTITY_LABEL = ALL_LABEL;


