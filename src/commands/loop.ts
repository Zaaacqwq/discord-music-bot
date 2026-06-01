import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { replyError, requireMemberVoice } from "../lib/voice.js";

const loop: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Set loop mode.")
    .addStringOption((o) =>
      o
        .setName("mode")
        .setDescription("Loop mode")
        .setRequired(true)
        .addChoices(
          { name: "Off", value: "off" },
          { name: "Track", value: "track" },
          { name: "Queue", value: "queue" },
        ),
    ),

  async execute({ interaction, manager }) {
    const voice = await requireMemberVoice(interaction);
    if (!voice.ok) return replyError(interaction, voice.reason);
    if (!interaction.inCachedGuild()) return;

    const player = manager.players.get(interaction.guildId);
    if (!player) return replyError(interaction, "I'm not in a voice channel.");

    const mode = interaction.options.getString("mode", true) as "off" | "track" | "queue";
    player.setTrackRepeat(mode === "track");
    player.setQueueRepeat(mode === "queue");

    const label = mode === "off" ? "Off" : mode === "track" ? "Track" : "Queue";
    await interaction.reply({ content: `🔁 Loop set to **${label}**.` });
  },
};

export default loop;
