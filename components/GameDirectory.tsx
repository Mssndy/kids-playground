import Link from 'next/link';
import { GAMES, SHELVES } from '@/components/games';

/**
 * ページ下の「あそびのいちらん」。検索エンジンと保護者向け。
 * 子供の操作の邪魔にならないよう、ゲームの下に小さく置く。
 */
export default function GameDirectory({ currentId }: { currentId?: string }) {
  return (
    <footer className="max-w-lg mx-auto w-full px-4 pt-8 pb-10 text-gray-500">
      <h2 className="text-sm font-black mb-3">あそびのいちらん</h2>
      {SHELVES.map((shelf) => (
        <section key={shelf.id} className="mb-3">
          <h3 className="text-xs font-black mb-1">{shelf.emoji} {shelf.label}</h3>
          <ul className="flex flex-col gap-1">
            {GAMES.filter((g) => g.shelf === shelf.id).map((g) => (
              <li key={g.id} className="text-xs leading-relaxed">
                {g.id === currentId ? (
                  <span className="font-black text-gray-700">{g.emoji} {g.label}</span>
                ) : (
                  <Link href={`/play/${g.id}`} className="font-black underline underline-offset-2">
                    {g.emoji} {g.label}
                  </Link>
                )}
                <span className="block text-[11px] text-gray-400">{g.about}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
        保護者の方へ：登録は不要です。入力した名前と記録は、お使いの端末の中に保存されます。広告はありません。
      </p>
    </footer>
  );
}
