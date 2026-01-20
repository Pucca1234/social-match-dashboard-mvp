import type { CSSProperties } from "react";
import { useState } from "react";
import { Entity, Metric } from "../types";
import MetricTable from "./MetricTable";
import Sparkline from "./Sparkline";
import { formatValue } from "../lib/format";

type EntityMetricTableProps = {
  weeks: string[];
  entities: Entity[];
  metrics: Metric[];
  primaryMetricId: string;
  seriesByEntity: Record<string, Record<string, number[]>>;
};

const formatDelta = (metric: Metric, delta: number | null) => {
  if (delta === null) return "-";
  if (metric.format === "percent") {
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${(delta * 100).toFixed(1)}%p`;
  }
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toLocaleString("ko-KR")}`;
};

const getHeatColor = (values: number[], value: number) => {
  if (!values.length) return "rgba(31, 111, 95, 0.15)";
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return "rgba(31, 111, 95, 0.18)";
  const ratio = (value - min) / (max - min);
  const intensity = 0.12 + ratio * 0.5;
  return `rgba(31, 111, 95, ${intensity})`;
};

export default function EntityMetricTable({
  weeks,
  entities,
  metrics,
  primaryMetricId,
  seriesByEntity
}: EntityMetricTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const primaryMetric = metrics.find((metric) => metric.id === primaryMetricId) ?? metrics[0];

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="panel metric-table">
      <div className="panel-title">엔티티별 {primaryMetric?.name ?? "핵심 지표"}</div>
      <div className="metric-grid" style={{ "--week-count": weeks.length } as CSSProperties}>
        <div className="metric-row metric-header">
          <div className="metric-cell metric-name">엔티티</div>
          <div className="metric-cell metric-spark">추이</div>
          {weeks.map((week) => (
            <div key={week} className="metric-cell metric-week">
              {week}
            </div>
          ))}
        </div>
        {entities.map((entity) => {
          const series = seriesByEntity[entity.id] ?? {};
          const values = series[primaryMetricId] ?? Array(weeks.length).fill(0);
          const isExpanded = expandedIds.has(entity.id);

          return (
            <div key={entity.id} className="metric-row-group">
              <div
                className={`metric-row entity-row ${isExpanded ? "is-expanded" : ""}`}
                onClick={() => toggleExpand(entity.id)}
                role="button"
              >
                <div className="metric-cell metric-name">
                  <span className="entity-label">{entity.name}</span>
                  <span className="entity-toggle">{isExpanded ? "접기" : "상세"}</span>
                </div>
                <div className="metric-cell metric-spark">
                  <Sparkline
                    values={values}
                    labels={weeks}
                    formatValue={(value) => (primaryMetric ? formatValue(value, primaryMetric) : String(value))}
                  />
                </div>
                {values.map((value, index) => {
                  const delta = index + 1 < values.length ? value - values[index + 1] : null;
                  const deltaLabel = primaryMetric ? formatDelta(primaryMetric, delta) : "-";
                  return (
                    <div
                      key={`${entity.id}-${index}`}
                      className="metric-cell metric-value"
                      style={{ backgroundColor: getHeatColor(values, value) }}
                    >
                      <span className="metric-value-main">
                        {primaryMetric ? formatValue(value, primaryMetric) : value}
                      </span>
                      <span className={`metric-delta ${delta !== null && delta < 0 ? "is-negative" : ""}`}>
                        {delta !== null ? `(${deltaLabel})` : "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {isExpanded && (
                <div className="entity-detail">
                  <MetricTable
                    weeks={weeks}
                    metrics={metrics}
                    series={series}
                    primaryMetricId={primaryMetricId}
                    showHeader={false}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
