"use client";

import type { CSSProperties } from "react";
import { Entity, Metric } from "../types";
import Sparkline from "./Sparkline";
import { formatValue } from "../lib/format";

type EntityMetricTableProps = {
  weeks: string[];
  entities: Entity[];
  metrics: Metric[];
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
  if (!values.length) return "rgba(37, 99, 235, 0.04)";
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return "rgba(37, 99, 235, 0.08)";
  const ratio = (value - min) / (max - min);
  const intensity = 0.04 + ratio * 0.25;
  return `rgba(37, 99, 235, ${intensity})`;
};

export default function EntityMetricTable({ weeks, entities, metrics, seriesByEntity }: EntityMetricTableProps) {
  const isAnomaly = (values: number[]) => {
    if (!values.length) return false;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    if (!std) return false;
    return values.some((value) => Math.abs(value - mean) >= std * 2);
  };

  return (
    <div className="card table-card">
      <div className="card-title">엔티티별 지표 추이</div>
      <div className="table-scroll">
        <div className="data-grid entity-grid" style={{ "--week-count": weeks.length } as CSSProperties}>
          <div className="data-row data-header">
            <div className="data-cell data-entity">엔티티</div>
            <div className="data-cell data-metric">지표명</div>
            <div className="data-cell data-spark">추이</div>
            {weeks.map((week) => (
              <div key={week} className="data-cell data-week">
                {week}
              </div>
            ))}
          </div>
          {entities.flatMap((entity) => {
            const series = seriesByEntity[entity.id] ?? {};
            const entityHasAnomaly = metrics.some((metric) =>
              isAnomaly(series[metric.id] ?? Array(weeks.length).fill(0))
            );
            return metrics.map((metric, index) => {
              const values = series[metric.id] ?? Array(weeks.length).fill(0);
              const isFirst = index === 0;
              const metricHasAnomaly = isAnomaly(values);
              return (
                <div key={`${entity.id}-${metric.id}`} className="data-row">
                  <div className={`data-cell data-entity ${isFirst ? "" : "is-empty"}`}>
                    <span className="name-title">
                      {entity.name}
                      {isFirst && entityHasAnomaly && (
                        <span className="anomaly-flag" title="이상치가 존재합니다">
                          ⚠️
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="data-cell data-metric">
                    <span className="name-title">
                      {metric.name}
                      {metricHasAnomaly && (
                        <span className="anomaly-flag" title="이상치가 존재합니다">
                          ⚠️
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="data-cell data-spark">
                    <Sparkline
                      values={values}
                      labels={weeks}
                      formatValue={(value) => formatValue(value, metric)}
                    />
                  </div>
                  {values.map((value, indexValue) => {
                    const delta = indexValue > 0 ? value - values[indexValue - 1] : null;
                    const deltaLabel = formatDelta(metric, delta);
                    return (
                      <div
                        key={`${entity.id}-${metric.id}-${indexValue}`}
                        className="data-cell data-value"
                        style={{ backgroundColor: getHeatColor(values, value) }}
                      >
                        <span className="value-main">{formatValue(value, metric)}</span>
                        <span
                          className={`value-delta ${delta !== null ? "has-delta" : ""} ${
                            delta !== null && delta < 0 ? "is-negative" : ""
                          }`}
                        >
                          {delta !== null ? `(${deltaLabel})` : "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}
