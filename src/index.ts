import {
  Client,
  GatewayIntentBits,
  MessageFlags,
  Partials,
} from "discord.js";

import { config } from "./config.js";
import { logger } from "./logger.js";
import { createManager } from "./lavalink/manager.js";
import { registerManagerEvents } from "./lavalink/events.js";
import { buildCommandCollection } from "./commands/index.js";
import { handleButton } from "./interactions/buttons.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  partials: [Partials.Channel],
});

const manager = createManager(client);
registerManagerEvents(client, manager);
const commands = buildCommandCollection();

client.once("clientReady", (c) => {
  logger.info({ user: c.user.tag, guilds: c.guilds.cache.size }, "discord client ready");
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const cmd = commands.get(interaction.commandName);
      if (!cmd) return;
      await cmd.execute({ interaction, manager });
      return;
    }

    if (interaction.isAutocomplete()) {
      const cmd = commands.get(interaction.commandName);
      if (cmd?.autocomplete) await cmd.autocomplete(interaction, manager);
      return;
    }

    if (interaction.isButton()) {
      await handleButton(interaction, manager);
      return;
    }
  } catch (err) {
    logger.error({ err, command: "commandName" in interaction ? interaction.commandName : null }, "interaction handler failed");
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ Something went wrong handling that interaction.",
          flags: MessageFlags.Ephemeral,
        });
      } catch {
        /* swallow — we already logged the real error */
      }
    }
  }
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  for (const player of manager.players.values()) {
    try {
      player.destroy();
    } catch {
      /* ignore — best-effort cleanup */
    }
  }
  await client.destroy();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error
    ? { name: reason.name, message: reason.message, stack: reason.stack }
    : { value: reason };
  logger.error({ err }, "unhandled promise rejection");
});

await client.login(config.discord.token);
