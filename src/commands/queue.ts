import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { replyError, requireMemberVoice } from "../lib/voice.js";
import { formatDuration, truncate } from "../lib/format.js";

const PAGE_SIZE = 10;

const queueCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Manage the queue.")
    .addSubcommand((s) =>
      s
        .setName("show")
        .setDescription("List the upcoming queue.")
        .addIntegerOption((o) =>
          o.setName("page").setDescription("Page number (10 per page)").setMinValue(1),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Remove a single track by its queue position.")
        .addIntegerOption((o) =>
          o
            .setName("position")
            .setDescription("Position in the queue (starting at 1)")
            .setMinValue(1)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) => s.setName("clear").setDescription("Remove every upcoming track.")),

  async execute({ interaction, manager }) {
    if (!interaction.inCachedGuild()) return;
    const player = manager.players.get(interaction.guildId);
    if (!player) return replyError(interaction, "I'm not in a voice channel.");

    const sub = interaction.options.getSubcommand(true);

    if (sub === "show") {
      const current = await player.queue.getCurrent();
      const upcoming = await player.queue.getTracks();

      if (!current && upcoming.length === 0) {
        return replyError(interaction, "Queue is empty.");
      }

      const page = interaction.options.getInteger("page") ?? 1;
      const totalPages = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * PAGE_SIZE;
      const slice = upcoming.slice(start, start + PAGE_SIZE);

      const lines = slice.map((track, i) => {
        const idx = start + i + 1;
        return `\`${idx.toString().padStart(2, "0")}.\` [${truncate(track.title, 60)}](${track.uri}) — \`${formatDuration(track.duration ?? 0)}\``;
      });

      const totalDuration = upcoming.reduce((sum, t) => sum + (t.duration ?? 0), 0);

      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle("Queue")
        .setDescription(
          [
            current
              ? `**Now playing**\n[${truncate(current.title, 60)}](${current.uri}) — \`${formatDuration(current.duration ?? 0)}\`\n`
              : "",
            upcoming.length > 0 ? "**Up next**" : "*No upcoming tracks.*",
            ...lines,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .setFooter({
          text: `Page ${safePage}/${totalPages} • ${upcoming.length} upcoming • ${formatDuration(totalDuration)} total`,
        });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "remove") {
      const voice = await requireMemberVoice(interaction);
      if (!voice.ok) return replyError(interaction, voice.reason);

      const size = await player.queue.size();
      const pos = interaction.options.getInteger("position", true) - 1;
      if (pos < 0 || pos >= size) {
        return replyError(interaction, `Position must be between 1 and ${size}.`);
      }
      const removed = (await player.queue.remove(pos, pos + 1))[0];
      await interaction.reply({
        content: removed
          ? `🗑️ Removed **${truncate(removed.title, 70)}** from the queue.`
          : "🗑️ Removed track from the queue.",
      });
      return;
    }

    if (sub === "clear") {
      const voice = await requireMemberVoice(interaction);
      if (!voice.ok) return replyError(interaction, voice.reason);

      const count = await player.queue.size();
      await player.queue.clear();
      await interaction.reply({
        content: `🗑️ Cleared **${count}** track${count === 1 ? "" : "s"} from the queue.`,
      });
      return;
    }
  },
};

export default queueCommand;
