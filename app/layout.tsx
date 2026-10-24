import type { Metadata } from "next";
import { Geist } from "next/font/google";
import AdSlot from "@/components/ui/AdSlot";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "あそびのひろば",
  description: "子供向けのあそびのひろば。ビンゴ・けいさん・もじ・ミニゲームであそんでまなぼう！",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} h-full`}>
      <body className="h-full flex flex-col items-center overflow-hidden bg-[var(--color-bingo-bg)]">
        <AdSlot slotId="bingo-top" width={320} height={50} className="w-full max-w-lg shrink-0" />
        <div className="flex-1 w-full max-w-lg min-h-0 overflow-y-auto">
          {children}
        </div>
        <AdSlot slotId="bingo-bottom" width={320} height={50} className="w-full max-w-lg shrink-0" />
      </body>
    </html>
  );
}
