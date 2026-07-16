import { prisma } from "./client.js";

export type VoiceGreeting = {
  guildId: string;
  userId: string;
  soundUri: string;
  enabled: boolean;
  cooldownSec: number;
};

export async function setGreeting(
  guildId: string,
  userId: string,
  soundUri: string,
): Promise<void> {
  await prisma.voiceGreeting.upsert({
    where: { guildId_userId: { guildId, userId } },
    update: { soundUri, enabled: true },
    create: { guildId, userId, soundUri },
  });
}

export async function removeGreeting(guildId: string, userId: string): Promise<boolean> {
  const result = await prisma.voiceGreeting.deleteMany({ where: { guildId, userId } });
  return result.count > 0;
}

export async function getGreeting(
  guildId: string,
  userId: string,
): Promise<VoiceGreeting | null> {
  return prisma.voiceGreeting.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });
}

export async function listGreetings(guildId: string): Promise<VoiceGreeting[]> {
  return prisma.voiceGreeting.findMany({ where: { guildId } });
}
