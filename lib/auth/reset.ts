import "server-only";
import { cookies } from "next/headers";

export const RESET_COOKIE = "reset_token";

// Written only from a Route Handler (cookies can't be set while a page renders).
export async function setResetToken(token: string) {
    const store = await cookies();
    store.set(RESET_COOKIE, token, {
        httpOnly: true, // browser JavaScript can never read it
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        // "/" because BOTH the page (/reset-password) and the API route
        // (/api/auth/reset-password) must be able to see it.
        path: "/",
        maxAge: 10 * 60, // 10 minutes. Match the token's real lifetime.
    });
}

// Readable from both Route Handlers and Server Components.
export async function getResetToken(): Promise<string | null> {
    const store = await cookies();
    return store.get(RESET_COOKIE)?.value ?? null;
}

export async function clearResetToken() {
    const store = await cookies();
    store.delete(RESET_COOKIE);
}