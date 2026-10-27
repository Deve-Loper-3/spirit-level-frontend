import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRoleHome, isRouteAllowedForRole, isStaffRole } from "@/lib/auth/roles";

/**
 * UI gate only. The cookie is the signed-in role for redirects.
 * SL-backend is what accepts or rejects the access token.
 */
export function proxy(request: NextRequest) {
    const role = request.cookies.get("user_role")?.value;
    const { pathname, search } = request.nextUrl;
    const staff = isStaffRole(role);

    if (pathname === "/signup") {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    if (pathname === "/403" || pathname === "/reset-password") {
        return NextResponse.next();
    }

    if (role && !staff) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "staff_only");
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete("user_role");
        return response;
    }

    if (pathname === "/login") {
        if (staff) {
            return NextResponse.redirect(new URL(getRoleHome(role), request.url));
        }
        return NextResponse.next();
    }

    if (!staff) {
        const loginUrl = new URL("/login", request.url);
        const returnTarget = pathname + (search || "");
        if (returnTarget !== "/") loginUrl.searchParams.set("returnUrl", returnTarget);
        return NextResponse.redirect(loginUrl);
    }

    if (!isRouteAllowedForRole(pathname, role)) {
        return NextResponse.rewrite(new URL("/403", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
