import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("显示当前歌曲歌词"),
  async execute(i: ChatInputCommandInteraction) {
    await i.reply({
      content: "歌词功能稍后接入（Genius/lyrics.ovh 或 网易云）",
      ephemeral: true,
    });
  },
};
