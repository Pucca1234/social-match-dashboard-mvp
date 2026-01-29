"use client";

import type { CSSProperties } from "react";
import { Metric } from "../types";
import { formatValue } from "../lib/format";
import Sparkline from "./Sparkline";

type MetricTableProps = {
  title?: string;
  weeks: string[];
  metrics: Metric[];
  series: Record<string, number[]>;
  primaryMetricId?: string;
  showHeader?: boolean;
  dense?: boolean;
  indent?: boolean;
  scrollable?: boolean;
  embedded?: boolean;
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

const hasAnomaly = (values: number[]) => {
  if (!values.length) return false;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  if (!std) return false;
  return values.some((value) => Math.abs(value - mean) >= std * 2);
};

export default function MetricTable({
  title,
  weeks,
  metrics,
  series,
  primaryMetricId,
  showHeader = true,
  dense = false,
  indent = false,
  scrollable = true,
  embedded = false
}: MetricTableProps) {
  const grid = (
    <div className="data-grid" style={{ "--week-count": weeks.length } as CSSProperties}>
      {showHeader && (
        <div className="data-row data-header">
          <div className="data-cell data-name">지표</div>
          <div className="data-cell data-spark">추이</div>
          {weeks.map((week) => (
            <div key={week} className="data-cell data-week">
              {week}
            </div>
          ))}
        </div>
      )}
      {metrics.map((metric) => {
        const values = series[metric.id] ?? Array(weeks.length).fill(0);
          return (
            <div key={metric.id} className={`data-row ${metric.id === primaryMetricId ? "is-primary" : ""}`}>
              <div className="data-cell data-name">
                <span className="name-title">
                  {metric.name}
                  {hasAnomaly(values) && (
                    <span className="anomaly-flag" title="이상치가 존재합니다">
                      ⚠️
                    </span>
                  )}
                </span>
              </div>
            <div className="data-cell data-spark">
              <Sparkline values={values} labels={weeks} formatValue={(value) => formatValue(value, metric)} />
            </div>
            {values.map((value, index) => {
              const delta = index > 0 ? value - values[index - 1] : null;
              const deltaLabel = formatDelta(metric, delta);
              return (
                <div
                  key={`${metric.id}-${index}`}
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
      })}
    </div>
  );

  const wrapperClass = `${embedded ? "table-embedded" : "card"} table-card ${dense ? "is-dense" : ""} ${
    indent ? "is-indent" : ""
  }`.trim();

  return (
    <div className={wrapperClass}>
      {title && <div className="card-title">{title}</div>}
      {scrollable ? (
        <div className="table-scroll">{grid}</div>
      ) : (
        grid
      )}
    </div>
  );
}
