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

async function main() {
  const token = process.env.DISCORD_TOKEN!;
  const clientId = process.env.DISCORD_CLIENT_ID!;
  if (!token || !clientId)
    throw new Error("Missing DISCORD_TOKEN / DISCORD_CLIENT_ID");

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
    lyrics,
  ].map((c) => (c.data as SlashCommandBuilder).toJSON());

  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log(
    "✅ Registered GLOBAL commands for",
    clientId,
    ":",
    commands.map((c: any) => c.name).join(", ")
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
