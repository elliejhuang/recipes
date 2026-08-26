import type { FormValues } from "@/components/recipe-form";

export const EMPTY_FORM: FormValues = {
  title: "",
  description: "",
  imageUrl: "",
  sourceUrl: "",
  sourceName: "",
  servings: 4,
  prepMinutes: null,
  cookMinutes: null,
  tags: [],
  notes: "",
  ingredientText: "",
  stepText: "",
  nutrition: null,
  nutritionSource: null,
};
