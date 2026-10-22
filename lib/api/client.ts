import type { ApiFieldError, ApiSuccess } from "./types";
import {
    getAccessToken,
    refreshTokens,
    handleSessionRevocation,
} from "@/lib/auth/authClient";

export class ApiClientError extends Error {
    status: number;
    code?: string;
    errors?: ApiFieldError[];

    constructor(
        status: number,
        message: string,
        code?: string,
        errors?: ApiFieldError[],
    ) {
        super(message);
        this.status = status;
        this.code = code;
        this.errors = errors;
        this.name = "ApiClientError";
    }
}

/**
 * Resolves the base URL for API calls from environment variables.
 * Fallback to /api/v1 for proxying or local relative endpoints.
 */
export function getApiBaseUrl(): string {
    const envUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.API_BASE_URL ||
        "http://localhost:4000/api/v1";
    return envUrl.replace(/\/+$/, "");
}

interface ApiRequestOptions extends RequestInit {
    requiresAuth?: boolean;
    skipRefresh?: boolean;
}

/**
 * Shared API Client
 * - Prepends environment API base URL
 * - Adds Authorization: Bearer <accessToken>
 * - Parses { success, message, data } and { success: false, message, code, errors: [{ field, message }] }
 * - Handles 429 with a "try again later" message
 * - On 401 TOKEN_EXPIRED or INVALID_TOKEN: triggers token refresh mutex and retries once
 * - If refresh fails or revoked token detected: redirects to /login with "Session ended, please sign in again"
 */
export async function apiFetch<T>(
    endpoint: string,
    options: ApiRequestOptions = {},
): Promise<ApiSuccess<T>> {
    const { requiresAuth = true, skipRefresh = false, headers: customHeaders, ...restOptions } = options;
    const baseUrl = getApiBaseUrl();
    const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

    const headers = new Headers(customHeaders);
    if (!headers.has("Content-Type") && !(restOptions.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    if (requiresAuth) {
        const token = getAccessToken();
        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
    }

    let response: Response;
    try {
        response = await fetch(url, {
            ...restOptions,
            headers,
        });
    } catch {
        throw new ApiClientError(503, "Network error: backend service unavailable.");
    }

    // 429 Handling
    if (response.status === 429) {
        throw new ApiClientError(429, "Too many requests. Please try again later.", "RATE_LIMITED");
    }

    let json: unknown = null;
    try {
        json = await response.json();
    } catch { }

    // On 401 Unauthorized: check for token expiration/invalidity
    if (response.status === 401 && !skipRefresh && requiresAuth) {
        const rawCode = typeof json === "object" && json !== null ? (json as { code?: string }).code : undefined;
        const isTokenIssue = !rawCode || rawCode === "TOKEN_EXPIRED" || rawCode === "INVALID_TOKEN";

        if (isTokenIssue) {
            // Wait on the shared refresh mutex
            const refreshedTokens = await refreshTokens();
            if (refreshedTokens) {
                // Retry the original request once with new token
                return apiFetch<T>(endpoint, {
                    ...options,
                    skipRefresh: true, // prevents infinite refresh loops
                });
            } else {
                // Refresh failed or revoked token
                handleSessionRevocation();
                throw new ApiClientError(
                    401,
                    "Session ended, please sign in again",
                    "SESSION_EXPIRED",
                );
            }
        }
    }

    if (!response.ok) {
        let message = "Request failed.";
        let code: string | undefined;
        let errors: ApiFieldError[] | undefined;

        if (typeof json === "object" && json !== null) {
            const errorObj = json as Record<string, unknown>;
            if (typeof errorObj.message === "string" && errorObj.message.trim().length > 0) {
                message = errorObj.message;
            }
            if (typeof errorObj.code === "string") {
                code = errorObj.code;
            }
            if (Array.isArray(errorObj.errors)) {
                errors = errorObj.errors.filter(
                    (e): e is ApiFieldError =>
                        typeof e === "object" &&
                        e !== null &&
                        typeof e.field === "string" &&
                        typeof e.message === "string",
                );
            }
        }

        if (response.status >= 500) {
            message = "The server encountered an issue. Please try again later.";
        }

        throw new ApiClientError(response.status, message, code, errors);
    }

    return json as ApiSuccess<T>;
}

export const apiClient = {
    get: <T>(url: string, options?: ApiRequestOptions) =>
        apiFetch<T>(url, { ...options, method: "GET" }),
    post: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
        apiFetch<T>(url, {
            ...options,
            method: "POST",
            body: body !== undefined ? JSON.stringify(body) : undefined,
        }),
    put: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
        apiFetch<T>(url, {
            ...options,
            method: "PUT",
            body: body !== undefined ? JSON.stringify(body) : undefined,
        }),
    delete: <T>(url: string, options?: ApiRequestOptions) =>
        apiFetch<T>(url, { ...options, method: "DELETE" }),
};
