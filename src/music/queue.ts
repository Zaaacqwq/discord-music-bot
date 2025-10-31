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
import type { Readable } from "stream";
import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
const execFile = promisify(_execFile);

// ---- helper: 统一从 url 构造可播放的 stream ----
async function streamFromUrl(
  url: string
): Promise<{ stream: Readable; type: StreamType }> {
  const play = (await import("play-dl")).default;

  // 1) 处理 ytsearch: 关键字 → 解析为真正的 YouTube URL
  if (url.startsWith("ytsearch:")) {
    const q = url.replace(/^ytsearch:/, "");
    const res = await play.search(q, {
      limit: 1,
      source: { youtube: "video" },
    });
    if (!res[0]?.url) throw new Error("YouTube search failed");
    url = res[0].url!;
  }

  // 2) 常规路径：用 play-dl 播放（支持 YouTube/B站直链等）
  try {
    const pd = await play.stream(url);
    return {
      stream: pd.stream as unknown as Readable,
      type: (pd.type as StreamType) ?? StreamType.Arbitrary,
    };
  } catch (e) {
    // 3) 兜底：用 yt-dlp 拿直链再播（需要本机已安装 yt-dlp）
    const bin = process.env.YTDLP_PATH || "yt-dlp";
    const { stdout } = await execFile(bin, ["-g", "-f", "bestaudio", url]);
    const direct = stdout.trim().split("\n")[0];
    if (!direct) throw e;

    // 用 undici 拉流作为 Readable
    const { request } = await import("undici");
    const resp = await request(direct);
    return {
      stream: resp.body as unknown as Readable,
      type: StreamType.Arbitrary,
    };
  }
}

// ---- 队列实现 ----
export type QueueItem = {
  title: string;
  url: string; // youtube 链接、ytsearch:关键字、或其它直链
  durationSec?: number;
  requestedBy?: string;
};

export class GuildQueue {
  guild: Guild;
  voice?: VoiceConnection;
  player: AudioPlayer;
  items: QueueItem[] = [];
  current?: QueueItem;
  volume = 1.0;

  constructor(guild: Guild) {
    this.guild = guild;
    this.player = createAudioPlayer();
    this.player.on(AudioPlayerStatus.Idle, () => this.next());
  }

  // 在 class GuildQueue 里新增：
  async ensureConnected(channel: VoiceBasedChannel) {
    // 没有连接 or 已销毁 → 直接连
    if (
      !this.voice ||
      this.voice.state.status === VoiceConnectionStatus.Destroyed
    ) {
      await this.connect(channel);
      return;
    }

    // 频道不一致 → 切换频道
    if (this.voice.joinConfig.channelId !== channel.id) {
      try {
        this.voice.destroy();
      } catch {}
      await this.connect(channel);
      return;
    }

    // 连接存在但未就绪 → 等待就绪或重连
    try {
      await entersState(this.voice, VoiceConnectionStatus.Ready, 5_000);
    } catch {
      try {
        this.voice.destroy();
      } catch {}
      await this.connect(channel);
    }
  }

  // 修改 connect()：连接成功后挂断线重连逻辑
  async connect(channel: VoiceBasedChannel) {
    this.voice = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    await entersState(this.voice, VoiceConnectionStatus.Ready, 20_000);
    this.voice.subscribe(this.player);

    // 断线自愈：短时间内能恢复就恢复；否则销毁并清掉 current，避免复播旧歌
    this.voice.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.voice!, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.voice!, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        // 能进入上述状态就算恢复，不动队列
      } catch {
        try {
          this.player.stop(true);
        } catch {}
        this.current = undefined; // ★ 关键：清掉“当前曲目”指针
        try {
          this.voice?.destroy();
        } catch {}
        this.voice = undefined;
      }
    });
  }

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

  // 插队到“下一首”位置：不打断当前，当前结束后立刻播放这首
  enqueueNext(track: QueueItem) {
    // 如果正在播放：插到队首（下一首）
    if (
      this.current &&
      this.player.state.status === AudioPlayerStatus.Playing
    ) {
      this.items.unshift(track);
      return;
    }
    // 如果没在播：直接进入常规队列并自动起播
    this.enqueue(track);
  }

  // 将一组曲目插到“下一首”开始，保持原始顺序
  enqueueManyNext(tracks: QueueItem[]) {
    if (!tracks.length) return;
    if (
      this.current &&
      this.player.state.status === AudioPlayerStatus.Playing
    ) {
      // [当前正在播]：把新曲目按顺序放到队首
      this.items = [...tracks, ...this.items];
    } else {
      // [未在播]：直接入队并自动起播
      this.enqueueMany(tracks);
    }
  }

  // 只读快照（用于 UI 渲染）
  snapshot() {
    return {
      current: this.current,
      items: [...this.items],
    };
  }

  // 进度（毫秒）
  getPlaybackMs() {
    // @discordjs/voice 的资源里有 playbackDuration
    // 兼容不同版本的内部结构
    const s: any = (this.player as any)._state ?? this.player.state;
    const r: any = s?.resource;
    return r?.playbackDuration ?? 0;
  }

  // 音量步进
  volUp(step = 0.1) {
    this.setVolume(this.volume + step);
  }
  volDown(step = 0.1) {
    this.setVolume(this.volume - step);
  }

  // 删除第 n 首（从队列的“下一首”开始计 1）
  removeAt(n: number) {
    if (n <= 0 || n > this.items.length) return undefined;
    const [removed] = this.items.splice(n - 1, 1);
    return removed;
  }

  // 清空后续；all=true 时连当前也停掉
  clear(all = false) {
    this.items = [];
    if (all) this.stop(); // stop() 会清空 current 并停止播放
  }

  async play(item: QueueItem) {
    this.current = item;
    const { stream, type } = await streamFromUrl(item.url);
    const resource: any = createAudioResource(stream as any, {
      inputType: type ?? StreamType.Arbitrary,
      inlineVolume: true,
    });
    if (resource.volume) resource.volume.setVolume(this.volume);
    this.player.play(resource);
  }

  pause() {
    this.player.pause();
  }
  resume() {
    this.player.unpause();
  }
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(v, 2));
    const r: any = (this.player as any)._state?.resource;
    if (r?.volume) r.volume.setVolume(this.volume);
  }
  skip() {
    this.player.stop(true);
  }
  stop() {
    this.items = [];
    this.current = undefined;
    this.player.stop(true);
  }

  async next() {
    const nxt = this.items.shift();
    if (!nxt) {
      this.current = undefined;
      return;
    }
    await this.play(nxt);
  }
}

const queues = new Map<string, GuildQueue>();
export function getQueue(guild: Guild) {
  let q = queues.get(guild.id);
  if (!q) {
    q = new GuildQueue(guild);
    queues.set(guild.id, q);
  }
  return q;
}
