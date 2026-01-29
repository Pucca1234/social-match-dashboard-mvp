import { FilterOption, MeasurementUnit, Metric, PeriodUnit } from "../types";
import SegmentedButtonGroup from "./SegmentedButtonGroup";

type ControlBarProps = {
  periodUnit: PeriodUnit;
  periodRangeValue: string;
  periodRangeOptions: { label: string; value: string }[];
  onPeriodRangeChange: (value: string) => void;
  measurementUnit: MeasurementUnit;
  onMeasurementUnitChange: (value: MeasurementUnit) => void;
  filterOptions: FilterOption[];
  filterValue: string;
  onFilterChange: (value: string) => void;
  metrics: Metric[];
  selectedMetricIds: string[];
  onSelectedMetricIdsChange: (next: string[]) => void;
  onSearch: () => void;
  isSearchDisabled?: boolean;
};

export default function ControlBar({
  periodUnit,
  periodRangeValue,
  periodRangeOptions,
  onPeriodRangeChange,
  measurementUnit,
  onMeasurementUnitChange,
  filterOptions,
  filterValue,
  onFilterChange,
  metrics,
  selectedMetricIds,
  onSelectedMetricIdsChange,
  onSearch,
  isSearchDisabled
}: ControlBarProps) {
  const toggleMetric = (metricId: string) => {
    if (selectedMetricIds.includes(metricId)) {
      if (selectedMetricIds.length <= 1) return;
      onSelectedMetricIdsChange(selectedMetricIds.filter((id) => id !== metricId));
    } else {
      onSelectedMetricIdsChange([...selectedMetricIds, metricId]);
    }
  };

  return (
    <div className="sidebar-panel">
      <div className="panel-title">옵션 선택</div>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">기간단위</span>
          <select value={periodUnit} disabled>
            <option value="week">주</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">기간범위</span>
          <select value={periodRangeValue} onChange={(event) => onPeriodRangeChange(event.target.value)}>
            {periodRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <SegmentedButtonGroup
          className="measurement"
          label="측정단위"
          value={measurementUnit}
          onChange={onMeasurementUnitChange}
          options={[
            { value: "all", label: "전체" },
            { value: "area_group", label: "지역 그룹" },
            { value: "area", label: "지역" },
            { value: "stadium_group", label: "구장 그룹" },
            { value: "stadium", label: "구장" }
          ]}
        />
        <label className="field">
          <span className="field-label">필터</span>
          <select value={filterValue} onChange={(event) => onFilterChange(event.target.value)}>
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="field metric-field">
          <span className="field-label">지표 선택 (최소 1개)</span>
          <div className="metric-list">
            {metrics.map((metric) => {
              const isSelected = selectedMetricIds.includes(metric.id);
              return (
                <button
                  key={metric.id}
                  type="button"
                  className={`metric-item ${isSelected ? "is-selected" : ""}`}
                  onClick={() => toggleMetric(metric.id)}
                  aria-pressed={isSelected}
                >
                  <div className="metric-text">
                    <span className="metric-name">{metric.name}</span>
                    <span className="metric-desc">{metric.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={onSearch} disabled={isSearchDisabled}>
          조회 및 ✨ AI 자동 분석
        </button>
      </div>
    </div>
  );
}
