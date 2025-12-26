
export interface Artist {
  id: number;
  name: string;
  picUrl?: string; // Optional because sometimes it's missing in track details but present in search
  img1v1Url?: string;
}

export interface Album {
  id: number;
  name: string;
  picUrl: string;
  pic_str?: string;
}

export interface Track {
  id: number;
  name: string;
  ar: Artist[];
  al: Album;
  dt: number; // Duration in ms
  fee?: number; // 0: Free, 1: VIP, 4: Paid Album, 8: Sq
  sourceUrl?: string; // URL for local file playback
}

export interface WordTiming {
  word: string;      // 字/词
  startTime: number; // 开始时间 (ms)
  duration: number;  // 持续时间 (ms)
}

export interface LyricLine {
  time: number;
  text: string;
  trans?: string;
  duration: number; // Duration of the line in ms
  isContinuation?: boolean;
  words?: WordTiming[]; // 逐字时间数据
}

export interface User {
  nickname: string;
  avatarUrl: string;
}

export interface Comment {
  commentId: number;
  content: string;
  user: User;
  time: number;
  likedCount: number;
}

export interface RecommendedPlaylist {
  id: number;
  name: string;
  picUrl: string;
  playCount: number;
  copywriter?: string;
}
