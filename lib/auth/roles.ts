const STAFF = ["OWNER", "ADMIN", "COACH"] as const;

export function isStaffRole(role?: string | null): boolean {
    return STAFF.includes((role ?? "").toUpperCase().trim() as (typeof STAFF)[number]);
}

export function getRoleHome(role?: string | null): string {
    switch ((role ?? "").toUpperCase().trim()) {
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

/** Staff route check. Anything that is not a console path is allowed through. */
export function isRouteAllowedForRole(pathname: string, role?: string | null): boolean {
    const normalized = (role ?? "").toUpperCase().trim();

    if (pathname.startsWith("/console/owner")) return normalized === "OWNER";
    if (pathname.startsWith("/console/admin")) return normalized === "ADMIN" || normalized === "OWNER";
    if (pathname.startsWith("/console/coach")) {
        return normalized === "COACH" || normalized === "ADMIN" || normalized === "OWNER";
    }
    if (pathname.startsWith("/console")) return isStaffRole(normalized);

    return true;
}
