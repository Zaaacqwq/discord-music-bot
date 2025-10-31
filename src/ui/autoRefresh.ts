import { AudioPlayerStatus } from "@discordjs/voice";
import type { ChatInputCommandInteraction } from "discord.js";
import type { GuildQueue } from "../music/queue";
import { buildNowPlayingEmbed, buildControlRow } from "./nowplaying";

const timers = new Map<string, NodeJS.Timeout>();

export function stopNowPlayingAutoRefresh(key: string) {
  const t = timers.get(key);
  if (t) clearInterval(t);
  timers.delete(key);
}

export function startNowPlayingAutoRefresh(
  i: ChatInputCommandInteraction,
  q: GuildQueue,
  ttlMs = 2 * 60_000
) {
  const key = `${i.guildId}:${i.user.id}`;

  // 清理旧定时器（避免重复）
  stopNowPlayingAutoRefresh(key);

  const update = async () => {
    try {
      const embed = buildNowPlayingEmbed(q);
      const row = buildControlRow(q);
      await i.editReply({ embeds: [embed], components: [row] });
    } catch {}
  };

  // 先刷一次
  void update();

  // 定时刷新
  const t = setInterval(update, 5_000);
  timers.set(key, t);

  // 超时后自动停止，防内存泄漏
  const stopAt = setTimeout(() => stopNowPlayingAutoRefresh(key), ttlMs);

  // 播放器状态变更时，立即刷新一次
  const onState = () => void update();
  q.player.on(AudioPlayerStatus.Playing, onState);
  q.player.on(AudioPlayerStatus.Buffering as any, onState);
  q.player.on(AudioPlayerStatus.Idle, onState);

  // 到期时移除监听
  setTimeout(() => {
    q.player.off(AudioPlayerStatus.Playing, onState);
    q.player.off(AudioPlayerStatus.Buffering as any, onState);
    q.player.off(AudioPlayerStatus.Idle, onState);
    clearTimeout(stopAt);
  }, ttlMs + 1000);
}
