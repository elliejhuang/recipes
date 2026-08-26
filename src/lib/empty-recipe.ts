import type { FormValues } from "@/components/recipe-form";

export const EMPTY_FORM: FormValues = {
  title: "",
  imageUrl: "",
  sourceUrl: "",
  sourceName: "",
  servings: 4,
  prepMinutes: null,
  cookMinutes: null,
  tags: [],
  method: "",
  notes: "",
  ingredientText: "",
  nutrition: null,
  nutritionSource: null,
};
