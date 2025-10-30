export type Parsed =
  | { source: 'youtube'; url: string }
  | { source: 'search'; q: string };

const YT = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i;

export function parseInput(s: string): Parsed {
  const str = s.trim();
  if (YT.test(str)) return { source: 'youtube', url: str };
  // 先做最小可用：其余全部走搜索（后面我们再接 B站/Spotify/QQ/网易云）
  return { source: 'search', q: str };
}
