import { NextResponse } from "next/server";
import { BackendError, requestPasswordReset } from "@/lib/api/backend";

function isText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

// One fixed message for every "request accepted" outcome. The browser never learns
// whether the account exists.
const NEUTRAL_MESSAGE = "If the email is registered, an OTP has been sent to it.";

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

    const { email } = body;
    if (!isText(email)) {
        return NextResponse.json(
            { message: "Please enter your email." },
            { status: 400 },
        );
    }

    try {
        await requestPasswordReset(email.trim());
        return NextResponse.json({ message: NEUTRAL_MESSAGE }, { status: 200 });
    } catch (error) {
        if (error instanceof BackendError) {
            // ASSUMPTION: if the real backend ever answers 404 for an unknown email, we hide
            // it, so this endpoint can never be used to discover registered emails.
            if (error.status === 404) {
                return NextResponse.json({ message: NEUTRAL_MESSAGE }, { status: 200 });
            }
            // Validation (400), too many requests (429) and so on: pass the message through.
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