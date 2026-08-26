import Link from "next/link";
import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { PlanBoard } from "@/components/plan-board";
import { ClearWeekButton } from "@/components/clear-week-button";
import { addDays, formatWeekRange, startOfWeek, todayKey } from "@/lib/dates";
import { sumMacros } from "@/lib/nutrition";
import { getWeekPlan, listRecipes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const weekStart = startOfWeek(params.week ?? todayKey());
  const weekEnd = addDays(weekStart, 6);

  const [entries, recipes] = await Promise.all([
    getWeekPlan(weekStart, weekEnd),
    listRecipes(),
  ]);

  const weekMacros = sumMacros(
    entries.map((entry) => ({
      servings: entry.servings,
      macros: {
        calories: entry.recipe.calories,
        proteinG: entry.recipe.proteinG,
        carbsG: entry.recipe.carbsG,
        fatG: entry.recipe.fatG,
        fiberG: null,
        sugarG: null,
        sodiumMg: null,
      },
    })),
  );

  const dailyAverage =
    weekMacros.calories !== null ? Math.round(weekMacros.calories / 7) : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={`/plan?week=${addDays(weekStart, -7)}`}
            aria-label="Previous week"
            className="btn !p-1.5"
          >
            <ChevronLeft size={15} />
          </Link>
          <Link
            href={`/plan?week=${addDays(weekStart, 7)}`}
            aria-label="Next week"
            className="btn !p-1.5"
          >
            <ChevronRight size={15} />
          </Link>
        </div>

        <div>
          <h1 className="font-serif text-xl font-semibold">
            {formatWeekRange(weekStart)}
          </h1>
          {dailyAverage !== null && (
            <p className="text-xs text-muted tabular-nums">
              {dailyAverage} cal/day average across what&rsquo;s planned
            </p>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {weekStart !== startOfWeek(todayKey()) && (
            <Link href="/plan" className="btn">
              This week
            </Link>
          )}
          <ClearWeekButton weekStart={weekStart} disabled={entries.length === 0} />
          <Link href={`/list?week=${weekStart}`} className="btn btn-primary">
            <ListChecks size={15} />
            Shopping list
          </Link>
        </div>
      </div>

      {recipes.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-serif text-xl">Nothing to plan with yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Add a few recipes first and they&rsquo;ll show up here to drop into
            your week.
          </p>
          <Link href="/recipes/import" className="btn btn-primary mt-5">
            Import a recipe
          </Link>
        </div>
      ) : (
        <PlanBoard weekStart={weekStart} entries={entries} recipes={recipes} />
      )}
    </div>
  );
}
