# Recipe Box

Your recipes, your week, your list. A personal recipe app that imports from any
recipe site, plans a week of meals, builds the shopping list, and tracks macros.

## Setup

Everything runs on one free Supabase project — Postgres for the data, Storage
for your photos.

1. Create a project at [supabase.com](https://supabase.com) (free tier, no card)
2. `cp .env.example .env.local`
3. Fill in four values from the Supabase dashboard:
   - `DATABASE_URL` — Settings → Database → Connection string → **Transaction
     pooler**, with `[YOUR-PASSWORD]` swapped for your database password
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY` — Settings → API. Server-only; never commit it
4. `npm run db:setup` — creates the tables and the photo bucket
5. `npm run dev` — http://localhost:3000

## What it does

**Recipe box.** Add recipes by hand or import them. Search across titles,
descriptions, and ingredients, so "what can I make with leeks" is a real
question you can ask it. Tag, favorite, print.

**Import from the web.** Paste a link and it pulls the title, image,
ingredients, steps, times, servings, tags, and any nutrition the site
published — then shows you the result to check before saving. This reads the
schema.org Recipe data that nearly every recipe site embeds to get its Google
rich card, so it works broadly and costs nothing.

**Pinterest** is resolved rather than scraped: a pin holds a picture and a link
to the blog that has the recipe, so the pin's outbound URL is followed and that
page is imported, keeping the pin's image if the destination has none. Pins
that point at a roundup ("25 chicken dinners") fall back to the pin's own title
and image.

**Instagram can't be read from outside the app** — verified, not assumed. A
logged-out request gets a login wall with no caption, no og:description and no
image, and the oEmbed endpoint is retired. So the link is kept as the source and
the caption is pasted in, which the free-text parser turns into ingredients and
steps by shape: bullets and amounts are shopping, sentences opening with a
cooking verb are method, and trailing hashtags are dropped.

**Simplify steps** cuts a wordy method down to the part you look back at
mid-cook — "Bake 350°F, 15 min". It's a button on the import screen, not
something done to you.

**Meal plan.** A Monday-to-Sunday grid, four meals a day. Drag between slots,
set how many servings you're actually making, see calories and macros per day
and averaged across the week.

**Shopping list.** Built from the week's plan. Amounts are scaled to the
servings you planned and summed across recipes, so ⅓ cup of olive oil in one
recipe and 2 tablespoons in another come out as one line reading "½ cup".
Grouped by aisle. Anything you add by hand survives a rebuild, and so do the
boxes you've already ticked.

**Your photos.** Drop them onto any recipe, several at a time. Caption them,
pick which one is the cover, or pin one to a step so you can see what it should
look like when the onions are done. They live in Supabase Storage and outlast
the original site's images, which rot.

**Make it mine.** A recipe off the internet is a record of what someone else
cooked. "Make it mine" copies it into your own version — adjust the amounts,
rewrite the steps, add your photos — and leaves the imported original untouched
as a reference. Both stay linked, so you can always see what the site actually
said, and each version keeps a note of what you changed and why.

**Macros.** Per serving, from three sources in order of trust: what the
original site published, what you typed in, or an estimate added up from the
ingredients. Estimates always say so and report how many ingredients they could
actually price — an estimate that quietly skipped the butter is worse than no
estimate.

## How it's built

Next.js App Router, Supabase Postgres via Drizzle, Supabase Storage for photos,
Tailwind. Everything is a Server Component reading the database directly, with
Server Actions for writes. Two API routes handle the things actions can't: the
importer, which fetches and parses an external page, and photo upload, which
takes multipart file data.

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

## Sharing into it from a phone

iOS doesn't implement Web Share Target, so a website cannot put itself in the
share sheet. A Shortcut does the same job in one tap:

1. Shortcuts → new shortcut, named "Save to Recipe Box"
2. **Receive URLs from Share Sheet**
3. **URL Encode**, input Shortcut Input
4. **Text**: `https://your-deployment/recipes/import?url=` followed by the
   encoded text
5. **Open URLs** with that text

`/recipes/import?url=…` runs the import on arrival, so sharing a pin goes
straight to a filled-in draft. Android needs none of this — the manifest
declares a `share_target` and the app appears in the sheet directly.

## Deploying

Push to GitHub, import the repo on Vercel, and copy all four environment
variables from `.env.local` into the project's settings. Nothing else to
configure.

## A note on the photo bucket

`npm run db:setup` creates the `recipe-photos` bucket as **public**, meaning
anyone holding a photo's URL can view it. The URLs contain a random UUID so
they aren't guessable, which is the right trade for a personal recipe box —
public URLs render instantly and cost nothing. If this ever grows real accounts,
make the bucket private and serve signed URLs instead.
