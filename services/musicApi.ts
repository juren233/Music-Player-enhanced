
import { Track, LyricLine, Comment, RecommendedPlaylist, Artist } from '../types';

// Use a rotating set of public APIs to improve stability
// Updated list with more reliable Vercel deployments and public instances
const API_BASES = [
  'https://netease-cloud-music-api-anon.vercel.app', // Highly reliable
  'https://music.cyrilstudio.top',
  'https://api-music.imsyy.top',
  'https://netease-cloud-music-api-demo.vercel.app',
  'https://music-api.heheda.top',
  'https://ncmapi.redd.one', // Sometimes slow
  'https://ncm.cloud.zlib.cn',
  // New backups
  'https://netease-cloud-music-api-git-main-fe-canvas.vercel.app',
  'https://music-api-theta-liart.vercel.app'
];

// Helper to try multiple endpoints
const fetchWithFailover = async (path: string): Promise<any> => {
  // Filter out official API if accidentally included (CORS issues in browser)
  const validBases = API_BASES.filter(b => !b.includes('music.163.com/api')); 
  let lastError: any = null;

  for (const base of validBases) {
    try {
      const controller = new AbortController();
      // Increased timeout to 8s to handle slower public instances / cold starts
      const timeoutId = setTimeout(() => controller.abort(), 8000); 

      // Add timestamp to prevent caching which can cause stale errors
      const separator = path.includes('?') ? '&' : '?';
      const url = `${base}${path}${separator}timestamp=${Date.now()}`;

      const res = await fetch(url, { 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
      
      const data = await res.json();
      
      // Check for logical API error (Netease API usually returns 200 with a code field)
      if (data.code && data.code !== 200) {
         throw new Error(`API Error Code: ${data.code}`);
      }

      return data;
    } catch (e) {
      // console.warn(`API ${base} failed:`, e);
      lastError = e;
      continue;
    }
  }
  
  throw lastError || new Error("All API endpoints failed");
};

export const fetchPlaylist = async (id: string): Promise<Track[]> => {
  try {
    const data = await fetchWithFailover(`/playlist/track/all?id=${id}&limit=50&offset=0`);
    return data.songs || [];
  } catch (e) {
    console.error("Failed to fetch playlist", e);
    throw e; // Re-throw to let App handle the error state
  }
};

export const fetchRecommendedPlaylists = async (): Promise<RecommendedPlaylist[]> => {
  try {
    const data = await fetchWithFailover('/personalized?limit=30');
    return data.result || [];
  } catch (e) {
    console.warn("Failed to fetch recommendations", e);
    return [];
  }
};

export const searchPlaylists = async (keywords: string): Promise<RecommendedPlaylist[]> => {
  try {
    // type 1000 = playlists
    const data = await fetchWithFailover(`/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=1000&limit=30`);
    const playlists = data.result?.playlists || [];
    
    // Map search result format to RecommendedPlaylist format
    return playlists.map((p: any) => ({
      id: p.id,
      name: p.name,
      picUrl: p.coverImgUrl, // Search results use 'coverImgUrl' instead of 'picUrl'
      playCount: p.playCount,
      copywriter: p.creator?.nickname // Use creator name as subtitle
    }));
  } catch (e) {
    console.warn("Failed to search playlists", e);
    return [];
  }
};

export const searchSongs = async (keywords: string): Promise<Track[]> => {
  try {
    // type 1 = songs
    const data = await fetchWithFailover(`/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=1&limit=30`);
    const songs = data.result?.songs || [];

    // Map search result song format to standard Track format
    // Note: Search results often differ slightly in structure (e.g., 'ar' vs 'artists', 'al' vs 'album')
    return songs.map((s: any) => ({
      id: s.id,
      name: s.name,
      ar: s.ar || s.artists || [], // Handle potential API inconsistencies
      al: s.al || s.album || { picUrl: '' },
      dt: s.dt || s.duration || 0
    }));
  } catch (e) {
    console.warn("Failed to search songs", e);
    return [];
  }
};

export const searchArtists = async (keywords: string): Promise<Artist[]> => {
  try {
    // type 100 = artists
    const data = await fetchWithFailover(`/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=100&limit=30`);
    const artists = data.result?.artists || [];

    return artists.map((a: any) => ({
      id: a.id,
      name: a.name,
      picUrl: a.picUrl || a.img1v1Url
    }));
  } catch (e) {
    console.warn("Failed to search artists", e);
    return [];
  }
};

export const fetchArtistSongs = async (artistId: number): Promise<Track[]> => {
  try {
    const data = await fetchWithFailover(`/artist/top/song?id=${artistId}`);
    return data.songs || [];
  } catch (e) {
    console.error("Failed to fetch artist songs", e);
    throw e;
  }
};

export const getAudioUrl = async (id: number): Promise<string> => {
  // Use standard Netease redirect interface for audio
  // This is a direct Netease URL (not via API proxy) and typically works well for <audio> tags
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

// Split configuration
const CHAR_LIMIT = 50; // Increased limit because we now handle wrapping gracefully

export const fetchLyrics = async (id: number): Promise<LyricLine[]> => {
  try {
    const data = await fetchWithFailover(`/lyric?id=${id}`);
    
    const original = data.lrc?.lyric ? parseLrc(data.lrc.lyric) : [];
    const translation = data.tlyric?.lyric ? parseLrc(data.tlyric.lyric) : [];

    // Calculate basic durations and map translations
    return original.map((line, index) => {
      const nextLine = original[index + 1];
      const rawDuration = nextLine ? nextLine.time - line.time : 5000;
      // Ensure a minimum duration for very fast lines to allow transition
      const duration = Math.max(400, rawDuration); 

      const transLine = translation.find(t => Math.abs(t.time - line.time) < 500);
      
      return {
        ...line,
        duration,
        trans: transLine?.text,
        isContinuation: false // No longer needed as much since we handle wrapping in UI
      };
    });

  } catch (e) {
    console.warn("No lyrics found");
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
