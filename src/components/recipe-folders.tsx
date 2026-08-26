"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRecipeFolders } from "@/lib/actions";
import type { FolderWithCount } from "@/lib/queries";
import { FolderPicker } from "./folder-bar";

/** The folder chooser, up at the top of the recipe where the tags used to be. */
export function RecipeFolders({
  recipeId,
  folders,
  initial,
}: {
  recipeId: number;
  folders: FolderWithCount[];
  initial: number[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(initial);
  const [, startTransition] = useTransition();

  if (folders.length === 0) return null;

  return (
    <FolderPicker
      recipeId={recipeId}
      folders={folders}
      selected={selected}
      onChange={(next) => {
        setSelected(next);
        startTransition(async () => {
          await setRecipeFolders(recipeId, next);
          router.refresh();
        });
      }}
    />
  );
}
