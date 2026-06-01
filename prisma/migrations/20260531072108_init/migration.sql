-- CreateTable
CREATE TABLE "GuildConfig" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "volume" INTEGER NOT NULL DEFAULT 80,
    "loopMode" TEXT NOT NULL DEFAULT 'none',
    "alwaysOn" BOOLEAN NOT NULL DEFAULT false,
    "defaultTextChannelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QueueSnapshot" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "voiceChannelId" TEXT NOT NULL,
    "textChannelId" TEXT NOT NULL,
    "currentPositionMs" INTEGER NOT NULL DEFAULT 0,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QueueSnapshot_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig" ("guildId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SnapshotTrack" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshotId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "uri" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "requesterId" TEXT,
    "artworkUrl" TEXT,
    "isrc" TEXT,
    CONSTRAINT "SnapshotTrack_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "QueueSnapshot" ("guildId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Playlist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PlaylistTrack" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playlistId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "uri" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    CONSTRAINT "PlaylistTrack_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SnapshotTrack_snapshotId_position_idx" ON "SnapshotTrack"("snapshotId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_guildId_ownerId_name_key" ON "Playlist"("guildId", "ownerId", "name");

-- CreateIndex
CREATE INDEX "PlaylistTrack_playlistId_position_idx" ON "PlaylistTrack"("playlistId", "position");
