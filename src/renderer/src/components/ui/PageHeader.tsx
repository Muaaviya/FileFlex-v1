import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-[13px] text-ink-2">{subtitle}</p>}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  );
}