// src/commands/play.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { getQueue } from "../music/queue";
import { resolvePlay } from "../music/router";

export default {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("播放链接或歌曲名")
    .addStringOption((o) =>
      o
        .setName("query")
        .setDescription("YouTube 链接或关键字（支持“歌手 歌名”）")
        .setRequired(true)
    )
    .addBooleanOption((o) =>
      o.setName("next").setDescription("是否插队为下一首").setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.guild!.members.cache.get(interaction.user.id);
    const vc = member?.voice.channel;
    if (!vc) {
      await interaction.reply({
        content: "请先进入一个语音频道。",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const q = getQueue(interaction.guild!);
    if (typeof (q as any).ensureConnected === "function") {
      await (q as any).ensureConnected(vc);
    } else if (!q.voice) {
      await q.connect(vc);
    }

    const query = interaction.options.getString("query", true);
    const isNext = interaction.options.getBoolean("next") ?? false;

    const resolved = await resolvePlay(query);

    if (resolved.kind === "track" && resolved.url) {
      const track = {
        title: resolved.title ?? "Track",
        url: resolved.url,
        requestedBy: interaction.user.tag,
      };

      if (isNext && typeof (q as any).enqueueNext === "function") {
        (q as any).enqueueNext(track);
        await interaction.editReply(`⏭️ 已插队为下一首：**${track.title}**`);
      } else {
        q.enqueue(track);
        await interaction.editReply(`🎵 已加入队列：**${track.title}**`);
      }
      return;
    }

    await interaction.editReply("未找到可播放的音频。");
  },
};
