"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

export function SearchBar({
  initial,
  basePath = "/",
  placeholder = "Search recipes and ingredients…",
}: {
  initial: string;
  /** Where the "?q=" param lives — each list-y page searches its own route. */
  basePath?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  // Debounced so typing "chicken" doesn't fire six queries.
  useEffect(() => {
    if (value === initial) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      router.replace(params.toString() ? `${basePath}?${params}` : basePath, {
        scroll: false,
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [value, initial, basePath, router]);

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
          placeholder={placeholder}
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
    </div>
  );
}
