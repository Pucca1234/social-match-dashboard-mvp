import { Metric, MeasurementUnit } from "../types";
import { getZScores } from "../lib/anomaly";

type Recommendation = {
  label: string;
  nextUnit: MeasurementUnit;
};

type InsightsPanelProps = {
  targetLabel: string;
  weeks: string[];
  metrics: Metric[];
  series: Record<string, number[]>;
  measurementUnit: MeasurementUnit;
  onRecommend: (nextUnit: MeasurementUnit) => void;
};

const unitNext: Record<MeasurementUnit, MeasurementUnit | null> = {
  all: "region_group",
  region_group: "region",
  region: "stadium",
  stadium: "court",
  court: null
};

const unitLabel: Record<MeasurementUnit, string> = {
  all: "전체",
  region_group: "지역그룹",
  region: "지역",
  stadium: "구장",
  court: "면"
};

const getLatestDelta = (values: number[]) => {
  const lastIndex = values.length - 1;
  if (lastIndex <= 0) return 0;
  return values[lastIndex] - values[lastIndex - 1];
};

export default function InsightsPanel({
  targetLabel,
  weeks,
  metrics,
  series,
  measurementUnit,
  onRecommend
}: InsightsPanelProps) {
  const primaryMetric = metrics[0];
  const secondaryMetric = metrics[1];

  const primaryValues = series[primaryMetric?.id ?? ""] ?? [];
  const secondaryValues = series[secondaryMetric?.id ?? ""] ?? [];
  const primaryDelta = getLatestDelta(primaryValues);
  const secondaryDelta = getLatestDelta(secondaryValues);

  const anomalyDetails = metrics
    .flatMap((metric) => {
      const values = series[metric.id] ?? [];
      const zscores = getZScores(values);
      return zscores
        .map((score, index) => ({
          metric,
          week: weeks[index],
          score,
          value: values[index] ?? 0
        }))
        .filter((entry) => Math.abs(entry.score) >= 2);
    })
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 3);

  const anomalySummary =
    anomalyDetails.length === 0
      ? "이번 범위에서는 뚜렷한 이상치가 없습니다."
      : anomalyDetails
          .map((entry) => {
            const direction = entry.score >= 0 ? "증가" : "감소";
            return `${entry.metric.name} · ${entry.week} · ${direction}`;
          })
          .join(" / ");

  const recommendations: Recommendation[] = [];
  const nextUnit = unitNext[measurementUnit];

  if (nextUnit) {
    recommendations.push({
      label: `${unitLabel[nextUnit]} 보기`,
      nextUnit
    });
  }

  if (anomalyDetails.length > 0 && nextUnit) {
    const metricName = anomalyDetails[0].metric.name;
    recommendations.unshift({
      label: `${metricName} 이상치 기준 ${unitLabel[nextUnit]} 확인`,
      nextUnit
    });
  }

  if (measurementUnit !== "all") {
    recommendations.push({
      label: "전체로 돌아가기",
      nextUnit: "all"
    });
  }

  const summaryLines = [
    `${primaryMetric?.name ?? "핵심 지표"}는 최근 흐름에서 ${primaryDelta >= 0 ? "상승" : "하락"}세입니다.`,
    `${secondaryMetric?.name ?? "보조 지표"}는 ${secondaryDelta >= 0 ? "안정적" : "약세"} 흐름을 보입니다.`,
    "현재 범위는 탐색용 요약이며 상세 원인은 하위 드릴다운에서 확인 가능합니다."
  ];

  const hypotheses = [
    "특정 지역/구장 단위 쏠림이 지표 변화를 만들었을 가능성이 있어요.",
    "이상치가 있는 주차는 프로모션/외부 이슈 영향일 수 있습니다."
  ];

  return (
    <div className="panel insights-panel">
      {/* 우측바 제거에 따라 하단 종합 인사이트 카드로 축소 */}
      <div className="panel-title">Insights · {targetLabel}</div>
      <div className="insight-card">
        <div className="insight-section">
          <div className="insight-heading">이번 기간 핵심 요약</div>
          <p>{summaryLines[0]}</p>
          <p>{summaryLines[1]}</p>
          <p>{summaryLines[2]}</p>
        </div>
        <div className="insight-section">
          <div className="insight-heading">이상 신호 감지</div>
          <p>{anomalySummary}</p>
        </div>
        <div className="insight-section">
          <div className="insight-heading">해석 가설</div>
          <ul>
            {hypotheses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="insight-section">
          <div className="insight-heading">다음 추천 드릴다운 옵션</div>
          <div className="recommend-list">
            {recommendations.length === 0 ? (
              <span className="muted">추천 항목이 없습니다.</span>
            ) : (
              recommendations.slice(0, 5).map((item, index) => (
                <button
                  key={`${item.label}-${index}`}
                  type="button"
                  className="recommend-chip"
                  onClick={() => onRecommend(item.nextUnit)}
                >
                  {item.label}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
