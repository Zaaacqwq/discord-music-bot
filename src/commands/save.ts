import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { replyError } from "../lib/voice.js";
import { savePlaylist } from "../db/playlists.js";
import { truncate } from "../lib/format.js";

const save: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("save")
    .setDescription("Save the current queue (and current track) as a named playlist.")
    .addStringOption((o) =>
      o
        .setName("name")
        .setDescription("Playlist name (1–64 chars)")
        .setMinLength(1)
        .setMaxLength(64)
        .setRequired(true),
    )
    .addBooleanOption((o) =>
      o
        .setName("replace")
        .setDescription("Overwrite if a playlist with this name already exists"),
    ),

  async execute({ interaction, manager }) {
    if (!interaction.inCachedGuild()) return;

    const player = manager.players.get(interaction.guildId);
    if (!player) return replyError(interaction, "I'm not in a voice channel.");

    const current = await player.queue.getCurrent();
    const upcoming = await player.queue.getTracks();
    if (!current && upcoming.length === 0) {
      return replyError(interaction, "Queue is empty — nothing to save.");
    }

    const name = interaction.options.getString("name", true).trim();
    if (name.length === 0) return replyError(interaction, "Name cannot be blank.");
    const replace = interaction.options.getBoolean("replace") ?? false;

    // Save the current track first so /load resumes from where we are.
    const tracks = [...(current ? [current] : []), ...upcoming].map((t) => ({
      uri: t.uri,
      title: t.title,
      author: t.author,
      durationMs: t.duration ?? 0,
    }));

    const result = await savePlaylist({
      guildId: interaction.guildId,
      ownerId: interaction.user.id,
      name,
      tracks,
      replace,
    });

    if (!result.ok) {
      return replyError(
        interaction,
        `A playlist named **${truncate(name, 60)}** already exists. Re-run with \`replace:true\` to overwrite.`,
      );
    }

    await interaction.reply({
      content: `💾 Saved **${truncate(name, 60)}** with ${result.trackCount} track${result.trackCount === 1 ? "" : "s"}.`,
    });
  },
};

export default save;
