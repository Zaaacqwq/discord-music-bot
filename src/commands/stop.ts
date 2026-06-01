import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { replyError, requireMemberVoice } from "../lib/voice.js";

const stop: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Clear the queue and leave the voice channel."),

  async execute({ interaction, manager }) {
    const voice = await requireMemberVoice(interaction);
    if (!voice.ok) return replyError(interaction, voice.reason);
    if (!interaction.inCachedGuild()) return;

    const player = manager.players.get(interaction.guildId);
    if (!player) return replyError(interaction, "I'm not in a voice channel.");

    await player.destroy();
    await interaction.reply({ content: "⏹️ Stopped and disconnected." });
  },
};

export default stop;
