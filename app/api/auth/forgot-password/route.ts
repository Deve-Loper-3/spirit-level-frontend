import { NextResponse } from "next/server";
import { BackendError, requestPasswordReset } from "@/lib/api/backend";
import { isText } from "@/lib/validation/request";
import { checkRateLimit, getClientIp, rateLimitResponse, resetOtpFailures } from "@/lib/security/rateLimit";

const NEUTRAL_MESSAGE = "If the email is registered, an OTP has been sent to it.";

export async function POST(request: Request) {
    // 0. IP rate limiting: 5 OTP requests per 15 minutes
    const clientIp = getClientIp(request);
    const ipCheck = checkRateLimit(`forgot-ip:${clientIp}`, 5, 15 * 60);
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

    const { email } = body;
    if (!isText(email)) {
        return NextResponse.json(
            { message: "Please enter your email." },
            { status: 400 },
        );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Secondary email-targeted rate limiting: 3 per 15 minutes
    const emailCheck = checkRateLimit(`forgot-email:${cleanEmail}`, 3, 15 * 60);
    if (!emailCheck.allowed) {
        return rateLimitResponse(emailCheck.retryAfterSeconds);
    }

    try {
        await requestPasswordReset(cleanEmail);
        resetOtpFailures(cleanEmail);
        return NextResponse.json({ message: NEUTRAL_MESSAGE }, { status: 200 });
    } catch (error) {
        if (error instanceof BackendError) {
            // Conceal 404 to avoid email enumeration
            if (error.status === 404) {
                return NextResponse.json({ message: NEUTRAL_MESSAGE }, { status: 200 });
            }
            return NextResponse.json(
                { message: error.message },
                { status: error.status },
            );
        }
        console.error("Forgot-password route failed:", error);
        return NextResponse.json(
            { message: "Something went wrong. Please try again." },
            { status: 500 },
        );
    }
}