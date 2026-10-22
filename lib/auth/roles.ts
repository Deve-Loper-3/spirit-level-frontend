export type { UserRole } from "@/lib/api/types";

export const ROLES = {
    OWNER: "OWNER",
    ADMIN: "ADMIN",
    COACH: "COACH",
    MEMBER: "MEMBER",
} as const;

/**
 * Returns the default home/landing URL for a given role according to Ticket 2:
 * "OWNER, ADMIN and COACH each go to their own home."
 */
export function getRoleHome(role?: string | null): string {
    const normalized = (role ?? "").toUpperCase().trim();
    switch (normalized) {
        case "OWNER":
            return "/console/owner";
        case "ADMIN":
            return "/console/admin";
        case "COACH":
            return "/console/coach";
        default:
            return "/console";
    }
}

/**
 * Checks if the role is a staff role (OWNER, ADMIN, COACH).
 * "A MEMBER login is refused with 'This portal is for staff', and the session is cleared."
 */
export function isStaffRole(role?: string | null): boolean {
    const normalized = (role ?? "").toUpperCase().trim();
    return ["OWNER", "ADMIN", "COACH"].includes(normalized);
}

/**
 * Verifies if a given pathname is allowed for the user's role.
 * - /console/owner: strictly OWNER
 * - /console/admin: ADMIN or OWNER
 * - /console/coach: COACH, ADMIN, or OWNER
 * - /console: any valid staff role
 */
export function isRouteAllowedForRole(pathname: string, role?: string | null): boolean {
    const normalized = (role ?? "").toUpperCase().trim();

    // Members are forbidden from the entire staff portal
    if (normalized === "MEMBER") {
        return false;
    }

    if (pathname.startsWith("/console/owner")) {
        return normalized === "OWNER";
    }

    if (pathname.startsWith("/console/admin")) {
        return normalized === "ADMIN" || normalized === "OWNER";
    }

    if (pathname.startsWith("/console/coach")) {
        return normalized === "COACH" || normalized === "ADMIN" || normalized === "OWNER";
    }

    if (pathname.startsWith("/console")) {
        return isStaffRole(normalized);
    }

    // Unrestricted internal page
    return true;
}
