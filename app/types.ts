export type PeriodUnit = "week";

export type MeasurementUnit =
  | "all"
  | "area_group"
  | "area"
  | "stadium_group"
  | "stadium"
  | "region_group"
  | "region"
  | "court";

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
