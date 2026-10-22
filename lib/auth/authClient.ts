import type { BackendTokens, BackendUser, ApiSuccess } from "@/lib/api/types";
import { getRoleHome, isRouteAllowedForRole } from "./roles";

// Secure in-memory store for accessToken
let inMemoryAccessToken: string | null = null;
let inMemoryUser: BackendUser | null = null;
let activeRefreshPromise: Promise<BackendTokens | null> | null = null;

// Secure storage helpers for reload persistence (avoiding localStorage to prevent XSS)
// Uses sessionStorage (cleared when browser session ends) and secure cookies
const REFRESH_STORAGE_KEY = "__sl_rt";
const EXPIRY_STORAGE_KEY = "__sl_rte";

function getStoredRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    try {
        // Try sessionStorage first
        const token = sessionStorage.getItem(REFRESH_STORAGE_KEY);
        if (token) return token;

        // Fallback: read from document.cookie
        const match = document.cookie.match(new RegExp(`(?:^|; )${REFRESH_STORAGE_KEY}=([^;]*)`));
        return match ? decodeURIComponent(match[1]) : null;
    } catch {
        return null;
    }
}

function setStoredRefreshToken(token: string, expiresAt?: string): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(REFRESH_STORAGE_KEY, token);
        if (expiresAt) {
            sessionStorage.setItem(EXPIRY_STORAGE_KEY, expiresAt);
        }
        // Also write secure cookie for reload persistence
        const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `${REFRESH_STORAGE_KEY}=${encodeURIComponent(token)}; Path=/; SameSite=Lax${secureFlag}`;
    } catch {
        // Suppress storage errors
    }
}

function clearStoredRefreshToken(): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.removeItem(REFRESH_STORAGE_KEY);
        sessionStorage.removeItem(EXPIRY_STORAGE_KEY);
        document.cookie = `${REFRESH_STORAGE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
        document.cookie = `user_role=; Path=/; Max-Age=0; SameSite=Lax`;
    } catch {
        // Suppress storage errors
    }
}

/**
 * Accessor for the in-memory access token.
 */
export function getAccessToken(): string | null {
    return inMemoryAccessToken;
}

/**
 * Accessor for the active authenticated user profile.
 */
export function getCurrentUser(): BackendUser | null {
    return inMemoryUser;
}

/**
 * Stores tokens and user profile into memory and secure reload storage.
 */
export function setClientSession(tokens: BackendTokens, user: BackendUser): void {
    // Ticket 2: "A MEMBER login is refused with 'This portal is for staff', and the session is cleared."
    if (user.role?.toUpperCase() === "MEMBER") {
        clearClientSession();
        throw new Error("This portal is for staff");
    }

    inMemoryAccessToken = tokens.accessToken;
    inMemoryUser = user;

    const expiry = tokens.refreshTokenExpiresAt ?? tokens.refreshTokenExpiresIn;
    setStoredRefreshToken(tokens.refreshToken, expiry);

    if (typeof window !== "undefined" && user.role) {
        const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `user_role=${encodeURIComponent(user.role)}; Path=/; SameSite=Lax${secureFlag}`;
    }
}

/**
 * Clears the active session from memory and reload storage.
 */
export function clearClientSession(): void {
    inMemoryAccessToken = null;
    inMemoryUser = null;
    clearStoredRefreshToken();
}

/**
 * Redirects user to login with "Session ended, please sign in again"
 */
export function handleSessionRevocation(): void {
    clearClientSession();
    if (typeof window !== "undefined") {
        const targetUrl = `/login?message=${encodeURIComponent("Session ended, please sign in again")}`;
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = targetUrl;
    }
}

/**
 * Refreshes tokens using POST /api/v1/auth/refresh.
 * Ticket 1:
 * - Rotates token pair on every refresh.
 * - Single in-flight mutex so parallel requests wait on the same one.
 * - If refresh fails or revoked token detected, clears session and redirects to login.
 * Ticket 2:
 * - "A role change after a token refresh re-evaluates the guards."
 */
export async function refreshTokens(): Promise<BackendTokens | null> {
    if (activeRefreshPromise) {
        return activeRefreshPromise;
    }

    activeRefreshPromise = (async () => {
        const refreshToken = getStoredRefreshToken();
        if (!refreshToken) {
            return null;
        }

        try {
            const envUrl =
                process.env.NEXT_PUBLIC_API_BASE_URL ||
                process.env.API_BASE_URL ||
                "http://localhost:4000/api/v1";
            const baseUrl = envUrl.replace(/\/+$/, "");

            const res = await fetch(`${baseUrl}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken }),
            });

            if (!res.ok) {
                return null;
            }

            const json = (await res.json()) as ApiSuccess<{
                tokens?: BackendTokens;
                accessToken?: string;
                accessTokenExpiresIn?: string;
                refreshToken?: string;
                refreshTokenExpiresIn?: string;
                refreshTokenExpiresAt?: string;
            }>;

            const data = json.data as Record<string, unknown>;
            const rawTokens = (data?.tokens as BackendTokens | undefined) ?? (data as unknown as BackendTokens);

            if (!rawTokens || !rawTokens.accessToken) {
                return null;
            }

            const newTokens: BackendTokens = {
                accessToken: rawTokens.accessToken,
                accessTokenExpiresIn: rawTokens.accessTokenExpiresIn ?? "15m",
                refreshToken: rawTokens.refreshToken ?? refreshToken,
                refreshTokenExpiresIn: rawTokens.refreshTokenExpiresIn,
                refreshTokenExpiresAt: rawTokens.refreshTokenExpiresAt,
            };

            inMemoryAccessToken = newTokens.accessToken;
            setStoredRefreshToken(newTokens.refreshToken, newTokens.refreshTokenExpiresAt);

            // Fetch me to verify user and re-evaluate guards if role changed
            try {
                const meRes = await fetch(`${baseUrl}/auth/me`, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${newTokens.accessToken}`,
                    },
                });

                if (meRes.ok) {
                    const meJson = (await meRes.json()) as ApiSuccess<BackendUser | { user: BackendUser }>;
                    const meData = meJson.data as Record<string, unknown>;
                    const updatedUser = (meData?.user as BackendUser | undefined) ?? (meData as unknown as BackendUser);

                    if (updatedUser) {
                        const previousRole = inMemoryUser?.role;
                        inMemoryUser = updatedUser;

                        if (typeof window !== "undefined" && updatedUser.role) {
                            const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
                            document.cookie = `user_role=${encodeURIComponent(updatedUser.role)}; Path=/; SameSite=Lax${secureFlag}`;
                        }

                        // Ticket 2: "A role change after a token refresh re-evaluates the guards."
                        if (
                            typeof window !== "undefined" &&
                            previousRole &&
                            previousRole !== updatedUser.role
                        ) {
                            const currentPath = window.location.pathname;
                            if (!isRouteAllowedForRole(currentPath, updatedUser.role)) {
                                window.location.href = getRoleHome(updatedUser.role);
                            }
                        }
                    }
                }
            } catch {
                // If me fetch fails, keep active tokens
            }

            return newTokens;
        } catch {
            return null;
        }
    })();

    try {
        const tokens = await activeRefreshPromise;
        if (!tokens) {
            handleSessionRevocation();
            return null;
        }
        return tokens;
    } finally {
        activeRefreshPromise = null;
    }
}

/**
 * On app load: if tokens exist, calls GET /api/v1/auth/me to restore the user.
 * Otherwise the user is treated as logged out.
 */
export async function initializeAuth(): Promise<BackendUser | null> {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
        clearClientSession();
        return null;
    }

    // Refresh to get a fresh in-memory access token
    const tokens = await refreshTokens();
    if (!tokens) {
        clearClientSession();
        return null;
    }

    try {
        const envUrl =
            process.env.NEXT_PUBLIC_API_BASE_URL ||
            process.env.API_BASE_URL ||
            "http://localhost:4000/api/v1";
        const baseUrl = envUrl.replace(/\/+$/, "");

        const res = await fetch(`${baseUrl}/auth/me`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokens.accessToken}`,
            },
        });

        if (!res.ok) {
            clearClientSession();
            return null;
        }

        const json = (await res.json()) as ApiSuccess<BackendUser | { user: BackendUser }>;
        const data = json.data as Record<string, unknown>;
        const user = (data?.user as BackendUser | undefined) ?? (data as unknown as BackendUser);

        if (!user || user.role?.toUpperCase() === "MEMBER") {
            clearClientSession();
            return null;
        }

        inMemoryUser = user;
        return user;
    } catch {
        clearClientSession();
        return null;
    }
}

/**
 * Logout: calls POST /api/v1/auth/logout with { refreshToken } and Bearer token,
 * then clears the local session even if the call fails.
 */
export async function logoutClient(): Promise<void> {
    const refreshToken = getStoredRefreshToken();
    const token = inMemoryAccessToken;

    if (refreshToken) {
        try {
            const envUrl =
                process.env.NEXT_PUBLIC_API_BASE_URL ||
                process.env.API_BASE_URL ||
                "http://localhost:4000/api/v1";
            const baseUrl = envUrl.replace(/\/+$/, "");

            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            await fetch(`${baseUrl}/auth/logout`, {
                method: "POST",
                headers,
                body: JSON.stringify({ refreshToken }),
            });
        } catch (err) {
            console.warn("Backend logout failed, clearing local session anyway:", err);
        }
    }

    clearClientSession();

    // Also call BFF logout route to wipe server cookies
    try {
        await fetch("/api/auth/logout", { method: "POST" });
    } catch { }

    if (typeof window !== "undefined") {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
    }
}
