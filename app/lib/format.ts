import { Metric } from "../types";

export const formatNumber = (value: number) => value.toLocaleString("ko-KR");

export const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const formatValue = (value: number, metric: Metric) => {
  if (metric.format === "percent") return formatPercent(value);
  return formatNumber(value);
};
