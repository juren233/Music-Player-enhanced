import { Track, LyricLine, Comment, RecommendedPlaylist, Artist } from '../types';

// 完整 API 列表（2025年1月更新）
const API_BASES = [
  // 2025-12-22 ZMusic 公开服务器（国内）
  'https://ncm.zhenxin.me',      // 上海
  'https://zm.i9mr.com',         // 扬州
  'https://zm.wwoyun.cn',        // 宁波
  // 其他公开源（国内）
  'https://music.cyrilstudio.top',
  'https://music-api.heheda.top',
  'https://ncmapi.redd.one',
  'https://api.music.areschang.top',
  'https://ncm.cloud.zlib.cn',
  'https://api.lo-li.cw',
  // 以下为备用源（海外/Vercel），暂时注释
  // 'https://music.mcseekeri.com', // 美国
  // 'https://netease-cloud-music-api-anon.vercel.app',
  // 'https://netease-cloud-music-api-beta-lyart.vercel.app',
  // 'https://netease-cloud-music-api-ochre-two.vercel.app',
  // 'https://music-api-theta-liart.vercel.app',
];

// 6 个模块类型
export type ApiModule = 'recommend' | 'playlist' | 'search' | 'artist' | 'lyrics' | 'comments';

// 模块名称映射（用于 UI 显示）
export const API_MODULE_NAMES: Record<ApiModule, string> = {
  recommend: '推荐歌单',
  playlist: '播放列表',
  search: '搜索',
  artist: '歌手',
  lyrics: '歌词',
  comments: '评论',
};

// 从 localStorage 恢复各模块最优节点
const loadModuleBestBases = (): Record<ApiModule, string | null> => {
  const modules: ApiModule[] = ['recommend', 'playlist', 'search', 'artist', 'lyrics', 'comments'];
  const result: Record<ApiModule, string | null> = {} as any;

  for (const mod of modules) {
    try {
      const saved = localStorage.getItem(`vinyl_api_${mod}`);
      result[mod] = (saved && API_BASES.includes(saved)) ? saved : null;
    } catch {
      result[mod] = null;
    }
  }
  return result;
};

// 各模块最优节点缓存
const moduleBestBases = loadModuleBestBases();

// 保存模块最优节点
const saveModuleBestBase = (module: ApiModule, base: string) => {
  moduleBestBases[module] = base;
  try { localStorage.setItem(`vinyl_api_${module}`, base); } catch { }
};

// 导出：重置指定模块的最优节点
export const resetModuleApiNode = (module: ApiModule) => {
  moduleBestBases[module] = null;
  try { localStorage.removeItem(`vinyl_api_${module}`); } catch { }
};

// 各模块测试用的 API 路径
const MODULE_TEST_PATHS: Record<ApiModule, string> = {
  recommend: '/personalized?limit=1',
  playlist: '/playlist/track/all?id=833444858&limit=1',
  search: '/cloudsearch?keywords=test&type=1&limit=1',
  artist: '/artist/detail?id=12138269',
  lyrics: '/lyric?id=1974443814',
  comments: '/comment/music?id=1974443814&limit=1',
};

// 导出：刷新指定模块 - 实际发起请求竞速找到最快源
export const refreshModuleApiNode = async (module: ApiModule): Promise<string | null> => {
  // 先清除缓存
  moduleBestBases[module] = null;
  try { localStorage.removeItem(`vinyl_api_${module}`); } catch { }

  const TIMEOUT = 4500;
  const startTime = performance.now();
  const testPath = MODULE_TEST_PATHS[module];

  // 所有节点并发竞速
  const racePromises = API_BASES.map(async (base) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const url = `${base}${testPath}&timestamp=${Date.now()}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (data.code && data.code !== 200) throw new Error(`API Error ${data.code}`);

      return { base, success: true };
    } catch {
      clearTimeout(timeoutId);
      throw new Error(`Failed: ${base}`);
    }
  });

  try {
    // 使用自定义 promiseAny，谁先成功谁就是最快的
    const winner = await promiseAny(racePromises);
    saveModuleBestBase(module, winner.base);
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`🏆 [${API_MODULE_NAMES[module]}] 新最快源: ${winner.base} | ${elapsed}s`);
    return winner.base;
  } catch {
    console.error(`[${module}] 所有节点测速失败`);
    return null;
  }
};

// 导出：重置所有模块节点（用于首页刷新按钮）
export const resetBestApiNode = () => {
  const modules: ApiModule[] = ['recommend', 'playlist', 'search', 'artist', 'lyrics', 'comments'];
  modules.forEach(mod => resetModuleApiNode(mod));
};

// 导出：获取所有模块的节点状态
export const getModuleApiNodes = (): Record<ApiModule, string | null> => ({ ...moduleBestBases });

// 导出：获取单个模块节点（兼容旧代码）
export const getCurrentApiNode = () => moduleBestBases.playlist || moduleBestBases.recommend;

// 专辑封面缓存
const albumCoverCache: Record<number, string> = {};

/**
 * 带有超时的 Fetch 包装器
 * 限制每个单独请求的最大等待时间，避免被慢节点拖死
 * 增加超时时间以适应 Serverless 冷启动
 */
const fetchWithTimeout = async (url: string, timeout = 8000) => {
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
 * 智能 API 请求函数（分模块赛马）
 * @param path API 路径
 * @param module 模块名称，用于独立存储最优节点
 */
const fetchWithFailover = async (path: string, module: ApiModule = 'playlist'): Promise<any> => {
  const separator = path.includes('?') ? '&' : '?';
  // Add realIP to simulate mobile access (prevents API from detecting desktop browser)
  const MOBILE_IP = '116.25.146.177'; // Chinese mobile IP
  const commonParams = `timestamp=${Date.now()}&realIP=${MOBILE_IP}`;
  const startTime = performance.now();
  const TIMEOUT = 4500; // 4.5 秒超时

  // 1. 快速通道：使用该模块的缓存节点
  const cachedBase = moduleBestBases[module];
  if (cachedBase) {
    try {
      const url = `${cachedBase}${path}${separator}${commonParams}`;
      const res = await fetchWithTimeout(url, TIMEOUT);
      if (!res.ok) throw new Error(`Status ${res.status}`);

      const data = await res.json();
      if (data.code && data.code !== 200) throw new Error(`API Code ${data.code}`);

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`🚀 [${API_MODULE_NAMES[module]}] ${cachedBase} | ${elapsed}s`);
      return data;
    } catch (e) {
      console.warn(`[${module}] 缓存节点 ${cachedBase} 失败，进入赛马模式`, e);
      moduleBestBases[module] = null;
    }
  }

  // 2. 赛马模式：所有节点并发竞争
  const allCandidates = [...API_BASES];
  const BATCH_SIZE = 5;

  let lastError: any = null;

  for (let i = 0; i < allCandidates.length; i += BATCH_SIZE) {
    const batch = allCandidates.slice(i, i + BATCH_SIZE);

    try {
      const winnerResponse = await promiseAny(
        batch.map(async (base) => {
          const url = `${base}${path}${separator}${commonParams}`;
          const res = await fetchWithTimeout(url, TIMEOUT);
          if (!res.ok) throw new Error(`Status ${res.status}`);

          const data = await res.json();
          if (data.code && data.code !== 200) throw new Error(`API Error: ${data.code}`);

          // 胜利者成为该模块的最优节点
          if (!moduleBestBases[module]) {
            saveModuleBestBase(module, base);
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
            console.log(`🏆 [${API_MODULE_NAMES[module]}] 新最快源: ${base} | ${elapsed}s`);
          }
          return data;
        })
      );

      return winnerResponse;
    } catch (batchError) {
      lastError = batchError;
      continue;
    }
  }

  console.error(`[${module}] 所有节点均失败`, lastError);
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

// 快速获取播放列表（只获取前3首，用于快速进入页面）
export const fetchPlaylistQuick = async (id: string): Promise<Track[]> => {
  try {
    const data = await fetchWithFailover(`/playlist/track/all?id=${id}&limit=3&offset=0`, 'playlist');
    return (data.songs || []).map(normalizeTrack);
  } catch (e) {
    console.error("Failed to fetch playlist quick", e);
    throw e;
  }
};

// 获取完整播放列表
export const fetchPlaylist = async (id: string): Promise<Track[]> => {
  try {
    const data = await fetchWithFailover(`/playlist/track/all?id=${id}&limit=200&offset=0`, 'playlist');
    return (data.songs || []).map(normalizeTrack);
  } catch (e) {
    console.error("Failed to fetch playlist", e);
    throw e;
  }
};

export const fetchRecommendedPlaylists = async (): Promise<RecommendedPlaylist[]> => {
  try {
    const data = await fetchWithFailover('/personalized?limit=30', 'recommend');
    return data.result || [];
  } catch (e) {
    return [];
  }
};

export const searchPlaylists = async (keywords: string): Promise<RecommendedPlaylist[]> => {
  try {
    const data = await fetchWithFailover(`/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=1000&limit=30`, 'search');
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
    const data = await fetchWithFailover(`/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=1&limit=30`, 'search');
    const songs = data.result?.songs || [];
    return songs.map(normalizeTrack);
  } catch (e) {
    return [];
  }
};

export const searchArtists = async (keywords: string): Promise<Artist[]> => {
  try {
    const data = await fetchWithFailover(`/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=100&limit=30`, 'search');
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
    const data = await fetchWithFailover(`/artist/top/song?id=${artistId}`, 'artist');
    return (data.songs || []).map(normalizeTrack);
  } catch (e) {
    throw e;
  }
};

export const fetchArtistDetail = async (artistId: number): Promise<any> => {
  try {
    const data = await fetchWithFailover(`/artist/detail?id=${artistId}`, 'artist');
    return data.data?.artist || data.artist || {};
  } catch (e) {
    return {};
  }
};

export const fetchArtistSongsList = async (artistId: number, order: 'hot' | 'time', limit = 100): Promise<Track[]> => {
  // 优先使用 top/song 接口获取热门歌曲，因为它的数据最完整（包含封面）
  if (order === 'hot') {
    return fetchArtistTopSongs(artistId);
  }

  try {
    const data = await fetchWithFailover(`/artist/songs?id=${artistId}&order=${order}&limit=${limit}`, 'artist');
    const songs = (data.songs || []).map(normalizeTrack);

    // 收集缺失封面且未缓存的专辑 ID（去重）
    const albumIdsToFetch: number[] = [];
    songs.forEach((song: Track) => {
      if (!song.al.picUrl && song.al.id) {
        if (albumCoverCache[song.al.id]) {
          song.al.picUrl = albumCoverCache[song.al.id];
        } else if (!albumIdsToFetch.includes(song.al.id)) {
          albumIdsToFetch.push(song.al.id);
        }
      }
    });

    // 批量获取专辑封面（限制数量以平衡速度和完整性）
    if (albumIdsToFetch.length > 0) {
      const idsToFetch = albumIdsToFetch.slice(0, 10);
      const results = await Promise.allSettled(
        idsToFetch.map(async (albumId) => {
          const albumData = await fetchWithFailover(`/album?id=${albumId}`, 'artist');
          const picUrl = albumData.album?.picUrl || '';
          if (picUrl) albumCoverCache[albumId] = picUrl;
          return { albumId, picUrl };
        })
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.picUrl) {
          albumCoverCache[result.value.albumId] = result.value.picUrl;
        }
      });
    }

    // 填充封面
    return songs.map((song: Track) => {
      if (!song.al.picUrl && albumCoverCache[song.al.id]) {
        return { ...song, al: { ...song.al, picUrl: albumCoverCache[song.al.id] } };
      }
      return song;
    });
  } catch (e) {
    return [];
  }
};

/**
 * 获取音频 URL
 * 优先级：备用源 (酷狗/咪咕) -> 网易云 API -> 抛出错误 (切歌)
 * 
 * @param id 歌曲 ID
 * @param songName 歌曲名 (用于备用源搜索)
 * @param artistName 歌手名 (用于备用源搜索)
 * @returns 播放 URL，如果都失败则抛出错误
 */
export const getAudioUrl = async (
  id: number,
  songName?: string,
  artistName?: string
): Promise<string> => {

  // 1. 首先尝试备用源 (UnblockNeteaseMusic 风格)
  if (songName && artistName) {
    try {
      console.log('[Audio] Trying alternative sources first...');
      const { getAlternativeUrl } = await import('./alternativeMusicSource');
      const altUrl = await getAlternativeUrl(songName, artistName);

      if (altUrl) {
        console.log('[Audio] ✓ Found on alternative source!');
        return altUrl;
      }
      console.log('[Audio] Alternative sources returned no result');
    } catch (altError) {
      console.warn('[Audio] Alternative source error:', altError);
    }
  }

  // 2. 备用源失败，尝试网易云 API
  try {
    console.log('[Audio] Trying NetEase API...');
    const data = await fetchWithFailover(`/song/url?id=${id}&br=320000&cookie=os%3Dandroid`, 'playlist');

    if (data?.data?.[0]?.url) {
      console.log('[Audio] ✓ Got URL from NetEase API');
      return data.data[0].url;
    }

    // 检查是否是 VIP 歌曲
    const fee = data?.data?.[0]?.fee;
    if (fee === 1) {
      console.warn('[Audio] VIP song, API returned no URL');
    }
  } catch (e) {
    console.warn('[Audio] NetEase API failed:', e);
  }

  // 3. 都失败了，抛出错误触发切歌
  console.error('[Audio] ✗ All sources failed, throwing error to skip song');
  throw new Error('无法获取播放链接，将切换到下一首');
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
    const data = await fetchWithFailover(`/lyric?id=${id}`, 'lyrics');

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
    const data = await fetchWithFailover(`/comment/music?id=${id}&limit=20`, 'comments');
    return data.hotComments || data.comments || [];
  } catch (e) {
    return [];
  }
};