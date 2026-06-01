import {
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  type CacheType,
} from "discord.js";

export type VoiceCheckResult =
  | { ok: true; voiceChannelId: string; member: GuildMember }
  | { ok: false; reason: string };

/**
 * Ensures the invoker is in a voice channel. Also blocks if the bot is already
 * playing in a different channel — that branch is left to the caller so it can
 * issue a targeted error message naming the bot's channel.
 *
 * Fetches the member explicitly so we don't depend on the privileged
 * GuildMembers intent.
 */
export async function requireMemberVoice(
  interaction: ChatInputCommandInteraction<CacheType>,
): Promise<VoiceCheckResult> {
  if (!interaction.inCachedGuild()) {
    return { ok: false, reason: "This command can only be used in a server." };
  }
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const voiceChannelId = member.voice.channelId;
  if (!voiceChannelId) {
    return { ok: false, reason: "You need to join a voice channel first." };
  }

  const botVoice = interaction.guild.members.me?.voice.channelId;
  if (botVoice && botVoice !== voiceChannelId) {
    return {
      ok: false,
      reason: `I'm already playing in <#${botVoice}>. Join me there to control playback.`,
    };
  }

  return { ok: true, voiceChannelId, member };
}

export async function replyError(
  interaction: ChatInputCommandInteraction,
  reason: string,
): Promise<void> {
  const content = `❌ ${reason}`;
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content });
  } else {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}
