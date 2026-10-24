import { GAMES, findGame } from "@/components/games";
import { OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "あそびのひろば";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id }));
}

export default async function Image({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const g = findGame(game);
  return renderOgImage({
    emoji: g?.emoji ?? "🛝",
    title: g?.label ?? "あそびのひろば",
    subtitle: g ? g.desc.replace("\n", " ") : "",
    gradient: g?.gradient ?? "linear-gradient(135deg, #40c057 0%, #1098ad 100%)",
  });
}
