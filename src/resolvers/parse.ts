export type Parsed =
  | { source: "youtube"; url: string }
  | { source: "spotify"; url: string }
  | { source: "search"; q: string };

const YT = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i;
const SP = /^(https?:\/\/)?(open\.)?spotify\.com\//i;

export function parseInput(s: string): Parsed {
  const str = s.trim();
  if (YT.test(str)) return { source: "youtube", url: str };
  if (SP.test(str)) return { source: "spotify", url: str };
  return { source: "search", q: str };
}
