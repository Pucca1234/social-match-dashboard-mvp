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
  all: "area_group",
  area_group: "area",
  area: "stadium_group",
  stadium_group: "stadium",
  stadium: null,
  region_group: "region",
  region: "stadium",
  court: null
};

const unitLabel: Record<MeasurementUnit, string> = {
  all: "전체",
  area_group: "지역 그룹",
  area: "지역",
  stadium_group: "구장 그룹",
  stadium: "구장",
  region_group: "권역 그룹",
  region: "권역",
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
      ? "이번 범위에서 뚜렷한 이상치는 없습니다."
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
    `${primaryMetric?.name ?? "핵심 지표"}가 최근 흐름에서 ${primaryDelta >= 0 ? "상승" : "하락"}했습니다.`,
    `${secondaryMetric?.name ?? "보조 지표"}는 ${secondaryDelta >= 0 ? "상승" : "하락"} 흐름을 보입니다.`,
    "현재 범위에서 이상치 후보는 색으로 표시되며, 자세한 변화는 아래 항목에서 확인할 수 있습니다."
  ];

  const hypotheses = [
    "특정 지역/구장 단위의 분포 변화가 지표 변동을 만들었을 수 있습니다.",
    "이상치가 있는 주차는 프로모션/외부 이슈 영향이 있었는지 확인이 필요합니다."
  ];

  return (
    <div className="panel insights-panel">
      {/* 과도한 텍스트를 줄인 간단 요약 인사이트 카드 */}
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
          <div className="insight-heading">다음 추천 액션</div>
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
