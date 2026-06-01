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

export async function isAlwaysOn(guildId: string): Promise<boolean> {
  const config = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { alwaysOn: true },
  });
  return config?.alwaysOn ?? false;
}
