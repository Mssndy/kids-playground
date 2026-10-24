import { OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "あそびのひろば";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgImage({
    emoji: "🛝",
    title: "あそびのひろば",
    subtitle: "ビンゴ・けいさん・もじ・えきめいクイズ",
    gradient: "linear-gradient(135deg, #40c057 0%, #1098ad 100%)",
  });
}
