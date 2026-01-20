import { NextResponse } from "next/server";
import { getHeatmap, METRIC_ID_LIST } from "../../lib/dataQueries";

const allowedUnits = ["all", "area_group", "area", "stadium_group", "stadium"] as const;
const MAX_WEEKS = 104;

export async function POST(request: Request) {
  let payload: {
    measureUnit?: string;
    filterValue?: string | null;
    weeks?: string[];
    metrics?: string[];
    primaryMetricId?: string;
  } = {};

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { measureUnit, filterValue, weeks, metrics, primaryMetricId } = payload;

  if (Array.isArray(weeks) && weeks.length > 0) {
    const firstWeek = weeks[0];
    const lastWeek = weeks[weeks.length - 1];
    console.log("[heatmap] request", {
      measureUnit,
      filterValue,
      weeksLength: weeks.length,
      firstWeek,
      lastWeek,
      metricsLength: Array.isArray(metrics) ? metrics.length : null,
      primaryMetricId
    });
  } else {
    console.log("[heatmap] request", {
      measureUnit,
      filterValue,
      weeksLength: Array.isArray(weeks) ? weeks.length : null,
      metricsLength: Array.isArray(metrics) ? metrics.length : null,
      primaryMetricId
    });
  }

  if (!measureUnit || !allowedUnits.includes(measureUnit as (typeof allowedUnits)[number])) {
    return NextResponse.json({ error: "Invalid measureUnit." }, { status: 400 });
  }

  if (!Array.isArray(weeks) || weeks.length === 0 || weeks.length > MAX_WEEKS) {
    return NextResponse.json({ error: "Invalid weeks." }, { status: 400 });
  }

  if (filterValue !== null && filterValue !== undefined && typeof filterValue !== "string") {
    return NextResponse.json({ error: "Invalid filterValue." }, { status: 400 });
  }

  if (metrics !== undefined && !Array.isArray(metrics)) {
    return NextResponse.json({ error: "Invalid metrics." }, { status: 400 });
  }

  const metricIds =
    metrics && metrics.length > 0
      ? metrics.filter((metric) => METRIC_ID_LIST.includes(metric as (typeof METRIC_ID_LIST)[number]))
      : METRIC_ID_LIST;

  if (metricIds.length === 0) {
    return NextResponse.json({ error: "No valid metrics provided." }, { status: 400 });
  }

  try {
    const rows = await getHeatmap({
      measureUnit: measureUnit as (typeof allowedUnits)[number],
      filterValue: filterValue && filterValue.trim() !== "" ? filterValue : null,
      weeks,
      metrics: metricIds
    });
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("[heatmap] error", error);
    return NextResponse.json({ error: (error as Error).message || "Failed to load heatmap." }, { status: 500 });
  }
}
