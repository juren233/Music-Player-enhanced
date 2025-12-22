
export interface Artist {
  id: number;
  name: string;
}

export interface Album {
  id: number;
  name: string;
  picUrl: string;
}

export interface Track {
  id: number;
  name: string;
  ar: Artist[];
  al: Album;
  dt: number; // Duration in ms
}

export interface LyricLine {
  time: number;
  text: string;
  trans?: string;
  duration: number; // Duration of the line in ms
  isContinuation?: boolean;
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
