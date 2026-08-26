"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Check, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { addToPlan } from "@/lib/actions";
import { MEALS, addDays, formatDayLabel, todayKey } from "@/lib/dates";

export function AddToPlan({ recipeId }: { recipeId: number }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayKey());
  const [meal, setMeal] = useState<string>("dinner");
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  // Two weeks out covers the way people actually plan; anything further and
  // you'd want the plan page's own week navigation.
  const days = Array.from({ length: 14 }, (_, i) => addDays(todayKey(), i));

  const submit = () =>
    startTransition(async () => {
      await addToPlan({ recipeId, date, meal });
      setAdded(true);
      setTimeout(() => {
        setAdded(false);
        setOpen(false);
      }, 1200);
    });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn">
        <CalendarPlus size={15} />
        Add to plan
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-rule bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="field !w-auto !py-1.5 !text-sm"
        >
          {days.map((day) => {
            const { weekday, date: label } = formatDayLabel(day);
            return (
              <option key={day} value={day}>
                {day === todayKey() ? "Today" : `${weekday} ${label}`}
              </option>
            );
          })}
        </select>

        <div className="flex rounded-lg border border-rule p-0.5">
          {MEALS.map((option) => (
            <button
              key={option}
              onClick={() => setMeal(option)}
              className={clsx(
                "rounded-md px-2 py-1 text-xs capitalize",
                meal === option ? "bg-accent-soft text-accent" : "text-muted",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <button
          onClick={submit}
          disabled={pending || added}
          className="btn btn-primary !py-1.5 !text-sm"
        >
          {pending && <Loader2 size={13} className="animate-spin" />}
          {added && <Check size={13} />}
          {added ? "Added" : "Add"}
        </button>

        <button
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
