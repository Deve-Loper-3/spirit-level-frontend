import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function POST() {
    await clearSession();
    return NextResponse.json({ message: "Logged out successfully." }, { status: 200 });
}

export async function GET(request: Request) {
    await clearSession();
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
}
