import type { Metadata } from "next";
import { Libre_Baskerville, Outfit } from "next/font/google";
import "./globals.css";
import { getTheme } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth/AuthContext";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "600", "700"]
});

const librebaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "slc",
  description: "Spirit Level Staff Console",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTheme();
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${outfit.variable} ${librebaskerville.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
