import type { Client, TextBasedChannel } from "discord.js";
import {
  ManagerEventTypes,
  type DiscordJSManager,
  type Player,
  type Track,
} from "magmastream";
import { logger } from "../logger.js";
import { buildControlRows, buildNowPlayingEmbed } from "../ui/nowplaying.js";
import { startPanelRefresh, stopPanelRefresh } from "../ui/panelRefresh.js";
import { isAlwaysOn } from "../db/guildConfig.js";

// Auto-disconnect timers keyed by guild id. Cleared on next trackStart.
const idleTimers = new Map<string, NodeJS.Timeout>();
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

function clearIdleTimer(guildId: string): void {
  const existing = idleTimers.get(guildId);
  if (existing) {
    clearTimeout(existing);
    idleTimers.delete(guildId);
  }
}

async function fetchTextChannel(
  client: Client,
  channelId: string | null | undefined,
): Promise<TextBasedChannel | null> {
  if (!channelId) return null;
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased() && !channel.isDMBased()) return channel;
  } catch (err) {
    logger.warn({ err, channelId }, "failed to fetch text channel");
  }
  return null;
}

export function registerManagerEvents(client: Client, manager: DiscordJSManager): void {
  manager
    .on(ManagerEventTypes.NodeConnect, (node) => {
      logger.info({ node: node.options.identifier }, "lavalink node connected");
    })
    .on(ManagerEventTypes.NodeReconnect, (node) => {
      logger.warn({ node: node.options.identifier }, "lavalink node reconnecting");
    })
    .on(ManagerEventTypes.NodeDisconnect, (node, reason) => {
      logger.warn({ node: node.options.identifier, reason }, "lavalink node disconnected");
    })
    .on(ManagerEventTypes.NodeError, (node, error) => {
      logger.error({ node: node.options.identifier, err: error }, "lavalink node error");
    })
    .on(ManagerEventTypes.TrackStart, async (player: Player, track: Track) => {
      clearIdleTimer(player.guildId);
      // Drop the previous track's refresher before we reuse (or send) the panel.
      stopPanelRefresh(player.guildId);

      const channel = await fetchTextChannel(client, player.textChannelId);
      if (!channel?.isSendable()) return;

      const payload = {
        embeds: [await buildNowPlayingEmbed(player, track)],
        components: await buildControlRows(player),
      };

      try {
        // Reuse the existing panel message so track changes don't spam the
        // channel. Falls through to sending a fresh one if it was deleted or
        // lives in a different (stale) channel.
        const existingId = player.get<string | undefined>("panelMessageId");
        const existingChannelId = player.get<string | undefined>("panelChannelId");
        if (existingId && existingChannelId === channel.id) {
          const existing = await channel.messages.fetch(existingId).catch(() => null);
          if (existing) {
            await existing.edit(payload);
            startPanelRefresh(client, player);
            return;
          }
        }

        const message = await channel.send(payload);
        // Remember the panel message so button handlers + the refresher can edit it.
        player.set("panelMessageId", message.id);
        player.set("panelChannelId", channel.id);
        startPanelRefresh(client, player);
      } catch (err) {
        logger.warn({ err, guild: player.guildId }, "failed to send now-playing panel");
      }
    })
    .on(ManagerEventTypes.TrackEnd, (_player, _track, payload) => {
      logger.debug({ reason: payload.reason }, "track ended");
    })
    .on(ManagerEventTypes.TrackStuck, async (player, _track, payload) => {
      logger.warn({ guild: player.guildId, threshold: payload.thresholdMs }, "track stuck, skipping");
      // stop() triggers trackEnd, which Lavalink's playNextOnEnd handler auto-advances.
      await player.stop();
    })
    .on(ManagerEventTypes.TrackError, (player, track, payload) => {
      logger.error(
        { guild: player.guildId, title: track.title, exception: payload.exception },
        "track error",
      );
    })
    .on(ManagerEventTypes.QueueEnd, async (player) => {
      clearIdleTimer(player.guildId);
      stopPanelRefresh(player.guildId);

      const stayConnected = await isAlwaysOn(player.guildId);

      const channel = await fetchTextChannel(client, player.textChannelId);
      if (channel?.isSendable()) {
        try {
          await channel.send(
            stayConnected
              ? "✅ Queue finished. Staying connected (24/7 mode is on — `/247 mode:off` to disable)."
              : "✅ Queue finished. I'll leave the voice channel in 5 minutes if nothing new is queued.",
          );
        } catch (err) {
          logger.warn({ err }, "failed to send queue-end notice");
        }
      }

      if (stayConnected) {
        logger.info({ guild: player.guildId }, "queue ended; staying connected (24/7)");
        return;
      }

      const timer = setTimeout(async () => {
        idleTimers.delete(player.guildId);
        const current = await player.queue.getCurrent();
        if (!current && !player.playing) {
          logger.info({ guild: player.guildId }, "auto-disconnecting after idle timeout");
          await player.destroy();
        }
      }, IDLE_TIMEOUT_MS);
      idleTimers.set(player.guildId, timer);
    })
    .on(ManagerEventTypes.PlayerDestroy, (player) => {
      clearIdleTimer(player.guildId);
      stopPanelRefresh(player.guildId);
    });
}
