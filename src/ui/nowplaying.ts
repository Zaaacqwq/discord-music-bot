// src/ui/nowplaying.ts
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { AudioPlayerStatus } from "@discordjs/voice";
import type {
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
  Message,
} from "discord.js";
import type { GuildQueue } from "../music/queue";

// ----------- Embed + Buttons -----------
function progressBar(currentMs: number, totalSec?: number, width = 18) {
  if (!totalSec || totalSec <= 0) return "─".repeat(width);
  const totalMs = totalSec * 1000;
  const pos = Math.min(width - 1, Math.floor((currentMs / totalMs) * width));
  let bar = "";
  for (let i = 0; i < width; i++) bar += i === pos ? "🔘" : "─";
  const mmss = (ms: number) => {
    const s = Math.floor(ms / 1000),
      m = Math.floor(s / 60),
      ss = String(s % 60).padStart(2, "0");
    return `${m}:${ss}`;
  };
  return `${mmss(currentMs)} ${bar} ${mmss(totalMs)}`;
}

export function buildNowPlayingEmbed(q: GuildQueue) {
  const cur = q.current;
  const pb = progressBar(q.getPlaybackMs(), cur?.durationSec);
  return new EmbedBuilder()
    .setTitle("🎵 Now Playing")
    .setDescription(
      cur
        ? `**${cur.title}**${
            cur.requestedBy ? `\nRequested by: ${cur.requestedBy}` : ""
          }`
        : "（空）"
    )
    .addFields(cur ? [{ name: "Progress", value: pb }] : [])
    .setColor(0x5865f2)
    .setTimestamp(new Date());
}

export function buildControlRow(q: GuildQueue) {
  const playing =
    q.player.state.status === "playing" ||
    q.player.state.status === "buffering";
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ctl:prev")
      .setEmoji("⏮️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(playing ? "ctl:pause" : "ctl:resume")
      .setEmoji(playing ? "⏸️" : "▶️")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ctl:skip")
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ctl:vol:down")
      .setEmoji("🔉")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ctl:vol:up")
      .setEmoji("🔊")
      .setStyle(ButtonStyle.Secondary)
  );
}

// ----------- Auto NowPlaying Panel -----------
type PanelRec = {
  channelId: string;
  messageId: string;
  timer?: NodeJS.Timeout;
  unsub?: () => void;
};
const panels = new Map<string, PanelRec>();

async function refreshMessage(msg: Message, q: GuildQueue) {
  const embed = buildNowPlayingEmbed(q);
  const row = buildControlRow(q);
  await msg.edit({ embeds: [embed], components: [row] });
}

function stop(guildId: string) {
  const rec = panels.get(guildId);
  if (!rec) return;
  if (rec.timer) clearInterval(rec.timer);
  rec.unsub?.();
  panels.delete(guildId);
}

export async function ensureNowPlayingPanel(
  i: ChatInputCommandInteraction,
  q: GuildQueue,
  ttlMs = 10 * 60_000
) {
  const guildId = i.guildId!;
  // 1) 通过 client 重新 fetch 频道，并收窄为 Guild 文本频道
  const ch = await i.client.channels.fetch(i.channelId!).catch(() => null);
  if (!ch || !ch.isTextBased() || !("send" in ch)) {
    // 当前交互频道不可发消息（例如 DM/线程无权限等）
    return;
  }
  const channel = ch as GuildTextBasedChannel;

  // 2) 取旧面板记录并尝试获取旧消息
  let rec = panels.get(guildId);
  let msg: Message | null = null;

  if (rec && rec.channelId === channel.id) {
    msg = await channel.messages.fetch(rec.messageId).catch(() => null);
  }

  // 3) 没有旧消息就新发一条
  if (!msg) {
    const embed = buildNowPlayingEmbed(q);
    const row = buildControlRow(q);
    const sent = await channel.send({ embeds: [embed], components: [row] });
    // 如果换了消息/频道，清掉旧的定时器与订阅
    if (rec) stop(guildId);
    rec = { channelId: channel.id, messageId: sent.id };
    panels.set(guildId, rec);
    msg = sent;
  }

  // 4) 立刻刷新一次（msg 一定非空了）
  await refreshMessage(msg, q);

  // 5) 定时刷新（每 5s）
  if (rec!.timer) clearInterval(rec!.timer);
  rec!.timer = setInterval(async () => {
    if (!q.current && q.items.length === 0) return stop(guildId);
    const m = await channel.messages.fetch(rec!.messageId).catch(() => null);
    if (!m) return stop(guildId);
    await refreshMessage(m, q);
  }, 5000);

  // 6) 订阅播放器状态变化（Playing/Buffering/Idle）→ 立即刷新
  const onState = async () => {
    const m = await channel.messages.fetch(rec!.messageId).catch(() => null);
    if (m) await refreshMessage(m, q);
  };
  const onEnd = async () => {
    if (!q.current && q.items.length === 0) stop(guildId);
    else await onState();
  };

  // 先取消旧订阅，再挂新订阅
  rec!.unsub?.();
  q.player.on(AudioPlayerStatus.Playing, onState);
  q.player.on(AudioPlayerStatus.Buffering as any, onState);
  q.player.on(AudioPlayerStatus.Idle, onEnd);
  rec!.unsub = () => {
    q.player.off(AudioPlayerStatus.Playing, onState);
    q.player.off(AudioPlayerStatus.Buffering as any, onState);
    q.player.off(AudioPlayerStatus.Idle, onEnd);
  };

  // 7) TTL 到期自动清理
  setTimeout(() => stop(guildId), ttlMs).unref?.();
}
