"use client";

import { useEffect, useMemo, useState } from "react";
import ControlBar from "./components/ControlBar";
import EntityList from "./components/EntityList";
import HeatmapMatrix from "./components/HeatmapMatrix";
import InsightsPanel from "./components/InsightsPanel";
import InfoBar, { InfoPayload } from "./components/InfoBar";
import { getAnomalyIndices, getZScores } from "./lib/anomaly";
import { Entity, FilterOption, MeasurementUnit, Metric, PeriodUnit } from "./types";

const ALL_LABEL = "전체";
const ALL_VALUE = "all";

const unitLabel: Record<MeasurementUnit, string> = {
  all: ALL_LABEL,
  area_group: "Area group",
  area: "Area",
  stadium_group: "Stadium group",
  stadium: "Stadium",
  region_group: "Region group",
  region: "Region",
  court: "Court"
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
  const [showResults, setShowResults] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [infoPayload, setInfoPayload] = useState<InfoPayload>({ metric: null });

  const [weeks, setWeeks] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([{ label: ALL_LABEL, value: ALL_VALUE }]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [seriesByEntity, setSeriesByEntity] = useState<Record<string, Record<string, number[]>>>({});

  const [isLoadingBase, setIsLoadingBase] = useState(true);
  const [isLoadingFilter, setIsLoadingFilter] = useState(false);
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const displayedWeeks = useMemo(() => {
    if (!weeks.length) return [];
    if (periodRangeValue === "all") return weeks;
    const sizeMap: Record<string, number> = {
      recent_8: 8,
      recent_12: 12,
      recent_24: 24
    };
    const size = sizeMap[periodRangeValue] ?? 8;
    return weeks.slice(-size);
  }, [weeks, periodRangeValue]);

  useEffect(() => {
    let canceled = false;

    const loadBase = async () => {
      setIsLoadingBase(true);
      setErrorMessage(null);
      try {
        const [weeksResponse, metricsResponse] = await Promise.all([
          fetchJson<{ weeks: string[] }>("/api/weeks"),
          fetchJson<{ metrics: MetricRow[] }>("/api/metrics")
        ]);

        if (canceled) return;

        const loadedWeeks = weeksResponse.weeks ?? [];
        setWeeks(loadedWeeks);
        const mappedMetrics = (metricsResponse.metrics ?? []).map((row) => ({
          id: row.metric,
          name: row.korean_name || row.metric,
          description: row.description || "",
          format: getMetricFormat(row.metric)
        }));
        setMetrics(mappedMetrics);
      } catch (error) {
        if (!canceled) setErrorMessage((error as Error).message);
      } finally {
        if (!canceled) setIsLoadingBase(false);
      }
    };

    loadBase();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    const loadFilters = async () => {
      const apiUnit =
        measurementUnit === "all" ||
        measurementUnit === "area_group" ||
        measurementUnit === "area" ||
        measurementUnit === "stadium_group" ||
        measurementUnit === "stadium"
          ? measurementUnit
          : "all";

      setIsLoadingFilter(true);
      setErrorMessage(null);
      try {
        const response = await fetchJson<{ options: string[] }>(
          `/api/filter-options?measureUnit=${apiUnit}`
        );
        if (canceled) return;

        const options = response.options ?? [];
        if (apiUnit === "all") {
          setFilterOptions([{ label: ALL_LABEL, value: ALL_VALUE }]);
        } else {
          setFilterOptions([
            { label: ALL_LABEL, value: ALL_VALUE },
            ...options.map((value) => ({ label: value, value }))
          ]);
        }
      } catch (error) {
        if (!canceled) setErrorMessage((error as Error).message);
      } finally {
        if (!canceled) setIsLoadingFilter(false);
      }
    };

    loadFilters();

    return () => {
      canceled = true;
    };
  }, [measurementUnit]);

  const measurementEntities = useMemo(() => {
    if (measurementUnit === "all") return [];
    return entities;
  }, [measurementUnit, entities]);

  const entityList = useMemo(() => {
    if (measurementUnit === "all") return [];
    if (filterValue === ALL_VALUE) return measurementEntities;
    return measurementEntities.filter((entity) => entity.id === filterValue);
  }, [measurementUnit, filterValue, measurementEntities]);

  const entityListData = useMemo(() => {
    if (!showResults) return [];
    if (measurementUnit === "all") return [];

    return entityList
      .map((entity) => {
        const series = seriesByEntity[entity.id] ?? {};
        let maxAbsZ = 0;
        let topMetricName = "";
        let anomalyIndices: number[] = [];

        metrics.forEach((metric) => {
          const values = series[metric.id] ?? [];
          const zscores = getZScores(values);
          const anomalies = getAnomalyIndices(values);
          anomalies.forEach((index) => {
            if (!anomalyIndices.includes(index)) anomalyIndices.push(index);
          });
          const localMax = zscores.length ? Math.max(...zscores.map((value) => Math.abs(value))) : 0;
          if (localMax > maxAbsZ) {
            maxAbsZ = localMax;
            topMetricName = metric.name;
          }
        });

        anomalyIndices = anomalyIndices.sort((a, b) => a - b);
        const score = Math.min(100, maxAbsZ * 22 + anomalyIndices.length * 6);
        const anomalyWeeks = anomalyIndices.slice(-3).map((index) => displayedWeeks[index]);

        return {
          entity,
          anomalyScore: score,
          topMetric: topMetricName || metrics[0]?.name || "-",
          anomalyWeeks,
          anomalyIndices
        };
      })
      .sort((a, b) => b.anomalyScore - a.anomalyScore);
  }, [showResults, measurementUnit, entityList, metrics, seriesByEntity, displayedWeeks]);

  useEffect(() => {
    if (!showResults) return;
    if (measurementUnit === "all") {
      setSelectedEntityId(ALL_LABEL);
      setInfoPayload({ metric: null });
      return;
    }
    if (filterValue !== ALL_VALUE) {
      setSelectedEntityId(filterValue);
      setInfoPayload({ metric: null });
      return;
    }
    if (!entityListData.length) return;
    setSelectedEntityId(entityListData[0].entity.id);
    setInfoPayload({ metric: null });
  }, [showResults, measurementUnit, filterValue, entityListData]);

  const buildSeriesMap = (rows: HeatmapRow[]) => {
    const weekIndex = new Map(displayedWeeks.map((week, index) => [week, index]));
    const nextEntities: Entity[] = [];
    const nextSeries: Record<string, Record<string, number[]>> = {};

    rows.forEach((row) => {
      if (!weekIndex.has(row.week)) return;
      const entityKey = row.entity || ALL_LABEL;

      if (!nextSeries[entityKey]) {
        nextSeries[entityKey] = {};
        metrics.forEach((metric) => {
          nextSeries[entityKey][metric.id] = Array(displayedWeeks.length).fill(0);
        });
        nextEntities.push({ id: entityKey, name: entityKey, unit: measurementUnit });
      }

      const series = nextSeries[entityKey];
      metrics.forEach((metric) => {
        const value = row.metrics[metric.id];
        series[metric.id][weekIndex.get(row.week) ?? 0] = typeof value === "number" ? value : 0;
      });
    });

    setEntities(nextEntities);
    setSeriesByEntity(nextSeries);
  };

  const loadHeatmap = async () => {
    if (!displayedWeeks.length || !metrics.length) {
      setErrorMessage("Weeks or metrics are not loaded yet.");
      return;
    }

    const apiUnit =
      measurementUnit === "all" ||
      measurementUnit === "area_group" ||
      measurementUnit === "area" ||
      measurementUnit === "stadium_group" ||
      measurementUnit === "stadium"
        ? measurementUnit
        : "all";

    setIsLoadingHeatmap(true);
    setErrorMessage(null);
    try {
      const response = await fetchJson<{ rows: HeatmapRow[] }>("/api/heatmap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          measureUnit: apiUnit,
          filterValue: filterValue === ALL_VALUE ? null : filterValue,
          weeks: displayedWeeks
        })
      });
      buildSeriesMap(response.rows ?? []);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLoadingHeatmap(false);
    }
  };

  const handleSearch = () => {
    setShowResults(true);
    setInfoPayload({ metric: null });
    loadHeatmap();
  };

  const handleMeasurementChange = (value: MeasurementUnit) => {
    setMeasurementUnit(value);
    setFilterValue(ALL_VALUE);
    setSelectedEntityId(null);
    setInfoPayload({ metric: null });
    setShowResults(false);
  };

  const handleFilterChange = (value: string) => {
    setFilterValue(value);
    setSelectedEntityId(null);
    setInfoPayload({ metric: null });
    setShowResults(false);
  };

  const handlePeriodRangeChange = (value: string) => {
    setPeriodRangeValue(value);
    setSelectedEntityId(null);
    setInfoPayload({ metric: null });
    setShowResults(false);
  };

  const handleDrilldown = (nextUnit: MeasurementUnit) => {
    setMeasurementUnit(nextUnit);
    setFilterValue(ALL_VALUE);
    setSelectedEntityId(null);
    setInfoPayload({ metric: null });
    setShowResults(false);
  };

  const handleRecommend = (nextUnit: MeasurementUnit) => {
    setMeasurementUnit(nextUnit);
    setFilterValue(ALL_VALUE);
    setSelectedEntityId(null);
    setInfoPayload({ metric: null });
    setShowResults(false);
  };

  const breadcrumbLabel = useMemo(() => {
    if (measurementUnit === "all") return ALL_LABEL;
    if (!selectedEntityId) return `${ALL_LABEL} > ${unitLabel[measurementUnit]}`;
    return `${ALL_LABEL} > ${unitLabel[measurementUnit]} > ${selectedEntityId}`;
  }, [measurementUnit, selectedEntityId]);

  const renderHeatmap = () => {
    if (isLoadingHeatmap) {
      return <div className="empty-state">Loading heatmap...</div>;
    }

    if (measurementUnit === "all") {
      const series = seriesByEntity[ALL_LABEL] ?? {};
      if (!Object.keys(series).length) {
        return <div className="empty-state">No data.</div>;
      }
      return (
        <HeatmapMatrix
          title={ALL_LABEL}
          weeks={displayedWeeks}
          metrics={metrics}
          series={series}
          onInfoChange={setInfoPayload}
        />
      );
    }

    if (!selectedEntityId) return <div className="empty-state">Select an entity.</div>;
    const series = seriesByEntity[selectedEntityId];
    if (!series) return <div className="empty-state">Select an entity.</div>;
    return (
      <HeatmapMatrix
        title={`${unitLabel[measurementUnit]} · ${selectedEntityId}`}
        weeks={displayedWeeks}
        metrics={metrics}
        series={series}
        onInfoChange={setInfoPayload}
      />
    );
  };

  const insightsSeries = useMemo(() => {
    if (measurementUnit === "all") {
      return seriesByEntity[ALL_LABEL] ?? null;
    }
    return selectedEntityId ? seriesByEntity[selectedEntityId] ?? null : null;
  }, [measurementUnit, selectedEntityId, seriesByEntity]);

  const insightsTitle =
    measurementUnit === "all"
      ? ALL_LABEL
      : selectedEntityId || unitLabel[measurementUnit] || "-";

  return (
    <main>
      <div className="page-header">
        <h1 className="page-title">Social Match Analytics Dashboard</h1>
        <p className="page-subtitle">MVP dashboard powered by Supabase data.</p>
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
              filterOptions={filterOptions}
              filterValue={filterValue}
              onMeasurementUnitChange={handleMeasurementChange}
              onFilterChange={handleFilterChange}
              onSearch={handleSearch}
            />
            {isLoadingFilter && <div className="empty-state">Loading filters...</div>}
          </div>
        </aside>

        <div className="content-area">
          {errorMessage && <div className="empty-state">Error: {errorMessage}</div>}
          {isLoadingBase ? (
            <section className="empty-state">Loading data...</section>
          ) : !showResults ? (
            <section className="empty-state">Select conditions and search.</section>
          ) : (
            <div className="left-stack">
              <div className="breadcrumb">{breadcrumbLabel}</div>
              {measurementUnit !== "all" && (
                <EntityList
                  titleUnit={measurementUnit}
                  items={entityListData}
                  selectedId={selectedEntityId ?? undefined}
                  onSelect={(entity) => setSelectedEntityId(entity.id)}
                  onDrilldown={
                    measurementUnit === "stadium"
                      ? undefined
                      : () => {
                          if (measurementUnit === "area_group") {
                            handleDrilldown("area");
                          }
                          if (measurementUnit === "area") {
                            handleDrilldown("stadium_group");
                          }
                          if (measurementUnit === "stadium_group") {
                            handleDrilldown("stadium");
                          }
                        }
                  }
                />
              )}

              <div className="heatmap-section">
                <InfoBar info={infoPayload} />
                {renderHeatmap()}
                <InsightsPanel
                  targetLabel={`${unitLabel[measurementUnit]} ${insightsTitle}`}
                  weeks={displayedWeeks}
                  metrics={metrics}
                  series={insightsSeries ?? {}}
                  measurementUnit={measurementUnit}
                  onRecommend={handleRecommend}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
