import "server-only"
import { cookies } from "next/headers"
import type { BackendTokens } from "@/lib/api/types"

export const ACCESS_COOKIE = "access_token"
export const REFRESH_COOKIE = "refresh_token"

function toSeconds(duration: string, fallback = 15 * 60) {
    const match = /^(\d+)\s*([smhd])$/.exec(duration.trim());
    if (!match) return fallback;
    const units = { s: 1, m: 60, h: 3600, d: 86400 } as const;
    return Number(match[1]) * units[match[2] as keyof typeof units]
}

const baseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
};

export async function setSession(tokens: BackendTokens, remember: boolean) {
    const store = await cookies();

    store.set(ACCESS_COOKIE, tokens.accessToken, {
        ...baseOptions, path: "/", maxAge: toSeconds(tokens.accessTokenExpiresIn)
    });

    const refreshExpires = new Date(tokens.refreshTokenExpiresIn);
    const hasValidExpiry = !Number.isNaN(refreshExpires.getTime());

    store.set(REFRESH_COOKIE, tokens.refreshToken, {
        ...baseOptions,
        path: "/api/auth",
        ...(remember && hasValidExpiry ? { expires: refreshExpires } : {})
    });
}

export async function getSession(): Promise<string | null> {
    const store = await cookies();
    return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function clearSession(): Promise<void> {
    const store = await cookies();
    store.set(ACCESS_COOKIE, "", { ...baseOptions, path: "/", maxAge: 0 });
    store.set(REFRESH_COOKIE, "", { ...baseOptions, path: "/api/auth", maxAge: 0 });
    store.delete(ACCESS_COOKIE);
    store.delete(REFRESH_COOKIE);
}