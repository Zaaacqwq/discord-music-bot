import { parseInput } from '../resolvers/parse';
import { resolveYouTube } from '../resolvers/youtube';
import { resolveSearch } from '../resolvers/search';

export async function resolvePlay(input: string) {
  const meta = parseInput(input);
  if (meta.source === 'youtube') return await resolveYouTube(meta.url);
  return await resolveSearch(meta.q);
}
