import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import type { ButtonVariant } from "./Button";

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