import { NextResponse } from "next/server";
import { logoutSession } from "@/lib/auth/session";

/**
 * Logs out the active user and clears authentication cookies.
 * Ticket 1: "Logout calls POST /api/v1/auth/logout with { refreshToken } and a Bearer token, then clears the local session even if the call fails."
 * POST-only to prevent cross-site navigation logout attacks (CSRF).
 */
export async function POST() {
    await logoutSession();
    return NextResponse.json({ message: "Logged out successfully." }, { status: 200 });
}
