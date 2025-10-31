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
import { ButtonInteraction } from "discord.js";
import { getQueue } from "./music/queue";
import { buildNowPlayingEmbed, buildControlRow } from "./ui/nowplaying";

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
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      /* 你的错误处理保持不变 */
    }
    return;
  }

  if (interaction.isButton()) {
    const i = interaction as ButtonInteraction;
    const q = getQueue(i.guild!);
    const id = i.customId;

    try {
      if (id === "ctl:pause") q.pause();
      if (id === "ctl:resume") q.resume();
      if (id === "ctl:skip") q.skip();
      if (id === "ctl:vol:up") q.volUp();
      if (id === "ctl:vol:down") q.volDown();

      const embed = buildNowPlayingEmbed(q);
      const row = buildControlRow(q);
      // 更新组件与进度（按钮点完立即刷新）
      if (i.replied || i.deferred) {
        await i.editReply({ embeds: [embed], components: [row] });
      } else {
        await i.reply({ embeds: [embed], components: [row], ephemeral: true });
      }
    } catch (e) {
      console.error(e);
      if (i.replied || i.deferred)
        await i.followUp({ content: "❌ 操作失败", ephemeral: true });
      else await i.reply({ content: "❌ 操作失败", ephemeral: true });
    }
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}
client.login(token);
