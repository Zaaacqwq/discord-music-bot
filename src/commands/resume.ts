import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { replyError, requireMemberVoice } from "../lib/voice.js";

const resume: SlashCommand = {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume playback."),

  async execute({ interaction, manager }) {
    const voice = await requireMemberVoice(interaction);
    if (!voice.ok) return replyError(interaction, voice.reason);
    if (!interaction.inCachedGuild()) return;

    const player = manager.players.get(interaction.guildId);
    const current = await player?.queue.getCurrent();
    if (!player || !current) return replyError(interaction, "Nothing is playing.");
    if (!player.paused) return replyError(interaction, "Already playing.");

    await player.pause(false);
    await interaction.reply({ content: "▶️ Resumed." });
  },
};

export default resume;
