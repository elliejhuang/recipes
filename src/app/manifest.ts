import type { MetadataRoute } from "next";

/**
 * Makes "Add to Home Screen" produce something that behaves like an app:
 * its own icon, no browser chrome, and the app's own background behind it
 * while it loads.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recipe Box",
    short_name: "Recipes",
    description: "Your recipes, your lists, your groceries.",
    start_url: "/",
    display: "standalone",
    background_color: "#fcfcfd",
    theme_color: "#fcfcfd",
    orientation: "portrait",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
