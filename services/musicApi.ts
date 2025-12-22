
import { Track, LyricLine, Comment } from '../types';

// Use a rotating set of public APIs to improve stability
// Updated list with more reliable Vercel deployments and public instances
const API_BASES = [
  'https://ncmapi.redd.one', // Often reliable
  'https://netease-cloud-music-api-anon.vercel.app',
  'https://netease-cloud-music-api-demo.vercel.app',
  'https://music.cyrilstudio.top',
  'https://api-music.imsyy.top',
  'https://netease-cloud-music-api-gamma-sage.vercel.app',
  'https://music-api.heheda.top',
  'https://ncm.cloud.zlib.cn',
  'https://netease-cloud-music-api-psi-topaz.vercel.app'
];

// Helper to try multiple endpoints
const fetchWithFailover = async (path: string): Promise<any> => {
  // Filter out official API if accidentally included (CORS issues in browser)
  const validBases = API_BASES.filter(b => !b.includes('music.163.com/api')); 
  let lastError: any = null;

  for (const base of validBases) {
    try {
      const controller = new AbortController();
      // Increased timeout to 15s to handle slower public instances / cold starts
      const timeoutId = setTimeout(() => controller.abort(), 15000); 

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
