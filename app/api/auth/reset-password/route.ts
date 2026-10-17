import { NextResponse } from "next/server";
import { BackendError, resetPassword } from "@/lib/api/backend";
import { clearResetToken, getResetToken } from "@/lib/auth/reset";
import { passwordProblem } from "@/lib/validation/password";

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

    // Only newPassword is read. The "confirm" field is a typo guard for the user and
    // never leaves the browser.
    const { newPassword } = body;
    if (!isText(newPassword)) {
        return NextResponse.json(
            { message: "Please enter a new password." },
            { status: 400 },
        );
    }

    // Anyone can call this URL directly and skip the form, so we check again here.
    const problem = passwordProblem(newPassword);
    if (problem) {
        return NextResponse.json({ message: problem }, { status: 400 });
    }

    // The proof that the OTP step succeeded. No cookie means no permission.
    const token = await getResetToken();
    if (!token) {
        return NextResponse.json(
            { message: "Your reset session has expired. Please request a new code." },
            { status: 401 },
        );
    }

    try {
        await resetPassword(token, newPassword); // never trim or log a password
        await clearResetToken(); // the token is single-use, so remove it now
        return NextResponse.json({ message: "Password updated." }, { status: 200 });
    } catch (error) {
        if (error instanceof BackendError) {
            // ASSUMPTION: the backend answers 401 for an invalid or expired token.
            // That token is dead, so drop the cookie too.
            if (error.status === 401) await clearResetToken();
            return NextResponse.json(
                { message: error.message },
                { status: error.status },
            );
        }
        console.error("Reset-password route failed:", error);
        return NextResponse.json(
            { message: "Something went wrong. Please try again." },
            { status: 500 },
        );
    }
}