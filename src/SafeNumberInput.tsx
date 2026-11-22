import { useEffect, useState } from "react";

/**
 * Keeps temporarily empty numeric input in local component state.
 * Only completed values within validation bounds reach the saved journal.
 */
export function SafeNumberInput({
  value, onValueChange, min, max, step = 1, integer = false,
}: {
  value: number;
  onValueChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        if (!text.trim()) return;
        const n = Number(text);
        if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) return;
        onValueChange(n);
      }}
      onBlur={() => setDraft(String(value))}
    />
  );
}
