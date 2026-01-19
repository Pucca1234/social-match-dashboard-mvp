import { NextResponse } from "next/server";
import { getWeeks } from "@/lib/dataQueries";

export async function GET() {
  try {
    const weeks = await getWeeks();
    return NextResponse.json({ weeks });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to load weeks." },
      { status: 500 }
    );
  }
}
