import type { Client } from "discord.js";
import { DiscordJSManager } from "magmastream";
import { config } from "../config.js";
import { logger } from "../logger.js";

export function createManager(client: Client): DiscordJSManager {
  // `as never` works around a TS dual-resolution-mode hazard: magmastream's
  // .d.ts imports discord.js with `resolution-mode: "import"`, ours doesn't,
  // so TS sees two structurally identical-but-distinct Client classes.
  const manager = new DiscordJSManager(client as never, {
    nodes: [
      {
        identifier: "main",
        host: config.lavalink.host,
        port: config.lavalink.port,
        password: config.lavalink.password,
        useSSL: config.lavalink.secure,
        maxRetryAttempts: 8,
        retryDelayMs: 5_000,
      },
    ],
    playNextOnEnd: true,
    clientName: "discord-music-bot/2.0",
  });

  client.once("clientReady", async (readyClient) => {
    await manager.init({ clientId: readyClient.user.id });
    // magmastream tries to restore players from Lavalink on every connect,
    // and on failure ("Session not found") it can leave a phantom paused
    // player behind that silently swallows the next play() call. We don't
    // restore in V1 anyway — SQLite snapshots will do that in V1.1 — so
    // drop anything magmastream put there.
    for (const player of [...manager.players.values()]) {
      try {
        await player.destroy();
      } catch (err) {
        logger.warn({ err, guild: player.guildId }, "failed to drop phantom player");
      }
    }
    logger.info({ user: readyClient.user.tag }, "magmastream manager initialised");
  });

  return manager;
}
