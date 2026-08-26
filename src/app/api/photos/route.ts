import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { photos, recipes } from "@/db/schema";
import { PHOTO_BUCKET, createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
]);

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const recipeId = Number(form.get("recipeId"));
  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return NextResponse.json({ error: "Which recipe?" }, { status: 400 });
  }

  const [recipe] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.id, recipeId));
  if (!recipe) {
    return NextResponse.json({ error: "That recipe doesn't exist." }, { status: 404 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "No photos in that upload." }, { status: 400 });
  }

  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `${file.name} is a ${file.type || "unknown"} — photos only.` },
        { status: 415 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `${file.name} is over the 10 MB limit.` },
        { status: 413 },
      );
    }
  }

  let storage;
  try {
    storage = createAdminClient().storage.from(PHOTO_BUCKET);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Storage isn't configured." },
      { status: 501 },
    );
  }

  // New photos go after whatever is already there, and the first photo a
  // recipe ever gets becomes its cover.
  const [{ count, nextPosition }] = await db
    .select({
      count: sql<number>`count(*)::int`,
      nextPosition: sql<number>`(COALESCE(MAX(${photos.position}), -1) + 1)::int`,
    })
    .from(photos)
    .where(eq(photos.recipeId, recipeId));

  const uploaded: { path: string }[] = [];
  const rows: (typeof photos.$inferInsert)[] = [];

  try {
    for (const [index, file] of files.entries()) {
      const extension = EXTENSIONS[file.type] ?? "jpg";
      const path = `recipes/${recipeId}/${randomUUID()}.${extension}`;

      const { error } = await storage.upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw new Error(error.message);

      uploaded.push({ path });
      rows.push({
        recipeId,
        storagePath: path,
        url: storage.getPublicUrl(path).data.publicUrl,
        position: nextPosition + index,
        isCover: count === 0 && index === 0,
      });
    }
  } catch (error) {
    // A half-finished batch would leave files nobody can see or delete, so
    // clean up anything that made it before the failure.
    if (uploaded.length) {
      await storage.remove(uploaded.map((u) => u.path)).catch(() => {});
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 502 },
    );
  }

  const saved = await db.insert(photos).values(rows).returning();
  return NextResponse.json({ photos: saved });
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Which photo?" }, { status: 400 });
  }

  const [photo] = await db.select().from(photos).where(eq(photos.id, id));
  if (!photo) return NextResponse.json({ ok: true });

  try {
    await createAdminClient().storage.from(PHOTO_BUCKET).remove([photo.storagePath]);
  } catch {
    // The row is the source of truth for what the app shows. If the file
    // lingers in the bucket, that's tidy-up, not a failure worth blocking on.
  }

  await db.delete(photos).where(eq(photos.id, id));

  // Losing the cover shouldn't leave the recipe without one.
  if (photo.isCover) {
    const [next] = await db
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.recipeId, photo.recipeId))
      .orderBy(photos.position)
      .limit(1);
    if (next) {
      await db.update(photos).set({ isCover: true }).where(eq(photos.id, next.id));
    }
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Which photo?" }, { status: 400 });
  }

  const [photo] = await db.select().from(photos).where(eq(photos.id, id));
  if (!photo) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (body.makeCover) {
    await db
      .update(photos)
      .set({ isCover: false })
      .where(and(eq(photos.recipeId, photo.recipeId), eq(photos.isCover, true)));
    await db.update(photos).set({ isCover: true }).where(eq(photos.id, id));
  }

  if (typeof body.caption === "string") {
    await db
      .update(photos)
      .set({ caption: body.caption.trim() || null })
      .where(eq(photos.id, id));
  }

  if (body.stepPosition === null || Number.isInteger(body.stepPosition)) {
    await db
      .update(photos)
      .set({ stepPosition: body.stepPosition })
      .where(eq(photos.id, id));
  }

  return NextResponse.json({ ok: true });
}
