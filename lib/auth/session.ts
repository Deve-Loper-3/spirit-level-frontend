import type { BackendTokens, BackendUser } from "@/lib/api/types";

const REFRESH_KEY = "sl_refresh";
const RESET_KEY = "sl_reset";
export const ROLE_COOKIE = "user_role";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
    return accessToken;
}

export function getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY);
}

function rememberRefresh(): boolean {
    return typeof window !== "undefined" && localStorage.getItem(REFRESH_KEY) !== null;
}

function writeRoleCookie(role: string, persistent: boolean) {
    const maxAge = persistent ? `; Max-Age=${30 * 24 * 60 * 60}` : "";
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ROLE_COOKIE}=${encodeURIComponent(role)}; Path=/; SameSite=Lax${maxAge}${secure}`;
}

export function clearRoleCookie() {
    if (typeof window === "undefined") return;
    document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Access token stays in memory. Refresh token is localStorage only when "keep me signed in" is on. */
export function saveSession(tokens: BackendTokens, user: BackendUser, remember: boolean) {
    accessToken = tokens.accessToken;
    localStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    const store = remember ? localStorage : sessionStorage;
    store.setItem(REFRESH_KEY, tokens.refreshToken);
    writeRoleCookie(user.role, remember);
}

export function updateTokens(tokens: BackendTokens) {
    accessToken = tokens.accessToken;
    const persistent = rememberRefresh();
    localStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    const store = persistent ? localStorage : sessionStorage;
    store.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearClientSession() {
    accessToken = null;
    if (typeof window === "undefined") return;
    localStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    clearRoleCookie();
}

export type PasswordReset = { email: string; resetToken: string };

export function saveReset(reset: PasswordReset) {
    sessionStorage.setItem(RESET_KEY, JSON.stringify(reset));
}

export function readReset(): PasswordReset | null {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(RESET_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as PasswordReset;
        if (!parsed.email || !parsed.resetToken) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function clearReset() {
    sessionStorage.removeItem(RESET_KEY);
}
