import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";
import ping, {
  pause,
  resume,
  skip,
  stop,
  nowplaying,
  volume,
} from "../commands/basic";
import play from "../commands/play";
import lyrics from "../commands/lyrics";
import queue from "../commands/queue";

async function main() {
  const token = process.env.DISCORD_TOKEN!;
  const clientId = process.env.DISCORD_CLIENT_ID!;
  const guildId = process.env.DISCORD_GUILD_ID!;
  if (!token || !clientId || !guildId)
    throw new Error(
      "Missing DISCORD_TOKEN / DISCORD_CLIENT_ID / DISCORD_GUILD_ID"
    );

  const rest = new REST({ version: "10" }).setToken(token);
  const commands = [
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
  ].map((c) => (c.data as SlashCommandBuilder).toJSON());

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  });
  console.log(
    "✅ Registered GUILD commands on",
    guildId,
    ":",
    commands.map((c: any) => c.name).join(", ")
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
