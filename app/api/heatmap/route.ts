import { NextResponse } from "next/server";
import { getHeatmap } from "../../lib/dataQueries";

const allowedUnits = ["all", "area_group", "area", "stadium_group", "stadium"] as const;
const MAX_WEEKS = 104;

export async function POST(request: Request) {
  let payload: { measureUnit?: string; filterValue?: string | null; weeks?: string[] } = {};

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { measureUnit, filterValue, weeks } = payload;

  if (!measureUnit || !allowedUnits.includes(measureUnit as (typeof allowedUnits)[number])) {
    return NextResponse.json({ error: "Invalid measureUnit." }, { status: 400 });
  }

  if (!Array.isArray(weeks) || weeks.length === 0 || weeks.length > MAX_WEEKS) {
    return NextResponse.json({ error: "Invalid weeks." }, { status: 400 });
  }

  if (filterValue !== null && filterValue !== undefined && typeof filterValue !== "string") {
    return NextResponse.json({ error: "Invalid filterValue." }, { status: 400 });
  }

  try {
    const rows = await getHeatmap({
      measureUnit: measureUnit as (typeof allowedUnits)[number],
      filterValue: filterValue && filterValue.trim() !== "" ? filterValue : null,
      weeks
    });
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || "Failed to load heatmap." }, { status: 500 });
  }
}
