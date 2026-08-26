"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Star, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import type { Photo } from "@/db/schema";
import { setCoverPhoto, updatePhotoCaption } from "@/lib/actions";

export function PhotoGallery({
  recipeId,
  photos,
  uploadsEnabled,
}: {
  recipeId: number;
  photos: Photo[];
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;

    setUploading(true);
    setError(null);

    const form = new FormData();
    form.set("recipeId", String(recipeId));
    for (const file of list) form.append("files", file);

    try {
      const response = await fetch("/api/photos", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "Upload failed.");
      else router.refresh();
    } catch {
      setError("Upload failed — check your connection.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (id: number) => {
    await fetch(`/api/photos?id=${id}`, { method: "DELETE" });
    setLightbox(null);
    router.refresh();
  };

  if (!uploadsEnabled && photos.length === 0) return null;

  return (
    <section className="no-print mt-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">
          Your photos
        </h2>

      </div>

      <div
        onDragOver={(e) => {
          if (!uploadsEnabled) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!uploadsEnabled) return;
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files);
        }}
        className={clsx(
          "rounded-xl border p-3 transition-colors",
          dragOver ? "border-accent bg-accent-soft" : "border-rule bg-card",
        )}
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setLightbox(photo)}
              className="group relative aspect-square overflow-hidden rounded-lg bg-paper"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption ?? ""}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              {photo.isCover && (
                <span className="absolute top-1.5 left-1.5 rounded-full bg-card/90 p-1 backdrop-blur">
                  <Star size={11} className="fill-accent text-accent" />
                </span>
              )}
              {photo.caption && (
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 text-left text-[10px] text-white">
                  {photo.caption}
                </span>
              )}
            </button>
          ))}

          {uploadsEnabled && (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-rule text-muted hover:border-accent hover:text-accent"
            >
              {uploading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ImagePlus size={18} />
              )}
              <span className="px-1 text-center text-[11px] leading-tight">
                {uploading ? "Uploading…" : photos.length ? "Add" : "Add photos"}
              </span>
            </button>
          )}
        </div>

        {!uploadsEnabled && (
          <p className="px-1 py-2 text-xs text-faint">
            Photo uploads need Supabase storage keys in <code>.env.local</code>.
          </p>
        )}

        {error && <p className="mt-2 px-1 text-xs text-accent">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => e.target.files && upload(e.target.files)}
      />

      {lightbox && (
        <Lightbox
          photo={lightbox}
          recipeId={recipeId}
          onClose={() => setLightbox(null)}
          onDelete={() => remove(lightbox.id)}
        />
      )}
    </section>
  );
}

function Lightbox({
  photo,
  recipeId,
  onClose,
  onDelete,
}: {
  photo: Photo;
  recipeId: number;
  onClose: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [pending, startTransition] = useTransition();

  const saveCaption = () => {
    if (caption === (photo.caption ?? "")) return;
    startTransition(async () => {
      await updatePhotoCaption(photo.id, recipeId, caption);
      router.refresh();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.caption ?? ""}
            className="max-h-[60vh] w-full object-contain"
          />
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <label className="label" htmlFor="caption">
              Caption
            </label>
            <input
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onBlur={saveCaption}
              onKeyDown={(e) => e.key === "Enter" && saveCaption()}
              placeholder="Second try — 15 minutes longer in the oven"
              className="field"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={photo.isCover || pending}
              onClick={() =>
                startTransition(async () => {
                  await setCoverPhoto(photo.id, recipeId);
                  router.refresh();
                  onClose();
                })
              }
              className="btn"
            >
              <Star size={14} className={photo.isCover ? "fill-accent text-accent" : ""} />
              {photo.isCover ? "This is the cover" : "Make it the cover"}
            </button>

            <button
              onClick={() => {
                if (confirm("Delete this photo?")) onDelete();
              }}
              className="btn ml-auto text-muted hover:!border-accent hover:text-accent"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
