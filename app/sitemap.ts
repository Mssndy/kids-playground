import type { MetadataRoute } from "next";
import { GAMES } from "@/components/games";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...GAMES.map((g) => ({
      url: `${SITE_URL}/play/${g.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
