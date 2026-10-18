import { CheckIcon } from "../icons";

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