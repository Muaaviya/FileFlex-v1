import type { ReactNode } from "react";

export type ChipTone = "neutral" | "brand" | "ok" | "warn" | "bad";

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: "bg-surface text-ink-2 border-line",
  brand: "bg-brand-50 text-brand-700 border-brand-200",
  ok: "bg-ok-50 text-ok-700 border-ok-300/70",
  warn: "bg-warn-50 text-warn-700 border-warn-300/70",
  bad: "bg-bad-50 text-bad-700 border-bad-300/70",
};

export function Chip({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[13px] font-semibold leading-4 ${CHIP_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function ConfidenceChip({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const pct = Math.round(value * 100);
  const tone: ChipTone = value >= 0.85 ? "ok" : value >= 0.6 ? "warn" : "bad";
  const label = value >= 0.85 ? "High" : value >= 0.6 ? "Medium" : "Low";
  return (
    <Chip tone={tone} className={`tnum ${className}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${tone === "ok" ? "bg-ok-600" : tone === "warn" ? "bg-warn-600" : "bg-bad-600"}`}
      />
      {pct}% · {label}
    </Chip>
  );
}