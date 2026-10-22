import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/auth/session";

export async function POST() {
    const refreshed = await refreshSession();
    if (!refreshed) {
        return NextResponse.json(
            { message: "Session expired or invalid refresh token." },
            { status: 401 },
        );
    }

    return NextResponse.json(
        { message: "Session refreshed successfully." },
        { status: 200 },
    );
}
