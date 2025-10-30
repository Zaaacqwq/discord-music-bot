// src/commands/basic.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { getQueue } from "../music/queue";

const ping = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency"),
  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({
      content: "Pinging...",
      ephemeral: true,
      fetchReply: true,
    });
    const rt = sent.createdTimestamp - interaction.createdTimestamp;
    const api = interaction.client.ws.ping;
    await interaction.editReply(`🏓 Pong! round-trip: ${rt}ms, api: ${api}ms`);
  },
};

export const pause = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("暂停当前播放"),
  async execute(i: ChatInputCommandInteraction) {
    getQueue(i.guild!).pause();
    await i.reply({ content: "⏸️ 已暂停", ephemeral: true });
  },
};

export const resume = {
  data: new SlashCommandBuilder().setName("resume").setDescription("继续播放"),
  async execute(i: ChatInputCommandInteraction) {
    getQueue(i.guild!).resume();
    await i.reply({ content: "▶️ 已继续", ephemeral: true });
  },
};

export const skip = {
  data: new SlashCommandBuilder().setName("skip").setDescription("跳到下一首"),
  async execute(i: ChatInputCommandInteraction) {
    getQueue(i.guild!).skip();
    await i.reply({ content: "⏭️ 已跳过", ephemeral: true });
  },
};

export const stop = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("停止并清空队列"),
  async execute(i: ChatInputCommandInteraction) {
    getQueue(i.guild!).stop();
    await i.reply({ content: "⏹️ 已停止", ephemeral: true });
  },
};

export const nowplaying = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("当前播放"),
  async execute(i: ChatInputCommandInteraction) {
    const c = getQueue(i.guild!).current;
    await i.reply({
      content: c ? `🎵 **${c.title}**` : "（空）",
      ephemeral: true,
    });
  },
};

export const volume = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("设置音量（0~200）")
    .addIntegerOption((o) =>
      o
        .setName("v")
        .setDescription("音量百分比（0~200）")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(200)
    ),
  async execute(i: ChatInputCommandInteraction) {
    const v = i.options.getInteger("v", true);
    getQueue(i.guild!).setVolume(v / 100);
    await i.reply({ content: `🔊 音量：${v}%`, ephemeral: true });
  },
};

export default ping;
