import { Prisma } from "@prisma/client";
import { prisma } from "./client.js";

export type SerializedTrack = {
  uri: string;
  title: string;
  author: string;
  durationMs: number;
};

export type SaveResult =
  | { ok: true; trackCount: number }
  | { ok: false; reason: "exists" };

export async function savePlaylist(args: {
  guildId: string;
  ownerId: string;
  name: string;
  tracks: SerializedTrack[];
  replace: boolean;
}): Promise<SaveResult> {
  const where = {
    guildId_ownerId_name: {
      guildId: args.guildId,
      ownerId: args.ownerId,
      name: args.name,
    },
  };

  const existing = await prisma.playlist.findUnique({ where });
  if (existing) {
    if (!args.replace) return { ok: false, reason: "exists" };
    await prisma.playlist.delete({ where });
  }

  await prisma.playlist.create({
    data: {
      guildId: args.guildId,
      ownerId: args.ownerId,
      name: args.name,
      tracks: {
        create: args.tracks.map((t, i) => ({
          position: i,
          uri: t.uri,
          title: t.title,
          author: t.author,
          durationMs: t.durationMs,
        })),
      },
    },
  });

  return { ok: true, trackCount: args.tracks.length };
}

export async function listMyPlaylists(guildId: string, ownerId: string) {
  return prisma.playlist.findMany({
    where: { guildId, ownerId },
    include: {
      _count: { select: { tracks: true } },
      tracks: { select: { durationMs: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPlaylist(args: {
  guildId: string;
  ownerId: string;
  name: string;
}) {
  return prisma.playlist.findUnique({
    where: {
      guildId_ownerId_name: {
        guildId: args.guildId,
        ownerId: args.ownerId,
        name: args.name,
      },
    },
    include: { tracks: { orderBy: { position: "asc" } } },
  });
}

export type DeleteResult = { ok: true } | { ok: false; reason: "not_found" };

export async function deletePlaylist(args: {
  guildId: string;
  ownerId: string;
  name: string;
}): Promise<DeleteResult> {
  try {
    await prisma.playlist.delete({
      where: {
        guildId_ownerId_name: {
          guildId: args.guildId,
          ownerId: args.ownerId,
          name: args.name,
        },
      },
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { ok: false, reason: "not_found" };
    }
    throw err;
  }
}
