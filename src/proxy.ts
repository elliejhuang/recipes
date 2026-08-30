import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * A single shared passcode in front of everything.
 *
 * The app has no accounts and never needed any — it's one person's recipe box.
 * But deployed it sits on a public URL with full read/write and a photo-upload
 * endpoint, so "nobody will guess the address" is the only thing standing
 * between a stranger and your recipes. One passcode, entered once per device
 * and remembered for a year, closes that without turning this into a product
 * with a login.
 *
 * Leave APP_PASSCODE unset and the gate disappears entirely, which is what
 * happens in local development.
 */
export const COOKIE = "rb_pass";

export function proxy(request: NextRequest) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return;

  const { pathname } = request.nextUrl;
  if (pathname === "/unlock") return;

  if (request.cookies.get(COOKIE)?.value === passcode) return;

  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  // Come back to whatever was being asked for.
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own assets and the icons — a locked padlock
     * screen should still look like the app, and the manifest has to be
     * readable for "Add to Home Screen" to offer the right name and icon.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)",
  ],
};
