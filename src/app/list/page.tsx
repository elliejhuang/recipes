import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { GroceryList } from "@/components/grocery-list";
import { PrintButton } from "@/components/favorite-button";
import { addDays, formatWeekRange, startOfWeek, todayKey } from "@/lib/dates";
import { getGroceryList, getWeekPlan } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const weekStart = startOfWeek(params.week ?? todayKey());
  const weekEnd = addDays(weekStart, 6);

  const [items, planned] = await Promise.all([
    getGroceryList(weekStart),
    getWeekPlan(weekStart, weekEnd),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="no-print flex items-center gap-1">
          <Link
            href={`/list?week=${addDays(weekStart, -7)}`}
            aria-label="Previous week"
            className="btn !p-1.5"
          >
            <ChevronLeft size={15} />
          </Link>
          <Link
            href={`/list?week=${addDays(weekStart, 7)}`}
            aria-label="Next week"
            className="btn !p-1.5"
          >
            <ChevronRight size={15} />
          </Link>
        </div>

        <div>
          <h1 className="font-serif text-xl font-semibold">Shopping list</h1>
          <p className="text-xs text-muted">
            {formatWeekRange(weekStart)} · {planned.length}{" "}
            {planned.length === 1 ? "meal" : "meals"} planned
          </p>
        </div>

        <div className="no-print ml-auto flex gap-2">
          <Link href={`/plan?week=${weekStart}`} className="btn">
            <CalendarDays size={14} />
            Plan
          </Link>
          <PrintButton />
        </div>
      </div>

      <GroceryList
        weekStart={weekStart}
        items={items}
        plannedCount={planned.length}
      />
    </div>
  );
}
