// src/commands/queue.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { getQueue } from "../music/queue";
import { queueEmbed } from "../ui/queueMessage";

export default {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("查看和管理队列")
    .addSubcommand((sc) =>
      sc.setName("show").setDescription("显示当前与后续曲目")
    )
    .addSubcommand((sc) =>
      sc
        .setName("remove")
        .setDescription("删除第 N 首（从下一首开始计 1）")
        .addIntegerOption((o) =>
          o
            .setName("index")
            .setDescription("要删除的序号（1 表示下一首）")
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName("clear")
        .setDescription("清空后续队列；all=true 时连当前也停止")
        .addBooleanOption((o) =>
          o
            .setName("all")
            .setDescription("是否包含当前播放（默认否）")
            .setRequired(false)
        )
    ),
  async execute(i: ChatInputCommandInteraction) {
    const q = getQueue(i.guild!);
    const sub = i.options.getSubcommand();

    if (sub === "remove") {
      const idx = i.options.getInteger("index", true);
      const removed = (q as any).removeAt(idx);
      if (!removed) {
        await i.reply({
          content: `❌ 没有第 **${idx}** 首。`,
          ephemeral: true,
        });
        return;
      }
      await i.reply({
        content: `🗑️ 已移除第 **${idx}** 首：**${removed.title}**`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "clear") {
      const all = i.options.getBoolean("all") ?? false;
      (q as any).clear(all);
      await i.reply({
        content: all ? "🧹 已清空队列并停止播放。" : "🧹 已清空后续队列。",
        ephemeral: true,
      });
      return;
    }

    // 默认：show
    const embed = queueEmbed(q);
    await i.reply({ embeds: [embed], ephemeral: true });
  },
};
