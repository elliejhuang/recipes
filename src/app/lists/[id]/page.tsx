import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RecipeGrid } from "@/components/recipe-card";
import { ListHeader } from "@/components/list-albums";
import { getList, listRecipes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listId = Number(id);
  const [list, recipes] = await Promise.all([
    getList(listId),
    listRecipes({ listId }),
  ]);
  if (!list) notFound();

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/lists"
          aria-label="All lists"
          className="-m-2 p-2 text-muted hover:text-ink"
        >
          <ArrowLeft size={16} />
        </Link>
        <ListHeader list={list} />
      </div>

      {recipes.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-serif text-xl">Nothing on this list yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Open a recipe and use <span className="text-ink">Add to list</span>.
          </p>
          <Link href="/" className="btn btn-primary mt-5">
            Browse recipes
          </Link>
        </div>
      ) : (
        <RecipeGrid recipes={recipes} showActions />
      )}
    </div>
  );
}
