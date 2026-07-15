import { ButtonInteraction, MessageFlags } from "discord.js";
import type { DiscordJSManager } from "magmastream";
import { logger } from "../logger.js";
import {
  buildControlRows,
  buildNowPlayingEmbed,
  PANEL_BUTTON_IDS,
  VOLUME_MAX,
  VOLUME_MIN,
  VOLUME_STEP,
} from "../ui/nowplaying.js";

export async function handleButton(
  interaction: ButtonInteraction,
  manager: DiscordJSManager,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const player = manager.players.get(interaction.guildId);
  if (!player) {
    await interaction.reply({ content: "❌ Player is gone.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Only members in the same voice channel as the bot can drive the panel.
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.voice.channelId || member.voice.channelId !== player.voiceChannelId) {
    await interaction.reply({
      content: "❌ Join my voice channel to use the controls.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    switch (interaction.customId) {
      case PANEL_BUTTON_IDS.pauseToggle:
        await player.pause(!player.paused);
        break;
      case PANEL_BUTTON_IDS.skip:
        // Lavalink's trackEnd handler auto-pulls the next track via playNextOnEnd.
        await player.stop();
        break;
      case PANEL_BUTTON_IDS.stop:
        await player.destroy();
        await interaction.update({ components: [], embeds: [], content: "⏹️ Stopped." });
        return;
      case PANEL_BUTTON_IDS.loop:
        // Cycle: off → track → queue → off
        if (!player.trackRepeat && !player.queueRepeat) {
          player.setTrackRepeat(true);
        } else if (player.trackRepeat) {
          player.setTrackRepeat(false);
          player.setQueueRepeat(true);
        } else {
          player.setQueueRepeat(false);
        }
        break;
      case PANEL_BUTTON_IDS.shuffle:
        await player.queue.shuffle();
        break;
      case PANEL_BUTTON_IDS.volumeDown:
        await player.setVolume(Math.max(VOLUME_MIN, (player.volume ?? 100) - VOLUME_STEP));
        break;
      case PANEL_BUTTON_IDS.volumeUp:
        await player.setVolume(Math.min(VOLUME_MAX, (player.volume ?? 100) + VOLUME_STEP));
        break;
      default:
        await interaction.reply({ content: "Unknown control.", flags: MessageFlags.Ephemeral });
        return;
    }

    const current = await player.queue.getCurrent();
    if (!current) {
      await interaction.update({ components: [], embeds: [], content: "Queue is empty." });
      return;
    }

    await interaction.update({
      embeds: [await buildNowPlayingEmbed(player, current)],
      components: await buildControlRows(player),
    });
  } catch (err) {
    logger.error({ err, customId: interaction.customId }, "button handler failed");
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ Control failed.", flags: MessageFlags.Ephemeral });
    }
  }
}
