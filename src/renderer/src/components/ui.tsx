import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Component, useEffect, useRef, useState } from "react";
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  ShieldIcon,
  XIcon,
} from "./icons";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

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

interface ErrorBoundaryState {
  error: Error | null;
}

/** Keeps a crashed page from blanking the whole app: shows the error and a retry. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-bad-300 bg-bad-50 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-bad-700">
            <AlertIcon className="h-4 w-4" /> This page hit an error
          </div>
          <div className="mt-2 break-all font-mono text-xs text-bad-700/80">
            {this.state.error.message}
          </div>
          <Button
            className="mt-3"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }
}

type ChipTone = "neutral" | "brand" | "ok" | "warn" | "bad";

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

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[24px] w-13.5 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        checked ? "bg-brand-600" : "bg-ink-3/40"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[20px] w-[20px] rounded-full bg-white shadow transition-all ${
          checked ? "left-[32px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}

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

export function TrustBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-md bg-panel border border-line px-3 py-2 text-md text-brand-50 font-semibold">
      <ShieldIcon className="h-3.5 w-3.5 shrink-0" />
      <span>
        {children ??
          "Nothing changes until you approve — every applied change can be rolled back from History."}
      </span>
    </div>
  );
}

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

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onMouseDown={onClose}
    >
      <div
        className={`w-full ${width} rounded-lg border border-line bg-panel shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
          <Button variant="ghost" sm onClick={onClose} aria-label="Close">
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/** Two-click confirm button — first click arms it, second click fires, auto-disarms after 3s. */
export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel = "Click to confirm",
  variant = "danger",
  sm = true,
  disabled,
}: {
  onConfirm: () => void;
  label: ReactNode;
  confirmLabel?: string;
  variant?: ButtonVariant;
  sm?: boolean;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <Button
      variant={armed ? "primary" : variant}
      sm={sm}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          if (timer.current) clearTimeout(timer.current);
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3000);
        }
      }}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}

/** A styled checkbox — square with rounded corners, accent fill + checkmark on check, indeterminate dash, focus ring, hover lift. */
export function Checkbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  label,
  className = "",
}: {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const real = indeterminate ? false : !!checked;
  const state = indeterminate ? "indeterminate" : real ? "checked" : "empty";
  return (
    <label
      className={`inline-flex items-center gap-2 select-none ${disabled ? "opacity-40" : "cursor-pointer"} ${className}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={indeterminate ? "mixed" : real}
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          if (!onChange) return;
          onChange(indeterminate ? true : !real);
        }}
        className={`relative h-4 w-4 shrink-0 rounded-[5px] border transition-all duration-150 ${
          state === "checked"
            ? "border-brand-600 bg-brand-600"
            : state === "indeterminate"
              ? "border-brand-600 bg-brand-600"
              : "border-line bg-panel hover:border-brand-400 hover:bg-brand-50"
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-1`}
      >
        {state === "checked" ? (
          <CheckIcon className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white" />
        ) : state === "indeterminate" ? (
          <span className="absolute top-1/2 left-1/2 h-0.5 w-2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white" />
        ) : null}
      </button>
      {label && <span className="text-[13px] text-ink-2">{label}</span>}
    </label>
  );
}

/** A fully-styled select dropdown that matches the app's theme exactly.
 *  Uses a button trigger + popover list for full CSS control.
 *  Works with any options array and preserves onChange behavior. */
export function Select({
  value,
  onChange,
  options,
  className = "",
  ...rest
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: Array<{ value: string | number; label: string }>;
  className?: string;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange">) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger button that matches input styling exactly */}
      <button
        onClick={() => setOpen(!open)}
        className={`relative w-full rounded-md border border-line bg-panel px-2.5 py-1 text-[14px] text-ink outline-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 hover:bg-brand-500 cursor-pointer`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select value"
      >
        <div className="flex w-full items-center justify-between px-1">
          <span className="flex-1">
            {selectedOption?.label ?? String(value)}
          </span>
          <ChevronDownIcon className="h-3.5 w-3.5 text-ink-3" />
        </div>
      </button>

      {/* Popover list of options */}
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-line bg-panel shadow-lg max-h-60 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(String(o.value));
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-ink hover:bg-brand-500 hover:text-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 cursor-pointer whitespace-nowrap`}
            >
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Toasts({
  toasts,
  onClose,
}: {
  toasts: Array<{ id: number; text: string; tone: string }>;
  onClose: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2.5 text-[13px] shadow-lg ${
            t.tone === "ok"
              ? "border-ok-300/70 bg-ok-50 text-ok-700"
              : t.tone === "warn"
                ? "border-warn-300/70 bg-warn-50 text-warn-700"
                : "border-bad-300/70 bg-bad-50 text-bad-700"
          }`}
        >
          {t.tone === "ok" ? (
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span className="flex-1">{t.text}</span>
          <button
            onClick={() => onClose(t.id)}
            className="mt-0.5 opacity-50 hover:opacity-100"
            aria-label="Dismiss"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
