import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { getQueue } from "../music/queue";
import { resolvePlay } from "../music/router";
import type { PlayResolved } from "../types";
import { ensureNowPlayingPanel } from "../ui/nowplaying";

export default {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("播放链接或歌曲名")
    .addStringOption((o) =>
      o
        .setName("query")
        .setDescription("链接或关键字（支持 Spotify / YouTube / 歌手+歌名）")
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

    const resolved = (await resolvePlay(query)) as PlayResolved;

    if (resolved.kind === "track") {
      const track = {
        title: resolved.title,
        url: resolved.url,
        requestedBy: interaction.user.tag,
      };
      if (isNext && typeof (q as any).enqueueNext === "function")
        (q as any).enqueueNext(track);
      else q.enqueue(track);
      await interaction.editReply(
        `${isNext ? "⏭️ 已插队为下一首" : "🎵 已加入队列"}：**${track.title}**`
      );
      await ensureNowPlayingPanel(interaction, q);
      return;
    }

    if (resolved.kind === "playlist") {
      const items = resolved.items.map((i) => ({
        title: i.title,
        url: i.url,
        requestedBy: interaction.user.tag,
      }));

      if (isNext && typeof (q as any).enqueueManyNext === "function") {
        (q as any).enqueueManyNext(items);
        await interaction.editReply(
          `⏭️ 歌单已插到“下一首”：**${items.length}** 首${
            resolved.title ? `（${resolved.title}）` : ""
          }`
        );
      } else {
        q.enqueueMany(items);
        await interaction.editReply(
          `📚 歌单加入：**${items.length}** 首${
            resolved.title ? `（${resolved.title}）` : ""
          }`
        );
      }
      await ensureNowPlayingPanel(interaction, q);
      return;
    }

    await interaction.editReply(`未找到可播放的音频：**${resolved.title}**`);
  },
};
