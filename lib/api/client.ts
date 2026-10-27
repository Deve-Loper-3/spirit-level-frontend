import type { ApiFieldError, ApiSuccess, BackendTokens } from "./types";
import {
    clearClientSession,
    getAccessToken,
    getRefreshToken,
    updateTokens,
} from "@/lib/auth/session";

export class ApiError extends Error {
    status: number;
    code?: string;
    errors?: ApiFieldError[];

    constructor(status: number, message: string, code?: string, errors?: ApiFieldError[]) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.errors = errors;
    }
}

export function getApiBaseUrl(): string {
    const url = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api/v1";
    return url.replace(/\/+$/, "");
}

type RequestOptions = {
    method?: string;
    body?: unknown;
    auth?: boolean;
    skipRefresh?: boolean;
};

let refreshPromise: Promise<BackendTokens | null> | null = null;

function refreshTokens(): Promise<BackendTokens | null> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        const refreshToken = getRefreshToken();
        if (!refreshToken) return null;

        const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return null;

        const json = (await response.json()) as ApiSuccess<{ tokens?: BackendTokens }>;
        const tokens = json.data?.tokens;
        if (!tokens?.accessToken || !tokens.refreshToken) return null;
        updateTokens(tokens);
        return tokens;
    })().finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
}

/** Ends a session that this app will not keep, such as a non-staff login. */
export async function revokeSession(accessToken: string, refreshToken: string): Promise<void> {
    await fetch(`${getApiBaseUrl()}/auth/logout`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
    });
}

/** Calls SL-backend. Auth, rate limits, and password rules live there. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, auth = true, skipRefresh = false } = options;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (auth) {
        const token = getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
        response = await fetch(`${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new ApiError(503, "Network error: backend service unavailable.");
    }

    if (response.status === 401 && auth && !skipRefresh) {
        const tokens = await refreshTokens();
        if (tokens) return api<T>(path, { ...options, skipRefresh: true });
        clearClientSession();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = `/login?message=${encodeURIComponent("Session ended, please sign in again")}`;
        }
        throw new ApiError(401, "Session ended, please sign in again", "SESSION_EXPIRED");
    }

    let json: unknown = null;
    try {
        json = await response.json();
    } catch {
        json = null;
    }

    if (!response.ok) {
        const obj = (typeof json === "object" && json !== null ? json : {}) as {
            message?: string;
            code?: string;
            errors?: ApiFieldError[];
        };
        const message =
            response.status === 429
                ? "Too many requests. Please try again later."
                : obj.message || "Request failed.";
        throw new ApiError(response.status, message, obj.code, obj.errors);
    }

    return (json as ApiSuccess<T>).data;
}
