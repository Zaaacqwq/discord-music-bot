# discord-music-bot

A Discord music bot built on **Lavalink v4** with the **LavaSrc** plugin for Spotify-aware playback.
Spotify links resolve via ISRC matching to the same recording on YouTube — same mix, same master,
not a "title-only" search hack.

```
Discord ──► discord.js v14 (this app, Node) ──► magmastream (WebSocket)
                                                    ▼
                                                  Lavalink v4 (Java, in Docker)
                                                    │
                                  ┌─────────────────┼──────────────────┐
                                  ▼                 ▼                  ▼
                          youtube-source        LavaSrc            built-in
                          (resilient YT)    (Spotify ↔ ISRC)   (SoundCloud, Bandcamp …)
```

---

## Prerequisites

| Tool   | Version | Notes |
|--------|---------|-------|
| Node   | 20 – 22 | Uses native `parseArgs`, ESM, top-level await |
| Docker | 24+     | Runs Lavalink |
| pnpm   | 9+ (or npm/yarn) | Examples use `pnpm` |

---

## 1. Configure secrets

```bash
cp .env.example .env
```

Fill in:

- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` — from the [Discord Developer Portal](https://discord.com/developers/applications).
- `DISCORD_GUILD_ID` *(optional)* — set this while iterating; guild commands register instantly. Leave blank in production.
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` — from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). Used by Lavalink (not this Node app) to fetch track metadata and ISRC codes.

`LAVALINK_*` defaults match `docker-compose.yml`. Leave them alone unless you change the compose file.

### Discord bot intents

This bot uses **non-privileged** intents only (`Guilds`, `GuildVoiceStates`). No need to enable `Server Members` or `Message Content` in the developer portal.

### Discord OAuth invite scope

When generating an invite, select:

- Scopes: `bot`, `applications.commands`
- Bot permissions: `View Channels`, `Send Messages`, `Embed Links`, `Connect`, `Speak`, `Use Voice Activity`

---

## 2. Start Lavalink

```bash
pnpm lavalink:up        # docker compose up -d lavalink
pnpm lavalink:logs      # tail logs; first start downloads plugin jars
```

The first boot downloads the `youtube-plugin` and `lavasrc-plugin` jars into `./lavalink/plugins/`. Wait until you see `Lavalink is ready to accept connections` before starting the bot.

To stop it: `pnpm lavalink:down`.

---

## 3. Install + migrate

```bash
pnpm install
pnpm db:migrate         # first run will create prisma/dev.db and prompt for a migration name
```

---

## 4. Register slash commands

```bash
pnpm deploy:guild       # fast — appears immediately in your DISCORD_GUILD_ID
# or
pnpm deploy:global      # slow — Discord can take up to 1 hour to propagate
```

Use `pnpm clear:guild` / `pnpm clear:global` to wipe registrations.

---

## 5. Run

```bash
pnpm dev                # tsx watch — hot-reloads on file change
# or
pnpm build && pnpm start
```

---

## Commands

| Command | What it does |
|---------|--------------|
| `/play <query> [next:bool]` | Play a URL or search query. Supports YouTube, Spotify (link or track ID), SoundCloud, Bandcamp, Twitch, Vimeo, direct HTTP streams. `next:true` inserts at the head of the queue. |
| `/skip [count:int]` | Skip the current track (or N tracks). |
| `/pause` / `/resume` | Pause / resume playback. |
| `/stop` | Clear the queue and disconnect. |
| `/queue show [page]` | List upcoming tracks (10 per page). |
| `/queue remove <position>` | Drop a single track by 1-based position. |
| `/queue clear` | Empty the upcoming queue (keeps the current track). |
| `/nowplaying` | Show the now-playing panel on demand. |
| `/volume [level:0–150]` | Read or set volume. |
| `/loop <off\|track\|queue>` | Set loop mode. |
| `/shuffle` | Shuffle the upcoming queue. |
| `/seek <position>` | Jump to `m:ss`, `h:mm:ss`, or a raw second count in the current track. |
| `/247 [mode:on\|off]` | Stay in voice 24/7. When off, the bot disconnects after 5 min of silence. |
| `/save <name> [replace]` | Save the current queue (and current track) as a named playlist. |
| `/playlists list` / `delete <name>` | Manage your saved playlists. |
| `/load <name> [replace]` | Load a saved playlist into the queue. |
| `/musicchannel [channel] [clear]` | Pin all bot output to one channel *(Manage Server)*. |
| `/greet set\|remove\|list` | Auto-greeting: when the chosen user joins voice, the bot hops in, plays a clip, and leaves *(Manage Server)*. |

### Now-playing panel

A single panel message is posted on the first track and **edited in place** on every track
change — no per-track spam. Controls: ⏮️ previous, ⏸️/▶️ pause-resume, ⏭️ skip, 🔁 loop,
🔀 shuffle, plus a volume row (🔉 / current % / 🔊) and ⏹️ stop. Button clicks repaint the
panel instantly; otherwise it auto-refreshes every 8 s (Discord edit rate limits). Only
members in the same voice channel as the bot can drive the controls.

### Pinned music channel

`/musicchannel channel:#music` routes **all** command output (panels, queue listings,
confirmations) to that channel, no matter where the command was typed — the invoker gets
an ephemeral pointer instead. Error replies stay ephemeral in place. `/musicchannel clear:true`
turns it off.

---

## Architecture notes

- **No audio in Node.** Every audio frame flows Java→Discord over the Lavalink WebSocket. Node only sends gateway voice updates (`client.on("raw", …) → manager.updateVoiceState`) and high-level commands.
- **Spotify is honest.** The bot does not stream Spotify directly (Spotify's TOS forbids it). LavaSrc reads Spotify metadata + ISRC, then asks `youtube-source` for `"ytsearch:\"%ISRC%\""` first — that yields the exact same recording on YouTube, not just a title match.
- **Auto-disconnect.** 5 minutes after the queue empties the bot leaves the channel, unless `/247 mode:on` is set for the guild.
- **Voice greetings.** `local: true` in `application.yml` plus a read-only `./lavalink/sounds → /opt/Lavalink/sounds` mount let Lavalink play local clips (`local:sounds/foo.mp3`). Greeting players are tagged `isGreeting` so they skip the now-playing panel and idle logic entirely, and a per-user cooldown stops rejoin spam.
- **Persistence.** Prisma + SQLite. Tables include `GuildConfig` (24/7 flag + pinned music channel), `VoiceGreeting`, `QueueSnapshot` + `SnapshotTrack`, and user `Playlist`s. The wiring for queue-restore-on-restart is scaffolded but not consumed yet — V1 plays cleanly in-memory; V1.1 will read snapshots on `nodeConnect`.

---

## Troubleshooting

- **`Cannot find module ...`** — run `pnpm install`, then `pnpm db:generate`.
- **Bot connects but no audio** — confirm Lavalink is up (`pnpm lavalink:logs`) and that `LAVALINK_PASSWORD` matches between `.env` and `lavalink/application.yml` (both default to `youshallnotpass`).
- **Spotify links return "Load failed"** — make sure `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` are set in the **shell that runs `docker compose`** (not just the Node app's env), because the Lavalink container reads them on boot.
- **YouTube rate-limits** — the rotating `clients` list in `lavalink/application.yml` already mitigates this; pull the latest `youtube-plugin` version if it persists.
