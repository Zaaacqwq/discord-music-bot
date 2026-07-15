import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { Player, Track } from "magmastream";
import { formatDuration, progressBar, truncate } from "../lib/format.js";

export const PANEL_BUTTON_IDS = {
  pauseToggle: "ctl:pauseToggle",
  skip: "ctl:skip",
  stop: "ctl:stop",
  loop: "ctl:loop",
  shuffle: "ctl:shuffle",
  volumeDown: "ctl:volumeDown",
  volumeUp: "ctl:volumeUp",
} as const;

// Matches the /volume slash command's bounds.
export const VOLUME_MIN = 0;
export const VOLUME_MAX = 150;
export const VOLUME_STEP = 10;

export async function buildNowPlayingEmbed(player: Player, track: Track): Promise<EmbedBuilder> {
  const position = player.position ?? 0;
  const duration = track.duration ?? 0;
  const loopLabel = player.trackRepeat ? "Track" : player.queueRepeat ? "Queue" : "Off";
  const queueSize = await player.queue.size();

  const embed = new EmbedBuilder()
    .setColor(0x1db954)
    .setTitle(truncate(track.title, 80))
    .setURL(track.uri || null)
    .setAuthor({ name: track.author || "Unknown" })
    .setDescription(
      track.isStream
        ? "🔴 **LIVE**"
        : `\`${formatDuration(position)}\` ${progressBar(position, duration)} \`${formatDuration(duration)}\``,
    )
    .addFields(
      { name: "Volume", value: `${player.volume ?? 100}%`, inline: true },
      { name: "Loop", value: loopLabel, inline: true },
      {
        name: "Up next",
        value: queueSize > 0 ? `${queueSize} track${queueSize === 1 ? "" : "s"} queued` : "—",
        inline: true,
      },
    );

  const artwork = track.artworkUrl ?? track.thumbnail;
  if (artwork) embed.setThumbnail(artwork);

  const requester = track.requester as { id?: string; username?: string } | undefined;
  if (requester?.id) {
    embed.setFooter({ text: `Requested by ${requester.username ?? requester.id}` });
  }

  return embed;
}

export async function buildControlRows(player: Player): Promise<ActionRowBuilder<ButtonBuilder>[]> {
  const isPaused = player.paused;
  const queueSize = await player.queue.size();
  const current = await player.queue.getCurrent();
  const volume = player.volume ?? 100;

  const playbackRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_BUTTON_IDS.pauseToggle)
      .setEmoji(isPaused ? "▶️" : "⏸️")
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(PANEL_BUTTON_IDS.skip)
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(queueSize === 0 && !current),
    new ButtonBuilder()
      .setCustomId(PANEL_BUTTON_IDS.loop)
      .setEmoji("🔁")
      .setStyle(
        player.trackRepeat || player.queueRepeat ? ButtonStyle.Primary : ButtonStyle.Secondary,
      ),
    new ButtonBuilder()
      .setCustomId(PANEL_BUTTON_IDS.shuffle)
      .setEmoji("🔀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(queueSize < 2),
    new ButtonBuilder()
      .setCustomId(PANEL_BUTTON_IDS.stop)
      .setEmoji("⏹️")
      .setStyle(ButtonStyle.Danger),
  );

  const volumeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_BUTTON_IDS.volumeDown)
      .setEmoji("🔉")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(volume <= VOLUME_MIN),
    new ButtonBuilder()
      .setCustomId("ctl:volumeDisplay")
      .setLabel(`${volume}%`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(PANEL_BUTTON_IDS.volumeUp)
      .setEmoji("🔊")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(volume >= VOLUME_MAX),
  );

  return [playbackRow, volumeRow];
}
