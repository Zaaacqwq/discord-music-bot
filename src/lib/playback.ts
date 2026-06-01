import type { Player } from "magmastream";

/**
 * Idempotent "make playback happen". Safe to call after any queue mutation.
 * - If already playing: noop.
 * - If paused (incl. the phantom paused state from a failed session restore):
 *   unpauses, then plays whatever the queue's current track is.
 * - If idle: plays current (which queue.add() auto-sets when the queue was empty).
 *
 * Always call this AFTER mutating the queue, never before.
 */
export async function startIfIdle(player: Player): Promise<void> {
  if (player.playing) return;
  if (player.paused) await player.pause(false);
  await player.play();
}
