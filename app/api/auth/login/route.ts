import { NextResponse } from "next/server";
import { BackendError, loginUser } from "@/lib/api/backend";
import { setSession } from "@/lib/auth/session";
import { isText } from "@/lib/validation/request";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rateLimit";

export async function POST(request: Request) {
    // 0. Rate limiting: 30 login attempts per 15 minutes per IP
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(`login:${clientIp}`, 30, 15 * 60);
    if (!rateCheck.allowed) {
        return rateLimitResponse(rateCheck.retryAfterSeconds);
    }

    // 1. Parse and sanity-check the request JSON
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

    // 2. Read only the fields we expect
    const { email, password, remember } = body;

    if (!isText(email) || !isText(password)) {
        return NextResponse.json(
            { message: "Please enter your email and password." },
            { status: 400 },
        );
    }

    // Secondary rate limiting per email target
    const emailKey = `login:email:${email.trim().toLowerCase()}`;
    const emailRateCheck = checkRateLimit(emailKey, 10, 15 * 60);
    if (!emailRateCheck.allowed) {
        return rateLimitResponse(emailRateCheck.retryAfterSeconds);
    }

    // 3. Authenticate with backend and configure session cookies
    try {
        const { user, tokens } = await loginUser({
            email: email.trim(),
            password,
        });

        // Ticket 2: "A MEMBER login is refused with 'This portal is for staff', and the session is cleared."
        if (user.role?.toUpperCase() === "MEMBER") {
            const { clearSession } = await import("@/lib/auth/session");
            await clearSession();
            return NextResponse.json(
                {
                    message: "This portal is for staff",
                    code: "FORBIDDEN_ROLE",
                },
                { status: 403 },
            );
        }

        // Store tokens and role securely in HttpOnly cookies
        await setSession(tokens, remember === true, user.role);

        // Return user and tokens per Ticket 3
        return NextResponse.json(
            {
                user,
                tokens,
            },
            { status: 200 },
        );
    } catch (error) {
        if (error instanceof BackendError) {
            return NextResponse.json(
                {
                    message: error.message,
                    code: error.code,
                    errors: error.errors,
                },
                { status: error.status },
            );
        }
        console.error("Login route failed:", error);
        return NextResponse.json(
            { message: "Something went wrong. Please try again." },
            { status: 500 },
        );
    }
}