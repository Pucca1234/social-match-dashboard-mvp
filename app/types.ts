export type PeriodUnit = "week";

export type MeasurementUnit = "all" | "region_group" | "region" | "stadium" | "court";

export type Metric = {
  id: string;
  name: string;
  description: string;
  format: "number" | "percent";
};

export type Entity = {
  id: string;
  name: string;
  unit: MeasurementUnit;
  regionGroupId?: string;
  regionId?: string;
  stadiumId?: string;
};

export type EntitySeries = {
  entity: Entity;
  metrics: Record<string, number[]>;
};

export type FilterOption = {
  label: string;
  value: string;
};
