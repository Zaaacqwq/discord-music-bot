import { SlashCommandBuilder } from "discord.js";
import type { Track } from "magmastream";
import type { SlashCommand } from "./types.js";
import { replyError, requireMemberVoice } from "../lib/voice.js";
import { getPlaylist, listMyPlaylists } from "../db/playlists.js";
import { getMusicChannel } from "../db/guildConfig.js";
import { truncate } from "../lib/format.js";
import { startIfIdle } from "../lib/playback.js";
import { logger } from "../logger.js";

const RESOLVE_BATCH = 5;

const load: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("load")
    .setDescription("Load one of your saved playlists into the queue.")
    .addStringOption((o) =>
      o
        .setName("name")
        .setDescription("Playlist name")
        .setMinLength(1)
        .setMaxLength(64)
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addBooleanOption((o) =>
      o
        .setName("replace")
        .setDescription("Stop the current track and clear the queue before loading"),
    ),

  async execute({ interaction, manager }) {
    const voice = await requireMemberVoice(interaction);
    if (!voice.ok) return replyError(interaction, voice.reason);
    if (!interaction.inCachedGuild()) return;

    const name = interaction.options.getString("name", true).trim();
    const replace = interaction.options.getBoolean("replace") ?? false;

    const playlist = await getPlaylist({
      guildId: interaction.guildId,
      ownerId: interaction.user.id,
      name,
    });
    if (!playlist || playlist.tracks.length === 0) {
      return replyError(interaction, `No playlist named **${truncate(name, 60)}** (or it's empty).`);
    }

    await interaction.deferReply();

    const pinnedChannelId = await getMusicChannel(interaction.guildId);
    const player = manager.create({
      guildId: interaction.guildId,
      textChannelId: pinnedChannelId ?? interaction.channelId,
      voiceChannelId: voice.voiceChannelId,
      selfDeafen: true,
      volume: 80,
    });
    if (player.state !== "CONNECTED") player.connect();

    // Resolve URIs back to Lavalink-playable tracks. For Spotify URIs LavaSrc
    // re-runs ISRC matching, so the YouTube pick may differ from the save time.
    const resolved: Track[] = [];
    let failed = 0;
    for (let i = 0; i < playlist.tracks.length; i += RESOLVE_BATCH) {
      const batch = playlist.tracks.slice(i, i + RESOLVE_BATCH);
      const results = await Promise.allSettled(
        batch.map((t) => manager.search(t.uri, interaction.user)),
      );
      for (const r of results) {
        if (r.status === "rejected") {
          failed++;
          logger.warn({ err: r.reason }, "playlist track resolve failed");
          continue;
        }
        // ErrorOrEmptySearchResult lacks .tracks; narrow with `in`.
        const sr = r.value;
        const track = "tracks" in sr ? sr.tracks?.[0] : undefined;
        if (track) resolved.push(track);
        else failed++;
      }
    }

    if (resolved.length === 0) {
      if (!(await player.queue.getCurrent())) await player.destroy();
      await interaction.editReply({
        content: `❌ Couldn't resolve any tracks from **${truncate(name, 60)}**.`,
      });
      return;
    }

    if (replace) {
      await player.queue.clear();
      await player.queue.add(resolved);
      // If something was playing, stop it; Lavalink auto-advance picks the
      // first loaded track. Otherwise just start playback.
      if (await player.queue.getCurrent()) await player.stop();
      else await startIfIdle(player);
    } else {
      await player.queue.add(resolved);
      await startIfIdle(player);
    }

    const note = failed > 0 ? ` (${failed} unavailable)` : "";
    const verb = replace ? "Replaced queue with" : "Queued";
    await interaction.editReply({
      content: `📥 ${verb} **${truncate(playlist.name, 60)}** — ${resolved.length} track${resolved.length === 1 ? "" : "s"}${note}.`,
    });
  },

  async autocomplete(interaction) {
    if (!interaction.inCachedGuild()) return;
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "name") return;

    const items = await listMyPlaylists(interaction.guildId, interaction.user.id);
    const q = focused.value.toLowerCase();
    const matches = items
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 25)
      .map((p) => ({
        name: `${truncate(p.name, 80)} (${p._count.tracks})`,
        value: p.name,
      }));

    await interaction.respond(matches);
  },
};

export default load;
