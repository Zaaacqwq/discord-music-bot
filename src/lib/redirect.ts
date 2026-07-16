import {
  ChatInputCommandInteraction,
  MessageFlags,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type MessagePayload,
} from "discord.js";
import { logger } from "../logger.js";

// Error/no-result replies stay ephemeral to the invoker instead of being
// forwarded — nobody else needs to see "no matches" in the music channel.
const PRIVATE_PREFIXES = ["❌", "🤷", "❓"];

function isPrivateContent(content: string | null | undefined): boolean {
  return !!content && PRIVATE_PREFIXES.some((p) => content.startsWith(p));
}

function isEphemeral(opts: InteractionReplyOptions): boolean {
  const flags = opts.flags;
  if (typeof flags === "number" || typeof flags === "bigint") {
    return (BigInt(flags) & BigInt(MessageFlags.Ephemeral)) !== 0n;
  }
  return false;
}

/**
 * Rewires an interaction so its public replies land in the guild's pinned
 * music channel instead of the channel the command was typed in. The invoker
 * gets an ephemeral pointer; errors stay ephemeral in place.
 *
 * Call only when a pinned channel exists and differs from the command channel.
 */
export function applyChannelRedirect(
  interaction: ChatInputCommandInteraction<"cached">,
  targetChannelId: string,
): void {
  const forward = async (
    opts: InteractionReplyOptions | InteractionEditReplyOptions,
  ): Promise<boolean> => {
    try {
      const channel = await interaction.client.channels
        .fetch(targetChannelId)
        .catch(() => null);
      if (!channel?.isTextBased() || !channel.isSendable()) return false;
      await channel.send({
        content: opts.content ?? undefined,
        embeds: opts.embeds ?? [],
        components: opts.components ?? [],
        files: opts.files ?? [],
      });
      return true;
    } catch (err) {
      logger.warn({ err, targetChannelId }, "redirect forward failed");
      return false;
    }
  };

  const pointer = `➡️ 已发送到 <#${targetChannelId}>`;
  const origReply = interaction.reply.bind(interaction);
  const origDefer = interaction.deferReply.bind(interaction);
  const origEdit = interaction.editReply.bind(interaction);

  interaction.deferReply = ((opts?: Parameters<typeof origDefer>[0]) =>
    // Force ephemeral so the eventual editReply pointer is invoker-only.
    origDefer({ ...opts, flags: MessageFlags.Ephemeral })) as typeof interaction.deferReply;

  interaction.reply = (async (
    opts: string | MessagePayload | InteractionReplyOptions,
  ) => {
    const o: InteractionReplyOptions =
      typeof opts === "string" ? { content: opts } : (opts as InteractionReplyOptions);
    if (isEphemeral(o) || isPrivateContent(o.content)) return origReply(o);
    const sent = await forward(o);
    return origReply(
      sent
        ? { content: pointer, flags: MessageFlags.Ephemeral }
        : o, // target channel unreachable — fall back to replying in place
    );
  }) as typeof interaction.reply;

  interaction.editReply = (async (
    opts: string | MessagePayload | InteractionEditReplyOptions,
  ) => {
    const o: InteractionEditReplyOptions =
      typeof opts === "string" ? { content: opts } : (opts as InteractionEditReplyOptions);
    if (isPrivateContent(o.content)) return origEdit(o);
    const sent = await forward(o);
    return origEdit(sent ? { content: pointer, embeds: [], components: [] } : o);
  }) as typeof interaction.editReply;
}
