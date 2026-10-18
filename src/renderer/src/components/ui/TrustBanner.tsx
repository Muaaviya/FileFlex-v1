import type { ReactNode } from "react";
import { ShieldIcon } from "../icons";

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