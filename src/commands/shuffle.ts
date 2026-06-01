import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { replyError, requireMemberVoice } from "../lib/voice.js";

const shuffle: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Shuffle the upcoming queue."),

  async execute({ interaction, manager }) {
    const voice = await requireMemberVoice(interaction);
    if (!voice.ok) return replyError(interaction, voice.reason);
    if (!interaction.inCachedGuild()) return;

    const player = manager.players.get(interaction.guildId);
    if (!player) return replyError(interaction, "I'm not in a voice channel.");

    const size = await player.queue.size();
    if (size < 2) return replyError(interaction, "Need at least 2 upcoming tracks to shuffle.");

    await player.queue.shuffle();
    await interaction.reply({ content: `🔀 Shuffled ${size} upcoming tracks.` });
  },
};

export default shuffle;
