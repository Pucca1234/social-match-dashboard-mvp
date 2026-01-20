import type { CSSProperties } from "react";
import { Metric } from "../types";
import { formatValue } from "../lib/format";
import MetricTooltip from "./MetricTooltip";
import Sparkline from "./Sparkline";

type MetricTableProps = {
  title?: string;
  weeks: string[];
  metrics: Metric[];
  series: Record<string, number[]>;
  primaryMetricId?: string;
  showHeader?: boolean;
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

export default function MetricTable({
  title,
  weeks,
  metrics,
  series,
  primaryMetricId,
  showHeader = true
}: MetricTableProps) {
  return (
    <div className="panel metric-table">
      {title && <div className="panel-title">{title}</div>}
      <div className="metric-grid" style={{ "--week-count": weeks.length } as CSSProperties}>
        {showHeader && (
          <div className="metric-row metric-header">
            <div className="metric-cell metric-name">지표</div>
            <div className="metric-cell metric-spark">추이</div>
            {weeks.map((week) => (
              <div key={week} className="metric-cell metric-week">
                {week}
              </div>
            ))}
          </div>
        )}
        {metrics.map((metric) => {
          const values = series[metric.id] ?? Array(weeks.length).fill(0);
          return (
            <div
              key={metric.id}
              className={`metric-row ${metric.id === primaryMetricId ? "is-primary" : ""}`}
            >
              <div className="metric-cell metric-name">
                <MetricTooltip label={metric.name} title={metric.name} description={metric.description} />
              </div>
              <div className="metric-cell metric-spark">
                <Sparkline
                  values={values}
                  labels={weeks}
                  formatValue={(value) => formatValue(value, metric)}
                />
              </div>
              {values.map((value, index) => {
                const delta = index + 1 < values.length ? value - values[index + 1] : null;
                const deltaLabel = formatDelta(metric, delta);
                return (
                  <div
                    key={`${metric.id}-${index}`}
                    className="metric-cell metric-value"
                    style={{ backgroundColor: getHeatColor(values, value) }}
                  >
                    <span className="metric-value-main">{formatValue(value, metric)}</span>
                    <span className={`metric-delta ${delta !== null && delta < 0 ? "is-negative" : ""}`}>
                      {delta !== null ? `(${deltaLabel})` : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
