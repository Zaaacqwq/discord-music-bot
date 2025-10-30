import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  ChatInputCommandInteraction,
} from "discord.js";
import ping, {
  pause,
  resume,
  skip,
  stop,
  nowplaying,
  volume,
} from "./commands/basic";
import play from "./commands/play";
import lyrics from "./commands/lyrics";
import queue from "./commands/queue";

type Command = {
  data: { name: string };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

declare module "discord.js" {
  interface Client {
    commands: Collection<string, Command>;
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  partials: [Partials.Channel],
}) as Client & { commands: Collection<string, Command> };

client.commands = new Collection<string, Command>();
[
  ping,
  pause,
  resume,
  skip,
  stop,
  nowplaying,
  volume,
  play,
  queue,
  lyrics,
].forEach((c) => client.commands.set(c.data.name, c));

client.once("clientReady", () =>
  console.log(`[READY] Logged in as ${client.user?.tag}`)
);

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied)
      await interaction.followUp({
        content: "❌ 命令执行失败。",
        ephemeral: true,
      });
    else
      await interaction.reply({
        content: "❌ 命令执行失败。",
        ephemeral: true,
      });
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}
client.login(token);
