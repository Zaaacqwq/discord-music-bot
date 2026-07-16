-- CreateTable
CREATE TABLE "VoiceGreeting" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "soundUri" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownSec" INTEGER NOT NULL DEFAULT 60,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("guildId", "userId")
);
