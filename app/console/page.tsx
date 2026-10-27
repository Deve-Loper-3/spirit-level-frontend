"use client";

import ConsoleHome from "@/components/console/ConsoleHome";

const STAFF = ["OWNER", "ADMIN", "COACH"];

export default function ConsolePage() {
    return (
        <ConsoleHome
            eyebrow="Staff"
            title="Console"
            subtitle="Spirit Level Staff Operations"
            allow={STAFF}
        />
    );
}
