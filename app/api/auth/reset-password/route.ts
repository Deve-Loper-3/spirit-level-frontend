import { NextResponse } from "next/server";
import { BackendError, resetPassword } from "@/lib/api/backend";
import { clearResetToken, getResetToken } from "@/lib/auth/reset";
import { passwordProblem } from "@/lib/validation/password";
import { isText } from "@/lib/validation/request";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rateLimit";

export async function POST(request: Request) {
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(`reset-pwd:${clientIp}`, 10, 15 * 60);
    if (!rateCheck.allowed) {
        return rateLimitResponse(rateCheck.retryAfterSeconds);
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

    const { newPassword } = body;
    if (!isText(newPassword)) {
        return NextResponse.json(
            { message: "Please enter a new password." },
            { status: 400 },
        );
    }

    const problem = passwordProblem(newPassword);
    if (problem) {
        return NextResponse.json({ message: problem }, { status: 400 });
    }

    const token = await getResetToken();
    if (!token) {
        return NextResponse.json(
            { message: "Your reset session has expired. Please request a new code." },
            { status: 401 },
        );
    }

    try {
        await resetPassword(token, newPassword);
        await clearResetToken();
        return NextResponse.json({ message: "Password updated successfully." }, { status: 200 });
    } catch (error) {
        if (error instanceof BackendError) {
            // Expired or invalid reset token is unrecoverable, clear the cookie
            if (error.status === 401) {
                await clearResetToken();
            }
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