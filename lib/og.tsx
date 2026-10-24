import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };

/** 共有カード用の日本語フォント。取れなければ既定フォントで描く（ビルドを止めない） */
async function loadJpFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@800&text=${encodeURIComponent(text)}`,
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export async function renderOgImage(opts: {
  emoji: string;
  title: string;
  subtitle: string;
  gradient: string;
}) {
  const brand = 'あそびのひろば';
  const font = await loadJpFont(opts.title + opts.subtitle + brand);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: opts.gradient,
          fontFamily: font ? 'Rounded' : undefined,
          color: 'white',
        }}
      >
        <div style={{ fontSize: 180, lineHeight: 1 }}>{opts.emoji}</div>
        <div style={{ fontSize: 96, fontWeight: 800, marginTop: 24 }}>{opts.title}</div>
        <div style={{ fontSize: 40, fontWeight: 800, marginTop: 12, opacity: 0.9 }}>{opts.subtitle}</div>
        <div style={{ fontSize: 32, fontWeight: 800, marginTop: 36, opacity: 0.8 }}>{`🛝 ${brand}`}</div>
      </div>
    ),
    {
      ...OG_SIZE,
      emoji: 'twemoji',
      fonts: font ? [{ name: 'Rounded', data: font, weight: 800, style: 'normal' }] : undefined,
    },
  );
}
