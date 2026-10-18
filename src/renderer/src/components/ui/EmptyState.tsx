import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-panel px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-[13px] text-ink-2">{body}</p>}
      {children && (
        <div className="mt-4 flex items-center gap-2">{children}</div>
      )}
    </div>
  );
}