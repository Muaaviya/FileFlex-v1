import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
  padded = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-lg border border-line bg-panel ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div>
            {title && (
              <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-ink-2">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}