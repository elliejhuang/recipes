"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

export function SearchBar({ initial }: { initial: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);

  // Debounced so typing "chicken" doesn't fire six queries.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (value === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      router.replace(next.toString() ? `/?${next}` : "/", { scroll: false });
    }, 250);

    return () => clearTimeout(timer);
  }, [value, params, router]);

  return (
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
  );
}
