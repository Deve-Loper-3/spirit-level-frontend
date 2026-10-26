import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRoleHome, isRouteAllowedForRole } from "@/lib/auth/roles";

const API_BASE =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:4000/api/v1";

/** Convert duration string / ISO timestamp to seconds for Max-Age */
function toSeconds(val: string | undefined, fallback: number): number {
    if (!val) return fallback;
    if (/^\d+$/.test(val)) return Number(val);
    const m = /^(\d+)([smhd])$/i.exec(val);
    if (m) {
        const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
        return Number(m[1]) * (units[m[2].toLowerCase()] ?? 1);
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return Math.max(0, Math.floor((d.getTime() - Date.now()) / 1000));
    return fallback;
}

/** Check if JWT access token is absent or expired */
function isTokenExpired(token: string | undefined): boolean {
    if (!token) return true;
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return true;
        const payloadStr = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
        const payload = JSON.parse(payloadStr);
        if (typeof payload.exp === "number") {
            // Treat as expired if within 3 seconds of expiry
            return Date.now() >= (payload.exp - 3) * 1000;
        }
        return false;
    } catch {
        return true;
    }
}

/**
 * Attempts a silent token refresh via the backend.
 * Returns a NextResponse with the new tokens written as Set-Cookie headers,
 * or null if the refresh fails (invalid / expired refresh token).
 *
 * This runs in the Edge Runtime, which CAN write response cookies —
 * unlike Next.js Server Components where cookies() is read-only.
 */
async function tryRefreshTokens(
    request: NextRequest,
    refreshToken: string,
    remember: boolean,
): Promise<{ response: NextResponse; newRole: string | undefined } | null> {
    try {
        const res = await fetch(`${API_BASE.replace(/\/+$/, "")}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) return null;

        const json = (await res.json()) as Record<string, unknown>;
        const data = (json.data ?? json) as Record<string, unknown>;
        const tokens = (data.tokens ?? data) as Record<string, unknown>;

        const newAccessToken = tokens.accessToken as string | undefined;
        const newRefreshToken = (tokens.refreshToken ?? refreshToken) as string;
        const accessExpiresIn = (tokens.accessTokenExpiresIn ?? "15m") as string;
        const refreshExpiresAt = (tokens.refreshTokenExpiresAt ?? tokens.refreshTokenExpiresIn) as
            | string
            | undefined;

        if (!newAccessToken) return null;

        let newRole: string | undefined;
        try {
            const parts = newAccessToken.split(".");
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
                if (typeof payload.role === "string") {
                    newRole = payload.role;
                }
            }
        } catch {
            // ignore decode error
        }

        const accessMaxAge = toSeconds(accessExpiresIn, 15 * 60);
        const refreshMaxAge = toSeconds(refreshExpiresAt, 30 * 86400);

        // Forward new token into request headers so downstream Server Components see it immediately
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-refreshed-access-token", newAccessToken);
        request.cookies.set("access_token", newAccessToken);
        request.cookies.set("refresh_token", newRefreshToken);
        if (newRole) {
            request.cookies.set("user_role", newRole);
        }
        requestHeaders.set("cookie", request.cookies.toString());

        const response = NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });

        // Set response cookies for browser / HTTP client
        response.cookies.set("access_token", newAccessToken, {
            maxAge: accessMaxAge,
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        });

        response.cookies.set("refresh_token", newRefreshToken, {
            ...(remember ? { maxAge: refreshMaxAge } : {}),
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        });

        if (newRole) {
            response.cookies.set("user_role", newRole, {
                ...(remember ? { maxAge: refreshMaxAge } : {}),
                path: "/",
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
            });
        }

        return { response, newRole };
    } catch {
        return null;
    }
}

export async function middleware(request: NextRequest) {
    const rawAccessToken = request.cookies.get("access_token")?.value;
    const refreshToken = request.cookies.get("refresh_token")?.value;
    const resetToken = request.cookies.get("reset_token")?.value;
    let userRole = request.cookies.get("user_role")?.value;
    const remember = request.cookies.get("remember_me")?.value === "1";
    const { pathname, search } = request.nextUrl;

    const hasAnySession = Boolean(rawAccessToken || refreshToken);

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

    // 6. Check if access token is absent or expired
    const isAccessExpired = isTokenExpired(rawAccessToken);

    if (isAccessExpired) {
        if (!refreshToken) {
            // Expired access token and NO refresh token -> redirect to login
            const loginUrl = new URL("/login", request.url);
            loginUrl.searchParams.set("returnUrl", pathname + (search || ""));
            const failResponse = NextResponse.redirect(loginUrl);
            failResponse.cookies.delete("access_token");
            failResponse.cookies.delete("refresh_token");
            failResponse.cookies.delete("remember_me");
            failResponse.cookies.delete("user_role");
            return failResponse;
        }

        // Silent access-token refresh in Edge middleware
        const refreshed = await tryRefreshTokens(request, refreshToken, remember);
        if (!refreshed) {
            // Refresh failed (token revoked / expired) — clear session and redirect to login
            const loginUrl = new URL("/login", request.url);
            loginUrl.searchParams.set("returnUrl", pathname + (search || ""));
            const failResponse = NextResponse.redirect(loginUrl);
            failResponse.cookies.delete("access_token");
            failResponse.cookies.delete("refresh_token");
            failResponse.cookies.delete("remember_me");
            failResponse.cookies.delete("user_role");
            return failResponse;
        }

        if (refreshed.newRole) {
            userRole = refreshed.newRole;
        }

        // If after refresh the role is MEMBER, refuse access
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

        // Check role-based route access on refreshed session
        if (!isRouteAllowedForRole(pathname, userRole)) {
            const forbiddenUrl = new URL("/403", request.url);
            return NextResponse.rewrite(forbiddenUrl);
        }

        return refreshed.response;
    }

    // 7. Role-based route access check for valid token
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
