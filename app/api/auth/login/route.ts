import { NextResponse } from "next/server";
import { BackendError, loginUser } from "@/lib/api/backend";
import { setSession } from "@/lib/auth/session";

function isText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: Request) {
    // 1. Parse and sanity-check the browser's JSON.
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

    // 2. Read only the fields we expect.
    const { email, password, remember } = body;

    if (!isText(email) || !isText(password)) {
        return NextResponse.json(
            { message: "Please enter your email and password." },
            { status: 400 },
        );
    }

    // 3. Call the backend, store the tokens in cookies, and reply with almost nothing.
    try {
        const { user, tokens } = await loginUser({
            email: email.trim(),
            password, // never trim or log a password
        });

        // `remember === true` is strict: only a real boolean true counts.
        await setSession(tokens, remember === true);

        // The tokens never go into this response body. The browser doesn't need them,
        // and its JavaScript must never see them. Send back only a small display profile.
        return NextResponse.json(
            { user: { fullName: user.fullName, role: user.role } },
            { status: 200 },
        );
    } catch (error) {
        if (error instanceof BackendError) {
            // Wrong password (401), pending account (403, in the mock) and so on:
            // the backend's message is meant for people, so pass it on with its status.
            return NextResponse.json(
                { message: error.message },
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