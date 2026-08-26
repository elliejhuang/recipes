/**
 * A compact nutrition reference for estimating a recipe's macros when the
 * source didn't publish any.
 *
 * Values are per 100g and rounded from USDA FoodData Central standard
 * reference entries. They are approximations by design — a recipe estimate is
 * useful at "roughly 520 calories a serving", not at three significant
 * figures, and the UI always labels estimated numbers as such.
 *
 * `gramsPerCup` lets a volume measurement become a weight. `gramsPerUnit`
 * covers the countable cases ("3 cloves garlic", "2 eggs").
 */
export type FoodEntry = {
  keywords: string[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number; // mg per 100g
  gramsPerCup?: number;
  gramsPerUnit?: Record<string, number>;
};

export const FOODS: FoodEntry[] = [
  // ---- Fats & oils -------------------------------------------------------
  { keywords: ["olive oil"], kcal: 884, protein: 0, carbs: 0, fat: 100, gramsPerCup: 216 },
  { keywords: ["vegetable oil", "canola oil", "sunflower oil", "grapeseed oil", "avocado oil", "peanut oil"], kcal: 884, protein: 0, carbs: 0, fat: 100, gramsPerCup: 218 },
  { keywords: ["coconut oil"], kcal: 892, protein: 0, carbs: 0, fat: 99, gramsPerCup: 218 },
  { keywords: ["sesame oil"], kcal: 884, protein: 0, carbs: 0, fat: 100, gramsPerCup: 218 },
  { keywords: ["butter"], kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, sodium: 11, gramsPerCup: 227, gramsPerUnit: { stick: 113, tbsp: 14 } },
  { keywords: ["ghee"], kcal: 900, protein: 0, carbs: 0, fat: 100, gramsPerCup: 205 },
  { keywords: ["mayonnaise", "mayo"], kcal: 680, protein: 1, carbs: 0.6, fat: 75, sodium: 635, gramsPerCup: 220 },

  // ---- Flours, grains, starches -----------------------------------------
  { keywords: ["all-purpose flour", "all purpose flour", "plain flour", "flour"], kcal: 364, protein: 10.3, carbs: 76, fat: 1, fiber: 2.7, gramsPerCup: 125 },
  { keywords: ["bread flour"], kcal: 361, protein: 12, carbs: 73, fat: 1.7, fiber: 2.4, gramsPerCup: 127 },
  { keywords: ["whole wheat flour"], kcal: 340, protein: 13.2, carbs: 72, fat: 2.5, fiber: 10.7, gramsPerCup: 120 },
  { keywords: ["almond flour"], kcal: 590, protein: 21, carbs: 21, fat: 50, fiber: 11, gramsPerCup: 96 },
  { keywords: ["cornstarch", "corn starch", "cornflour"], kcal: 381, protein: 0.3, carbs: 91, fat: 0.1, gramsPerCup: 128 },
  { keywords: ["cornmeal", "polenta"], kcal: 370, protein: 8.1, carbs: 79, fat: 1.8, fiber: 7.3, gramsPerCup: 157 },
  { keywords: ["breadcrumb", "panko"], kcal: 395, protein: 13, carbs: 72, fat: 5.3, fiber: 4.5, sodium: 732, gramsPerCup: 108 },
  { keywords: ["rolled oat", "oats", "oatmeal"], kcal: 389, protein: 16.9, carbs: 66, fat: 6.9, fiber: 10.6, gramsPerCup: 81 },
  { keywords: ["white rice", "jasmine rice", "basmati rice", "rice"], kcal: 365, protein: 7.1, carbs: 80, fat: 0.7, fiber: 1.3, gramsPerCup: 185 },
  { keywords: ["brown rice"], kcal: 370, protein: 7.9, carbs: 77, fat: 2.9, fiber: 3.5, gramsPerCup: 190 },
  { keywords: ["quinoa"], kcal: 368, protein: 14.1, carbs: 64, fat: 6.1, fiber: 7, gramsPerCup: 170 },
  { keywords: ["couscous"], kcal: 376, protein: 12.8, carbs: 77, fat: 0.6, fiber: 5, gramsPerCup: 173 },
  { keywords: ["farro", "barley", "bulgur"], kcal: 352, protein: 12, carbs: 72, fat: 2.2, fiber: 10, gramsPerCup: 180 },
  { keywords: ["pasta", "spaghetti", "penne", "macaroni", "linguine", "fettuccine", "rigatoni", "orzo", "noodle"], kcal: 371, protein: 13, carbs: 75, fat: 1.5, fiber: 3.2, gramsPerCup: 105 },
  { keywords: ["bread", "sourdough", "baguette"], kcal: 265, protein: 9, carbs: 49, fat: 3.2, fiber: 2.7, sodium: 491, gramsPerUnit: { slice: 30, piece: 30 } },
  { keywords: ["tortilla"], kcal: 306, protein: 8, carbs: 51, fat: 7.7, fiber: 3, sodium: 630, gramsPerUnit: { piece: 45 } },

  // ---- Sugars & sweeteners ----------------------------------------------
  { keywords: ["granulated sugar", "white sugar", "caster sugar", "sugar"], kcal: 387, protein: 0, carbs: 100, fat: 0, sugar: 100, gramsPerCup: 200 },
  { keywords: ["brown sugar"], kcal: 380, protein: 0, carbs: 98, fat: 0, sugar: 97, gramsPerCup: 220 },
  { keywords: ["powdered sugar", "confectioners sugar", "icing sugar"], kcal: 389, protein: 0, carbs: 100, fat: 0, sugar: 98, gramsPerCup: 120 },
  { keywords: ["honey"], kcal: 304, protein: 0.3, carbs: 82, fat: 0, sugar: 82, gramsPerCup: 340 },
  { keywords: ["maple syrup"], kcal: 260, protein: 0, carbs: 67, fat: 0.1, sugar: 60, gramsPerCup: 322 },
  { keywords: ["molasses"], kcal: 290, protein: 0, carbs: 75, fat: 0.1, sugar: 55, gramsPerCup: 337 },

  // ---- Dairy & eggs ------------------------------------------------------
  { keywords: ["whole milk", "milk"], kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, sugar: 5.1, sodium: 43, gramsPerCup: 244 },
  { keywords: ["heavy cream", "whipping cream", "double cream"], kcal: 340, protein: 2.8, carbs: 2.8, fat: 36, sodium: 27, gramsPerCup: 238 },
  { keywords: ["half and half", "half-and-half"], kcal: 130, protein: 3, carbs: 4.3, fat: 11.5, gramsPerCup: 242 },
  { keywords: ["buttermilk"], kcal: 40, protein: 3.3, carbs: 4.8, fat: 0.9, sodium: 105, gramsPerCup: 245 },
  { keywords: ["sour cream", "creme fraiche", "crème fraîche"], kcal: 198, protein: 2.4, carbs: 4.6, fat: 19.4, sodium: 41, gramsPerCup: 230 },
  { keywords: ["greek yogurt"], kcal: 59, protein: 10, carbs: 3.6, fat: 0.4, sugar: 3.2, sodium: 36, gramsPerCup: 245 },
  { keywords: ["yogurt", "yoghurt"], kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3, sugar: 4.7, sodium: 46, gramsPerCup: 245 },
  { keywords: ["coconut milk"], kcal: 230, protein: 2.3, carbs: 5.5, fat: 24, gramsPerCup: 240 },
  { keywords: ["parmesan", "parmigiano", "pecorino"], kcal: 431, protein: 38, carbs: 4.1, fat: 29, sodium: 1529, gramsPerCup: 100 },
  { keywords: ["cheddar"], kcal: 403, protein: 25, carbs: 1.3, fat: 33, sodium: 621, gramsPerCup: 113 },
  { keywords: ["mozzarella"], kcal: 300, protein: 22, carbs: 2.2, fat: 22, sodium: 627, gramsPerCup: 112 },
  { keywords: ["cream cheese"], kcal: 342, protein: 6, carbs: 4.1, fat: 34, sodium: 321, gramsPerCup: 232 },
  { keywords: ["ricotta"], kcal: 174, protein: 11, carbs: 3, fat: 13, sodium: 84, gramsPerCup: 246 },
  { keywords: ["feta"], kcal: 264, protein: 14, carbs: 4.1, fat: 21, sodium: 917, gramsPerCup: 150 },
  { keywords: ["goat cheese"], kcal: 364, protein: 22, carbs: 2.5, fat: 30, sodium: 515, gramsPerCup: 135 },
  { keywords: ["gruyere", "gruyère", "swiss", "provolone", "gouda", "cheese"], kcal: 380, protein: 27, carbs: 2, fat: 29, sodium: 700, gramsPerCup: 110 },
  { keywords: ["egg white"], kcal: 52, protein: 11, carbs: 0.7, fat: 0.2, sodium: 166, gramsPerUnit: { piece: 33 } },
  { keywords: ["egg yolk"], kcal: 322, protein: 16, carbs: 3.6, fat: 27, sodium: 48, gramsPerUnit: { piece: 17 } },
  { keywords: ["egg"], kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, sodium: 142, gramsPerUnit: { piece: 50 } },

  // ---- Meat & seafood ----------------------------------------------------
  { keywords: ["chicken breast"], kcal: 165, protein: 31, carbs: 0, fat: 3.6, sodium: 74, gramsPerUnit: { piece: 174, breast: 174 } },
  { keywords: ["chicken thigh"], kcal: 209, protein: 26, carbs: 0, fat: 11, sodium: 86, gramsPerUnit: { piece: 90, thigh: 90 } },
  { keywords: ["chicken"], kcal: 190, protein: 28, carbs: 0, fat: 8, sodium: 80 },
  { keywords: ["ground beef", "beef mince"], kcal: 254, protein: 26, carbs: 0, fat: 16, sodium: 75 },
  { keywords: ["steak", "sirloin", "ribeye", "beef"], kcal: 250, protein: 26, carbs: 0, fat: 15, sodium: 60 },
  { keywords: ["ground turkey"], kcal: 189, protein: 27, carbs: 0, fat: 8.3, sodium: 78 },
  { keywords: ["turkey"], kcal: 189, protein: 29, carbs: 0, fat: 7, sodium: 90 },
  { keywords: ["pork shoulder", "pork butt"], kcal: 269, protein: 24, carbs: 0, fat: 19, sodium: 65 },
  { keywords: ["pork tenderloin", "pork chop", "pork"], kcal: 197, protein: 26, carbs: 0, fat: 10, sodium: 55 },
  { keywords: ["bacon"], kcal: 541, protein: 37, carbs: 1.4, fat: 42, sodium: 1717, gramsPerUnit: { slice: 28, piece: 28 } },
  { keywords: ["pancetta", "prosciutto"], kcal: 400, protein: 28, carbs: 0.5, fat: 32, sodium: 2000 },
  { keywords: ["sausage", "chorizo"], kcal: 340, protein: 19, carbs: 2, fat: 28, sodium: 1000, gramsPerUnit: { piece: 75 } },
  { keywords: ["lamb"], kcal: 282, protein: 25, carbs: 0, fat: 20, sodium: 72 },
  { keywords: ["salmon"], kcal: 208, protein: 20, carbs: 0, fat: 13, sodium: 59, gramsPerUnit: { fillet: 170, piece: 170 } },
  { keywords: ["shrimp", "prawn"], kcal: 99, protein: 24, carbs: 0.2, fat: 0.3, sodium: 111 },
  { keywords: ["tuna"], kcal: 132, protein: 28, carbs: 0, fat: 1.3, sodium: 47 },
  { keywords: ["cod", "halibut", "tilapia", "snapper", "sea bass", "white fish", "fish"], kcal: 105, protein: 22, carbs: 0, fat: 1.5, sodium: 70, gramsPerUnit: { fillet: 150, piece: 150 } },
  { keywords: ["scallop"], kcal: 88, protein: 17, carbs: 2.4, fat: 0.8, sodium: 392 },
  { keywords: ["anchovy"], kcal: 210, protein: 29, carbs: 0, fat: 10, sodium: 3670, gramsPerUnit: { fillet: 4, piece: 4 } },

  // ---- Plant proteins ----------------------------------------------------
  { keywords: ["tofu"], kcal: 76, protein: 8, carbs: 1.9, fat: 4.8, sodium: 7, gramsPerCup: 252 },
  { keywords: ["tempeh"], kcal: 192, protein: 20, carbs: 7.6, fat: 11, sodium: 9 },
  { keywords: ["chickpea", "garbanzo"], kcal: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6, sodium: 240, gramsPerCup: 164, gramsPerUnit: { can: 240 } },
  { keywords: ["black bean", "kidney bean", "pinto bean", "cannellini", "white bean", "bean"], kcal: 132, protein: 8.9, carbs: 24, fat: 0.5, fiber: 8.7, sodium: 238, gramsPerCup: 172, gramsPerUnit: { can: 240 } },
  { keywords: ["lentil"], kcal: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, sodium: 2, gramsPerCup: 198 },

  // ---- Vegetables --------------------------------------------------------
  { keywords: ["onion", "shallot"], kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, sugar: 4.2, sodium: 4, gramsPerCup: 160, gramsPerUnit: { piece: 110 } },
  { keywords: ["scallion", "green onion", "spring onion"], kcal: 32, protein: 1.8, carbs: 7.3, fat: 0.2, fiber: 2.6, gramsPerCup: 100, gramsPerUnit: { piece: 15, stalk: 15 } },
  { keywords: ["garlic"], kcal: 149, protein: 6.4, carbs: 33, fat: 0.5, fiber: 2.1, sodium: 17, gramsPerCup: 136, gramsPerUnit: { clove: 3, head: 40 } },
  { keywords: ["leek"], kcal: 61, protein: 1.5, carbs: 14, fat: 0.3, fiber: 1.8, gramsPerCup: 89, gramsPerUnit: { piece: 89 } },
  { keywords: ["carrot"], kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8, sugar: 4.7, sodium: 69, gramsPerCup: 128, gramsPerUnit: { piece: 61 } },
  { keywords: ["celery"], kcal: 16, protein: 0.7, carbs: 3, fat: 0.2, fiber: 1.6, sodium: 80, gramsPerCup: 101, gramsPerUnit: { stalk: 40, piece: 40 } },
  { keywords: ["potato"], kcal: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2, sodium: 6, gramsPerCup: 150, gramsPerUnit: { piece: 173 } },
  { keywords: ["sweet potato"], kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, sugar: 4.2, sodium: 55, gramsPerCup: 133, gramsPerUnit: { piece: 130 } },
  { keywords: ["tomato paste"], kcal: 82, protein: 4.3, carbs: 19, fat: 0.5, fiber: 4.1, sodium: 59, gramsPerCup: 262 },
  { keywords: ["tomato sauce", "passata", "crushed tomato", "diced tomato", "canned tomato"], kcal: 32, protein: 1.3, carbs: 7, fat: 0.3, fiber: 1.5, sodium: 380, gramsPerCup: 245, gramsPerUnit: { can: 411 } },
  { keywords: ["cherry tomato", "tomato"], kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6, sodium: 5, gramsPerCup: 180, gramsPerUnit: { piece: 123 } },
  { keywords: ["bell pepper", "red pepper", "green pepper", "capsicum"], kcal: 26, protein: 1, carbs: 6, fat: 0.3, fiber: 2.1, sodium: 4, gramsPerCup: 149, gramsPerUnit: { piece: 119 } },
  { keywords: ["jalapeno", "jalapeño", "serrano", "chili pepper", "chile"], kcal: 29, protein: 0.9, carbs: 6.5, fat: 0.4, fiber: 2.8, gramsPerUnit: { piece: 14 } },
  { keywords: ["mushroom"], kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fiber: 1, sodium: 5, gramsPerCup: 70, gramsPerUnit: { piece: 18 } },
  { keywords: ["zucchini", "courgette", "summer squash"], kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1, sodium: 8, gramsPerCup: 124, gramsPerUnit: { piece: 196 } },
  { keywords: ["butternut squash", "squash", "pumpkin"], kcal: 45, protein: 1, carbs: 12, fat: 0.1, fiber: 2, gramsPerCup: 140 },
  { keywords: ["eggplant", "aubergine"], kcal: 25, protein: 1, carbs: 6, fat: 0.2, fiber: 3, gramsPerCup: 82, gramsPerUnit: { piece: 458 } },
  { keywords: ["broccoli"], kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6, sodium: 33, gramsPerCup: 91, gramsPerUnit: { head: 550 } },
  { keywords: ["cauliflower"], kcal: 25, protein: 1.9, carbs: 5, fat: 0.3, fiber: 2, sodium: 30, gramsPerCup: 107, gramsPerUnit: { head: 588 } },
  { keywords: ["spinach"], kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, sodium: 79, gramsPerCup: 30 },
  { keywords: ["kale", "chard", "arugula", "lettuce", "romaine", "salad green", "mixed green"], kcal: 25, protein: 2.2, carbs: 4.4, fat: 0.4, fiber: 2, sodium: 30, gramsPerCup: 30 },
  { keywords: ["cabbage"], kcal: 25, protein: 1.3, carbs: 5.8, fat: 0.1, fiber: 2.5, sodium: 18, gramsPerCup: 89, gramsPerUnit: { head: 900 } },
  { keywords: ["brussels sprout"], kcal: 43, protein: 3.4, carbs: 9, fat: 0.3, fiber: 3.8, sodium: 25, gramsPerCup: 88 },
  { keywords: ["green bean"], kcal: 31, protein: 1.8, carbs: 7, fat: 0.2, fiber: 3.4, sodium: 6, gramsPerCup: 100 },
  { keywords: ["pea"], kcal: 81, protein: 5.4, carbs: 14, fat: 0.4, fiber: 5.1, sodium: 5, gramsPerCup: 145 },
  { keywords: ["corn"], kcal: 86, protein: 3.3, carbs: 19, fat: 1.4, fiber: 2, sugar: 3.2, sodium: 15, gramsPerCup: 154, gramsPerUnit: { ear: 90 } },
  { keywords: ["cucumber"], kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, gramsPerCup: 119, gramsPerUnit: { piece: 301 } },
  { keywords: ["asparagus"], kcal: 20, protein: 2.2, carbs: 3.9, fat: 0.1, fiber: 2.1, gramsPerCup: 134, gramsPerUnit: { bunch: 450 } },
  { keywords: ["ginger"], kcal: 80, protein: 1.8, carbs: 18, fat: 0.8, fiber: 2, gramsPerCup: 96, gramsPerUnit: { piece: 30 } },
  { keywords: ["avocado"], kcal: 160, protein: 2, carbs: 8.5, fat: 15, fiber: 6.7, sodium: 7, gramsPerCup: 146, gramsPerUnit: { piece: 150 } },
  { keywords: ["olive"], kcal: 115, protein: 0.8, carbs: 6, fat: 11, fiber: 3.2, sodium: 735, gramsPerCup: 135 },
  { keywords: ["parsley", "cilantro", "basil", "mint", "dill", "chive", "tarragon", "herb"], kcal: 36, protein: 3, carbs: 6.3, fat: 0.8, fiber: 3.3, sodium: 56, gramsPerCup: 24, gramsPerUnit: { bunch: 60, sprig: 2, leaf: 0.5 } },

  // ---- Fruit -------------------------------------------------------------
  { keywords: ["lemon juice", "lime juice"], kcal: 22, protein: 0.4, carbs: 6.9, fat: 0.2, sugar: 2.5, gramsPerCup: 244 },
  { keywords: ["lemon", "lime"], kcal: 29, protein: 1.1, carbs: 9.3, fat: 0.3, fiber: 2.8, gramsPerUnit: { piece: 84 } },
  { keywords: ["orange"], kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, sugar: 9.4, gramsPerUnit: { piece: 131 } },
  { keywords: ["apple"], kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10, gramsPerCup: 125, gramsPerUnit: { piece: 182 } },
  { keywords: ["banana"], kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sugar: 12, gramsPerCup: 150, gramsPerUnit: { piece: 118 } },
  { keywords: ["strawberr", "raspberr", "blueberr", "blackberr", "berry", "berries"], kcal: 50, protein: 0.9, carbs: 12, fat: 0.4, fiber: 3.5, sugar: 7, gramsPerCup: 145 },
  { keywords: ["raisin", "date", "dried fruit"], kcal: 299, protein: 3.1, carbs: 79, fat: 0.5, fiber: 3.7, sugar: 59, gramsPerCup: 145 },

  // ---- Nuts, seeds, spreads ---------------------------------------------
  { keywords: ["almond"], kcal: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5, gramsPerCup: 143 },
  { keywords: ["walnut", "pecan"], kcal: 691, protein: 15, carbs: 14, fat: 68, fiber: 7, gramsPerCup: 117 },
  { keywords: ["cashew"], kcal: 553, protein: 18, carbs: 30, fat: 44, fiber: 3.3, gramsPerCup: 137 },
  { keywords: ["peanut butter", "almond butter"], kcal: 588, protein: 25, carbs: 20, fat: 50, fiber: 6, sodium: 429, gramsPerCup: 258 },
  { keywords: ["tahini"], kcal: 595, protein: 17, carbs: 21, fat: 54, fiber: 9.3, gramsPerCup: 240 },
  { keywords: ["pine nut", "pistachio", "hazelnut", "nut"], kcal: 620, protein: 15, carbs: 17, fat: 58, fiber: 5, gramsPerCup: 135 },
  { keywords: ["sesame seed", "sunflower seed", "pumpkin seed", "chia", "flax"], kcal: 570, protein: 20, carbs: 22, fat: 48, fiber: 12, gramsPerCup: 144 },

  // ---- Condiments, sauces, liquids --------------------------------------
  { keywords: ["soy sauce", "tamari"], kcal: 53, protein: 8, carbs: 4.9, fat: 0.6, sodium: 5493, gramsPerCup: 255 },
  { keywords: ["fish sauce"], kcal: 35, protein: 5, carbs: 3.6, fat: 0, sodium: 7851, gramsPerCup: 270 },
  { keywords: ["vinegar"], kcal: 21, protein: 0, carbs: 0.9, fat: 0, gramsPerCup: 239 },
  { keywords: ["dijon", "mustard"], kcal: 66, protein: 4.4, carbs: 5.8, fat: 3.3, sodium: 1135, gramsPerCup: 249 },
  { keywords: ["ketchup"], kcal: 101, protein: 1.3, carbs: 26, fat: 0.1, sugar: 21, sodium: 907, gramsPerCup: 272 },
  { keywords: ["sriracha", "hot sauce", "chili sauce"], kcal: 93, protein: 1.9, carbs: 19, fat: 0.9, sodium: 2124, gramsPerCup: 240 },
  { keywords: ["miso"], kcal: 199, protein: 12, carbs: 26, fat: 6, sodium: 3728, gramsPerCup: 275 },
  { keywords: ["chicken broth", "chicken stock", "vegetable broth", "beef broth", "broth", "stock"], kcal: 6, protein: 0.9, carbs: 0.4, fat: 0.2, sodium: 143, gramsPerCup: 240 },
  { keywords: ["white wine", "red wine", "wine"], kcal: 83, protein: 0.1, carbs: 2.6, fat: 0, gramsPerCup: 235 },
  { keywords: ["water"], kcal: 0, protein: 0, carbs: 0, fat: 0, gramsPerCup: 237 },

  // ---- Baking & chocolate ------------------------------------------------
  { keywords: ["cocoa powder"], kcal: 228, protein: 20, carbs: 58, fat: 14, fiber: 33, gramsPerCup: 86 },
  { keywords: ["chocolate chip", "dark chocolate", "chocolate"], kcal: 546, protein: 4.9, carbs: 61, fat: 31, fiber: 7, sugar: 48, gramsPerCup: 170 },
  { keywords: ["baking powder"], kcal: 53, protein: 0, carbs: 28, fat: 0, sodium: 10600, gramsPerCup: 220 },
  { keywords: ["baking soda"], kcal: 0, protein: 0, carbs: 0, fat: 0, sodium: 27360, gramsPerCup: 220 },
  { keywords: ["vanilla extract"], kcal: 288, protein: 0.1, carbs: 13, fat: 0.1, sugar: 13, gramsPerCup: 208 },
  { keywords: ["yeast"], kcal: 325, protein: 40, carbs: 41, fat: 7.6, gramsPerCup: 136 },

  // ---- Seasoning ---------------------------------------------------------
  { keywords: ["salt"], kcal: 0, protein: 0, carbs: 0, fat: 0, sodium: 38758, gramsPerCup: 273 },
  { keywords: ["black pepper", "pepper", "cumin", "paprika", "cinnamon", "oregano", "thyme", "rosemary", "coriander", "turmeric", "curry powder", "chili powder", "spice", "seasoning"], kcal: 255, protein: 11, carbs: 64, fat: 3.3, fiber: 25, sodium: 44, gramsPerCup: 100 },
];

/** Finds the best entry for a name — longest keyword match wins. */
export function lookupFood(name: string): FoodEntry | null {
  const n = name.toLowerCase();
  let best: { entry: FoodEntry; length: number } | null = null;
  for (const entry of FOODS) {
    for (const kw of entry.keywords) {
      if (n.includes(kw) && (!best || kw.length > best.length)) {
        best = { entry, length: kw.length };
      }
    }
  }
  return best?.entry ?? null;
}
