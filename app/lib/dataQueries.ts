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

type QueryMeasureUnit = "all" | "area_group" | "area" | "stadium_group" | "stadium";

const hasSchemaFn = typeof (supabaseServer as { schema?: (name: string) => unknown }).schema === "function";
const schemaClient = hasSchemaFn
  ? (supabaseServer as { schema: (name: string) => typeof supabaseServer }).schema(SCHEMA_NAME)
  : supabaseServer;
const tableName = (name: string) => (hasSchemaFn ? name : `${SCHEMA_NAME}.${name}`);

const applyBaseFilters = <T extends ReturnType<typeof schemaClient.from>>(query: T) =>
  query
    .eq("period_type", "week")
    .is("day", null)
    .is("yoil", null)
    .is("yoil_group", null)
    .is("hour", null)
    .is("time", null);

const isBlank = (value: unknown) => value === null || value === undefined || String(value).trim() === "";

const WEEK_LIMIT_DEFAULT = 104;

const parseWeekStart = (weekLabel: string) => {
  const match = weekLabel.match(/^(\d{2})\.(\d{2})\.(\d{2})/);
  if (!match) return null;
  const year = 2000 + Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
};

const parseWeekStartLocal = (weekLabel: string) => {
  const match = weekLabel.match(/^(\d{2})\.(\d{2})\.(\d{2})/);
  if (!match) return null;
  const year = 2000 + Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const toStartDate = (row: { week?: string | null; year?: number | null; month?: number | null; day?: number | null }) => {
  if (
    typeof row.year === "number" &&
    typeof row.month === "number" &&
    typeof row.day === "number" &&
    row.year > 0 &&
    row.month > 0 &&
    row.day > 0
  ) {
    return new Date(Date.UTC(row.year, row.month - 1, row.day));
  }
  const weekLabel = typeof row.week === "string" ? row.week.trim() : "";
  return weekLabel ? parseWeekStart(weekLabel) : null;
};

const formatDate = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

type WeekEntry = { week: string; startDate: string | null };

const parseStartDateLocal = (value: string | null) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const getCurrentWeekWindow = (limit: number) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = todayStart.getDay();
  const diffToMonday = (day + 6) % 7;
  const currentWeekStart = new Date(todayStart);
  currentWeekStart.setDate(currentWeekStart.getDate() - diffToMonday);
  const cutoff = new Date(currentWeekStart);
  cutoff.setDate(cutoff.getDate() - (limit - 1) * 7);
  return { cutoff, currentWeekStart };
};

const buildWeekEntries = async (limit?: number) => {
  const effectiveLimit = typeof limit === "number" && limit > 0 ? limit : WEEK_LIMIT_DEFAULT;
  const { cutoff, currentWeekStart } = getCurrentWeekWindow(effectiveLimit);
  const pageSize = 500;
  const maxPages = 20;

  const uniqueWeeks: string[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await applyBaseFilters(
      schemaClient.from(tableName(BASE_TABLE)).select("week")
    )
      .order("week", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    for (const row of data as { week?: string | null }[]) {
      const week = typeof row.week === "string" ? row.week.trim() : "";
      if (!week || seen.has(week)) continue;
      const startDate = parseWeekStartLocal(week);
      if (!startDate) continue;
      if (startDate > currentWeekStart) continue;
      if (startDate < cutoff) continue;
      seen.add(week);
      uniqueWeeks.push(week);
      if (uniqueWeeks.length >= effectiveLimit) break;
    }

    if (uniqueWeeks.length >= effectiveLimit) break;
  }

  if (uniqueWeeks.length === 0) return [];

  const { data: dateRows, error: dateError } = await applyBaseFilters(
    schemaClient.from(tableName(BASE_TABLE)).select("week,year,month,day")
  ).in("week", uniqueWeeks);
  if (dateError) throw new Error(dateError.message);

  const map = new Map<string, { week: string; startDate: Date | null }>();
  (dateRows ?? []).forEach((row) => {
    const typed = row as { week?: string | null; year?: number | null; month?: number | null; day?: number | null };
    const week = typeof typed.week === "string" ? typed.week.trim() : "";
    if (!week) return;
    const startDate = toStartDate(typed);
    const existing = map.get(week);
    if (!existing) {
      map.set(week, { week, startDate });
      return;
    }
    if (startDate && (!existing.startDate || startDate > existing.startDate)) {
      existing.startDate = startDate;
    }
  });

  uniqueWeeks.forEach((week) => {
    if (!map.has(week)) {
      map.set(week, { week, startDate: parseWeekStart(week) });
    } else if (!map.get(week)?.startDate) {
      map.get(week)!.startDate = parseWeekStart(week);
    }
  });

  return uniqueWeeks
    .map((week) => {
      const entry = map.get(week);
      return { week, startDate: formatDate(entry?.startDate ?? null) };
    })
    .filter(Boolean);
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

export async function getMetricDictionary() {
  const { data, error } = await schemaClient
    .from(tableName(METRIC_TABLE))
    .select("metric,korean_name,description")
    .in("metric", METRIC_IDS as unknown as string[]);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { metric: string; korean_name: string; description: string | null }[];
  return METRIC_IDS.map((metric) => rows.find((row) => row.metric === metric)).filter(Boolean);
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
    .map((row) => (row as Record<string, string | null>)[column])
    .filter((value) => !isBlank(value)) as string[];

  return Array.from(new Set(values)).sort();
}

type HeatmapParams = {
  measureUnit: QueryMeasureUnit;
  filterValue: string | null;
  weeks: string[];
  metrics?: string[];
};

export async function getHeatmap({ measureUnit, filterValue, weeks, metrics }: HeatmapParams) {
  const weekIndex = new Map(weeks.map((week, index) => [week, index]));
  const metricIds = (metrics && metrics.length > 0 ? metrics : [...METRIC_IDS]).filter(
    (metric) => METRIC_IDS.includes(metric as (typeof METRIC_IDS)[number])
  );
  const columns = [
    "week",
    "dimension_type",
    "area_group",
    "area",
    "stadium_group",
    "stadium",
    ...metricIds
  ];

  let query = applyBaseFilters(
    schemaClient.from(tableName(BASE_TABLE)).select(columns.join(","))
  );

  if (weeks.length > 0) {
    query = query.in("week", weeks);
  }

  if (measureUnit === "all") {
    query = query
      .is("dimension_type", null)
      .is("area_group", null)
      .is("area", null)
      .is("stadium_group", null)
      .is("stadium", null);
  } else if (filterValue) {
    const columnByUnit: Record<Exclude<QueryMeasureUnit, "all">, string> = {
      area_group: "area_group",
      area: "area",
      stadium_group: "stadium_group",
      stadium: "stadium"
    };
    query = query.eq(columnByUnit[measureUnit], filterValue);
  } else {
    const columnByUnit: Record<Exclude<QueryMeasureUnit, "all">, string> = {
      area_group: "area_group",
      area: "area",
      stadium_group: "stadium_group",
      stadium: "stadium"
    };
    query = query.not(columnByUnit[measureUnit], "is", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter((row) => {
    const typed = row as Record<string, string | null>;
    if (measureUnit === "all") {
      return (
        isBlank(typed.area_group) &&
        isBlank(typed.area) &&
        isBlank(typed.stadium_group) &&
        isBlank(typed.stadium)
      );
    }
    const columnByUnit: Record<Exclude<QueryMeasureUnit, "all">, string> = {
      area_group: "area_group",
      area: "area",
      stadium_group: "stadium_group",
      stadium: "stadium"
    };
    return !isBlank(typed[columnByUnit[measureUnit]]);
  });

  const mapped = rows.map((row) => {
    const typed = row as Record<string, string | number | null>;
    const entity =
      measureUnit === "all"
        ? ALL_LABEL
        : String(typed[measureUnit] ?? typed[measureUnit as keyof typeof typed] ?? "").trim();
    const metrics: Record<string, number> = {};
    metricIds.forEach((metric) => {
      const value = typed[metric];
      metrics[metric] = typeof value === "number" ? value : Number(value ?? 0);
    });

    return {
      entity,
      week: String(typed.week ?? ""),
      metrics
    };
  });

  return mapped.sort((a, b) => {
    if (a.entity !== b.entity) {
      return a.entity.localeCompare(b.entity);
    }
    return (weekIndex.get(a.week) ?? 0) - (weekIndex.get(b.week) ?? 0);
  });
}

export const METRIC_ID_LIST = METRIC_IDS;
export const ALL_ENTITY_LABEL = ALL_LABEL;

