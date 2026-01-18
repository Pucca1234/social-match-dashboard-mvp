import { FilterOption, MeasurementUnit, PeriodUnit } from "../types";

type ControlBarProps = {
  periodUnit: PeriodUnit;
  periodRangeLabel: string;
  measurementUnit: MeasurementUnit;
  filterOptions: FilterOption[];
  filterValue: string;
  onMeasurementUnitChange: (value: MeasurementUnit) => void;
  onFilterChange: (value: string) => void;
  onSearch: () => void;
};

export default function ControlBar({
  periodUnit,
  periodRangeLabel,
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
          <select value={periodRangeLabel} disabled>
            <option>{periodRangeLabel}</option>
          </select>
        </div>
        <div className="control-field">
          <label>측정단위</label>
          <select value={measurementUnit} onChange={(event) => onMeasurementUnitChange(event.target.value as MeasurementUnit)}>
            <option value="all">전체</option>
            <option value="region_group">지역그룹</option>
            <option value="region">지역</option>
            <option value="stadium">구장</option>
            <option value="court">면</option>
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
