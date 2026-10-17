import "server-only";

import type { ApiSucces, BackendRegisterRequest, BackendUser, BackendLoginRequest, BackendLoginData, BackendVerifyOtpData } from "./types"

export class BackendError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.name = "BackendError";
    }
}

const BASE_URL = process.env.API_BASE_URL;

function extractMessage(json: unknown, fallback: string) {
    if (typeof json === "object" && json !== null && "message" in json) {
        const message = (json as { message: unknown }).message;
        if (typeof message === "string") return message;

    }
    return fallback
}

async function backendPost<T>(path: string, body: unknown): Promise<ApiSucces<T>> {
    if (!BASE_URL) {
        throw new Error("BASE_URL is not defined");
    }

    let response: Response;
    try {
        response = await fetch(`${BASE_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10_000),
        });
    } catch {
        throw new BackendError(503, "Network error");
    }

    let json: unknown = null;
    try {
        json = await response.json();
    } catch { }

    if (!response.ok) {
        console.error(`Backend ${response.status} for POST ${BASE_URL}${path}`);
        if (response.status >= 500) {
            throw new BackendError(503, "The Server had a Problem")
        }
        throw new BackendError(
            response.status,
            extractMessage(json, "Request Failed")
        )
    }

    return json as ApiSucces<T>;
}

export async function registerUser(payload: BackendRegisterRequest): Promise<BackendUser> {
    const result = await backendPost<BackendUser>("/auth/register", payload);
    return result.data;
}

export async function loginUser(payload: BackendLoginRequest): Promise<BackendLoginData> {
    const result = await backendPost<BackendLoginData>("/auth/login", payload);
    return result.data;
}

// data is null on success, so there's nothing to return.
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

    // Guard against our assumption being wrong: if the backend sends no token,
    // fail loudly here instead of storing "undefined" in a cookie.
    if (!result.data?.resetToken) {
        throw new Error("verify-otp response had no resetToken");
    }
    return result.data;
}

export async function resetPassword(
    resetToken: string,
    newPassword: string,
): Promise<void> {
    await backendPost<null>("/auth/reset-password", { resetToken, newPassword });
}
