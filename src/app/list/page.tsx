import { GroceryLists } from "@/components/grocery-lists";
import { ensureAutoList, getGroceryLists } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ListPage() {
  // A fresh database has no lists at all, and the auto one is meant to always
  // be there.
  await ensureAutoList();
  const lists = await getGroceryLists();

  return <GroceryLists lists={lists} />;
}
