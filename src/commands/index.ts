import { Collection } from "discord.js";
import type { SlashCommand } from "./types.js";

import play from "./play.js";
import skip from "./skip.js";
import pause from "./pause.js";
import resume from "./resume.js";
import stop from "./stop.js";
import nowplaying from "./nowplaying.js";
import volume from "./volume.js";
import loop from "./loop.js";
import shuffle from "./shuffle.js";
import seek from "./seek.js";
import queue from "./queue.js";
import twentyFourSeven from "./twentyFourSeven.js";
import save from "./save.js";
import playlists from "./playlists.js";
import load from "./load.js";

export const commands: ReadonlyArray<SlashCommand> = [
  play,
  skip,
  pause,
  resume,
  stop,
  nowplaying,
  volume,
  loop,
  shuffle,
  seek,
  queue,
  twentyFourSeven,
  save,
  playlists,
  load,
];

export function buildCommandCollection(): Collection<string, SlashCommand> {
  const collection = new Collection<string, SlashCommand>();
  for (const cmd of commands) {
    const name =
      "name" in cmd.data ? cmd.data.name : (cmd.data as { name: string }).name;
    collection.set(name, cmd);
  }
  return collection;
}
