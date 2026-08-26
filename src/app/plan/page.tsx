import Link from "next/link";
import { RecipeCard } from "@/components/recipe-card";
import { ClearPlanButton } from "@/components/clear-plan-button";
import { getPlan } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const plan = await getPlan();

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-xl font-semibold">To Make</h1>
        {plan.length > 0 && (
          <div className="flex items-center gap-2">
            <ClearPlanButton />
            <Link href="/list" className="btn btn-primary">
              Groceries
            </Link>
          </div>
        )}
      </div>

      {plan.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-serif text-xl">Nothing on the list yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Open a recipe and hit <span className="text-ink">Want to make</span>.
            Everything here becomes your grocery list automatically.
          </p>
          <Link href="/" className="btn btn-primary mt-5">
            Browse recipes
          </Link>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {plan.map((entry) => (
            <RecipeCard key={entry.id} recipe={entry.recipe} />
          ))}
        </div>
      )}
    </div>
  );
}
