import { AlertIcon, CheckIcon, XIcon } from "../icons";

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