import { Entity, EntitySeries, MeasurementUnit, Metric } from "../types";

export const weeks = [
  "25.10.20 - 10.26",
  "25.10.27 - 11.02",
  "25.11.03 - 11.09",
  "25.11.10 - 11.16",
  "25.11.17 - 11.23",
  "25.11.24 - 11.30",
  "25.12.01 - 12.07",
  "25.12.08 - 12.14",
  "25.12.15 - 12.21",
  "25.12.22 - 12.28",
  "25.12.29 - 01.04",
  "26.01.05 - 01.11"
];

export const metrics: Metric[] = [
  {
    id: "total_match_cnt",
    name: "전체 매치 수",
    description: "주간 전체 매치 생성 수",
    format: "number"
  },
  {
    id: "setting_match_cnt",
    name: "세팅 매치 수",
    description: "매치가 세팅 상태까지 도달한 건수",
    format: "number"
  },
  {
    id: "progress_match_cnt",
    name: "진행 매치 수",
    description: "실제 진행된 매치 수",
    format: "number"
  },
  {
    id: "progress_match_rate",
    name: "진행 매치율",
    description: "진행 매치 / 전체 매치 비율",
    format: "percent"
  },
  {
    id: "match_open_rate",
    name: "오픈 비율",
    description: "공개로 전환된 매치 비율",
    format: "percent"
  },
  {
    id: "match_loss_rate",
    name: "이탈 비율",
    description: "매치가 취소 또는 유실된 비율",
    format: "percent"
  }
];


const regionGroups = ["수도권", "충청", "호남", "영남", "강원/제주"];
const regionsByGroup: Record<string, string[]> = {
  수도권: ["서울", "경기북부", "경기남부", "인천", "수원"],
  충청: ["대전", "세종", "청주", "천안", "충주"],
  호남: ["광주", "전주", "여수", "목포", "순천"],
  영남: ["부산", "대구", "울산", "포항", "창원"],
  "강원/제주": ["춘천", "강릉", "원주", "속초", "제주"]
};

type MetricConfig = {
  base: number;
  variance: number;
  min: number;
  max: number;
  isRate?: boolean;
};

const metricConfig: Record<string, MetricConfig> = {
  total_match_cnt: { base: 1400, variance: 320, min: 400, max: 2200 },
  setting_match_cnt: { base: 620, variance: 180, min: 180, max: 1100 },
  progress_match_cnt: { base: 520, variance: 160, min: 140, max: 980 },
  progress_match_rate: { base: 0.78, variance: 0.08, min: 0.45, max: 0.92, isRate: true },
  match_open_rate: { base: 0.42, variance: 0.08, min: 0.2, max: 0.68, isRate: true },
  match_loss_rate: { base: 0.08, variance: 0.04, min: 0.02, max: 0.2, isRate: true }
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const makeSeries = (seed: number, scale: number, config: MetricConfig) => {
  return weeks.map((_, index) => {
    const wave =
      Math.sin((index + 1) * 0.65 + seed) * config.variance +
      Math.cos((index + 2) * 0.35 + seed * 1.4) * config.variance * 0.45;
    const base = config.base * scale;
    const value = config.isRate ? config.base + wave * 0.12 : base + wave;
    const adjusted = config.isRate ? value : Math.round(value);
    return clamp(adjusted, config.min, config.max);
  });
};

const injectAnomalies = (values: number[], seed: number, config: MetricConfig) => {
  if (values.length < 4) return values;
  const next = [...values];
  const spikeIndex = (seed * 3) % values.length;
  const dipIndex = (seed * 5 + 2) % values.length;
  const spike = config.isRate ? 0.12 : config.variance * 1.4;
  const dip = config.isRate ? -0.1 : -config.variance * 1.2;
  next[spikeIndex] = clamp(next[spikeIndex] + spike, config.min, config.max);
  next[dipIndex] = clamp(next[dipIndex] + dip, config.min, config.max);
  return next;
};

const scaleByUnit: Record<MeasurementUnit, number> = {
  all: 1,
  region_group: 0.65,
  region: 0.38,
  stadium: 0.22,
  court: 0.12
};

const createEntitySeries = (entity: Entity, seed: number): EntitySeries => {
  const metricsMap: Record<string, number[]> = {};
  metrics.forEach((metric) => {
    const config = metricConfig[metric.id];
    const raw = makeSeries(seed + metric.id.length * 1.3, scaleByUnit[entity.unit], config);
    metricsMap[metric.id] = injectAnomalies(raw, seed + metric.id.length, config);
  });
  return { entity, metrics: metricsMap };
};

const entityKey = (entity: Entity) => `${entity.unit}:${entity.id}`;

const allEntity: Entity = {
  id: "all",
  name: "전체",
  unit: "all"
};

const entitySeriesMap: Record<string, EntitySeries> = {};
const entitiesByUnit: Record<MeasurementUnit, Entity[]> = {
  all: [allEntity],
  region_group: [],
  region: [],
  stadium: [],
  court: []
};

entitySeriesMap[entityKey(allEntity)] = createEntitySeries(allEntity, 0.7);

let seedCounter = 1;
regionGroups.forEach((group) => {
  const groupEntity: Entity = {
    id: `rg-${seedCounter}`,
    name: group,
    unit: "region_group"
  };
  entitiesByUnit.region_group.push(groupEntity);
  entitySeriesMap[entityKey(groupEntity)] = createEntitySeries(groupEntity, seedCounter);

  const regions = regionsByGroup[group];
  regions.forEach((region, regionIndex) => {
    const regionEntity: Entity = {
      id: `r-${seedCounter}-${regionIndex + 1}`,
      name: region,
      unit: "region",
      regionGroupId: groupEntity.id
    };
    entitiesByUnit.region.push(regionEntity);
    entitySeriesMap[entityKey(regionEntity)] = createEntitySeries(regionEntity, seedCounter + regionIndex * 0.4);

    for (let sIndex = 0; sIndex < 3; sIndex += 1) {
      const stadiumEntity: Entity = {
        id: `st-${seedCounter}-${regionIndex + 1}-${sIndex + 1}`,
        name: `${region} ${sIndex + 1}구장`,
        unit: "stadium",
        regionGroupId: groupEntity.id,
        regionId: regionEntity.id
      };
      entitiesByUnit.stadium.push(stadiumEntity);
      entitySeriesMap[entityKey(stadiumEntity)] = createEntitySeries(stadiumEntity, seedCounter + sIndex * 0.5);

      const courtCount = (sIndex % 3) + 1;
      for (let cIndex = 0; cIndex < courtCount; cIndex += 1) {
        const courtEntity: Entity = {
          id: `c-${seedCounter}-${regionIndex + 1}-${sIndex + 1}-${cIndex + 1}`,
          name: `${stadiumEntity.name} ${cIndex + 1}면`,
          unit: "court",
          regionGroupId: groupEntity.id,
          regionId: regionEntity.id,
          stadiumId: stadiumEntity.id
        };
        entitiesByUnit.court.push(courtEntity);
        entitySeriesMap[entityKey(courtEntity)] = createEntitySeries(courtEntity, seedCounter + cIndex * 0.3);
      }
    }
  });

  seedCounter += 1;
});

export const cube = {
  weeks,
  metrics,
  entitiesByUnit
};

export const getEntitySeries = (entity: Entity) => entitySeriesMap[entityKey(entity)];

export const getEntitiesByUnit = (unit: MeasurementUnit) => entitiesByUnit[unit];

export const getChildEntities = (unit: MeasurementUnit, filters: { regionGroupId?: string; regionId?: string }) => {
  if (unit === "region") {
    return entitiesByUnit.region.filter((item) => !filters.regionGroupId || item.regionGroupId === filters.regionGroupId);
  }
  if (unit === "stadium") {
    return entitiesByUnit.stadium.filter((item) => !filters.regionId || item.regionId === filters.regionId);
  }
  if (unit === "court") {
    return entitiesByUnit.court.filter((item) => !filters.regionId || item.regionId === filters.regionId);
  }
  return entitiesByUnit[unit];
};

export const getCourtsByStadium = (stadiumId: string) =>
  entitiesByUnit.court.filter((item) => item.stadiumId === stadiumId);

export const getRegionGroups = () => entitiesByUnit.region_group;
export const getRegions = () => entitiesByUnit.region;
export const getStadiums = () => entitiesByUnit.stadium;
