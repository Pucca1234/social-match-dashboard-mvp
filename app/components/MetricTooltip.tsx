"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type MetricTooltipProps = {
  label: string;
  title?: string;
  description: string;
  detail?: string;
};

export default function MetricTooltip({ label, title, description, detail }: MetricTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEnter = (event: React.MouseEvent<HTMLSpanElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPos({ x: rect.left, y: rect.bottom + 8 });
    setIsVisible(true);
  };

  const handleLeave = () => setIsVisible(false);

  return (
    <span className="tooltip" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <span className="tooltip-trigger">{label}</span>
      {mounted && isVisible
        ? createPortal(
            <div className="tooltip-portal" style={{ left: pos.x, top: pos.y }}>
              <strong>{title ?? label}</strong>
              <span>{description}</span>
              {detail && <span className="tooltip-detail">{detail}</span>}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
