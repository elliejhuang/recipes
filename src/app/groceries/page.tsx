import { GroceryLists } from "@/components/grocery-lists";
import { ensureAutoList, getGroceryLists } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function GroceriesPage() {
  // A fresh database has no lists at all, and the auto one is always there.
  await ensureAutoList();
  const lists = await getGroceryLists();

  return <GroceryLists lists={lists} />;
}
