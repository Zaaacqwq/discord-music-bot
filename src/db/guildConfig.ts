import { prisma } from "./client.js";

/**
 * Upserts a default GuildConfig row. Cheap — called lazily from command paths
 * that need the row to exist.
 */
export async function getOrCreateGuildConfig(guildId: string) {
  return prisma.guildConfig.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });
}

export async function setAlwaysOn(guildId: string, alwaysOn: boolean): Promise<void> {
  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { alwaysOn },
    create: { guildId, alwaysOn },
  });
}

/**
 * Pins the now-playing panel (and queue-end messages) to a specific text
 * channel. Pass null to clear — the panel then follows the command channel.
 */
export async function setMusicChannel(guildId: string, channelId: string | null): Promise<void> {
  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { defaultTextChannelId: channelId },
    create: { guildId, defaultTextChannelId: channelId },
  });
}

export async function getMusicChannel(guildId: string): Promise<string | null> {
  const config = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { defaultTextChannelId: true },
  });
  return config?.defaultTextChannelId ?? null;
}

export async function isAlwaysOn(guildId: string): Promise<boolean> {
  const config = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { alwaysOn: true },
  });
  return config?.alwaysOn ?? false;
}
