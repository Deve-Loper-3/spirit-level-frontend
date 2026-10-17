import { NextResponse } from "next/server";
import { BackendError, verifyOtp } from "@/lib/api/backend";
import { setResetToken } from "@/lib/auth/reset";

function isText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: Request) {
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

    // The code is exactly 4 digits (confirmed by the backend developer).
    if (!isText(email) || !isText(otp) || !/^\d{4}$/.test(otp.trim())) {
        return NextResponse.json(
            { message: "Please enter the code from your email." },
            { status: 400 },
        );
    }

    try {
        const { resetToken } = await verifyOtp(email.trim(), otp.trim());

        // The token goes into an HttpOnly cookie. It is NOT in the response body,
        // so the browser's JavaScript never sees it.
        await setResetToken(resetToken);

        return NextResponse.json({ message: "Code verified." }, { status: 200 });
    } catch (error) {
        if (error instanceof BackendError) {
            return NextResponse.json(
                { message: error.message },
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