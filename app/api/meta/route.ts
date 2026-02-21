import { NextResponse } from "next/server";
import { supabaseServer } from "../../lib/supabaseServer";

const SCHEMA_NAME = "bigquery";
const VIEW_NAME = "weeks_view";

const hasSchemaFn = typeof (supabaseServer as { schema?: (name: string) => unknown }).schema === "function";
const schemaClient = hasSchemaFn
  ? (supabaseServer as unknown as { schema: (name: string) => typeof supabaseServer }).schema(SCHEMA_NAME)
  : supabaseServer;
const tableName = (name: string) => (hasSchemaFn ? name : `${SCHEMA_NAME}.${name}`);

export async function GET() {
  const { data, error } = await schemaClient
    .from(tableName(VIEW_NAME))
    .select("week_start_date")
    .order("week_start_date", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load latest update." },
      { status: 500 }
    );
  }

  const latestUpdate =
    Array.isArray(data) && data.length > 0 && data[0]?.week_start_date
      ? String(data[0].week_start_date)
      : null;

  return NextResponse.json({ latestUpdate });
}
