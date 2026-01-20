import { Entity, MeasurementUnit } from "../types";

const unitLabels: Record<MeasurementUnit, string> = {
  all: "전체",
  area_group: "지역 그룹",
  area: "지역",
  stadium_group: "구장 그룹",
  stadium: "구장",
  region_group: "권역 그룹",
  region: "권역",
  court: "면"
};

type EntityListProps = {
  titleUnit: MeasurementUnit;
  items: {
    entity: Entity;
    anomalyScore: number;
    topMetric: string;
    anomalyWeeks: string[];
    anomalyIndices: number[];
  }[];
  selectedId?: string;
  onSelect: (entity: Entity) => void;
  onDrilldown?: (entity: Entity) => void;
};

export default function EntityList({ titleUnit, items, selectedId, onSelect, onDrilldown }: EntityListProps) {
  return (
    <div className="panel entity-list">
      <div className="panel-title">
        {unitLabels[titleUnit]} 리스트
        <span className="panel-subtitle">{items.length}개</span>
      </div>
      <div className="list-header">
        <span>대상</span>
        <span>점수</span>
        <span>주요 지표</span>
        <span>이상 주차</span>
        <span>추이</span>
      </div>
      <div className="list-body">
        {items.map((item) => (
          <div
            key={item.entity.id}
            className={`list-row ${selectedId === item.entity.id ? "is-selected" : ""}`}
            onClick={() => onSelect(item.entity)}
            role="button"
          >
            <span className="cell-entity">
              {item.entity.name}
              {onDrilldown && (
                <button
                  type="button"
                  className="drilldown-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDrilldown(item.entity);
                  }}
                >
                  상세
                </button>
              )}
            </span>
            <span className="cell-score">{Math.round(item.anomalyScore)}</span>
            <span className="cell-metric">{item.topMetric}</span>
            <span className="cell-weeks">{item.anomalyWeeks.join(", ") || "-"}</span>
            <span className="cell-strip">
              {Array.from({ length: 12 }).map((_, index) => (
                <span
                  key={`${item.entity.id}-${index}`}
                  className={`strip-dot ${item.anomalyIndices.includes(index) ? "is-hit" : ""}`}
                />
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
