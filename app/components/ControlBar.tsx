import { FilterOption, MeasurementUnit, PeriodUnit } from "../types";

type ControlBarProps = {
  periodUnit: PeriodUnit;
  periodRangeValue: string;
  periodRangeOptions: { label: string; value: string }[];
  onPeriodRangeChange: (value: string) => void;
  measurementUnit: MeasurementUnit;
  filterOptions: FilterOption[];
  filterValue: string;
  onMeasurementUnitChange: (value: MeasurementUnit) => void;
  onFilterChange: (value: string) => void;
  onSearch: () => void;
};

export default function ControlBar({
  periodUnit,
  periodRangeValue,
  periodRangeOptions,
  onPeriodRangeChange,
  measurementUnit,
  filterOptions,
  filterValue,
  onMeasurementUnitChange,
  onFilterChange,
  onSearch
}: ControlBarProps) {
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
            <option value="area_group">Area group</option>
            <option value="area">Area</option>
            <option value="stadium_group">Stadium group</option>
            <option value="stadium">Stadium</option>
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
          <button type="button" onClick={onSearch}>
            조회하기
          </button>
        </div>
      </div>
    </div>
  );
}
