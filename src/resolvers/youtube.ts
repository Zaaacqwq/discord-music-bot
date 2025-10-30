import play from 'play-dl';

export async function resolveYouTube(url: string) {
  // 返回一个可播放的对象
  const info = await play.video_info(url);
  const title = info.video_details.title ?? 'Unknown';
  return { kind: 'track' as const, title, url: info.video_details.url };
}
