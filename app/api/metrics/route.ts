import { NextResponse } from "next/server";
import { getMetricDictionary } from "../../lib/dataQueries";

export async function GET() {
  try {
    const metrics = await getMetricDictionary();
    return NextResponse.json({ metrics });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || "Failed to load metrics." }, { status: 500 });
  }
}
