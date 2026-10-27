import Image from "next/image";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { getTheme } from "@/lib/theme";

export default async function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Read the theme cookie on the server so ThemeSwitcher knows which button
    // to highlight without waiting for hydration.
    const theme = await getTheme();

    return (
        <main className="bg-stripes relative flex min-h-dvh flex-col items-center gap-6 px-4 py-8 lg:py-24">
            {/* THEME SWITCHER — top-centre, mirrors the logo/footer absolute positioning */}
            <div className="flex justify-center lg:absolute lg:top-[30px] lg:left-1/2 lg:-translate-x-1/2">
                <ThemeSwitcher current={theme} />
            </div>

            {/* BRANDING */}
            <div className="flex items-center gap-3 self-start lg:absolute lg:left-10 lg:top-[34px]">
                <Image
                    src="/sl-icon-green.png"
                    alt=""
                    width={47}
                    height={26}
                    className="h-[26px] w-auto"
                    priority
                />
                <div className="leading-none">
                    <p className="text-[13px] font-bold uppercase tracking-[0.04em] text-white">
                        Spirit Level
                    </p>
                    <p className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-spirit-green">
                        Staff Console
                    </p>
                </div>
            </div>

            {/* CARD: {children} is the hole where each page's own content appears. */}
            <div className="my-auto w-full max-w-[532px] rounded-[6px] bg-card px-6 py-[38px] text-card-foreground sm:px-10">
                {children}
            </div>

            {/* FOOTER TEXT */}
            <p className="self-start text-[10.5px] uppercase tracking-[0.16em] text-white/40 lg:absolute lg:bottom-[30px] lg:left-10">
                Internal use only · Spirit Level Operations
            </p>
        </main>
    );
}
