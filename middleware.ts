import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const accessToken = request.cookies.get("access_token")?.value;
    const { pathname } = request.nextUrl;

    // Protect /console routes: require valid access token
    if (pathname.startsWith("/console")) {
        if (!accessToken) {
            const loginUrl = new URL("/login", request.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    // If authenticated user visits login or signup, redirect directly to console
    if (pathname === "/login" || pathname === "/signup") {
        if (accessToken) {
            const consoleUrl = new URL("/console", request.url);
            return NextResponse.redirect(consoleUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/console/:path*", "/login", "/signup"],
};
