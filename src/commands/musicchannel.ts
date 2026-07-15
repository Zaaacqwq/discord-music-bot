import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { getMusicChannel, setMusicChannel } from "../db/guildConfig.js";

const musicchannel: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("musicchannel")
    .setDescription("Pin bot messages (now-playing panel) to one channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("Channel to pin the panel to (omit to view current)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .addBooleanOption((o) =>
      o
        .setName("clear")
        .setDescription("Unpin — panel follows the command channel again")
        .setRequired(false),
    ),

  async execute({ interaction }) {
    if (!interaction.inCachedGuild()) return;

    const channel = interaction.options.getChannel("channel");
    const clear = interaction.options.getBoolean("clear") ?? false;

    if (clear) {
      await setMusicChannel(interaction.guildId, null);
      await interaction.reply({
        content: "📌 Unpinned. The panel now follows whichever channel commands are used in.",
      });
      return;
    }

    if (!channel) {
      const current = await getMusicChannel(interaction.guildId);
      await interaction.reply({
        content: current
          ? `📌 Panel is pinned to <#${current}>.`
          : "📌 No pinned channel — the panel follows the command channel.",
      });
      return;
    }

    // Bot must be able to actually post there, otherwise panels silently vanish.
    const me = await interaction.guild.members.fetchMe();
    const perms = interaction.guild.channels.cache
      .get(channel.id)
      ?.permissionsFor(me);
    if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
      await interaction.reply({
        content: `❌ I can't send messages in <#${channel.id}>. Fix my permissions there first.`,
      });
      return;
    }

    await setMusicChannel(interaction.guildId, channel.id);
    await interaction.reply({
      content: `📌 Pinned. Now-playing panels will go to <#${channel.id}>.`,
    });
  },
};

export default musicchannel;
