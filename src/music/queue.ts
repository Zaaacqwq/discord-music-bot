// src/music/queue.ts
import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { Guild, VoiceBasedChannel } from "discord.js";
import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import prism from "prism-media"; // ← CJS 默认导入
const execFile = promisify(_execFile);

// ---------- 类型 ----------
export type QueueItem = {
  title: string;
  url: string; // YouTube 链接 / 其它直链 / ytsearch:关键字
  durationSec?: number; // 秒（用于进度条）
  requestedBy?: string;
};

// ---------- 取直链：优先 yt-dlp ----------
async function tryGetDirectUrl(url: string): Promise<string | null> {
  try {
    const bin = process.env.YTDLP_PATH || "yt-dlp";
    const { stdout } = await execFile(bin, ["-g", "-f", "bestaudio", url], {
      timeout: 20_000,
    });
    const direct = stdout.trim().split("\n")[0];
    return direct || null;
  } catch {
    return null;
  }
}

// ---------- 兜底：play-dl 的可读流 ----------
async function tryPlayDlStream(
  url: string
): Promise<{ stream: Readable; type: StreamType } | null> {
  const play = (await import("play-dl")).default;
  try {
    if (url.startsWith("ytsearch:")) {
      const q = url.replace(/^ytsearch:/, "");
      const res = await play.search(q, {
        limit: 1,
        source: { youtube: "video" },
      });
      if (!res[0]?.url) return null;
      url = res[0].url!;
    }
    const pd = await play.stream(url);
    return {
      stream: pd.stream as unknown as Readable,
      type: (pd.type as StreamType) ?? StreamType.Arbitrary,
    };
  } catch {
    return null;
  }
}

// ---------- 队列实现 ----------
export class GuildQueue {
  guild: Guild;
  voice?: VoiceConnection;
  player: AudioPlayer;
  items: QueueItem[] = [];
  current?: QueueItem;
  volume = 1.0;
  private _retrying = false;

  constructor(guild: Guild) {
    this.guild = guild;
    this.player = createAudioPlayer();

    // 放完自动下一首
    this.player.on(AudioPlayerStatus.Idle, () => this.next());

    // 错误兜底：重试一次，失败则跳过
    this.player.on("error", async (err) => {
      console.error("[player error]", err?.message || err);
      if (this._retrying) {
        this.skip();
        return;
      }
      this._retrying = true;
      try {
        await this.retryCurrent();
      } catch {
        this.skip();
      } finally {
        this._retrying = false;
      }
    });
  }

  // 连接语音（带自愈）
  async ensureConnected(channel: VoiceBasedChannel) {
    if (
      !this.voice ||
      this.voice.state.status === VoiceConnectionStatus.Destroyed
    ) {
      await this.connect(channel);
      return;
    }
    if (this.voice.joinConfig.channelId !== channel.id) {
      try {
        this.voice.destroy();
      } catch {}
      await this.connect(channel);
      return;
    }
    try {
      await entersState(this.voice, VoiceConnectionStatus.Ready, 5_000);
    } catch {
      try {
        this.voice.destroy();
      } catch {}
      await this.connect(channel);
    }
  }

  async connect(channel: VoiceBasedChannel) {
    this.voice = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    await entersState(this.voice, VoiceConnectionStatus.Ready, 20_000);
    this.voice.subscribe(this.player);

    // 断线自愈
    this.voice.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.voice!, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.voice!, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        try {
          this.player.stop(true);
        } catch {}
        this.current = undefined; // 防复播旧歌
        try {
          this.voice?.destroy();
        } catch {}
        this.voice = undefined;
      }
    });
  }

  // —— 队列操作 —— //
  enqueue(track: QueueItem) {
    this.items.push(track);
    if (!this.current || this.player.state.status === AudioPlayerStatus.Idle) {
      this.next();
    }
  }
  enqueueMany(tracks: QueueItem[]) {
    this.items.push(...tracks);
    if (!this.current) this.next();
  }
  enqueueNext(track: QueueItem) {
    if (
      this.current &&
      this.player.state.status === AudioPlayerStatus.Playing
    ) {
      this.items.unshift(track);
    } else {
      this.enqueue(track);
    }
  }
  enqueueManyNext(tracks: QueueItem[]) {
    if (!tracks.length) return;
    if (
      this.current &&
      this.player.state.status === AudioPlayerStatus.Playing
    ) {
      this.items = [...tracks, ...this.items];
    } else {
      this.enqueueMany(tracks);
    }
  }

  snapshot() {
    return { current: this.current, items: [...this.items] };
  }

  // 进度（毫秒）
  getPlaybackMs() {
    const s: any = (this.player as any)._state ?? this.player.state;
    const r: any = s?.resource;
    return r?.playbackDuration ?? 0;
  }

  // 音量
  volUp(step = 0.1) {
    this.setVolume(this.volume + step);
  }
  volDown(step = 0.1) {
    this.setVolume(this.volume - step);
  }
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(v, 2));
    const r: any = (this.player as any)._state?.resource;
    if (r?.volume) r.volume.setVolume(this.volume);
  }

  removeAt(n: number) {
    if (n <= 0 || n > this.items.length) return undefined;
    const [removed] = this.items.splice(n - 1, 1);
    return removed;
  }

  clear(all = false) {
    this.items = [];
    if (all) this.stop();
  }

  pause() {
    this.player.pause();
  }
  resume() {
    this.player.unpause();
  }
  skip() {
    this.player.stop(true);
  }
  stop() {
    this.items = [];
    this.current = undefined;
    this.player.stop(true);
  }

  // —— 播放主流程 —— //
  async next() {
    const nxt = this.items.shift();
    if (!nxt) {
      this.current = undefined;
      return;
    }
    await this.play(nxt);
  }

  private async retryCurrent() {
    if (!this.current) throw new Error("no current");
    const res = await this.buildResource(this.current.url);
    if ((res as any).volume) (res as any).volume.setVolume(this.volume);
    this.player.play(res);
  }

  async play(item: QueueItem) {
    this.current = item;

    // 播放前补齐时长（给面板进度条用）
    if (item.url && item.durationSec == null) {
      try {
        const play = (await import("play-dl")).default;
        const info = await play.video_info(item.url);
        const sec =
          Number((info as any).video_details?.durationInSec) ||
          Number((info as any).video_details?.durationInSeconds) ||
          Number((info as any).video_details?.durationInMS / 1000) ||
          0;
        if (sec > 0) item.durationSec = Math.round(sec);
      } catch {}
    }

    const resource: any = await this.buildResource(item.url);
    if (resource.volume) resource.volume.setVolume(this.volume);
    this.player.play(resource);
  }

  // 统一创建“更抗断”的资源：
  // 1) 优先 yt-dlp 拿直链 → FFmpeg 自拉（-reconnect）
  // 2) 兜底 play-dl 的 stream
  private async buildResource(url: string) {
    // ytsearch:关键字 → 转真实 URL（供 yt-dlp/FFmpeg 使用）
    if (url.startsWith("ytsearch:")) {
      const play = (await import("play-dl")).default;
      const q = url.replace(/^ytsearch:/, "");
      const res = await play.search(q, {
        limit: 1,
        source: { youtube: "video" },
      });
      if (res[0]?.url) url = res[0].url!;
    }

    const direct = await tryGetDirectUrl(url);
    if (direct) {
      // 用 FFmpeg 自拉流（自动重连）
      const ff = new (prism as any).FFmpeg({
        args: [
          "-reconnect",
          "1",
          "-reconnect_at_eof",
          "1",
          "-reconnect_streamed",
          "1",
          "-reconnect_delay_max",
          "5",
          "-i",
          direct,
          "-analyzeduration",
          "0",
          "-loglevel",
          "0",
          "-f",
          "s16le",
          "-ar",
          "48000",
          "-ac",
          "2",
        ],
      });
      ff.on("error", (e: any) =>
        console.warn("[ffmpeg error]", e?.message || e)
      );
      const res = createAudioResource(ff, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });
      (res as any).playStream?.on?.("error", (e: any) =>
        console.warn("[resource stream error]", e?.message || e)
      );
      return res;
    }

    // 兜底：play-dl 的可读流
    const pd = await tryPlayDlStream(url);
    if (!pd) throw new Error("Failed to build audio resource");
    const res = createAudioResource(pd.stream as any, {
      inputType: pd.type,
      inlineVolume: true,
    });
    (res as any).playStream?.on?.("error", (e: any) =>
      console.warn("[resource stream error]", e?.message || e)
    );
    return res;
  }
}

// ---------- 单例 ----------
const queues = new Map<string, GuildQueue>();
export function getQueue(guild: Guild) {
  let q = queues.get(guild.id);
  if (!q) {
    q = new GuildQueue(guild);
    queues.set(guild.id, q);
  }
  return q;
}
