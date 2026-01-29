import React from "react";

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type SegmentedButtonGroupProps<T extends string> = {
  label?: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export default function SegmentedButtonGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className
}: SegmentedButtonGroupProps<T>) {
  return (
    <div className={`segment-group ${className ?? ""}`.trim()}>
      {label && <div className="segment-label">{label}</div>}
      <div className={`segment-row ${className ?? ""}`.trim()} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`segment-btn ${value === option.value ? "is-active" : ""}`}
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            disabled={option.disabled}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
