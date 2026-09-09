"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, ListChecks, ShoppingCart } from "lucide-react";
import { clsx } from "clsx";

const NAV = [
  { href: "/", label: "Recipes", icon: ChefHat },
  { href: "/lists", label: "Lists", icon: ListChecks },
  { href: "/groceries", label: "Groceries", icon: ShoppingCart },
] as const;

/** "/" only matches the recipe grid itself, not every route under it. */
function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper/85 backdrop-blur"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-5xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                active ? "text-accent" : "text-muted hover:text-ink",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
