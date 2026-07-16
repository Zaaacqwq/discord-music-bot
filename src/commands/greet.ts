import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { listGreetings, removeGreeting, setGreeting } from "../db/voiceGreetings.js";
import { DEFAULT_GREETING_SOUND } from "../lib/greeting.js";

const greet: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("greet")
    .setDescription("Auto-play a sound clip when a specific user joins voice.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("set")
        .setDescription("Greet this user with a clip whenever they join voice.")
        .addUserOption((o) =>
          o.setName("user").setDescription("Who to greet").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("sound")
            .setDescription("Clip URL or Lavalink-local path (omit for the default clip)")
            .setRequired(false),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Stop greeting this user.")
        .addUserOption((o) =>
          o.setName("user").setDescription("Who to stop greeting").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s.setName("list").setDescription("Show all configured greetings."),
    ),

  async execute({ interaction }) {
    if (!interaction.inCachedGuild()) return;

    const sub = interaction.options.getSubcommand(true);

    if (sub === "set") {
      const user = interaction.options.getUser("user", true);
      const sound = interaction.options.getString("sound") ?? DEFAULT_GREETING_SOUND;
      if (user.bot) {
        await interaction.reply({ content: "❌ Bots can't be greeted." });
        return;
      }
      await setGreeting(interaction.guildId, user.id, sound);
      await interaction.reply({
        content: `👋 Got it — when <@${user.id}> joins voice, I'll hop in, play the clip, and leave.`,
      });
      return;
    }

    if (sub === "remove") {
      const user = interaction.options.getUser("user", true);
      const existed = await removeGreeting(interaction.guildId, user.id);
      await interaction.reply({
        content: existed
          ? `👋 Removed — <@${user.id}> will no longer be greeted.`
          : `🤷 <@${user.id}> had no greeting configured.`,
      });
      return;
    }

    const greetings = await listGreetings(interaction.guildId);
    if (!greetings.length) {
      await interaction.reply({
        content: "🤷 No greetings configured. Use `/greet set user:@someone` to add one.",
      });
      return;
    }
    const lines = greetings.map(
      (g) => `• <@${g.userId}> — \`${g.soundUri}\`${g.enabled ? "" : " *(disabled)*"}`,
    );
    await interaction.reply({
      content: `👋 **Voice greetings**\n${lines.join("\n")}`,
      allowedMentions: { parse: [] },
    });
  },
};

export default greet;
