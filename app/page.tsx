"use client";

import { useEffect, useMemo, useState } from "react";
import ControlBar from "./components/ControlBar";
import EntityList from "./components/EntityList";
import HeatmapMatrix from "./components/HeatmapMatrix";
import InsightsPanel from "./components/InsightsPanel";
import InfoBar, { InfoPayload } from "./components/InfoBar";
import { cube, getEntitiesByUnit, getEntitySeries } from "./data/mockCube";
import { getAnomalyIndices, getZScores } from "./lib/anomaly";
import { FilterOption, MeasurementUnit, PeriodUnit } from "./types";

const unitLabel: Record<MeasurementUnit, string> = {
  all: "전체",
  region_group: "지역그룹",
  region: "지역",
  stadium: "구장",
  court: "면"
};

const periodRangeLabel = "최근 12주";

const getEntityName = (unit: MeasurementUnit, id: string) =>
  getEntitiesByUnit(unit).find((entity) => entity.id === id)?.name;

export default function Home() {
  const [periodUnit] = useState<PeriodUnit>("week");
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>("all");
  const [filterValue, setFilterValue] = useState("all");
  const [showResults, setShowResults] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [infoPayload, setInfoPayload] = useState<InfoPayload>({ metric: null });

  const selectedMetrics = cube.metrics;

  const measurementEntities = useMemo(() => {
    if (measurementUnit === "all") return [];
    return getEntitiesByUnit(measurementUnit);
  }, [measurementUnit]);

  const filterOptions = useMemo<FilterOption[]>(() => {
    // 측정단위(집계 기준)와 필터(동일 레벨 범위 제한)를 분리해 옵션 혼선을 방지한다.
    if (measurementUnit === "all") {
      return [{ label: "전체", value: "all" }];
    }
    return [
      { label: "전체", value: "all" },
      ...measurementEntities.map((entity) => ({ label: entity.name, value: entity.id }))
    ];
  }, [measurementUnit, measurementEntities]);

  const entityList = useMemo(() => {
    if (measurementUnit === "all") return [];
    if (filterValue === "all") return measurementEntities;
    return measurementEntities.filter((entity) => entity.id === filterValue);
  }, [measurementUnit, filterValue, measurementEntities]);

  const entityListData = useMemo(() => {
    if (!showResults) return [];
    if (measurementUnit === "all") return [];

    return entityList
      .map((entity) => {
        const series = getEntitySeries(entity);
        let maxAbsZ = 0;
        let topMetricName = "";
        let anomalyIndices: number[] = [];

        selectedMetrics.forEach((metric) => {
          const values = series.metrics[metric.id] ?? [];
          const zscores = getZScores(values);
          const anomalies = getAnomalyIndices(values);
          anomalies.forEach((index) => {
            if (!anomalyIndices.includes(index)) anomalyIndices.push(index);
          });
          const localMax = Math.max(...zscores.map((value) => Math.abs(value)));
          if (localMax > maxAbsZ) {
            maxAbsZ = localMax;
            topMetricName = metric.name;
          }
        });

        anomalyIndices = anomalyIndices.sort((a, b) => a - b);
        const score = Math.min(100, maxAbsZ * 22 + anomalyIndices.length * 6);
        const anomalyWeeks = anomalyIndices.slice(-3).map((index) => cube.weeks[index]);

        return {
          entity,
          anomalyScore: score,
          topMetric: topMetricName || selectedMetrics[0]?.name || "-",
          anomalyWeeks,
          anomalyIndices
        };
      })
      .sort((a, b) => b.anomalyScore - a.anomalyScore);
  }, [showResults, measurementUnit, entityList, selectedMetrics]);

  useEffect(() => {
    if (!showResults) return;
    if (measurementUnit === "all") {
      setSelectedEntityId("all");
      setInfoPayload({ metric: null });
      return;
    }
    if (filterValue !== "all") {
      setSelectedEntityId(filterValue);
      setInfoPayload({ metric: null });
      return;
    }
    if (!entityListData.length) return;
    setSelectedEntityId(entityListData[0].entity.id);
    setInfoPayload({ metric: null });
  }, [showResults, measurementUnit, filterValue, entityListData]);

  const handleSearch = () => {
    setShowResults(true);
    setInfoPayload({ metric: null });
  };

  const handleMeasurementChange = (value: MeasurementUnit) => {
    // 측정단위 변경 시 필터는 초기화된다.
    setMeasurementUnit(value);
    setFilterValue("all");
    setSelectedEntityId(null);
    setInfoPayload({ metric: null });
  };

  const handleFilterChange = (value: string) => {
    setFilterValue(value);
    setSelectedEntityId(null);
    setInfoPayload({ metric: null });
  };

  const handleDrilldown = (nextUnit: MeasurementUnit) => {
    // 드릴다운은 하위 단계로만 이동하며 필터는 동일 레벨 기준으로 다시 시작한다.
    setMeasurementUnit(nextUnit);
    setFilterValue("all");
    setSelectedEntityId(null);
    setInfoPayload({ metric: null });
  };

  const handleRecommend = (nextUnit: MeasurementUnit) => {
    // 추천 드릴다운은 측정단위를 전환하고 필터는 전체로 초기화한다.
    setMeasurementUnit(nextUnit);
    setFilterValue("all");
    setSelectedEntityId(null);
    setInfoPayload({ metric: null });
  };

  const breadcrumbLabel = useMemo(() => {
    if (measurementUnit === "all") return "전체";
    if (!selectedEntityId) return `전체 > ${unitLabel[measurementUnit]}`;

    if (measurementUnit === "region_group") {
      return `전체 > ${getEntityName("region_group", selectedEntityId)}`;
    }
    if (measurementUnit === "region") {
      const region = getEntitiesByUnit("region").find((item) => item.id === selectedEntityId);
      const groupName = region?.regionGroupId ? getEntityName("region_group", region.regionGroupId) : "지역그룹";
      return `전체 > ${groupName} > ${region?.name ?? "지역"}`;
    }
    if (measurementUnit === "stadium") {
      const stadium = getEntitiesByUnit("stadium").find((item) => item.id === selectedEntityId);
      const regionName = stadium?.regionId ? getEntityName("region", stadium.regionId) : "지역";
      const groupName = stadium?.regionGroupId ? getEntityName("region_group", stadium.regionGroupId) : "지역그룹";
      return `전체 > ${groupName} > ${regionName} > ${stadium?.name ?? "구장"}`;
    }
    const court = getEntitiesByUnit("court").find((item) => item.id === selectedEntityId);
    const stadiumName = court?.stadiumId ? getEntityName("stadium", court.stadiumId) : "구장";
    const regionName = court?.regionId ? getEntityName("region", court.regionId) : "지역";
    const groupName = court?.regionGroupId ? getEntityName("region_group", court.regionGroupId) : "지역그룹";
    return `전체 > ${groupName} > ${regionName} > ${stadiumName} > ${court?.name ?? "면"}`;
  }, [measurementUnit, selectedEntityId]);

  const renderHeatmap = () => {
    if (measurementUnit === "all") {
      const entity = getEntitiesByUnit("all")[0];
      const series = getEntitySeries(entity);
      return (
        <HeatmapMatrix
          title="전체"
          weeks={cube.weeks}
          metrics={selectedMetrics}
          series={series.metrics}
          onInfoChange={setInfoPayload}
        />
      );
    }

    if (!selectedEntityId) return <div className="empty-state">대상을 선택하세요.</div>;
    const entity = getEntitiesByUnit(measurementUnit).find((item) => item.id === selectedEntityId);
    if (!entity) return <div className="empty-state">대상을 선택하세요.</div>;
    const series = getEntitySeries(entity);
    return (
      <HeatmapMatrix
        title={`${unitLabel[measurementUnit]} · ${entity.name}`}
        weeks={cube.weeks}
        metrics={selectedMetrics}
        series={series.metrics}
        onInfoChange={setInfoPayload}
      />
    );
  };

  const insightsSeries = useMemo(() => {
    if (measurementUnit === "all") {
      const entity = getEntitiesByUnit("all")[0];
      return getEntitySeries(entity);
    }
    const entity = getEntitiesByUnit(measurementUnit).find((item) => item.id === selectedEntityId);
    return entity ? getEntitySeries(entity) : null;
  }, [measurementUnit, selectedEntityId]);

  const insightsTitle = insightsSeries?.entity.name ?? "선택 없음";

  return (
    <main>
      <div className="page-header">
        <h1 className="page-title">소셜매치 분석 대시보드</h1>
        <p className="page-subtitle">탐색 흐름 검증을 위한 MVP 프로토타입</p>
      </div>

      {/* 좌/중 2단 레이아웃 */}
      <section className="dashboard-layout">
        <aside className="sidebar left-panel">
          <div className="panel sidebar-panel">
            <div className="panel-title">검색 옵션</div>
            <ControlBar
              periodUnit={periodUnit}
              periodRangeLabel={periodRangeLabel}
              measurementUnit={measurementUnit}
              filterOptions={filterOptions}
              filterValue={filterValue}
              onMeasurementUnitChange={handleMeasurementChange}
              onFilterChange={handleFilterChange}
              onSearch={handleSearch}
            />
          </div>
        </aside>

        <div className="content-area">
          {!showResults ? (
            <section className="empty-state">조건을 선택한 뒤 조회하기를 눌러 결과를 확인하세요.</section>
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
                    measurementUnit === "court"
                      ? undefined
                      : (entity) => {
                          if (measurementUnit === "region_group") {
                            handleDrilldown("region");
                          }
                          if (measurementUnit === "region") {
                            handleDrilldown("stadium");
                          }
                          if (measurementUnit === "stadium") {
                            handleDrilldown("court");
                          }
                        }
                  }
                />
              )}

              <div className="heatmap-section">
                <InfoBar info={infoPayload} />
                {renderHeatmap()}
                {/* 우측바 제거: 인사이트는 테이블 하단으로 이동 */}
                <InsightsPanel
                  targetLabel={`${unitLabel[measurementUnit]} ${insightsTitle}`}
                  weeks={cube.weeks}
                  metrics={selectedMetrics}
                  series={insightsSeries?.metrics ?? {}}
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
