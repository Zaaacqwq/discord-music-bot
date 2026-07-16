import type { Client, User, VoiceState } from "discord.js";
import { TrackUtils, type DiscordJSManager, type Player, type Track } from "magmastream";
import { getGreeting } from "../db/voiceGreetings.js";
import { logger } from "../logger.js";

/** Default clip shipped in ./lavalink/sounds — path as seen from inside the Lavalink container. */
export const DEFAULT_GREETING_SOUND = "/opt/Lavalink/sounds/a-shen.mp3";

// If the clip somehow never finishes (node hiccup, bad file), force-leave.
const GREETING_MAX_MS = 15_000;

// How long to wait for Discord to hand over the voice session before giving up.
const VOICE_READY_TIMEOUT_MS = 5_000;
// Small grace period after voice is ready so the opus stream has warmed up.
const VOICE_WARMUP_MS = 400;

// Last greeting timestamp per guild:user — rejoin spam guard.
const lastGreetedAt = new Map<string, number>();

/**
 * Watches voice state updates; when a configured user freshly joins a voice
 * channel (not moving between channels), the bot hops in, plays their clip,
 * and leaves. Never interrupts an existing player (music or 24/7).
 */
export function registerVoiceGreetings(client: Client, manager: DiscordJSManager): void {
  client.on("voiceStateUpdate", (oldState, newState) => {
    void handleVoiceStateUpdate(manager, oldState, newState).catch((err) => {
      logger.error({ err, guild: newState.guild.id }, "voice greeting failed");
    });
  });
}

async function handleVoiceStateUpdate(
  manager: DiscordJSManager,
  oldState: VoiceState,
  newState: VoiceState,
): Promise<void> {
  // Fresh joins only — ignore bots, channel moves, and mute/deafen updates.
  if (!newState.channelId || oldState.channelId || newState.member?.user.bot) return;

  const guildId = newState.guild.id;
  const userId = newState.id;

  const greeting = await getGreeting(guildId, userId);
  if (!greeting?.enabled) return;

  // An existing player means music is playing or the bot is parked (24/7 /
  // idle-wait). Greeting would hijack it — skip.
  if (manager.players.get(guildId)) return;

  const key = `${guildId}:${userId}`;
  const last = lastGreetedAt.get(key) ?? 0;
  if (Date.now() - last < greeting.cooldownSec * 1000) return;
  lastGreetedAt.set(key, Date.now());

  const player = manager.create({
    guildId,
    // Unused (greeting players never post panels) but required by create().
    textChannelId: newState.channelId,
    voiceChannelId: newState.channelId,
    selfDeafen: true,
    // Clip is already normalized to the clipping ceiling; Lavalink amplifies past 100.
    volume: 300,
  });
  // Flag checked in lavalink/events.ts to suppress panels + queue-end notices.
  player.set("isGreeting", true);
  player.connect();

  try {
    const track = await resolveGreetingTrack(manager, player, greeting.soundUri, newState.member?.user);
    if (!track) {
      logger.warn({ guild: guildId, uri: greeting.soundUri }, "greeting sound not loadable");
      await player.destroy();
      return;
    }

    // connect() flips player.state to "Connected" synchronously, but Lavalink
    // can't transmit until Discord's voice server update has been forwarded.
    // Playing before that point ends the track silently.
    if (!(await waitForVoiceReady(player))) {
      logger.warn({ guild: guildId }, "voice session never became ready, aborting greeting");
      await player.destroy();
      return;
    }
    await sleep(VOICE_WARMUP_MS);

    await player.queue.add(track);
    await player.play();
    logger.info({ guild: guildId, user: userId }, "playing voice greeting");
  } catch (err) {
    logger.error({ err, guild: guildId, uri: greeting.soundUri }, "greeting playback failed");
    await player.destroy();
    return;
  }

  setTimeout(() => {
    if (manager.players.get(guildId) !== player) return;
    logger.warn({ guild: guildId }, "greeting exceeded max duration, force-destroying");
    void player.destroy().catch(() => undefined);
  }, GREETING_MAX_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolves once Lavalink has everything it needs to transmit audio: the voice
 * server event (token + endpoint) and the session id, both forwarded from
 * Discord after connect(). Returns false on timeout.
 */
async function waitForVoiceReady(player: Player): Promise<boolean> {
  const deadline = Date.now() + VOICE_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const voice = player.voiceState;
    if (voice?.event?.token && voice.event.endpoint && voice.sessionId) return true;
    await sleep(100);
  }
  return false;
}

/**
 * URLs go through the normal search path. Anything else is a file path on the
 * Lavalink host — magmastream's search() would wrap it in a `<source>:` search
 * prefix (never matching), so load it via the raw /v4/loadtracks identifier.
 */
async function resolveGreetingTrack(
  manager: DiscordJSManager,
  player: Player,
  soundUri: string,
  requester: User | undefined,
): Promise<Track | null> {
  if (/^https?:\/\//.test(soundUri)) {
    const result = await player.search(soundUri, requester);
    if (result.loadType !== "track" && result.loadType !== "search") return null;
    return result.tracks[0] ?? null;
  }

  const res = (await manager.useableNode.rest.get(
    `/v4/loadtracks?identifier=${encodeURIComponent(soundUri)}`,
  )) as { loadType: string; data: unknown } | null;
  if (res?.loadType !== "track" || !res.data) return null;
  return TrackUtils.build(res.data as Parameters<typeof TrackUtils.build>[0], requester);
}
