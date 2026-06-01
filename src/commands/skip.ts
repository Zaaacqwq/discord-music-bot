import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { replyError, requireMemberVoice } from "../lib/voice.js";
import { logger } from "../logger.js";
import { truncate } from "../lib/format.js";

const skip: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current track.")
    .addIntegerOption((o) =>
      o
        .setName("count")
        .setDescription("Skip N tracks forward (defaults to 1)")
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(false),
    ),

  async execute({ interaction, manager }) {
    const voice = await requireMemberVoice(interaction);
    if (!voice.ok) return replyError(interaction, voice.reason);
    if (!interaction.inCachedGuild()) return;

    const player = manager.players.get(interaction.guildId);
    const current = await player?.queue.getCurrent();
    if (!player || !current) {
      await replyError(interaction, "Nothing is playing.");
      return;
    }

    const count = interaction.options.getInteger("count") ?? 1;

    try {
      // stop(N) trims N-1 upcoming tracks then ends the current; Lavalink's
      // trackEnd handler then auto-advances via playNextOnEnd.
      await player.stop(count);
    } catch (err) {
      logger.warn({ err, count }, "skip count exceeds queue size");
      await replyError(interaction, "Not enough tracks queued to skip that many.");
      return;
    }

    await interaction.reply({
      content: `⏭️ Skipped **${truncate(current.title, 70)}**${count > 1 ? ` and ${count - 1} more` : ""}.`,
    });
  },
};

export default skip;
