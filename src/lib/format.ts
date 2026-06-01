export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function progressBar(currentMs: number, totalMs: number, width = 18): string {
  if (totalMs <= 0) return "▬".repeat(width);
  const ratio = Math.max(0, Math.min(1, currentMs / totalMs));
  const filled = Math.round(ratio * (width - 1));
  const empty = width - 1 - filled;
  return `${"█".repeat(filled)}🔘${"▬".repeat(Math.max(0, empty))}`;
}

export function truncate(s: string, max = 60): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
