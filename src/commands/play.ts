import { SlashCommandBuilder } from "discord.js";
import type { SearchResult } from "magmastream";
import type { SlashCommand } from "./types.js";
import { replyError, requireMemberVoice } from "../lib/voice.js";
import { logger } from "../logger.js";
import { truncate } from "../lib/format.js";
import { startIfIdle } from "../lib/playback.js";

const play: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a track or playlist from a URL or search query.")
    .addStringOption((o) =>
      o
        .setName("query")
        .setDescription("URL (YouTube/Spotify/SoundCloud) or a search query")
        .setRequired(true),
    )
    .addBooleanOption((o) =>
      o
        .setName("next")
        .setDescription("Insert at the front of the queue instead of the end")
        .setRequired(false),
    ),

  async execute({ interaction, manager }) {
    const voice = await requireMemberVoice(interaction);
    if (!voice.ok) {
      await replyError(interaction, voice.reason);
      return;
    }
    if (!interaction.inCachedGuild()) return;

    await interaction.deferReply();

    const query = interaction.options.getString("query", true);
    const playNext = interaction.options.getBoolean("next") ?? false;

    const player = manager.create({
      guildId: interaction.guildId,
      textChannelId: interaction.channelId,
      voiceChannelId: voice.voiceChannelId,
      selfDeafen: true,
      volume: 80,
    });

    if (player.state !== "CONNECTED") player.connect();

    let result: SearchResult;
    try {
      result = await player.search(query, interaction.user);
    } catch (err) {
      logger.error({ err, query }, "search failed");
      if (!(await player.queue.getCurrent())) await player.destroy();
      await interaction.editReply({ content: `❌ Search failed: \`${truncate(query, 80)}\`` });
      return;
    }

    switch (result.loadType) {
      case "empty": {
        if (!(await player.queue.getCurrent())) await player.destroy();
        await interaction.editReply({ content: `🤷 No matches for \`${truncate(query, 80)}\`.` });
        return;
      }
      case "error": {
        if (!(await player.queue.getCurrent())) await player.destroy();
        await interaction.editReply({ content: `❌ Load failed for \`${truncate(query, 80)}\`.` });
        return;
      }
      case "track":
      case "search": {
        const track = result.tracks[0];
        if (!track) {
          await interaction.editReply({ content: `🤷 No playable track in result.` });
          return;
        }
        // add(track, 0) inserts at the front when there's already a current track,
        // and auto-sets-as-current when the queue is empty. add(track) appends.
        await player.queue.add(track, playNext ? 0 : undefined);

        await startIfIdle(player);
        await interaction.editReply({
          content: `➕ Queued **[${truncate(track.title, 70)}](${track.uri})**${playNext ? " *(up next)*" : ""}`,
        });
        return;
      }
      case "playlist": {
        const playlist = result.playlist;
        if (!playlist?.tracks?.length) {
          await interaction.editReply({ content: `🤷 Playlist is empty.` });
          return;
        }
        await player.queue.add(playlist.tracks);
        await startIfIdle(player);
        await interaction.editReply({
          content: `🎵 Queued playlist **${truncate(playlist.name ?? "Unknown", 70)}** (${playlist.tracks.length} tracks)`,
        });
        return;
      }
      default: {
        await interaction.editReply({ content: `❓ Unknown load type.` });
      }
    }
  },
};

export default play;
