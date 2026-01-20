import { NextResponse } from "next/server";
import { getWeeksData } from "../../lib/dataQueries";

const MAX_WEEKS = 520;
const DEFAULT_WEEKS = 104;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range");
  const nParam = searchParams.get("n");
  const includeStartDate =
    searchParams.get("includeStartDate") === "1" || searchParams.get("includeStartDate") === "true";

  let limit: number | undefined;
  if (nParam !== null) {
    const parsed = Number.parseInt(nParam, 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_WEEKS) {
      return NextResponse.json({ error: "Invalid n parameter." }, { status: 400 });
    }
    limit = parsed;
  } else if (range === "latest") {
    limit = DEFAULT_WEEKS;
  }

  try {
    if (includeStartDate) {
      const order = range === "latest" ? "desc" : "asc";
      const weeks = await getWeeksData({ limit, order });
      return NextResponse.json({ weeks });
    }

    if (range === "latest") {
      const weeks = await getWeeksData({ limit, order: "desc" });
      return NextResponse.json({ weeks: weeks.map((entry) => entry.week) });
    }

    const weeks = await getWeeksData({ limit, order: "asc" });
    return NextResponse.json({ weeks: weeks.map((entry) => entry.week) });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to load weeks." },
      { status: 500 }
    );
  }
}
