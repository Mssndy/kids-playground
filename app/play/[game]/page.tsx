import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PlaygroundApp from "@/components/PlaygroundApp";
import GameDirectory from "@/components/GameDirectory";
import { GAMES, findGame } from "@/components/games";
import { SITE_NAME } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ game: string }>;
}): Promise<Metadata> {
  const { game } = await params;
  const g = findGame(game);
  if (!g) return {};
  const url = `/play/${g.id}`;
  return {
    title: g.label,
    description: g.about,
    alternates: { canonical: url },
    openGraph: {
      siteName: SITE_NAME,
      locale: "ja_JP",
      type: "website",
      url,
      title: `${g.label}｜${SITE_NAME}`,
      description: g.about,
    },
  };
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  const g = findGame(game);
  if (!g) notFound();
  return (
    <>
      <PlaygroundApp gameId={g.id} />
      <GameDirectory currentId={g.id} />
    </>
  );
}
