export type TrackResolved = { kind: "track"; title: string; url: string };
export type PlaylistResolved = {
  kind: "playlist";
  title?: string;
  items: Array<{ title: string; url: string }>;
};
export type SearchMiss = { kind: "search"; title: string };

export type PlayResolved = TrackResolved | PlaylistResolved | SearchMiss;
