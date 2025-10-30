import { EmbedBuilder } from "discord.js";
import { GuildQueue } from "../music/queue";

export function queueEmbed(q: GuildQueue) {
  const desc = [
    q.current ? `▶️ **Now**: ${q.current.title}` : "队列为空",
    "",
    ...q.items.slice(0, 10).map((t, i) => `${i + 1}. ${t.title}`),
  ].join("\n");
  return new EmbedBuilder()
    .setTitle("🎶 队列")
    .setDescription(desc)
    .setTimestamp();
}
