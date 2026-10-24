// fire-and-forget — エラーは握り潰す（オフライン時も動くように）
export function pushRecordToServer(playerName: string, key: string, value: number): void {
  fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName, key, value }),
  }).catch(() => {});
}

// プレイヤーの記録取得（起動時に一度だけ呼ぶ）
export async function fetchRecordsFromServer(
  playerName: string,
): Promise<Record<string, number>> {
  const res = await fetch(`/api/records?player=${encodeURIComponent(playerName)}`);
  if (!res.ok) return {};
  return res.json() as Promise<Record<string, number>>;
}
