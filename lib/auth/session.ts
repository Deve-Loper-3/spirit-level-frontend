import "server-only";
import { cookies } from "next/headers";
import type { BackendTokens, BackendUser } from "@/lib/api/types";
import { BackendError, getMe, refreshAccessToken } from "@/lib/api/backend";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
export const REMEMBER_COOKIE = "remember_me";
export const USER_ROLE_COOKIE = "user_role";

/**
 * Universal duration / timestamp to seconds parser.
 * Handles:
 * - Direct numeric seconds (e.g. 900)
 * - Duration strings (e.g. "15m", "7d", "24h", "60s")
 * - ISO 8601 strings (e.g. "2026-10-27T05:00:00.000Z")
 */
export function toSeconds(
    duration: string | number | undefined,
    fallback: number,
): number {
    if (duration === undefined || duration === null) {
        return fallback;
    }

    if (typeof duration === "number" && !Number.isNaN(duration)) {
        return Math.max(0, Math.floor(duration));
    }

    if (typeof duration === "string") {
        const trimmed = duration.trim();

        // 1. Check for pure numeric string
        if (/^\d+$/.test(trimmed)) {
            return Number(trimmed);
        }

        // 2. Check for duration shorthand (e.g. "15m", "7d")
        const match = /^(\d+)\s*([smhd])$/i.exec(trimmed);
        if (match) {
            const units: Record<string, number> = {
                s: 1,
                m: 60,
                h: 3600,
                d: 86400,
            };
            const unit = match[2].toLowerCase();
            return Number(match[1]) * (units[unit] ?? 1);
        }

        // 3. Check for ISO date string
        const parsedDate = new Date(trimmed);
        if (!Number.isNaN(parsedDate.getTime())) {
            const diffSeconds = Math.floor(
                (parsedDate.getTime() - Date.now()) / 1000,
            );
            return Math.max(0, diffSeconds);
        }
    }

    return fallback;
}

const baseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
};

/**
 * Global mutex for server-side token refresh to prevent duplicate simultaneous refresh requests.
 * "Runs only one refresh at a time, so parallel requests wait on the same one."
 */
let serverRefreshPromise: Promise<BackendTokens | null> | null = null;

/**
 * Persists session tokens and user role to HttpOnly cookies.
 * - ACCESS_COOKIE: Short-lived access token with maxAge.
 * - REFRESH_COOKIE:
 *   - If remember = true: Long-lived persistent cookie with maxAge.
 *   - If remember = false: Session-only cookie (cleared when browser closes).
 * - USER_ROLE_COOKIE: User role for synchronous middleware routing.
 */
export async function setSession(
    tokens: BackendTokens,
    remember: boolean,
    role?: string | null,
): Promise<void> {
    try {
        const store = await cookies();

        const accessMaxAge = toSeconds(tokens.accessTokenExpiresIn, 15 * 60);
        store.set(ACCESS_COOKIE, tokens.accessToken, {
            ...baseOptions,
            maxAge: accessMaxAge,
        });

        const refreshExpiry = tokens.refreshTokenExpiresAt ?? tokens.refreshTokenExpiresIn;
        if (remember) {
            const refreshMaxAge = toSeconds(
                refreshExpiry,
                30 * 86400,
            );
            store.set(REFRESH_COOKIE, tokens.refreshToken, {
                ...baseOptions,
                maxAge: refreshMaxAge,
            });
            store.set(REMEMBER_COOKIE, "1", {
                ...baseOptions,
                maxAge: refreshMaxAge,
            });
            if (role) {
                store.set(USER_ROLE_COOKIE, role, {
                    ...baseOptions,
                    maxAge: refreshMaxAge,
                });
            }
        } else {
            // Session-only cookie: omitting maxAge creates a session cookie in the browser
            store.set(REFRESH_COOKIE, tokens.refreshToken, {
                ...baseOptions,
            });
            store.set(REMEMBER_COOKIE, "0", {
                ...baseOptions,
            });
            if (role) {
                store.set(USER_ROLE_COOKIE, role, {
                    ...baseOptions,
                });
            }
        }
    } catch {
        // In Next.js Server Components, cookies() is read-only.
        // We catch and suppress the error so the active request continues with refreshed token.
    }
}

/**
 * Returns the raw access token cookie value, if present.
 */
export async function getSession(): Promise<string | null> {
    const store = await cookies();
    return store.get(ACCESS_COOKIE)?.value ?? null;
}

/**
 * Returns the stored user role cookie value, if present.
 */
export async function getUserRole(): Promise<string | null> {
    const store = await cookies();
    return store.get(USER_ROLE_COOKIE)?.value ?? null;
}

/**
 * Refreshes the session using the stored refresh token.
 * Uses a single-flight mutex so parallel requests await the exact same refresh promise.
 * Writes new tokens into cookies if successful.
 * Clears cookies if refresh fails.
 */
export async function refreshSession(): Promise<BackendTokens | null> {
    if (serverRefreshPromise) {
        return serverRefreshPromise;
    }

    serverRefreshPromise = (async () => {
        const store = await cookies();
        const refreshToken = store.get(REFRESH_COOKIE)?.value;
        const isRemembered = store.get(REMEMBER_COOKIE)?.value === "1";

        if (!refreshToken) {
            return null;
        }

        try {
            const newTokens = await refreshAccessToken(refreshToken);
            let role = store.get(USER_ROLE_COOKIE)?.value ?? null;

            // Fetch user profile to verify role change on refresh
            // Ticket 2: "A role change after a token refresh re-evaluates the guards."
            try {
                const user = await getMe(newTokens.accessToken);
                if (user?.role) {
                    role = user.role;
                }
            } catch {
                // If getMe fails here, proceed with existing role
            }

            await setSession(newTokens, isRemembered, role);
            return newTokens;
        } catch (error) {
            console.warn("Session refresh failed:", error);
            await clearSession();
            return null;
        }
    })();

    try {
        return await serverRefreshPromise;
    } finally {
        serverRefreshPromise = null;
    }
}

/**
 * Validates the current session against the backend:
 * 1. Checks access token.
 * 2. If missing, attempts silent refresh via refresh token.
 * 3. Verifies access token with GET /auth/me.
 * 4. On 401, attempts silent refresh and retries validation.
 * 5. Returns validated user profile and active token, or null.
 */
export async function getValidSession(): Promise<{
    token: string;
    user: BackendUser;
} | null> {
    let token = await getSession();

    if (!token) {
        const refreshed = await refreshSession();
        if (!refreshed) {
            return null;
        }
        token = refreshed.accessToken;
    }

    try {
        const user = await getMe(token);
        return { token, user };
    } catch (error) {
        if (error instanceof BackendError && error.status === 401) {
            // Access token expired or invalid; attempt refresh once
            const refreshed = await refreshSession();
            if (!refreshed) {
                return null;
            }
            try {
                const user = await getMe(refreshed.accessToken);
                return { token: refreshed.accessToken, user };
            } catch {
                await clearSession();
                return null;
            }
        }

        // For other backend errors or missing sessions, clear and deny
        await clearSession();
        return null;
    }
}

/**
 * Clears all authentication cookies.
 */
export async function clearSession(): Promise<void> {
    try {
        const store = await cookies();
        store.set(ACCESS_COOKIE, "", { ...baseOptions, maxAge: 0 });
        store.set(REFRESH_COOKIE, "", { ...baseOptions, maxAge: 0 });
        store.set(REMEMBER_COOKIE, "", { ...baseOptions, maxAge: 0 });
        store.set(USER_ROLE_COOKIE, "", { ...baseOptions, maxAge: 0 });
        store.delete(ACCESS_COOKIE);
        store.delete(REFRESH_COOKIE);
        store.delete(REMEMBER_COOKIE);
        store.delete(USER_ROLE_COOKIE);
    } catch {
        // In Next.js Server Components, cookies() is read-only.
    }
}

/**
 * Calls backend POST /api/v1/auth/logout with refreshToken and Bearer token,
 * then clears local session cookies even if the call fails.
 */
export async function logoutSession(): Promise<void> {
    try {
        const store = await cookies();
        const refreshToken = store.get(REFRESH_COOKIE)?.value;
        const accessToken = store.get(ACCESS_COOKIE)?.value;

        if (refreshToken) {
            const { logoutUser } = await import("@/lib/api/backend");
            await logoutUser(refreshToken, accessToken);
        }
    } catch (err) {
        console.warn("Logout request failed:", err);
    } finally {
        await clearSession();
    }
}