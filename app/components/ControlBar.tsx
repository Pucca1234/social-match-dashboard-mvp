import { FilterOption, MeasurementUnit, Metric, PeriodUnit } from "../types";
import MetricTooltip from "./MetricTooltip";

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
  primaryMetricId: string;
  onSelectedMetricIdsChange: (next: string[]) => void;
  onPrimaryMetricChange: (value: string) => void;
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
  primaryMetricId,
  onSelectedMetricIdsChange,
  onPrimaryMetricChange,
  onSearch,
  isSearchDisabled
}: ControlBarProps) {
  const toggleMetric = (metricId: string) => {
    if (selectedMetricIds.includes(metricId)) {
      onSelectedMetricIdsChange(selectedMetricIds.filter((id) => id !== metricId));
    } else {
      onSelectedMetricIdsChange([...selectedMetricIds, metricId]);
    }
  };

  const primaryOptions = metrics.filter((metric) => selectedMetricIds.includes(metric.id));

  return (
    <div className="control-bar">
      <div className="control-grid">
        <div className="control-field">
          <label>기간단위</label>
          <select value={periodUnit} disabled>
            <option value="week">주</option>
          </select>
        </div>
        <div className="control-field">
          <label>기간범위</label>
          <select value={periodRangeValue} onChange={(event) => onPeriodRangeChange(event.target.value)}>
            {periodRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="control-field">
          <label>측정단위</label>
          <select value={measurementUnit} onChange={(event) => onMeasurementUnitChange(event.target.value as MeasurementUnit)}>
            <option value="all">전체</option>
            <option value="area_group">지역 그룹</option>
            <option value="area">지역</option>
            <option value="stadium_group">구장 그룹</option>
            <option value="stadium">구장</option>
          </select>
        </div>
        <div className="control-field">
          <label>필터</label>
          <select value={filterValue} onChange={(event) => onFilterChange(event.target.value)}>
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="control-field">
          <label>핵심 지표</label>
          <select
            value={primaryMetricId}
            onChange={(event) => onPrimaryMetricChange(event.target.value)}
            disabled={primaryOptions.length === 0}
          >
            {primaryOptions.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.name}
              </option>
            ))}
          </select>
        </div>
        <div className="control-field control-metrics">
          <label>지표 선택</label>
          <div className="metric-select-list">
            {metrics.map((metric) => (
              <label key={metric.id} className="metric-option">
                <input
                  type="checkbox"
                  checked={selectedMetricIds.includes(metric.id)}
                  onChange={() => toggleMetric(metric.id)}
                />
                <span className="metric-option-label">{metric.name}</span>
                <MetricTooltip label="ⓘ" title={metric.name} description={metric.description} />
              </label>
            ))}
          </div>
        </div>
        <div className="control-field">
          <button type="button" onClick={onSearch} disabled={isSearchDisabled}>
            조회하기
          </button>
        </div>
      </div>
    </div>
  );
}
