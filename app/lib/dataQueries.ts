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

const dedupeWeeks = (rows: { week: string }[]) => {
  const seen = new Set<string>();
  const ordered: string[] = [];
  rows.forEach((row) => {
    const week = String(row.week ?? "").trim();
    if (!week || seen.has(week)) return;
    seen.add(week);
    ordered.push(week);
  });
  return ordered;
};

const fetchWeeksByDateColumns = async () => {
  const { data, error } = await applyBaseFilters(
    schemaClient.from(tableName(BASE_TABLE)).select("week,year,month,day")
  )
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .order("day", { ascending: false });

  if (error) return { weeks: null as string[] | null, error };

  const rows = (data ?? []) as { week: string; year?: number | null; month?: number | null; day?: number | null }[];
  const hasDateParts = rows.some((row) => row.year !== null || row.month !== null || row.day !== null);
  if (!hasDateParts) {
    return { weeks: null as string[] | null, error: null };
  }

  const ordered = dedupeWeeks(rows);
  return { weeks: ordered, error: null };
};

const fetchWeeksByParsedWeek = async () => {
  const { data, error } = await applyBaseFilters(
    schemaClient.from(tableName(BASE_TABLE)).select("week")
  );
  if (error) throw new Error(error.message);

  const unique = dedupeWeeks((data ?? []) as { week: string }[]);
  return unique
    .map((week) => ({ week, date: parseWeekStart(week) }))
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.getTime() - a.date.getTime();
    })
    .map((item) => item.week);
};

export async function getWeeks(limit = WEEK_LIMIT_DEFAULT) {
  const { weeks: orderedWeeks, error } = await fetchWeeksByDateColumns();

  let weeks = orderedWeeks;
  if (!weeks || error) {
    weeks = await fetchWeeksByParsedWeek();
  }

  const limited = weeks.slice(0, limit);
  return limited.reverse();
}

export async function getLatestWeek() {
  const weeks = await getWeeks(1);
  return weeks[0] ?? null;
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
};

export async function getHeatmap({ measureUnit, filterValue, weeks }: HeatmapParams) {
  const weekIndex = new Map(weeks.map((week, index) => [week, index]));
  const columns = [
    "week",
    "dimension_type",
    "area_group",
    "area",
    "stadium_group",
    "stadium",
    ...METRIC_IDS
  ];

  let query = applyBaseFilters(
    schemaClient.from(tableName(BASE_TABLE)).select(columns.join(","))
  );

  if (weeks.length > 0) {
    query = query.in("week", weeks);
  }

  if (measureUnit === "all") {
    query = query.is("dimension_type", null);
  } else if (filterValue) {
    const columnByUnit: Record<Exclude<QueryMeasureUnit, "all">, string> = {
      area_group: "area_group",
      area: "area",
      stadium_group: "stadium_group",
      stadium: "stadium"
    };
    query = query.eq(columnByUnit[measureUnit], filterValue);
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
    METRIC_IDS.forEach((metric) => {
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
