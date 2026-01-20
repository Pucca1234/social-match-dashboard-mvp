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

const periodRangeOptions = [
  { label: "최근 8주", value: "recent_8" },
  { label: "최근 12주", value: "recent_12" },
  { label: "최근 24주", value: "recent_24" },
  { label: "전체", value: "all" }
];

const periodRangeSizeMap: Record<string, number> = {
  recent_8: 8,
  recent_12: 12,
  recent_24: 24,
  all: 104
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

const fetchJson = async <T,>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Request failed.");
  }
  return (await response.json()) as T;
};

const getMetricFormat = (metricId: string) => metricFormats[metricId] ?? "number";

export default function Home() {
  const [periodUnit] = useState<PeriodUnit>("week");
  const [periodRangeValue, setPeriodRangeValue] = useState("recent_8");
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>("all");
  const [filterValue, setFilterValue] = useState(ALL_VALUE);

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
  const [primaryMetricId, setPrimaryMetricId] = useState<string>("");

  const [weeks, setWeeks] = useState<string[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [seriesByEntity, setSeriesByEntity] = useState<Record<string, Record<string, number[]>>>({});

  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([{ label: ALL_LABEL, value: ALL_VALUE }]);

  const [showResults, setShowResults] = useState(false);
  const [isLoadingBase, setIsLoadingBase] = useState(true);
  const [isLoadingFilter, setIsLoadingFilter] = useState(false);
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [errorLogs, setErrorLogs] = useState<ErrorLogItem[]>([]);
  const [isErrorLogOpen, setIsErrorLogOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
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
        const response = await fetchJson<{ metrics: MetricRow[] }>("/api/metrics");
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
        setPrimaryMetricId(mappedMetrics[0]?.id ?? "");
      } catch (error) {
        if (!canceled) {
          const message = (error as Error).message;
          setErrorMessage(message);
          pushError("지표 정보를 불러오지 못했습니다.", message);
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
      return;
    }
    if (primaryMetricId && selectedMetricIds.includes(primaryMetricId)) return;
    const fallback = selectedMetricIds[0] ?? metrics[0]?.id ?? "";
    if (fallback) setPrimaryMetricId(fallback);
  }, [metrics, selectedMetricIds, primaryMetricId]);

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

  const buildSeriesMap = (rows: HeatmapRow[], metricIds: string[], weekLabels: string[]) => {
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
        nextEntities.push({ id: entityKey, name: entityKey, unit: measurementUnit });
      }

      const series = nextSeries[entityKey];
      metricIds.forEach((metric) => {
        const value = row.metrics[metric];
        series[metric][weekIndex.get(row.week) ?? 0] = typeof value === "number" ? value : Number(value ?? 0);
      });
    });

    setEntities(nextEntities);
    setSeriesByEntity(nextSeries);
  };

  const handleSearch = async () => {
    if (!selectedMetricIds.length) {
      setErrorMessage("지표를 최소 1개 선택해주세요.");
      pushError("지표를 최소 1개 선택해주세요.");
      return;
    }
    if (!primaryMetricId) {
      setErrorMessage("핵심 지표를 선택해주세요.");
      pushError("핵심 지표를 선택해주세요.");
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

      setWeeks(nextWeeks);

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
          metrics: selectedMetricIds,
          primaryMetricId
        })
      });

      buildSeriesMap(response.rows ?? [], selectedMetricIds, nextWeeks);
      setShowResults(true);
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
      setIsFetching(false);
    }
  };

  const handleMeasurementChange = (value: MeasurementUnit) => {
    setMeasurementUnit(value);
    setFilterValue(ALL_VALUE);
    setShowResults(false);
  };

  const handleFilterChange = (value: string) => {
    setFilterValue(value);
    setShowResults(false);
  };

  const handlePeriodRangeChange = (value: string) => {
    setPeriodRangeValue(value);
    setShowResults(false);
  };

  const isSearchDisabled = isLoadingBase || isLoadingHeatmap;

  return (
    <main>
      <div className="page-header">
        <h1 className="page-title">Kevin</h1>
        <p className="page-subtitle">Social match analytics dashboard MVP.</p>
      </div>

      <section className="dashboard-layout">
        <aside className="sidebar left-panel">
          <div className="panel sidebar-panel">
            <div className="panel-title">Search Options</div>
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
              primaryMetricId={primaryMetricId}
              onSelectedMetricIdsChange={setSelectedMetricIds}
              onPrimaryMetricChange={setPrimaryMetricId}
              onSearch={handleSearch}
              isSearchDisabled={isSearchDisabled}
            />
            {isLoadingFilter && <div className="empty-state">필터 로딩 중...</div>}
          </div>
        </aside>

        <div className="content-area">
          {errorMessage && <div className="empty-state">Error: {errorMessage}</div>}
          {isLoadingBase ? (
            <section className="empty-state">지표 정보를 불러오는 중...</section>
          ) : !showResults ? (
            <section className="empty-state">옵션을 선택하고 조회를 눌러주세요.</section>
          ) : (
            <div className="left-stack">
              <div className="breadcrumb">
                {measurementUnit === "all"
                  ? ALL_LABEL
                  : `${unitLabel[measurementUnit]} · ${filterValue === ALL_VALUE ? "전체" : filterValue}`}
              </div>

              {measurementUnit === "all" ? (
                <MetricTable
                  title="전체 지표 추이"
                  weeks={weeks}
                  metrics={selectedMetrics}
                  series={seriesByEntity[ALL_LABEL] ?? {}}
                  primaryMetricId={primaryMetricId}
                />
              ) : (
                <EntityMetricTable
                  weeks={weeks}
                  entities={entities}
                  metrics={selectedMetrics}
                  primaryMetricId={primaryMetricId}
                  seriesByEntity={seriesByEntity}
                />
              )}

              {isLoadingHeatmap && <div className="empty-state">데이터를 불러오는 중...</div>}
            </div>
          )}
        </div>
      </section>

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
