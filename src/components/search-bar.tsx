"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Link2, Search, X } from "lucide-react";

export function SearchBar({
  initial,
  folderId,
}: {
  initial: string;
  folderId: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  // Debounced so typing "chicken" doesn't fire six queries.
  useEffect(() => {
    if (value === initial) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      if (folderId) params.set("folder", String(folderId));
      router.replace(params.toString() ? `/?${params}` : "/", { scroll: false });
    }, 250);

    return () => clearTimeout(timer);
  }, [value, initial, folderId, router]);

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search recipes and ingredients…"
          className="field !pl-9"
        />
        {value && (
          <button
            onClick={() => setValue("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-faint hover:text-ink"
          >
            <X size={15} />
          </button>
        )}
      </div>
      <Link href="/recipes/import" className="btn shrink-0">
        <Link2 size={14} />
        Import
      </Link>
    </div>
  );
}
