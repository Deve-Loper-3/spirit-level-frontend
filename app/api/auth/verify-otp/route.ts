import { NextResponse } from "next/server";
import { BackendError, verifyOtp } from "@/lib/api/backend";
import { setResetToken } from "@/lib/auth/reset";
import { isText } from "@/lib/validation/request";
import {
    checkRateLimit,
    getClientIp,
    isOtpLocked,
    recordOtpFailure,
    resetOtpFailures,
    rateLimitResponse,
} from "@/lib/security/rateLimit";

export async function POST(request: Request) {
    const clientIp = getClientIp(request);
    const ipCheck = checkRateLimit(`verify-otp:${clientIp}`, 50, 10 * 60);
    if (!ipCheck.allowed) {
        return rateLimitResponse(ipCheck.retryAfterSeconds);
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { message: "Invalid request body." },
            { status: 400 },
        );
    }
    if (typeof body !== "object" || body === null) {
        return NextResponse.json(
            { message: "Invalid request body." },
            { status: 400 },
        );
    }

    const { email, otp } = body;

    if (!isText(email) || !isText(otp) || !/^\d{4}$/.test(otp.trim())) {
        return NextResponse.json(
            { message: "Please enter the 4-digit code from your email." },
            { status: 400 },
        );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    // Check if account is locked due to too many failed OTP attempts
    const lockStatus = isOtpLocked(cleanEmail);
    if (lockStatus.locked) {
        return rateLimitResponse(
            lockStatus.retryAfterSeconds,
            `Too many failed attempts. Account verification is locked. Please request a new code.`,
        );
    }

    try {
        const { resetToken } = await verifyOtp(cleanEmail, cleanOtp);

        // Reset failure counter upon successful validation
        resetOtpFailures(cleanEmail);

        // Set HttpOnly reset cookie
        await setResetToken(resetToken);

        return NextResponse.json({ message: "Code verified." }, { status: 200 });
    } catch (error) {
        if (error instanceof BackendError) {
            // Respect backend rate-limiting if the backend returned 429
            if (error.status === 429) {
                return rateLimitResponse(
                    60,
                    error.message || "Too many attempts. Please try again later.",
                );
            }

            const failStatus = recordOtpFailure(cleanEmail);
            if (failStatus.locked) {
                return rateLimitResponse(
                    failStatus.retryAfterSeconds,
                    "Too many incorrect attempts. Account verification is locked. Please request a new code.",
                );
            }

            const attemptsText =
                failStatus.remainingAttempts === 1
                    ? "1 attempt remaining"
                    : `${failStatus.remainingAttempts} attempts remaining`;

            const baseMessage =
                error.message && !error.message.toLowerCase().includes("too many attempts")
                    ? error.message
                    : "Invalid verification code. Please try again.";

            return NextResponse.json(
                {
                    message: `${baseMessage} (${attemptsText})`,
                    remainingAttempts: failStatus.remainingAttempts,
                },
                { status: error.status },
            );
        }

        // Log the problem, never the code or the token.
        console.error("Verify-OTP route failed:", error);
        return NextResponse.json(
            { message: "Something went wrong. Please try again." },
            { status: 500 },
        );
    }
}