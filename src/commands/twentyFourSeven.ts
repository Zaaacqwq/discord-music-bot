import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { replyError, requireMemberVoice } from "../lib/voice.js";
import { isAlwaysOn, setAlwaysOn } from "../db/guildConfig.js";

const twentyFourSeven: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("247")
    .setDescription("Stay in voice 24/7. When off, I disconnect after 5 min of silence.")
    .addStringOption((o) =>
      o
        .setName("mode")
        .setDescription("Toggle 24/7 mode (omit to view current state)")
        .setRequired(false)
        .addChoices(
          { name: "On", value: "on" },
          { name: "Off", value: "off" },
        ),
    ),

  async execute({ interaction }) {
    if (!interaction.inCachedGuild()) return;

    const mode = interaction.options.getString("mode");
    if (mode === null) {
      const current = await isAlwaysOn(interaction.guildId);
      await interaction.reply({
        content: `🌙 24/7 mode is currently **${current ? "on" : "off"}**.`,
      });
      return;
    }

    // Mutations require being in voice — same guard as playback commands.
    const voice = await requireMemberVoice(interaction);
    if (!voice.ok) return replyError(interaction, voice.reason);

    const on = mode === "on";
    await setAlwaysOn(interaction.guildId, on);
    await interaction.reply({
      content: on
        ? "🌙 24/7 mode **enabled**. I'll stay even when the queue is empty."
        : "🌙 24/7 mode **disabled**. I'll disconnect after 5 min of silence.",
    });
  },
};

export default twentyFourSeven;
