import { Track, LyricLine, Comment, RecommendedPlaylist, Artist } from '../types';

// 优化后的 API 列表，包含更稳定的镜像源
// 移除了部分极其不稳定的 Vercel 免费实例
const API_BASES = [
  'https://music.cyrilstudio.top', // 通常速度较快
  'https://netease-cloud-music-api-anon.vercel.app', // 官方维护的匿名版
  'https://netease-cloud-music-api-beta-lyart.vercel.app', // 社区备用
  'https://music-api.heheda.top',
  'https://ncmapi.redd.one',
  'https://api.music.areschang.top',
  'https://netease-cloud-music-api-ochre-two.vercel.app',
  'https://music-api-theta-liart.vercel.app',
  'https://ncm.cloud.zlib.cn',
  'https://api.lo-li.cw',
  'https://music.163.com/api', // 官方接口 (可能跨域，作为最后的备选)
];

// 缓存当前最快的 API 节点
let currentBestBase: string | null = null;

/**
 * 带有超时的 Fetch 包装器
 * 限制每个单独请求的最大等待时间，避免被慢节点拖死
 * 增加超时时间以适应 Serverless 冷启动
 */
const fetchWithTimeout = async (url: string, timeout = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

/**
 * Polyfill-like implementation for Promise.any behavior to fix TS error.
 * Returns the first fulfilled promise, or rejects if all fail.
 */
const promiseAny = <T>(promises: Promise<T>[]): Promise<T> => {
    return new Promise((resolve, reject) => {
        if (promises.length === 0) {
            reject(new Error("No promises provided"));
            return;
        }

        let rejectedCount = 0;
        const errors: any[] = [];

        promises.forEach((p) => {
            Promise.resolve(p).then(resolve).catch((e) => {
                rejectedCount++;
                errors.push(e);
                if (rejectedCount === promises.length) {
                    reject(new Error("All promises rejected"));
                }
            });
        });
    });
};

/**
 * 智能 API 请求函数
 * 策略：
 * 1. 如果已有最优节点，优先使用。
 * 2. 如果无最优节点或请求失败，触发"分批赛马模式"。
 * 3. 将所有节点打乱后按批次(Batch)尝试，每批同时并发请求 N 个。
 * 4. 只要有一批中有一个成功，即返回结果并更新最优节点。
 * 5. 如果所有批次都失败，抛出错误。
 */
const fetchWithFailover = async (path: string): Promise<any> => {
  const separator = path.includes('?') ? '&' : '?';
  const timestamp = `timestamp=${Date.now()}`;
  
  // 1. 快速通道：如果已经锁定了最快节点，直接尝试
  if (currentBestBase) {
      try {
          const url = `${currentBestBase}${path}${separator}${timestamp}`;
          // 缓存节点的超时时间可以设短一点，因为它应该是快的
          const res = await fetchWithTimeout(url, 5000); 
          if (!res.ok) throw new Error(`Status ${res.status}`);
          
          const data = await res.json();
          // 部分接口虽然 200 但返回 code!=200
          if (data.code && data.code !== 200) throw new Error(`API Code ${data.code}`);
          
          return data;
      } catch (e) {
          console.warn(`Cached node ${currentBestBase} failed, switching to Race Mode.`, e);
          currentBestBase = null; // 缓存失效，降级到赛马模式
      }
  }

  // 2. 深度赛马模式：打乱所有节点，分批尝试
  const allCandidates = [...API_BASES].sort(() => Math.random() - 0.5);
  const BATCH_SIZE = 3; // 每批并发 3 个请求，避免浏览器并发限制
  
  let lastError: any = null;

  for (let i = 0; i < allCandidates.length; i += BATCH_SIZE) {
      const batch = allCandidates.slice(i, i + BATCH_SIZE);
      
      try {
          // 等待这一批中任意一个成功
          const winnerResponse = await promiseAny(
              batch.map(async (base) => {
                  const url = `${base}${path}${separator}${timestamp}`;
                  const res = await fetchWithTimeout(url, 8000); 
                  if (!res.ok) throw new Error(`Network response was not ok: ${res.status}`);
                  
                  const data = await res.json();
                  if (data.code && data.code !== 200) throw new Error(`API Error: ${data.code}`);
                  
                  // 胜利者即刻成为新的最优节点
                  if (!currentBestBase) {
                      currentBestBase = base;
                      // console.log(`🏆 New fastest API node found: ${base}`);
                  }
                  return data;
              })
          );
          
          return winnerResponse;
      } catch (batchError) {
          // 这一批全军覆没，继续下一批
          lastError = batchError;
          continue;
      }
  }

  // 所有批次都失败了
  console.error("All API candidates failed.", lastError);
  throw new Error("无法连接到任何音乐服务器，请检查网络连接。");
};

// 统一处理歌曲数据格式，解决不同 API 返回结构不一致问题
const normalizeTrack = (s: any): Track => {
  const al = s.al || s.album || {};
  return {
    id: s.id,
    name: s.name,
    ar: s.ar || s.artists || [],
    al: {
        id: al.id || 0,
        name: al.name || 'Unknown Album',
        // 确保 picUrl 存在。如果 pic_str 是 URL 则使用它，否则忽略（避免使用数字 ID 作为 URL）
        picUrl: al.picUrl || (al.pic_str && al.pic_str.startsWith('http') ? al.pic_str : '') || '' 
    },
    dt: s.dt || s.duration || 0,
    fee: s.fee
  };
};

export const fetchPlaylist = async (id: string): Promise<Track[]> => {
  try {
    const data = await fetchWithFailover(`/playlist/track/all?id=${id}&limit=200&offset=0`);
    return (data.songs || []).map(normalizeTrack);
  } catch (e) {
    console.error("Failed to fetch playlist", e);
    throw e;
  }
};

export const fetchRecommendedPlaylists = async (): Promise<RecommendedPlaylist[]> => {
  try {
    const data = await fetchWithFailover('/personalized?limit=30');
    return data.result || [];
  } catch (e) {
    return [];
  }
};

export const searchPlaylists = async (keywords: string): Promise<RecommendedPlaylist[]> => {
  try {
    const data = await fetchWithFailover(`/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=1000&limit=30`);
    const playlists = data.result?.playlists || [];
    
    return playlists.map((p: any) => ({
      id: p.id,
      name: p.name,
      picUrl: p.coverImgUrl, 
      playCount: p.playCount,
      copywriter: p.creator?.nickname 
    }));
  } catch (e) {
    return [];
  }
};

export const searchSongs = async (keywords: string): Promise<Track[]> => {
  try {
    const data = await fetchWithFailover(`/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=1&limit=30`);
    const songs = data.result?.songs || [];
    return songs.map(normalizeTrack);
  } catch (e) {
    return [];
  }
};

export const searchArtists = async (keywords: string): Promise<Artist[]> => {
  try {
    const data = await fetchWithFailover(`/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=100&limit=30`);
    const artists = data.result?.artists || [];

    return artists.map((a: any) => ({
      id: a.id,
      name: a.name,
      picUrl: a.picUrl || a.img1v1Url
    }));
  } catch (e) {
    return [];
  }
};

export const fetchArtistTopSongs = async (artistId: number): Promise<Track[]> => {
  try {
    const data = await fetchWithFailover(`/artist/top/song?id=${artistId}`);
    return (data.songs || []).map(normalizeTrack);
  } catch (e) {
    throw e;
  }
};

export const fetchArtistDetail = async (artistId: number): Promise<any> => {
    try {
        const data = await fetchWithFailover(`/artist/detail?id=${artistId}`);
        return data.data?.artist || data.artist || {};
    } catch (e) {
        return {};
    }
};

export const fetchArtistSongsList = async (artistId: number, order: 'hot' | 'time', limit = 100): Promise<Track[]> => {
    // 优先使用 top/song 接口获取热门歌曲，因为它的数据最完整（包含封面），而 artist/songs 往往缺乏封面信息
    if (order === 'hot') {
        return fetchArtistTopSongs(artistId);
    }
    
    try {
        const data = await fetchWithFailover(`/artist/songs?id=${artistId}&order=${order}&limit=${limit}`);
        return (data.songs || []).map(normalizeTrack);
    } catch (e) {
        return [];
    }
};

export const getAudioUrl = async (id: number): Promise<string> => {
  // 保持使用网易云直链，这个通常是最快的且不需要 API 代理
  return `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
};

const parseLrc = (lrc: string): { time: number; text: string }[] => {
  if (!lrc) return [];
  const lines = lrc.split('\n');
  const result: { time: number; text: string }[] = [];
  const timeExp = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  for (const line of lines) {
    const match = timeExp.exec(line);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3]) * (match[3].length === 2 ? 10 : 1);
      const time = min * 60 * 1000 + sec * 1000 + ms;
      const text = line.replace(timeExp, '').trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }
  return result;
};

export const fetchLyrics = async (id: number): Promise<LyricLine[]> => {
  try {
    const data = await fetchWithFailover(`/lyric?id=${id}`);
    
    const original = data.lrc?.lyric ? parseLrc(data.lrc.lyric) : [];
    const translation = data.tlyric?.lyric ? parseLrc(data.tlyric.lyric) : [];

    return original.map((line, index) => {
      const nextLine = original[index + 1];
      const rawDuration = nextLine ? nextLine.time - line.time : 5000;
      const duration = Math.max(400, rawDuration); 

      const transLine = translation.find(t => Math.abs(t.time - line.time) < 500);
      
      return {
        ...line,
        duration,
        trans: transLine?.text,
        isContinuation: false 
      };
    });

  } catch (e) {
    return [];
  }
};

export const fetchComments = async (id: number): Promise<Comment[]> => {
  try {
    const data = await fetchWithFailover(`/comment/music?id=${id}&limit=20`);
    return data.hotComments || data.comments || [];
  } catch (e) {
    return [];
  }
};