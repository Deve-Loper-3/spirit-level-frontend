"use client";

/**
 * ThemeSwitcher – Client Component
 *
 * Renders a pill-style toggle that lets the user switch between the
 * "Studio" (light) and "Ink" (dark) themes.  It is intentionally a
 * Client Component because it owns the optimistic highlight animation;
 * the actual theme write is done through the `setTheme` Server Action so
 * the cookie is always set on the server and the page re-renders in one
 * round-trip.
 *
 * Design:
 *  - Dark pill background (#1f2937-ish) matching the auth layout stripes.
 *  - The active option gets the spirit-green (#CEFC52) background with
 *    near-black text — identical to the reference screenshot.
 *  - Subtle scale + shadow animation on the sliding indicator.
 *  - startTransition wraps the Server Action call so React can batch the
 *    optimistic update without blocking the UI.
 */

import { startTransition, useOptimistic } from "react";
import { setTheme } from "@/lib/actions/theme";
import { type Theme } from "@/lib/theme";

const THEMES: { value: Theme; label: string }[] = [
  { value: "studio", label: "Studio" },
  { value: "ink", label: "Ink" },
];

interface ThemeSwitcherProps {
  /** The theme that was read from the cookie by the Server Component parent. */
  current: Theme;
}

export default function ThemeSwitcher({ current }: ThemeSwitcherProps) {
  // useOptimistic lets us flip the highlight immediately while the server
  // round-trip is in-flight, then commits to the server-confirmed value.
  const [optimisticTheme, setOptimisticTheme] = useOptimistic(current);

  function handleSwitch(theme: Theme) {
    if (theme === optimisticTheme) return;
    startTransition(async () => {
      setOptimisticTheme(theme);
      await setTheme(theme);
    });
  }

  return (
    <div
      role="group"
      aria-label="Theme switcher"
      className="theme-switcher-pill"
    >
      {THEMES.map(({ value, label }) => {
        const isActive = optimisticTheme === value;
        return (
          <button
            key={value}
            id={`theme-btn-${value}`}
            type="button"
            aria-pressed={isActive}
            onClick={() => handleSwitch(value)}
            className={`theme-switcher-option${isActive ? " theme-switcher-option--active" : ""}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
