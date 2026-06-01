import "dotenv/config";
import { z } from "zod";

const ConfigSchema = z.object({
  discord: z.object({
    token: z.string().min(1, "DISCORD_TOKEN is required"),
    clientId: z.string().min(1, "DISCORD_CLIENT_ID is required"),
    guildId: z.string().optional(),
  }),
  lavalink: z.object({
    host: z.string().default("127.0.0.1"),
    port: z.coerce.number().int().positive().default(2333),
    password: z.string().default("youshallnotpass"),
    secure: z
      .union([z.literal("true"), z.literal("false")])
      .default("false")
      .transform((v) => v === "true"),
  }),
  database: z.object({
    url: z.string().default("file:./dev.db"),
  }),
  logLevel: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const parsed = ConfigSchema.safeParse({
    discord: {
      token: process.env.DISCORD_TOKEN,
      clientId: process.env.DISCORD_CLIENT_ID,
      guildId: process.env.DISCORD_GUILD_ID || undefined,
    },
    lavalink: {
      host: process.env.LAVALINK_HOST,
      port: process.env.LAVALINK_PORT,
      password: process.env.LAVALINK_PASSWORD,
      secure: process.env.LAVALINK_SECURE,
    },
    database: {
      url: process.env.DATABASE_URL,
    },
    logLevel: process.env.LOG_LEVEL,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}

export const config = loadConfig();
