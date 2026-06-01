import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { replyError, requireMemberVoice } from "../lib/voice.js";

const volume: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Get or set playback volume.")
    .addIntegerOption((o) =>
      o
        .setName("level")
        .setDescription("Target volume (0–150). Omit to display the current level.")
        .setMinValue(0)
        .setMaxValue(150)
        .setRequired(false),
    ),

  async execute({ interaction, manager }) {
    if (!interaction.inCachedGuild()) return;

    const player = manager.players.get(interaction.guildId);
    if (!player) return replyError(interaction, "I'm not in a voice channel.");

    const level = interaction.options.getInteger("level");
    if (level === null) {
      await interaction.reply({ content: `🔊 Volume is **${player.volume ?? 100}%**.` });
      return;
    }

    const voice = await requireMemberVoice(interaction);
    if (!voice.ok) return replyError(interaction, voice.reason);

    await player.setVolume(level);
    await interaction.reply({ content: `🔊 Volume set to **${level}%**.` });
  },
};

export default volume;
