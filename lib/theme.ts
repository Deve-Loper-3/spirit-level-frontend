import { cookies } from "next/headers";

export type Theme = "studio" | "ink";

export async function getTheme(): Promise<Theme> {
    const cookieStore = await cookies();
    return (cookieStore.get("theme")?.value as Theme | undefined) ?? "studio";
}