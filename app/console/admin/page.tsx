"use client";

import ConsoleHome from "@/components/console/ConsoleHome";

const ALLOW = ["OWNER", "ADMIN"];

export default function AdminPage() {
    return (
        <ConsoleHome
            eyebrow="Administrator"
            title="Staff Administration"
            subtitle="Spirit Level Facility Operations & Staff Controls"
            allow={ALLOW}
        />
    );
}
