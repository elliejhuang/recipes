import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { DevStudioMount } from "@/components/dev-studio/mount";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recipe Box",
  description: "Your recipes, what you want to make, and the list.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Let the page paint under the notch and home indicator; padding below puts
  // the content back where it belongs.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#22201e" },
  ],
};

const NAV = [
  { href: "/", label: "Recipes" },
  { href: "/plan", label: "To Make" },
  { href: "/list", label: "Groceries" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="no-print sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-4 pt-[env(safe-area-inset-top)]">
            <nav className="flex items-center gap-1">
              {NAV.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-card hover:text-ink"
                >
                  {label}
                </Link>
              ))}
            </nav>

            <Link href="/recipes/new" className="btn btn-primary ml-auto !px-3 !py-1.5 !text-sm">
              Add
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:py-8">
          {children}
        </main>

        <DevStudioMount />
      </body>
    </html>
  );
}
