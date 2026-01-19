import { NextResponse } from "next/server";
import { getFilterOptions } from "../../lib/dataQueries";

const allowedUnits = ["all", "area_group", "area", "stadium_group", "stadium"] as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const measureUnit = searchParams.get("measureUnit");

  if (!measureUnit || !allowedUnits.includes(measureUnit as (typeof allowedUnits)[number])) {
    return NextResponse.json({ error: "Invalid measureUnit." }, { status: 400 });
  }

  try {
    const options = await getFilterOptions(measureUnit as (typeof allowedUnits)[number]);
    return NextResponse.json({ options });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to load filter options." },
      { status: 500 }
    );
  }
}
