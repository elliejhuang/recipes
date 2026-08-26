# Recipe Box

Your recipes, your week, your list. A personal recipe app that imports from any
recipe site, plans a week of meals, builds the shopping list, and tracks macros.

## Getting a database

The app needs a Postgres connection string. Neon's free tier is enough and
doesn't ask for a card.

1. Sign up at [neon.tech](https://neon.tech) and create a project
2. Copy the **pooled** connection string from the dashboard
3. `cp .env.example .env.local` and paste it in as `DATABASE_URL`
4. `npm run db:setup` — creates the tables
5. `npm run dev` — http://localhost:3000

## What it does

**Recipe box.** Add recipes by hand or import them. Search across titles,
descriptions, and ingredients, so "what can I make with leeks" is a real
question you can ask it. Tag, favorite, print.

**Import from the web.** Paste a link and it pulls the title, image,
ingredients, steps, times, servings, tags, and any nutrition the site
published — then shows you the result to check before saving. This reads the
schema.org Recipe data that nearly every recipe site embeds to get its Google
rich card, so it works broadly and costs nothing. Paywalled and app-only
recipes are the exception.

**Meal plan.** A Monday-to-Sunday grid, four meals a day. Drag between slots,
set how many servings you're actually making, see calories and macros per day
and averaged across the week.

**Shopping list.** Built from the week's plan. Amounts are scaled to the
servings you planned and summed across recipes, so ⅓ cup of olive oil in one
recipe and 2 tablespoons in another come out as one line reading "½ cup".
Grouped by aisle. Anything you add by hand survives a rebuild, and so do the
boxes you've already ticked.

**Macros.** Per serving, from three sources in order of trust: what the
original site published, what you typed in, or an estimate added up from the
ingredients. Estimates always say so and report how many ingredients they could
actually price — an estimate that quietly skipped the butter is worse than no
estimate.

## How it's built

Next.js App Router, Postgres via Drizzle on Neon's HTTP driver, Tailwind.
Everything is a Server Component reading the database directly, with Server
Actions for writes; there's one API route, for the importer, because it needs
to fetch and parse an external page.

The interesting code is in `src/lib`:

| File | What it does |
| --- | --- |
| `units.ts` | Parses "1½", "¾", "2-3", "one" into numbers; converts and rounds units to what a cook would actually say |
| `parse-ingredient.ts` | Splits an ingredient line into amount, unit, name, and prep note |
| `import-recipe.ts` | Pulls schema.org Recipe data out of a web page, with a microdata fallback |
| `aggregate-groceries.ts` | Scales and sums a week of ingredients into a shopping list |
| `nutrition.ts` + `food-data.ts` | Estimates macros from ingredients, and reports its own coverage |
| `aisles.ts` | Sorts a shopping list into supermarket sections |

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Development server |
| `npm run db:setup` | Create tables from `drizzle/` |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:studio` | Browse the data |
| `npm run build` | Production build |

There's also a development-only endpoint at `POST /api/seed` that takes the
output of `/api/import` and saves it, which is the quick way to load a batch of
recipes without clicking through the import screen once per link. It returns
404 in production.

## Deploying

Push to GitHub, import the repo on Vercel, and set `DATABASE_URL` in the
project's environment variables to the same Neon string. Nothing else to
configure.
