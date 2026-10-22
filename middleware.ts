import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRoleHome, isRouteAllowedForRole } from "@/lib/auth/roles";

export function middleware(request: NextRequest) {
    const accessToken = request.cookies.get("access_token")?.value;
    const refreshToken = request.cookies.get("refresh_token")?.value;
    const resetToken = request.cookies.get("reset_token")?.value;
    const userRole = request.cookies.get("user_role")?.value;
    const { pathname, search } = request.nextUrl;

    const hasAnySession = Boolean(accessToken || refreshToken);

    // 1. Refuse MEMBER access to the staff portal
    // Ticket 2: "A MEMBER login is refused with 'This portal is for staff', and the session is cleared."
    if (userRole?.toUpperCase() === "MEMBER") {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "member_refused");
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete("access_token");
        response.cookies.delete("refresh_token");
        response.cookies.delete("remember_me");
        response.cookies.delete("user_role");
        return response;
    }

    // 2. Allow 403 page for users to view access denial feedback
    if (pathname === "/403") {
        return NextResponse.next();
    }

    // 3. Guest-only routes: /login and /signup
    // Ticket 2: "An authenticated user who opens /login or /signup is redirected to their home."
    if (pathname === "/login" || pathname === "/signup") {
        if (hasAnySession) {
            const homePath = getRoleHome(userRole);
            return NextResponse.redirect(new URL(homePath, request.url));
        }
        return NextResponse.next();
    }

    // 4. Reset password route: requires active reset_token from OTP verification
    if (pathname === "/reset-password") {
        if (!resetToken) {
            const loginUrl = new URL("/login", request.url);
            return NextResponse.redirect(loginUrl);
        }
        return NextResponse.next();
    }

    // 5. Protected routes
    // Ticket 2: "Public routes: /login and /signup. Everything else needs a session."
    // Ticket 2: "An unauthenticated user is sent to /login?returnUrl=…. After login they return to the saved URL if their role is allowed there."
    if (!hasAnySession) {
        const loginUrl = new URL("/login", request.url);
        const returnTarget = pathname + (search || "");
        loginUrl.searchParams.set("returnUrl", returnTarget);
        return NextResponse.redirect(loginUrl);
    }

    // 6. Role-based route access check
    // Ticket 2: "Role-based route access: a user hitting a screen outside their role sees a 403 page, not a blank screen."
    if (!isRouteAllowedForRole(pathname, userRole)) {
        const forbiddenUrl = new URL("/403", request.url);
        return NextResponse.rewrite(forbiddenUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public static images/assets (.png, .jpg, .svg, etc.)
         * - api routes (/api/:path*)
         */
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
