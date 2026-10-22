import { NextResponse } from "next/server";

interface RateLimitRecord {
    count: number;
    resetTime: number;
}

interface OtpFailureRecord {
    failures: number;
    lockUntil: number;
}

// Persist in-memory stores on globalThis to survive Next.js module reloads in development
const globalStore = globalThis as unknown as {
    __rateLimitStore?: Map<string, RateLimitRecord>;
    __otpFailuresStore?: Map<string, OtpFailureRecord>;
    __rateLimitCleanupInterval?: NodeJS.Timeout;
};

if (!globalStore.__rateLimitStore) {
    globalStore.__rateLimitStore = new Map<string, RateLimitRecord>();
}
if (!globalStore.__otpFailuresStore) {
    globalStore.__otpFailuresStore = new Map<string, OtpFailureRecord>();
}

const rateLimitStore = globalStore.__rateLimitStore;
const otpFailuresStore = globalStore.__otpFailuresStore;

// Periodic cleanup every 5 minutes to avoid memory accumulation
if (!globalStore.__rateLimitCleanupInterval && typeof setInterval !== "undefined") {
    globalStore.__rateLimitCleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of rateLimitStore.entries()) {
            if (now > record.resetTime) {
                rateLimitStore.delete(key);
            }
        }
        for (const [key, record] of otpFailuresStore.entries()) {
            if (now > record.lockUntil) {
                otpFailuresStore.delete(key);
            }
        }
    }, 5 * 60 * 1000);
}

/**
 * Extracts a client IP from request headers or falls back to standard identifier.
 */
export function getClientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
        return realIp.trim();
    }
    return "127.0.0.1";
}

/**
 * Generic sliding rate-limiter for API endpoints.
 */
export function checkRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number,
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const existing = rateLimitStore.get(key);

    if (!existing || now > existing.resetTime) {
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + windowMs,
        });
        return {
            allowed: true,
            remaining: maxRequests - 1,
            retryAfterSeconds: windowSeconds,
        };
    }

    if (existing.count >= maxRequests) {
        const retryAfterSeconds = Math.max(
            1,
            Math.ceil((existing.resetTime - now) / 1000),
        );
        return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds,
        };
    }

    existing.count += 1;
    return {
        allowed: true,
        remaining: maxRequests - existing.count,
        retryAfterSeconds: Math.max(
            1,
            Math.ceil((existing.resetTime - now) / 1000),
        ),
    };
}

/**
 * Handles OTP brute force protection.
 * Allows at most maxFailures attempts before locking the email for lockDurationSeconds.
 */
export function recordOtpFailure(
    email: string,
    maxFailures = 5,
    lockDurationSeconds = 10 * 60,
): { locked: boolean; remainingAttempts: number; retryAfterSeconds: number } {
    const now = Date.now();
    const key = `otp-fail:${email.toLowerCase().trim()}`;
    const record = otpFailuresStore.get(key);

    // If currently locked
    if (record && record.lockUntil > 0) {
        if (now < record.lockUntil) {
            const retryAfterSeconds = Math.max(
                1,
                Math.ceil((record.lockUntil - now) / 1000),
            );
            return { locked: true, remainingAttempts: 0, retryAfterSeconds };
        }
        // Lock has expired; reset failures
        otpFailuresStore.delete(key);
    }

    const previousFailures = otpFailuresStore.get(key)?.failures ?? 0;
    const currentFailures = previousFailures + 1;

    if (currentFailures >= maxFailures) {
        const lockUntil = now + lockDurationSeconds * 1000;
        otpFailuresStore.set(key, { failures: currentFailures, lockUntil });
        return {
            locked: true,
            remainingAttempts: 0,
            retryAfterSeconds: lockDurationSeconds,
        };
    }

    otpFailuresStore.set(key, { failures: currentFailures, lockUntil: 0 });
    return {
        locked: false,
        remainingAttempts: maxFailures - currentFailures,
        retryAfterSeconds: 0,
    };
}

export function isOtpLocked(email: string): { locked: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const key = `otp-fail:${email.toLowerCase().trim()}`;
    const record = otpFailuresStore.get(key);

    if (record && record.lockUntil > 0) {
        if (now < record.lockUntil) {
            return {
                locked: true,
                retryAfterSeconds: Math.max(1, Math.ceil((record.lockUntil - now) / 1000)),
            };
        }
        // Lock expired
        otpFailuresStore.delete(key);
    }

    return { locked: false, retryAfterSeconds: 0 };
}

export function resetOtpFailures(email: string): void {
    const key = `otp-fail:${email.toLowerCase().trim()}`;
    otpFailuresStore.delete(key);
}

/**
 * Helper to produce uniform 429 responses.
 */
export function rateLimitResponse(retryAfterSeconds: number, message?: string) {
    return NextResponse.json(
        {
            message:
                message ??
                `Too many requests. Please try again in ${retryAfterSeconds} seconds.`,
            retryAfter: retryAfterSeconds,
            remainingAttempts: 0,
        },
        {
            status: 429,
            headers: {
                "Retry-After": String(retryAfterSeconds),
            },
        },
    );
}
