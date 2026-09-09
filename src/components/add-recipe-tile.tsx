"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardPaste, Link2, Loader2, PencilLine, Plus, X } from "lucide-react";

/**
 * Leads the recipe grid. Three ways in — paste a link, paste the recipe as
 * text, or write it yourself — and one tile that offers all three beats a
 * permanent button in the header competing with the nav.
 */
export function AddRecipeTile() {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<"link" | "text" | null>(null);
  const router = useRouter();

  return (
    <div className="relative">
      <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-rule">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted hover:text-accent"
        >
          <Plus size={22} />
          <span className="text-xs">Add recipe</span>
        </button>
      </div>
      {/* Keeps this tile's height in step with the titled ones beside it. */}
      <div className="mt-1.5 px-0.5 text-[15px] font-semibold text-transparent">.</div>

      {open && (
        <>
          <button
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-1/2 left-1/2 z-20 w-44 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-rule bg-card p-1 shadow-lg">
            <button
              onClick={() => {
                setOpen(false);
                setModal("link");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm hover:bg-paper"
            >
              <Link2 size={15} className="shrink-0 text-muted" />
              Paste a link
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setModal("text");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm hover:bg-paper"
            >
              <ClipboardPaste size={15} className="shrink-0 text-muted" />
              Paste recipe
            </button>
            <Link
              href="/recipes/new"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm hover:bg-paper"
            >
              <PencilLine size={15} className="shrink-0 text-muted" />
              Write from scratch
            </Link>
          </div>
        </>
      )}

      {modal && (
        <PasteModal
          mode={modal}
          onClose={() => setModal(null)}
          onSubmit={(value) => {
            const param = modal === "link" ? "url" : "text";
            router.push(`/recipes/import?${param}=${encodeURIComponent(value)}`);
          }}
        />
      )}
    </div>
  );
}

/**
 * One field, one button. The import page does the actual reading — this just
 * collects what it needs without making you sit on the full import screen
 * (link input, paste box, help text) to hand over one thing.
 */
function PasteModal({
  mode,
  onClose,
  onSubmit,
}: {
  mode: "link" | "text";
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSubmitting(true);
    onSubmit(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">
            {mode === "link" ? "Paste link" : "Paste recipe"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-faint hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {mode === "link" ? (
          <input
            autoFocus
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="https://…"
            className="field"
          />
        ) : (
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={8}
            placeholder="A caption, a screenshot's text, anything with the ingredients one per line."
            className="field resize-y font-mono !text-[13px] leading-relaxed"
          />
        )}

        <button
          onClick={submit}
          disabled={!value.trim() || submitting}
          className="btn btn-primary mt-3 w-full"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Next
        </button>
      </div>
    </div>
  );
}
