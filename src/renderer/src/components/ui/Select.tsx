import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDownIcon } from "../icons";

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