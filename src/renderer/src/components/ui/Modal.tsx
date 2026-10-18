import { useEffect } from "react";
import type { ReactNode } from "react";
import { XIcon } from "../icons";
import { Button } from "./Button";

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