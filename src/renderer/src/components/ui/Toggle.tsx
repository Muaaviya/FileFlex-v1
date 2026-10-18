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