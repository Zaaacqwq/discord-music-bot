import { parseInput } from "../resolvers/parse";
import { resolveYouTube } from "../resolvers/youtube";
import { resolveSearch } from "../resolvers/search";
import { resolveSpotify } from "../resolvers/spotify";
import type { PlayResolved } from "../types";

export async function resolvePlay(input: string): Promise<PlayResolved> {
  const meta = parseInput(input);
  if (meta.source === "youtube")
    return (await resolveYouTube(meta.url)) as PlayResolved;
  if (meta.source === "spotify")
    return (await resolveSpotify(meta.url)) as PlayResolved;
  return (await resolveSearch(meta.q)) as PlayResolved;
}
