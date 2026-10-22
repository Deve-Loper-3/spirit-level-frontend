import "server-only";

import type {
    ApiSuccess,
    ApiFieldError,
    BackendRegisterRequest,
    BackendUser,
    BackendLoginRequest,
    BackendLoginData,
    BackendVerifyOtpData,
    BackendTokens,
    BackendRefreshData,
} from "./types";

export class BackendError extends Error {
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
        this.name = "BackendError";
    }
}

function getBaseUrl(): string {
    const baseUrl = process.env.API_BASE_URL;
    if (!baseUrl) {
        throw new Error(
            "API_BASE_URL is not defined in the environment. Please check your .env or .env.local file (refer to .env.example).",
        );
    }
    return baseUrl.replace(/\/+$/, "");
}

function extractErrorInfo(json: unknown, fallbackMessage: string, status: number): {
    message: string;
    code?: string;
    errors?: ApiFieldError[];
} {
    let message = fallbackMessage;
    let code: string | undefined;
    let errors: ApiFieldError[] | undefined;

    if (typeof json === "object" && json !== null) {
        const obj = json as Record<string, unknown>;
        if (typeof obj.message === "string" && obj.message.trim().length > 0) {
            message = obj.message;
        }
        if (typeof obj.code === "string") {
            code = obj.code;
        }
        if (Array.isArray(obj.errors)) {
            errors = obj.errors.filter(
                (err): err is ApiFieldError =>
                    typeof err === "object" &&
                    err !== null &&
                    typeof err.field === "string" &&
                    typeof err.message === "string",
            );
        }
    }

    if (status === 429) {
        message = "Too many requests. Please try again later.";
    }

    return { message, code, errors };
}

async function backendPost<T>(path: string, body: unknown, token?: string): Promise<ApiSuccess<T>> {
    const baseUrl = getBaseUrl();

    let response: Response;
    try {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        response = await fetch(`${baseUrl}${path}`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10_000),
        });
    } catch {
        throw new BackendError(503, "Network error: backend service unavailable.");
    }

    let json: unknown = null;
    try {
        json = await response.json();
    } catch { }

    if (!response.ok) {
        console.error(`Backend ${response.status} for POST ${baseUrl}${path}`);
        if (response.status >= 500) {
            throw new BackendError(503, "The server encountered an issue. Please try again later.");
        }
        const errInfo = extractErrorInfo(json, "Request failed.", response.status);
        throw new BackendError(
            response.status,
            errInfo.message,
            errInfo.code,
            errInfo.errors,
        );
    }

    return json as ApiSuccess<T>;
}

async function backendGet<T>(path: string, token?: string): Promise<ApiSuccess<T>> {
    const baseUrl = getBaseUrl();

    let response: Response;
    try {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        response = await fetch(`${baseUrl}${path}`, {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(10_000),
        });
    } catch {
        throw new BackendError(503, "Network error: backend service unavailable.");
    }

    let json: unknown = null;
    try {
        json = await response.json();
    } catch { }

    if (!response.ok) {
        console.error(`Backend ${response.status} for GET ${baseUrl}${path}`);
        if (response.status >= 500) {
            throw new BackendError(503, "The server encountered an issue. Please try again later.");
        }
        const errInfo = extractErrorInfo(json, "Request failed.", response.status);
        throw new BackendError(
            response.status,
            errInfo.message,
            errInfo.code,
            errInfo.errors,
        );
    }

    return json as ApiSuccess<T>;
}

export async function registerUser(payload: BackendRegisterRequest): Promise<BackendUser> {
    const result = await backendPost<BackendUser>("/auth/register", payload);
    return result.data;
}

export async function loginUser(payload: BackendLoginRequest): Promise<BackendLoginData> {
    const result = await backendPost<BackendLoginData>("/auth/login", payload);
    return result.data;
}

/**
 * Refreshes an expired access token using the stored refresh token.
 * POST /api/v1/auth/refresh
 */
export async function refreshAccessToken(refreshToken: string): Promise<BackendTokens> {
    const result = await backendPost<BackendRefreshData>("/auth/refresh", {
        refreshToken,
    });

    const data = result.data as Record<string, unknown>;
    const nestedTokens = (data?.tokens as BackendTokens | undefined) ?? (data as unknown as BackendTokens);

    if (!nestedTokens || typeof nestedTokens.accessToken !== "string") {
        throw new BackendError(500, "Invalid token refresh payload received from backend.");
    }

    const expiry =
        nestedTokens.refreshTokenExpiresIn ??
        nestedTokens.refreshTokenExpiresAt ??
        "30d";

    return {
        accessToken: nestedTokens.accessToken,
        accessTokenExpiresIn: nestedTokens.accessTokenExpiresIn ?? "15m",
        refreshToken: nestedTokens.refreshToken ?? refreshToken,
        refreshTokenExpiresIn: expiry,
        refreshTokenExpiresAt: nestedTokens.refreshTokenExpiresAt,
    };
}

/**
 * Validates the current session access token by fetching the authenticated profile.
 * GET /api/v1/auth/me
 */
export async function getMe(accessToken: string): Promise<BackendUser> {
    const result = await backendGet<BackendUser | { user: BackendUser }>("/auth/me", accessToken);
    const data = result.data as Record<string, unknown>;
    const user = (data?.user as BackendUser | undefined) ?? (data as unknown as BackendUser);

    if (!user || typeof user.email !== "string") {
        throw new BackendError(500, "Invalid user profile received from backend.");
    }

    return user;
}

export async function requestPasswordReset(email: string): Promise<void> {
    await backendPost<null>("/auth/forgot-password", { email });
}

export async function verifyOtp(
    email: string,
    otp: string,
): Promise<BackendVerifyOtpData> {
    const result = await backendPost<BackendVerifyOtpData>("/auth/verify-otp", {
        email,
        otp,
    });

    if (!result.data?.resetToken) {
        throw new BackendError(500, "Verification succeeded but no reset token was returned.");
    }
    return result.data;
}

export async function resetPassword(
    resetToken: string,
    newPassword: string,
): Promise<void> {
    await backendPost<null>("/auth/reset-password", { resetToken, newPassword });
}

/**
 * Calls POST /api/v1/auth/logout with { refreshToken } and Bearer token.
 * Ticket 1: "Logout calls POST /api/v1/auth/logout with { refreshToken } and a Bearer token, then clears the local session even if the call fails."
 */
export async function logoutUser(
    refreshToken: string,
    accessToken?: string,
): Promise<void> {
    try {
        await backendPost<null>("/auth/logout", { refreshToken }, accessToken);
    } catch (error) {
        console.warn("Backend logout request failed (continuing to clear session):", error);
    }
}
