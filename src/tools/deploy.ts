import { REST, Routes } from "discord.js";
import { parseArgs } from "node:util";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { commands } from "../commands/index.js";

type Scope = "guild" | "global";
type Action = "register" | "clear";

function parseFlags(): { scope: Scope; action: Action } {
  const { values } = parseArgs({
    options: {
      scope: { type: "string", default: "guild" },
      action: { type: "string", default: "register" },
    },
  });

  const scope = values.scope as Scope;
  const action = values.action as Action;
  if (!["guild", "global"].includes(scope)) {
    throw new Error(`--scope must be "guild" or "global" (got "${scope}")`);
  }
  if (!["register", "clear"].includes(action)) {
    throw new Error(`--action must be "register" or "clear" (got "${action}")`);
  }
  return { scope, action };
}

async function main(): Promise<void> {
  const { scope, action } = parseFlags();
  const rest = new REST({ version: "10" }).setToken(config.discord.token);

  const body = action === "register"
    ? commands.map((c) =>
        "toJSON" in c.data
          ? (c.data as { toJSON: () => unknown }).toJSON()
          : c.data,
      )
    : [];

  if (scope === "guild") {
    if (!config.discord.guildId) {
      throw new Error("DISCORD_GUILD_ID is required for guild-scoped deploys.");
    }
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body },
    );
    logger.info(
      { count: Array.isArray(body) ? body.length : 0, scope, guild: config.discord.guildId },
      action === "register" ? "registered guild commands" : "cleared guild commands",
    );
  } else {
    await rest.put(Routes.applicationCommands(config.discord.clientId), { body });
    logger.info(
      { count: Array.isArray(body) ? body.length : 0, scope },
      action === "register"
        ? "registered global commands (may take up to 1 hour to appear)"
        : "cleared global commands",
    );
  }
}

main().catch((err) => {
  logger.error({ err }, "deploy failed");
  process.exit(1);
});
