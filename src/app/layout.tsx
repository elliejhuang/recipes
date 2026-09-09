import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/bottom-nav";
import { DevStudioMount } from "@/components/dev-studio/mount";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recipe Box",
  description: "Your recipes, what you want to make, and the list.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Fixed at 1x — this is an app you tap through, not a document you'd ever
  // want to pinch-zoom, and an accidental double-tap zoom on a phone is more
  // often a mis-tap than intent.
  maximumScale: 1,
  userScalable: false,
  // Let the page paint under the notch and home indicator; padding below puts
  // the content back where it belongs.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1f" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <main className="mx-auto max-w-5xl px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-24 sm:pt-10">
          {children}
        </main>

        <BottomNav />

        <DevStudioMount />
      </body>
    </html>
  );
}
