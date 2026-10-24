import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}｜子供向けの無料あそび・まなびゲーム`,
    template: `%s｜${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    siteName: SITE_NAME,
    locale: "ja_JP",
    type: "website",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} h-full`}>
      <body className="h-full flex flex-col items-center overflow-hidden bg-[var(--color-bingo-bg)]">
        <div className="flex-1 w-full max-w-lg min-h-0 overflow-y-auto">
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  );
}
