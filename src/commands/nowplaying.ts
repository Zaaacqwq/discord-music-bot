import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { replyError } from "../lib/voice.js";
import { buildControlRow, buildNowPlayingEmbed } from "../ui/nowplaying.js";

const nowplaying: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show the now-playing panel."),

  async execute({ interaction, manager }) {
    if (!interaction.inCachedGuild()) return;

    const player = manager.players.get(interaction.guildId);
    const current = await player?.queue.getCurrent();
    if (!player || !current) return replyError(interaction, "Nothing is playing.");

    await interaction.reply({
      embeds: [await buildNowPlayingEmbed(player, current)],
      components: [await buildControlRow(player)],
    });
  },
};

export default nowplaying;
