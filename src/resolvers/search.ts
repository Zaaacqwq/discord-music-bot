import play from "play-dl";
export async function resolveSearch(q: string) {
  const res = await play.search(q, { limit: 1, source: { youtube: "video" } });
  if (res[0])
    return {
      kind: "track" as const,
      title: res[0].title ?? q,
      url: res[0].url,
    };
  return { kind: "search" as const, title: q };
}
