"use client";

import ConsoleHome from "@/components/console/ConsoleHome";

const ALLOW = ["OWNER"];

export default function OwnerPage() {
    return (
        <ConsoleHome
            eyebrow="Owner"
            title="Executive Operations"
            subtitle="Spirit Level Organization & Franchise Management"
            allow={ALLOW}
        />
    );
}
