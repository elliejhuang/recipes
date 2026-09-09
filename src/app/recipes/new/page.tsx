import Link from "next/link";
import { Link2 } from "lucide-react";
import { RecipeForm } from "@/components/recipe-form";
import { EMPTY_FORM } from "@/lib/empty-recipe";
import { photosEnabled } from "@/lib/supabase";

export default function NewRecipePage() {
  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-2xl font-semibold">New recipe</h1>
        <Link href="/recipes/import" className="flex items-center gap-1.5 text-sm text-accent">
          <Link2 size={14} />
          Import from a link instead
        </Link>
      </div>
      <RecipeForm
        initial={EMPTY_FORM}
        submitLabel="Save recipe"
        uploadsEnabled={photosEnabled()}
      />
    </div>
  );
}
