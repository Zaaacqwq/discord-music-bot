import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { replyError } from "../lib/voice.js";
import { deletePlaylist, listMyPlaylists } from "../db/playlists.js";
import { formatDuration, truncate } from "../lib/format.js";

const playlists: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("playlists")
    .setDescription("Manage your saved playlists.")
    .addSubcommand((s) =>
      s.setName("list").setDescription("List your saved playlists in this server."),
    )
    .addSubcommand((s) =>
      s
        .setName("delete")
        .setDescription("Delete one of your playlists.")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Playlist name")
            .setMinLength(1)
            .setMaxLength(64)
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),

  async execute({ interaction }) {
    if (!interaction.inCachedGuild()) return;
    const sub = interaction.options.getSubcommand(true);

    if (sub === "list") {
      const items = await listMyPlaylists(interaction.guildId, interaction.user.id);
      if (items.length === 0) {
        return replyError(
          interaction,
          "You don't have any saved playlists in this server. Use `/save <name>` to create one.",
        );
      }

      const lines = items.map((p, i) => {
        const totalMs = p.tracks.reduce((sum, t) => sum + t.durationMs, 0);
        return `\`${(i + 1).toString().padStart(2, "0")}.\` **${truncate(p.name, 60)}** — ${p._count.tracks} track${p._count.tracks === 1 ? "" : "s"} · \`${formatDuration(totalMs)}\``;
      });

      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle("Your playlists")
        .setDescription(lines.join("\n"))
        .setFooter({ text: `${items.length} playlist${items.length === 1 ? "" : "s"} • use /load <name> to play` });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "delete") {
      const name = interaction.options.getString("name", true).trim();
      const result = await deletePlaylist({
        guildId: interaction.guildId,
        ownerId: interaction.user.id,
        name,
      });
      if (!result.ok) {
        return replyError(interaction, `No playlist named **${truncate(name, 60)}**.`);
      }
      await interaction.reply({ content: `🗑️ Deleted **${truncate(name, 60)}**.` });
      return;
    }
  },

  async autocomplete(interaction) {
    if (!interaction.inCachedGuild()) return;
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "name") return;

    const items = await listMyPlaylists(interaction.guildId, interaction.user.id);
    const q = focused.value.toLowerCase();
    const matches = items
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 25)
      .map((p) => ({
        name: `${truncate(p.name, 80)} (${p._count.tracks})`,
        value: p.name,
      }));

    await interaction.respond(matches);
  },
};

export default playlists;
