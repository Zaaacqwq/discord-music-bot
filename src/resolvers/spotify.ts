import SpotifyWebApi from "spotify-web-api-node";
import play from "play-dl";

const clientId = process.env.SPOTIFY_CLIENT_ID || "";
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";

function assertCreds() {
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env"
    );
  }
}

async function getApi() {
  assertCreds();
  const api = new SpotifyWebApi({ clientId, clientSecret });
  const token = await api.clientCredentialsGrant();
  api.setAccessToken(token.body.access_token);
  return api;
}

function artistsToLine(
  artists: SpotifyApi.ArtistObjectSimplified[] | SpotifyApi.ArtistObjectFull[]
) {
  return (artists ?? []).map((a) => a.name).join(", ");
}

async function ytBestUrl(query: string) {
  const res = await play.search(query, {
    limit: 1,
    source: { youtube: "video" },
  });
  return res[0]?.url;
}

export async function resolveSpotify(inputUrl: string) {
  const api = await getApi();

  // 解析 URL 类型
  // track / album / playlist / artist
  const u = new URL(inputUrl);
  const [, type, id] = u.pathname.split("/"); // /track/xxx /album/xxx /playlist/xxx /artist/xxx
  if (!type || !id) throw new Error("Unsupported Spotify URL");

  if (type === "track") {
    const t = (await api.getTrack(id)).body;
    const q = `${artistsToLine(t.artists)} - ${t.name}`;
    const url = await ytBestUrl(q);
    if (!url) return { kind: "search" as const, title: q };
    return {
      kind: "track" as const,
      title: `${t.name} - ${artistsToLine(t.artists)}`,
      url,
    };
  }

  if (type === "album") {
    const alb = (await api.getAlbum(id)).body;
    const tracks = alb.tracks.items;
    const items: Array<{ title: string; url: string }> = [];
    for (const tr of tracks) {
      const q = `${artistsToLine(tr.artists)} - ${tr.name}`;
      const url = await ytBestUrl(q);
      if (url)
        items.push({ title: `${tr.name} - ${artistsToLine(tr.artists)}`, url });
    }
    if (items.length === 0) return { kind: "search" as const, title: alb.name };
    return { kind: "playlist" as const, title: alb.name, items };
  }

  if (type === "playlist") {
    const pl = (await api.getPlaylist(id)).body;
    const items: Array<{ title: string; url: string }> = [];
    for (const it of pl.tracks.items) {
      const tr = it.track as SpotifyApi.TrackObjectFull | null;
      if (!tr) continue;
      const q = `${artistsToLine(tr.artists)} - ${tr.name}`;
      const url = await ytBestUrl(q);
      if (url)
        items.push({ title: `${tr.name} - ${artistsToLine(tr.artists)}`, url });
    }
    if (items.length === 0)
      return { kind: "search" as const, title: pl.name ?? "playlist" };
    return { kind: "playlist" as const, title: pl.name ?? undefined, items };
  }

  if (type === "artist") {
    // 取 Top Tracks（默认 US）
    const art = (await api.getArtist(id)).body;
    const top = (await api.getArtistTopTracks(id, "US")).body.tracks;
    const items: Array<{ title: string; url: string }> = [];
    for (const tr of top) {
      const q = `${artistsToLine(tr.artists)} - ${tr.name}`;
      const url = await ytBestUrl(q);
      if (url)
        items.push({ title: `${tr.name} - ${artistsToLine(tr.artists)}`, url });
    }
    if (items.length === 0) return { kind: "search" as const, title: art.name };
    return {
      kind: "playlist" as const,
      title: `${art.name} — Top Tracks`,
      items,
    };
  }

  throw new Error("Unsupported Spotify URL type: " + type);
}
