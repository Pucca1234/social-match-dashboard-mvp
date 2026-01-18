type MetricTooltipProps = {
  label: string;
  title?: string;
  description: string;
  detail?: string;
};

export default function MetricTooltip({ label, title, description, detail }: MetricTooltipProps) {
  return (
    <span className="tooltip">
      <span className="tooltip-trigger">{label}</span>
      <span className="tooltip-content">
        <strong>{title ?? label}</strong>
        <span>{description}</span>
        {detail && <span className="tooltip-detail">{detail}</span>}
      </span>
    </span>
  );
}
