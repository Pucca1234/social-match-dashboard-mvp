import { Metric } from "../types";
import HeatmapMatrix from "./HeatmapMatrix";
import { InfoPayload } from "./InfoBar";

type SmallMultiple = {
  title: string;
  series: Record<string, number[]>;
};

type HeatmapSmallMultiplesProps = {
  weeks: string[];
  metrics: Metric[];
  multiples: SmallMultiple[];
  onInfoChange?: (info: InfoPayload) => void;
};

export default function HeatmapSmallMultiples({
  weeks,
  metrics,
  multiples,
  onInfoChange
}: HeatmapSmallMultiplesProps) {
  return (
    <div className="small-multiples">
      {multiples.map((item) => (
        <HeatmapMatrix
          key={item.title}
          title={item.title}
          weeks={weeks}
          metrics={metrics}
          series={item.series}
          onInfoChange={onInfoChange}
        />
      ))}
    </div>
  );
}
