import { supabaseServer } from "./supabaseServer";

// ✅ week 단위로만 보려는 기본 조건
// ⚠️ null 조건은 match()로 걸면 안 되고, is('컬럼', null)로 걸어야 함
function applyBaseWeekFilters(query: any) {
    return query
        .eq("period_type", "week")
        .is("day", null)
        .is("yoil", null)
        .is("yoil_group", null)
        .is("hour", null)
        .is("time", null);
}

/** 최신 week 라벨 1개 가져오기 (예: 26.03.30 - 04.05) */
export async function getLatestWeek() {
    let query = supabaseServer
        .schema("bigquery")
        .from("data_mart_1_social_match")
        .select("week");

    query = applyBaseWeekFilters(query);

    const { data, error } = await query.order("week", { ascending: false }).limit(1);

    if (error) throw error;
    return data?.[0]?.week ?? null;
}

/** week 라벨 전체 목록 가져오기 */
export async function getWeeks() {
    let query = supabaseServer
        .schema("bigquery")
        .from("data_mart_1_social_match")
        .select("week");

    query = applyBaseWeekFilters(query);

    const { data, error } = await query.order("week", { ascending: true });

    if (error) throw error;

    // 중복 제거
    const set = new Set((data ?? []).map((d: any) => d.week).filter(Boolean));
    return Array.from(set);
}

/** 지표 사전(6개) 가져오기 */
export async function getMetricDictionary() {
    const { data, error } = await supabaseServer
        .schema("bigquery")
        .from("metric_store_native")
        .select("metric, korean_name, description")
        .in("metric", [
            "total_match_cnt",
            "setting_match_cnt",
            "progress_match_cnt",
            "progress_match_rate",
            "match_open_rate",
            "match_loss_rate",
        ]);

    if (error) throw error;
    return data ?? [];
}
