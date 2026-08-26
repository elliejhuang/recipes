"use client";

import { useTransition } from "react";
import { Eraser } from "lucide-react";
import { clearWeek } from "@/lib/actions";

export function ClearWeekButton({
  weekStart,
  disabled,
}: {
  weekStart: string;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={disabled || pending}
      onClick={() => {
        if (confirm("Clear everything planned this week?")) {
          startTransition(() => void clearWeek(weekStart));
        }
      }}
      className="btn"
    >
      <Eraser size={14} />
      Clear
    </button>
  );
}
