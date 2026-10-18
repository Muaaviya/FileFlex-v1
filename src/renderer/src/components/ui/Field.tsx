import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-8 w-full rounded-md border border-line bg-panel px-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";