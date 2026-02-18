"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ControlBar from "./components/ControlBar";
import MetricTable from "./components/MetricTable";
import EntityMetricTable from "./components/EntityMetricTable";
import ErrorLogPanel, { ErrorLogItem } from "./components/ErrorLogPanel";
import { Entity, FilterOption, MeasurementUnit, Metric, PeriodUnit } from "./types";

const ALL_LABEL = "전체";
const ALL_VALUE = "all";

const unitLabel: Record<MeasurementUnit, string> = {
  all: ALL_LABEL,
  area_group: "지역 그룹",
  area: "지역",
  stadium_group: "구장 그룹",
  stadium: "구장",
  region_group: "권역 그룹",
  region: "권역",
  court: "면"
};

const metricFormats: Record<string, Metric["format"]> = {
  total_match_cnt: "number",
  setting_match_cnt: "number",
  progress_match_cnt: "number",
  progress_match_rate: "percent",
  match_open_rate: "percent",
  match_loss_rate: "percent"
};

const fallbackMetrics: Metric[] = [
  {
    id: "total_match_cnt",
    name: "전체 매치 수",
    description: "공개 혹은 취소 상태의 매치 수. 진행률 계산식의 분모에 해당.",
    format: "number"
  },
  {
    id: "setting_match_cnt",
    name: "세팅 매치 수",
    description: "정기일정 혹은 개별일정 형태로 생성된 매치 수.",
    format: "number"
  },
  {
    id: "progress_match_cnt",
    name: "진행 매치 수",
    description: "매치 시작 시간이 지난 공개 상태의 매치 수.",
    format: "number"
  },
  {
    id: "progress_match_rate",
    name: "진행률",
    description: "전체 매치 수 대비 진행 매치 수의 비율.",
    format: "percent"
  },
  {
    id: "match_open_rate",
    name: "매치 공개율",
    description: "세팅 매치 중 매니저가 배정되거나 플래버 매치로 공개된 매치 비율.",
    format: "percent"
  },
  {
    id: "match_loss_rate",
    name: "매치 로스율",
    description: "세팅 매치 중 매치 공개 후 숨기기 처리된 매치 비율.",
    format: "percent"
  }
];

const periodRangeOptions = [
  { label: "최근 8주", value: "recent_8" },
  { label: "최근 12주", value: "recent_12" },
  { label: "최근 24주", value: "recent_24" }
];

const periodRangeSizeMap: Record<string, number> = {
  recent_8: 8,
  recent_12: 12,
  recent_24: 24
};

type MetricRow = {
  metric: string;
  korean_name: string;
  description: string | null;
};

type HeatmapRow = {
  entity: string;
  week: string;
  metrics: Record<string, number>;
};

type SummaryPayload = {
  title: string;
  bullets: string[];
  caution?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const fetchJson = async <T,>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Request failed.");
  }
  return (await response.json()) as T;
};

const fetchJsonWithTimeout = async <T,>(
  input: RequestInfo,
  timeoutMs: number,
  init?: RequestInit
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchJson<T>(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const getMetricFormat = (metricId: string) => metricFormats[metricId] ?? "number";

const buildContext = (
  weeks: string[],
  metrics: Metric[],
  primaryMetricId: string | null,
  seriesByEntity: Record<string, Record<string, number[]>>,
  measurementUnit: MeasurementUnit,
  filterValue: string
) => {
  const unitName =
    measurementUnit === "all" ? ALL_LABEL : unitLabel[measurementUnit] ?? measurementUnit;
  const entityKey = measurementUnit === "all" ? ALL_LABEL : filterValue;
  const series = seriesByEntity[entityKey] ?? seriesByEntity[ALL_LABEL] ?? {};
  const latestIndex = 0;

  const metricSummaries = metrics.map((metric) => {
    const values = series[metric.id] ?? [];
    const latest = values[latestIndex] ?? null;
    const delta =
      values.length > 1 ? (values[latestIndex] ?? 0) - (values[latestIndex + 1] ?? 0) : null;
    return { metricId: metric.id, name: metric.name, latest, delta, format: metric.format };
  });

  return {
    unit: unitName,
    filter: filterValue,
    weeks,
    primaryMetricId: primaryMetricId ?? "",
    metricSummaries
  };
};

export default function Home() {
  const [periodUnit] = useState<PeriodUnit>("week");
  const [periodRangeValue, setPeriodRangeValue] = useState("recent_8");
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>("all");
  const [filterValue, setFilterValue] = useState(ALL_VALUE);
  const [appliedMeasurementUnit, setAppliedMeasurementUnit] = useState<MeasurementUnit>("all");
  const [appliedFilterValue, setAppliedFilterValue] = useState(ALL_VALUE);

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);

  const [weeks, setWeeks] = useState<string[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [seriesByEntity, setSeriesByEntity] = useState<Record<string, Record<string, number[]>>>({});
  const [availableMetricIds, setAvailableMetricIds] = useState<string[]>([]);

  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([{ label: ALL_LABEL, value: ALL_VALUE }]);

  const [showResults, setShowResults] = useState(false);
  const [isLoadingBase, setIsLoadingBase] = useState(true);
  const [isLoadingFilter, setIsLoadingFilter] = useState(false);
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [errorLogs, setErrorLogs] = useState<ErrorLogItem[]>([]);
  const [isErrorLogOpen, setIsErrorLogOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const pushError = (message: string, detail?: string) => {
    setErrorLogs((prev) => {
      const next: ErrorLogItem[] = [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          message,
          detail,
          time: new Date().toLocaleString("ko-KR")
        },
        ...prev
      ];
      return next.slice(0, 50);
    });
  };

  useEffect(() => {
    const originalError = console.error;
    const safeStringify = (value: unknown) => {
      if (typeof value === "string") return value;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };
    console.error = (...args) => {
      originalError(...args);
      const detail = args.map((arg) => safeStringify(arg)).join(" ");
      pushError("Console error", detail);
    };
    return () => {
      console.error = originalError;
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    const loadMetrics = async () => {
      setIsLoadingBase(true);
      setErrorMessage(null);
      try {
        const response = await fetchJsonWithTimeout<{ metrics: MetricRow[] }>("/api/metrics", 6000);
        if (canceled) return;
        const mappedMetrics = (response.metrics ?? []).map((row) => ({
          id: row.metric,
          name: row.korean_name || row.metric,
          description: row.description || "",
          format: getMetricFormat(row.metric)
        }));
        setMetrics(mappedMetrics);
        const defaultIds = mappedMetrics.map((metric) => metric.id);
        setSelectedMetricIds(defaultIds);
      } catch (error) {
        if (!canceled) {
          const message = (error as Error).message;
          setErrorMessage(message);
          pushError("지표 정보를 불러오지 못했습니다.", message);
          if (metrics.length === 0) {
            setMetrics(fallbackMetrics);
            const defaultIds = fallbackMetrics.map((metric) => metric.id);
            setSelectedMetricIds(defaultIds);
          }
        }
      } finally {
        if (!canceled) setIsLoadingBase(false);
      }
    };

    loadMetrics();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!metrics.length) return;
    if (!selectedMetricIds.length) {
      setSelectedMetricIds(metrics.map((metric) => metric.id));
    }
  }, [metrics, selectedMetricIds]);

  useEffect(() => {
    let canceled = false;

    const loadFilters = async () => {
      if (measurementUnit === "all") {
        setFilterOptions([{ label: ALL_LABEL, value: ALL_VALUE }]);
        setFilterValue(ALL_VALUE);
        return;
      }

      setIsLoadingFilter(true);
      setErrorMessage(null);
      try {
        const response = await fetchJson<{ options: string[] }>(
          `/api/filter-options?measureUnit=${measurementUnit}`
        );
        if (canceled) return;

        const options = response.options ?? [];
        setFilterOptions([
          { label: ALL_LABEL, value: ALL_VALUE },
          ...options.map((value) => ({ label: value, value }))
        ]);
      } catch (error) {
        if (!canceled) {
          const message = (error as Error).message;
          setErrorMessage(message);
          pushError("필터 옵션을 불러오지 못했습니다.", message);
        }
      } finally {
        if (!canceled) setIsLoadingFilter(false);
      }
    };

    loadFilters();

    return () => {
      canceled = true;
    };
  }, [measurementUnit]);

  const selectedMetrics = useMemo(() => {
    const map = new Map(metrics.map((metric) => [metric.id, metric]));
    return selectedMetricIds.map((id) => map.get(id)).filter(Boolean) as Metric[];
  }, [metrics, selectedMetricIds]);

  const missingMetricIds = useMemo(() => {
    if (!availableMetricIds.length) return [] as string[];
    return selectedMetricIds.filter((id) => !availableMetricIds.includes(id));
  }, [availableMetricIds, selectedMetricIds]);

  const buildSeriesMap = (
    rows: HeatmapRow[],
    metricIds: string[],
    weekLabels: string[],
    unit: MeasurementUnit
  ) => {
    const weekIndex = new Map(weekLabels.map((week, index) => [week, index]));
    const nextEntities: Entity[] = [];
    const nextSeries: Record<string, Record<string, number[]>> = {};

    rows.forEach((row) => {
      if (!weekIndex.has(row.week)) return;
      const entityKey = row.entity || ALL_LABEL;

      if (!nextSeries[entityKey]) {
        nextSeries[entityKey] = {};
        metricIds.forEach((metric) => {
          nextSeries[entityKey][metric] = Array(weekLabels.length).fill(0);
        });
        nextEntities.push({ id: entityKey, name: entityKey, unit });
      }

      const series = nextSeries[entityKey];
      metricIds.forEach((metric) => {
        const value = row.metrics[metric];
        series[metric][weekIndex.get(row.week) ?? 0] = typeof value === "number" ? value : Number(value ?? 0);
      });
    });

    return { entities: nextEntities, seriesByEntity: nextSeries };
  };

  const handleSearch = async () => {
    if (!selectedMetricIds.length) {
      setErrorMessage("지표를 최소 1개 선택해주세요.");
      pushError("지표를 최소 1개 선택해주세요.");
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const size = periodRangeSizeMap[periodRangeValue] ?? 8;
    setIsLoadingHeatmap(true);
    setIsFetching(true);
    setErrorMessage(null);
    setSummary(null);

    try {
      const weeksResponse = await fetchJson<{ weeks: string[] }>(`/api/weeks?n=${size}`, {
        signal: controller.signal
      });
      const nextWeeks = (weeksResponse.weeks ?? []).slice().reverse();
      if (!nextWeeks.length) {
        setErrorMessage("조건에 맞는 주차 데이터가 없습니다.");
        pushError("조건에 맞는 주차 데이터가 없습니다.");
        setIsLoadingHeatmap(false);
        setIsFetching(false);
        return;
      }

      const metricIdsForQuery = metrics.map((metric) => metric.id);

      setWeeks(nextWeeks);
      setAvailableMetricIds(metricIdsForQuery);

      const response = await fetchJson<{ rows: HeatmapRow[] }>("/api/heatmap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          measureUnit: measurementUnit,
          filterValue: filterValue === ALL_VALUE ? null : filterValue,
        weeks: nextWeeks,
          metrics: metricIdsForQuery
        })
      });

      const { entities: nextEntities, seriesByEntity: nextSeries } = buildSeriesMap(
        response.rows ?? [],
        metricIdsForQuery,
        nextWeeks,
        measurementUnit
      );

      setEntities(nextEntities);
      setSeriesByEntity(nextSeries);
      setAppliedMeasurementUnit(measurementUnit);
      setAppliedFilterValue(filterValue);
      setShowResults(true);

      const context = buildContext(
        nextWeeks,
        selectedMetrics,
        selectedMetrics[0]?.id ?? null,
        nextSeries,
        measurementUnit,
        filterValue === ALL_VALUE ? ALL_LABEL : filterValue
      );

      setIsSummaryLoading(true);
      const summaryResponse = await fetchJson<{ summary: SummaryPayload }>("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ context })
      });
      setSummary(summaryResponse.summary);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        pushError("Request canceled");
      } else {
        const message = (error as Error).message;
        setErrorMessage(message);
        pushError("데이터 조회 실패", message);
      }
    } finally {
      setIsLoadingHeatmap(false);
      setIsSummaryLoading(false);
      setIsFetching(false);
    }
  };

  const handleMeasurementChange = (value: MeasurementUnit) => {
    setMeasurementUnit(value);
    setFilterValue(ALL_VALUE);
  };

  const handleFilterChange = (value: string) => {
    setFilterValue(value);
  };

  const handlePeriodRangeChange = (value: string) => {
    setPeriodRangeValue(value);
  };

  const handleChatSend = async () => {
    const message = chatInput.trim();
    if (!message || isChatLoading) return;
    const userMessage: ChatMessage = { id: `${Date.now()}-user`, role: "user", content: message };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");

    try {
      setIsChatLoading(true);
      const context = buildContext(
        weeks,
        selectedMetrics,
        selectedMetrics[0]?.id ?? null,
        seriesByEntity,
        appliedMeasurementUnit,
        appliedFilterValue === ALL_VALUE ? ALL_LABEL : appliedFilterValue
      );
      const response = await fetchJson<{ reply: string }>("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context })
      });
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: response.reply
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const messageText = (error as Error).message;
      pushError("AI 응답 실패", messageText);
    } finally {
      setIsChatLoading(false);
    }
  };

  const isSearchDisabled = isLoadingBase || isLoadingHeatmap;

  useEffect(() => {
    if (!isReportOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsReportOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isReportOpen]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img className="brand-icon" src="/kevin-avatar.png" alt="Kevin" />
          <div>
            <h1>Kevin</h1>
            <p>지표 중심 분석을 위한 스마트 대시보드</p>
          </div>
        </div>
        <div className="header-meta">
          <span>데이터 소스: Supabase</span>
        </div>
      </header>

      <section className="app-layout">
        <aside className="sidebar">
          <ControlBar
            periodUnit={periodUnit}
            periodRangeValue={periodRangeValue}
            periodRangeOptions={periodRangeOptions}
            onPeriodRangeChange={handlePeriodRangeChange}
            measurementUnit={measurementUnit}
            onMeasurementUnitChange={handleMeasurementChange}
            filterOptions={filterOptions}
            filterValue={filterValue}
            onFilterChange={handleFilterChange}
            metrics={metrics}
            selectedMetricIds={selectedMetricIds}
            onSelectedMetricIdsChange={setSelectedMetricIds}
            onSearch={handleSearch}
            isSearchDisabled={isSearchDisabled}
          />
          {isLoadingFilter && <div className="card subtle">필터 로딩 중...</div>}
        </aside>

        <section className="main-panel">
          {errorMessage && <div className="card error">Error: {errorMessage}</div>}
          {missingMetricIds.length > 0 && (
            <div className="card warning">선택한 지표 중 일부는 현재 결과에 포함되지 않습니다.</div>
          )}
          {isLoadingBase ? (
            <div className="card subtle">지표 정보를 불러오는 중...</div>
          ) : !showResults ? (
            <div className="card subtle">옵션을 선택하고 조회를 눌러주세요.</div>
          ) : (
            <div className="result-stack">
              <div className="breadcrumb">
                {appliedMeasurementUnit === "all"
                  ? ALL_LABEL
                  : `${unitLabel[appliedMeasurementUnit]} · ${
                      appliedFilterValue === ALL_VALUE ? "전체" : appliedFilterValue
                    }`}
              </div>

              {appliedMeasurementUnit === "all" ? (
                <MetricTable
                  title="전체 지표 추이"
                  weeks={weeks}
                  metrics={selectedMetrics}
                  series={seriesByEntity[ALL_LABEL] ?? {}}
                />
              ) : (
                <EntityMetricTable
                  weeks={weeks}
                  entities={entities}
                  metrics={selectedMetrics}
                  seriesByEntity={seriesByEntity}
                />
              )}

            </div>
          )}
        </section>
      </section>

      {showResults && (
        <button
          type="button"
          className="ai-fab"
          onClick={() => setIsReportOpen(true)}
        >
          AI 분석 리포트
        </button>
      )}

      {isReportOpen && (
        <div className="report-modal-overlay" onClick={() => setIsReportOpen(false)}>
          <div className="report-modal" onClick={(event) => event.stopPropagation()}>
            <div className="report-modal-header">
              <div className="card-title">AI 분석 리포트</div>
              <button type="button" className="report-modal-close" onClick={() => setIsReportOpen(false)}>
                닫기
              </button>
            </div>
            <div className="report-modal-body">
              <div className="report-summary">
                {isSummaryLoading ? (
                  <p>요약을 생성하는 중...</p>
                ) : summary ? (
                  <>
                    <h3>{summary.title}</h3>
                    <ul>
                      {summary.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    {summary.caution && <p className="note">{summary.caution}</p>}
                  </>
                ) : (
                  <p>조회 후 자동 요약이 표시됩니다.</p>
                )}
              </div>
              <div className="report-chat">
                <div className="chat-messages">
                  {chatMessages.length === 0 && (
                    <div className="chat-empty">질문을 입력하면 데이터 기반으로 답변합니다.</div>
                  )}
                  {chatMessages.map((message) => (
                    <div key={message.id} className={`chat-bubble ${message.role}`}>
                      {message.content}
                    </div>
                  ))}
                </div>
                <div className="chat-input">
                  <input
                    type="text"
                    value={chatInput}
                    placeholder="예: 이번 기간의 핵심 지표는 어떤 추세인가요?"
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleChatSend();
                    }}
                  />
                  <button type="button" onClick={handleChatSend} disabled={isChatLoading}>
                    전송
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isFetching && (
        <div className="fetch-overlay">
          <div className="fetch-overlay-card">
            <div className="spinner" />
            <div className="fetch-overlay-text">데이터를 불러오는 중입니다...</div>
            <button
              type="button"
              onClick={() => {
                if (abortRef.current) abortRef.current.abort();
                setIsFetching(false);
              }}
            >
              실행취소
            </button>
          </div>
        </div>
      )}

      <ErrorLogPanel
        logs={errorLogs}
        isOpen={isErrorLogOpen}
        onToggle={() => setIsErrorLogOpen((prev) => !prev)}
        onClear={() => setErrorLogs([])}
      />
    </main>
  );
}
