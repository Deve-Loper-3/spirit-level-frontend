"use server";

/**
 * setTheme – Server Action
 *
 * Sets the "theme" cookie to either "studio" or "ink".
 * Because Next.js automatically re-renders the current route whenever a
 * Server Action mutates cookies(), the <html data-theme> attribute in
 * RootLayout is refreshed in the same HTTP round-trip — no client-side
 * router.refresh() call is needed.
 *
 * Security: the value is validated server-side before it is written.
 */

import { cookies } from "next/headers";
import { type Theme } from "@/lib/theme";

export async function setTheme(theme: Theme): Promise<void> {
  // Whitelist — never persist an arbitrary string from the client.
  if (theme !== "studio" && theme !== "ink") return;

  const cookieStore = await cookies();
  cookieStore.set("theme", theme, {
    // Keep the cookie for 1 year; it's purely a UI preference.
    maxAge: 60 * 60 * 24 * 365,
    // httpOnly: false so that client JS can read it if needed in future,
    // but sameSite/path are locked down.
    path: "/",
    sameSite: "lax",
  });
}
