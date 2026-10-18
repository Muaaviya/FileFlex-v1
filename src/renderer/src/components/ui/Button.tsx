import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 border border-brand-700",
  secondary:
    "bg-panel text-ink border border-line hover:bg-surface hover:border-ink-3/50",
  ghost: "text-ink-2 hover:bg-surface hover:text-ink border border-transparent",
  danger: "bg-panel text-bad-700 border border-bad-300 hover:bg-bad-50",
};

export function Button({
  variant = "secondary",
  sm,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  sm?: boolean;
}) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        sm ? "h-7 px-7.5 py-3 text-sm" : "h-8 px-3 text-[13px]"
      } ${BTN_VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}