import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "./types.js";
import { replyError, requireMemberVoice } from "../lib/voice.js";
import { formatDuration } from "../lib/format.js";

// Accepts "1:23", "1:23:45", or a raw second count.
function parsePositionToMs(input: string): number | null {
  const parts = input.split(":").map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  let seconds = 0;
  if (nums.length === 1) seconds = nums[0]!;
  else if (nums.length === 2) seconds = nums[0]! * 60 + nums[1]!;
  else if (nums.length === 3) seconds = nums[0]! * 3600 + nums[1]! * 60 + nums[2]!;
  else return null;
  return seconds * 1000;
}

const seek: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("seek")
    .setDescription("Jump to a position in the current track.")
    .addStringOption((o) =>
      o
        .setName("position")
        .setDescription('Position as "1:23", "1:23:45", or seconds (e.g., "90").')
        .setRequired(true),
    ),

  async execute({ interaction, manager }) {
    const voice = await requireMemberVoice(interaction);
    if (!voice.ok) return replyError(interaction, voice.reason);
    if (!interaction.inCachedGuild()) return;

    const player = manager.players.get(interaction.guildId);
    const current = await player?.queue.getCurrent();
    if (!player || !current) return replyError(interaction, "Nothing is playing.");
    if (current.isStream) return replyError(interaction, "Cannot seek inside a live stream.");

    const ms = parsePositionToMs(interaction.options.getString("position", true));
    if (ms === null) return replyError(interaction, "Could not parse position. Use `m:ss`, `h:mm:ss`, or a number of seconds.");
    if (ms > (current.duration ?? 0)) return replyError(interaction, "Position is past the end of the track.");

    await player.seek(ms);
    await interaction.reply({ content: `⏩ Seeked to **${formatDuration(ms)}**.` });
  },
};

export default seek;
