import type { Client } from "discord.js";
import type { Player } from "magmastream";
import { logger } from "../logger.js";
import { buildControlRow, buildNowPlayingEmbed } from "./nowplaying.js";

// Discord rate limits message edits at ~5/5s per channel. 8s gives headroom
// while still moving the progress bar visibly (~13% of a 60s track per tick).
const REFRESH_INTERVAL_MS = 8_000;

type Refresher = {
  intervalId: NodeJS.Timeout;
};

const refreshers = new Map<string, Refresher>();

export function stopPanelRefresh(guildId: string): void {
  const meta = refreshers.get(guildId);
  if (!meta) return;
  clearInterval(meta.intervalId);
  refreshers.delete(guildId);
}

/**
 * Starts a per-guild interval that edits the now-playing panel message in
 * place so the progress bar visibly advances. The panel's message + channel
 * IDs come from `player.set("panelMessageId" / "panelChannelId")` — set by
 * the TrackStart handler when it sends the panel.
 *
 * Self-stops when the panel message was deleted by a user.
 */
export function startPanelRefresh(client: Client, player: Player): void {
  stopPanelRefresh(player.guildId);

  const intervalId = setInterval(async () => {
    try {
      const current = await player.queue.getCurrent();
      // Nothing to show, no point refreshing
      if (!current) return;
      // Live streams have no meaningful position — embed is static
      if (current.isStream) return;
      // Position doesn't advance while paused — skip the API call
      if (player.paused) return;

      const messageId = player.get<string | undefined>("panelMessageId");
      const channelId = player.get<string | undefined>("panelChannelId");
      if (!messageId || !channelId) return;

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel?.isTextBased() || channel.isDMBased()) {
        stopPanelRefresh(player.guildId);
        return;
      }

      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) {
        // User deleted the panel — give up on this guild until next trackStart
        stopPanelRefresh(player.guildId);
        return;
      }

      await message.edit({
        embeds: [await buildNowPlayingEmbed(player, current)],
        components: [await buildControlRow(player)],
      });
    } catch (err) {
      logger.warn({ err, guild: player.guildId }, "panel refresh tick failed");
    }
  }, REFRESH_INTERVAL_MS);

  refreshers.set(player.guildId, { intervalId });
}
