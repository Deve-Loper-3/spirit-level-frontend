// Shared class strings, moved out of login/page.tsx so login and sign-up use identical styles.
// Tailwind scans .ts files too, so classes written here are still generated.

export const labelClass =
    "mb-2 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-field-label";

// No padding in the base: the password input needs a larger right padding for the eye icon,
// and two padding utilities on one element conflict.
export const inputBase =
    "h-[50px] w-full rounded-[6px] border border-input-border bg-input text-[15px] text-card-foreground outline-none focus:border-focus focus:ring-[0.5px] focus:ring-focus focus:outline-hidden";

export const inputClass = `${inputBase} px-[15px]`;

export const primaryButtonClass =
    "h-[52px] w-full rounded-[6px] bg-button text-[15px] font-semibold text-button-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
    "h-[52px] w-full rounded-[6px] border border-input-border bg-transparent text-[15px] font-semibold text-card-foreground transition-colors hover:bg-divider focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export const linkButtonClass =
    "font-semibold text-link underline underline-offset-4 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link";