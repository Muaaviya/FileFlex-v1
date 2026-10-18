import type { ReactNode } from "react";

export function Stat({
  label,
  value,
  sub,
  className = "",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-line bg-panel px-4 py-5 ${className}`}
    >
      <div className="text-sm text-ink-2">{label}</div>
      <div className="tnum mt-2 text-3xl font-semibold tracking-[-0.01em] text-ink">
        {value}
      </div>
      {sub && <div className="tnum mt-1.5 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}