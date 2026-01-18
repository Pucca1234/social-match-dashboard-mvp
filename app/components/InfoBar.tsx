import { Metric } from "../types";
import { formatValue } from "../lib/format";

export type InfoPayload = {
  metric: Metric | null;
  value?: number;
  delta?: number;
  zscore?: number;
  isAnomaly?: boolean;
  week?: string;
};

type InfoBarProps = {
  info: InfoPayload;
};

export default function InfoBar({ info }: InfoBarProps) {
  if (!info.metric) {
    return <div className="info-bar">지표 또는 셀을 hover하면 상세 정보가 표시됩니다.</div>;
  }

  const { metric, value, delta, zscore, isAnomaly, week } = info;
  const deltaLabel =
    delta === undefined ? "-" : `${delta >= 0 ? "+" : ""}${formatValue(delta, metric)}`;
  const valueLabel = value === undefined ? "-" : formatValue(value, metric);

  return (
    <div className="info-bar">
      <span className="info-title">{metric.name}</span>
      <span className="info-desc">{metric.description}</span>
      <span className="info-item">주차: {week ?? "-"}</span>
      <span className="info-item">값: {valueLabel}</span>
      <span className="info-item">Δ: {deltaLabel}</span>
      <span className={`info-item ${isAnomaly ? "is-anomaly" : ""}`}>
        이상치: {isAnomaly ? `예 (z=${(zscore ?? 0).toFixed(2)})` : "아니오"}
      </span>
    </div>
  );
}
