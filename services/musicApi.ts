import { Track, LyricLine, Comment, RecommendedPlaylist, Artist } from '../types';

// 优化后的 API 列表，包含更稳定的镜像源
// 移除了部分极其不稳定的 Vercel 免费实例
const API_BASES = [
  'https://music.cyrilstudio.top', // 通常速度较快
  'https://netease-cloud-music-api-anon.vercel.app', // 官方维护的匿名版
  'https://api.music.areschang.top', // 备用镜像
  'https://music-api.heheda.top',
  'https://ncmapi.redd.one',
  'https://music-api-theta-liart.vercel.app',
  'https://ncm.cloud.zlib.cn',
];

// 缓存当前最快的 API 节点
let currentBestBase: string | null = null;

/**
 * 带有超时的 Fetch 包装器
 * 限制每个单独请求的最大等待时间，避免被慢节点拖死
 */
const fetchWithTimeout = async (url: string, timeout = 5000) => {
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
 * 2. 如果无最优节点或请求失败，触发"赛马模式" (promiseAny)，同时请求前 N 个节点，谁快用谁。
 */
const fetchWithFailover = async (path: string): Promise<any> => {
  const separator = path.includes('?') ? '&' : '?';
  const timestamp = `timestamp=${Date.now()}`;
  
  // 1. 快速通道：如果已经锁定了最快节点，直接尝试
  if (currentBestBase) {
      try {
          const url = `${currentBestBase}${path}${separator}${timestamp}`;
          const res = await fetchWithTimeout(url, 6000); // 稍微放宽一点超时给已验证节点
          if (!res.ok) throw new Error(`Status ${res.status}`);
          
          const data = await res.json();
          if (data.code && data.code !== 200) throw new Error(`API Code ${data.code}`);
          
          return data;
      } catch (e) {
          console.warn(`Cached node ${currentBestBase} failed, switching to Race Mode.`, e);
          currentBestBase = null; // 缓存失效，降级到赛马模式
      }
  }

  // 2. 赛马通道：选取前 5 个节点进行并发竞速
  // 这种方式虽然多发了请求，但能确保用户连接到当前网络环境下最快的节点
  const candidates = API_BASES.slice(0, 5); 
  
  try {
      // promiseAny 会等待第一个 *成功* (Fulfilled) 的结果
      const winnerResponse = await promiseAny(
          candidates.map(async (base) => {
              const url = `${base}${path}${separator}${timestamp}`;
              const res = await fetchWithTimeout(url, 5000); // 竞速时超时要短，快速过滤慢节点
              if (!res.ok) throw new Error('Network response was not ok');
              
              const data = await res.json();
              if (data.code && data.code !== 200) throw new Error(`API Error: ${data.code}`);
              
              // 副作用：胜利者即刻成为新的最优节点
              if (!currentBestBase) {
                  currentBestBase = base;
                  // console.log(`🏆 New fastest API node found: ${base}`);
              }
              return data;
          })
      );
      
      return winnerResponse;
  } catch (aggregateError) {
      console.error("All API candidates failed.", aggregateError);
      throw new Error("无法连接到任何音乐服务器，请检查网络连接。");
  }
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