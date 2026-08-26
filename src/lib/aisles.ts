/**
 * Groups a shopping list the way a store is laid out, so you walk the
 * perimeter once instead of criss-crossing it.
 */
export const AISLES = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Pantry",
  "Spices",
  "Frozen",
  "Beverages",
  "Other",
] as const;

export type Aisle = (typeof AISLES)[number];

const RULES: [Aisle, string[]][] = [
  ["Produce", [
    "lettuce", "spinach", "kale", "arugula", "romaine", "cabbage", "chard",
    "tomato", "onion", "shallot", "scallion", "green onion", "leek", "garlic",
    "carrot", "celery", "potato", "sweet potato", "yam", "cucumber",
    "bell pepper", "red pepper", "green pepper", "poblano", "capsicum",
    "jalapeno", "jalapeño", "serrano", "habanero", "zucchini", "squash", "eggplant",
    "broccoli", "cauliflower", "asparagus", "green bean", "pea", "corn",
    "mushroom", "avocado", "apple", "banana", "orange", "lemon", "lime",
    "grapefruit", "berry", "berries", "strawberr", "blueberr", "raspberr",
    "blackberr", "grape", "melon", "pineapple", "mango", "peach", "pear",
    "plum", "cherry", "cherries", "kiwi", "pomegranate", "fig", "date",
    "parsley", "cilantro", "basil", "mint", "dill", "rosemary", "thyme",
    "sage", "tarragon", "chive", "ginger", "turmeric root", "beet", "radish",
    "turnip", "parsnip", "brussels sprout", "bok choy", "fennel", "artichoke",
    "sprout", "herb", "salad", "slaw",
  ]],
  ["Meat & Seafood", [
    "chicken", "beef", "steak", "ground beef", "pork", "bacon", "sausage",
    "ham", "turkey", "lamb", "veal", "duck", "prosciutto", "pancetta",
    "chorizo", "salami", "pepperoni", "brisket", "ribs", "tenderloin",
    "shrimp", "prawn", "salmon", "tuna", "cod", "halibut", "tilapia",
    "trout", "bass", "snapper", "mahi", "scallop", "crab", "lobster",
    "clam", "mussel", "oyster", "squid", "calamari", "anchovy", "sardine",
    "fish", "meat", "cutlet", "thigh", "breast", "drumstick", "wing",
  ]],
  ["Dairy & Eggs", [
    "milk", "cream", "half and half", "half-and-half", "butter", "buttermilk",
    "yogurt", "yoghurt", "sour cream", "creme fraiche", "crème fraîche",
    "cheese", "cheddar", "mozzarella", "parmesan", "parmigiano", "pecorino",
    "gruyere", "gruyère", "feta", "goat cheese", "ricotta", "mascarpone",
    "cream cheese", "cottage cheese", "brie", "swiss", "provolone", "gouda",
    "egg", "ghee",
  ]],
  ["Bakery", [
    "bread", "baguette", "roll", "bun", "tortilla", "pita", "naan",
    "croissant", "bagel", "english muffin", "brioche", "sourdough",
    "breadcrumb", "panko", "crouton", "pie crust", "puff pastry", "phyllo",
  ]],
  ["Spices", [
    "salt", "pepper", "peppercorn", "cumin", "coriander", "paprika",
    "cayenne", "chili powder", "chile powder", "curry powder", "garam masala",
    "cinnamon", "nutmeg", "clove", "allspice", "cardamom", "ginger powder",
    "turmeric", "oregano", "italian seasoning", "bay leaf", "bay leaves",
    "fennel seed", "mustard seed", "sesame seed", "poppy seed", "za'atar",
    "sumac", "saffron", "vanilla extract", "almond extract", "seasoning",
    "red pepper flake", "old bay", "herbes de provence", "onion powder",
    "garlic powder", "smoked paprika", "dried",
  ]],
  ["Frozen", [
    "frozen", "ice cream", "puff pastry sheet", "ice",
  ]],
  ["Beverages", [
    "wine", "beer", "vodka", "rum", "whiskey", "bourbon", "tequila", "gin",
    "sherry", "vermouth", "juice", "soda", "seltzer", "sparkling water",
    "coffee", "espresso", "tea", "kombucha", "cider",
  ]],
  ["Pantry", [
    "flour", "sugar", "brown sugar", "powdered sugar", "confectioner",
    "baking powder", "baking soda", "yeast", "cornstarch", "cornmeal",
    "oat", "rice", "quinoa", "farro", "barley", "couscous", "bulgur",
    "pasta", "spaghetti", "penne", "noodle", "macaroni", "lasagna",
    "bean", "lentil", "chickpea", "garbanzo", "hummus",
    "oil", "olive oil", "vinegar", "soy sauce", "fish sauce", "worcestershire",
    "hot sauce", "sriracha", "ketchup", "mustard", "mayonnaise", "mayo",
    "honey", "maple syrup", "molasses", "agave", "jam", "jelly", "preserve",
    "peanut butter", "almond butter", "tahini", "nutella",
    "broth", "stock", "bouillon", "coconut milk", "coconut cream",
    "canned", "can of", "tomato paste", "tomato sauce", "passata", "salsa",
    "chocolate", "cocoa", "chip", "nut", "almond", "walnut", "pecan",
    "cashew", "pistachio", "peanut", "hazelnut", "pine nut", "raisin",
    "cracker", "chip", "cereal", "granola", "gelatin", "cornflour",
    "wrap", "shell", "stuffing", "seaweed", "nori", "miso", "gochujang",
    "curry paste", "capers", "olive", "pickle", "relish", "sun-dried",
  ]],
];

export function categorize(name: string): Aisle {
  const n = name.toLowerCase();

  // Most specific wins: check longer keywords first so "chili powder" lands in
  // Spices rather than "chili" pulling it into Produce.
  let best: { aisle: Aisle; length: number } | null = null;
  for (const [aisle, keywords] of RULES) {
    for (const kw of keywords) {
      if (n.includes(kw) && (!best || kw.length > best.length)) {
        best = { aisle, length: kw.length };
      }
    }
  }
  return best?.aisle ?? "Other";
}
