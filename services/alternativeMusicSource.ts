/**
 * 多平台音乐源 - VIP 歌曲解锁服务
 * 
 * 当网易云 VIP 歌曲无法播放时，从其他平台搜索替代源
 * 优先级：酷狗 -> 咪咕 -> 放弃
 */

// ============ 酷狗音乐 API ============

/**
 * 酷狗音乐搜索
 * @param keyword 搜索关键词 (歌曲名 + 歌手名)
 * @returns 搜索结果列表
 */
export const searchKugou = async (keyword: string): Promise<KugouSong[]> => {
    try {
        const url = `https://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(keyword)}&page=1&pagesize=10`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn('[Kugou] Search request failed:', response.status);
            return [];
        }

        const data = await response.json();

        if (data.status !== 1 || !data.data?.info) {
            console.warn('[Kugou] Search returned empty or error:', data);
            return [];
        }

        return data.data.info.map((item: any) => ({
            hash: item.hash,
            songName: item.songname,
            singerName: item.singername,
            albumId: item.album_id,
            duration: item.duration
        }));
    } catch (e) {
        console.error('[Kugou] Search error:', e);
        return [];
    }
};

/**
 * 获取酷狗音乐播放 URL
 * @param hash 歌曲 hash
 * @param albumId 专辑 ID (可选)
 * @returns 播放 URL 或 null
 */
export const getKugouUrl = async (hash: string, albumId?: string): Promise<string | null> => {
    try {
        // 使用移动端接口获取播放信息
        const url = `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn('[Kugou] Get URL request failed:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.url) {
            console.log('[Kugou] Got URL successfully');
            return data.url;
        }

        console.warn('[Kugou] No URL in response:', data);
        return null;
    } catch (e) {
        console.error('[Kugou] Get URL error:', e);
        return null;
    }
};

// ============ 咪咕音乐 API ============

/**
 * 咪咕音乐搜索
 * @param keyword 搜索关键词
 * @returns 搜索结果列表
 */
export const searchMigu = async (keyword: string): Promise<MiguSong[]> => {
    try {
        const url = `https://m.music.migu.cn/migu/remoting/scr_search_tag?keyword=${encodeURIComponent(keyword)}&type=2&pgc=1&rows=10`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn('[Migu] Search request failed:', response.status);
            return [];
        }

        const data = await response.json();

        if (!data.musics || data.musics.length === 0) {
            console.warn('[Migu] Search returned empty');
            return [];
        }

        return data.musics.map((item: any) => ({
            id: item.id,
            copyrightId: item.copyrightId,
            songName: item.songName,
            singerName: item.singerName,
            mp3: item.mp3,
            listenUrl: item.listenUrl
        }));
    } catch (e) {
        console.error('[Migu] Search error:', e);
        return [];
    }
};

/**
 * 获取咪咕音乐播放 URL
 * 咪咕搜索结果中通常已包含播放链接
 */
export const getMiguUrl = async (song: MiguSong): Promise<string | null> => {
    // 咪咕搜索结果通常直接包含 listenUrl 或 mp3
    if (song.mp3) {
        console.log('[Migu] Using mp3 URL');
        return song.mp3;
    }
    if (song.listenUrl) {
        console.log('[Migu] Using listenUrl');
        return song.listenUrl;
    }
    return null;
};

// ============ 匹配逻辑 ============

/**
 * 计算歌曲匹配度
 * @param targetName 目标歌曲名
 * @param targetArtist 目标歌手名
 * @param foundName 找到的歌曲名
 * @param foundArtist 找到的歌手名
 * @returns 匹配度 0-1
 */
const calculateMatchScore = (
    targetName: string,
    targetArtist: string,
    foundName: string,
    foundArtist: string
): number => {
    // 标准化字符串
    const normalize = (s: string) => s.toLowerCase().trim()
        .replace(/\s+/g, '')
        .replace(/[（）()【】\[\]「」『』]/g, '');

    const tName = normalize(targetName);
    const tArtist = normalize(targetArtist);
    const fName = normalize(foundName);
    const fArtist = normalize(foundArtist);

    // 歌曲名完全匹配得 0.6 分
    let nameScore = 0;
    if (fName === tName) {
        nameScore = 0.6;
    } else if (fName.includes(tName) || tName.includes(fName)) {
        nameScore = 0.4;
    }

    // 歌手名匹配得 0.4 分
    let artistScore = 0;
    if (fArtist === tArtist) {
        artistScore = 0.4;
    } else if (fArtist.includes(tArtist) || tArtist.includes(fArtist)) {
        artistScore = 0.3;
    } else {
        // 检查歌手名是否有交集（多个歌手的情况）
        const tArtists = tArtist.split(/[,、\/\\]/);
        const fArtists = fArtist.split(/[,、\/\\]/);
        const hasMatch = tArtists.some(ta =>
            fArtists.some(fa => fa.includes(ta) || ta.includes(fa))
        );
        if (hasMatch) artistScore = 0.2;
    }

    return nameScore + artistScore;
};

// ============ 主入口 ============

/**
 * 从备用源获取歌曲播放 URL
 * 
 * @param songName 歌曲名
 * @param artistName 歌手名
 * @returns 播放 URL 或 null
 */
export const getAlternativeUrl = async (
    songName: string,
    artistName: string
): Promise<string | null> => {
    const keyword = `${songName} ${artistName}`;
    const MATCH_THRESHOLD = 0.6; // 匹配度阈值

    console.log(`[Alternative] Searching for: ${keyword}`);

    // 1. 尝试酷狗
    try {
        const kugouResults = await searchKugou(keyword);

        for (const song of kugouResults) {
            const score = calculateMatchScore(songName, artistName, song.songName, song.singerName);
            console.log(`[Kugou] Match: "${song.songName}" by "${song.singerName}" - Score: ${score.toFixed(2)}`);

            if (score >= MATCH_THRESHOLD) {
                const url = await getKugouUrl(song.hash, song.albumId);
                if (url) {
                    console.log(`[Alternative] Found on Kugou!`);
                    return url;
                }
            }
        }
    } catch (e) {
        console.warn('[Alternative] Kugou failed:', e);
    }

    // 2. 尝试咪咕
    try {
        const miguResults = await searchMigu(keyword);

        for (const song of miguResults) {
            const score = calculateMatchScore(songName, artistName, song.songName, song.singerName);
            console.log(`[Migu] Match: "${song.songName}" by "${song.singerName}" - Score: ${score.toFixed(2)}`);

            if (score >= MATCH_THRESHOLD) {
                const url = await getMiguUrl(song);
                if (url) {
                    console.log(`[Alternative] Found on Migu!`);
                    return url;
                }
            }
        }
    } catch (e) {
        console.warn('[Alternative] Migu failed:', e);
    }

    console.log(`[Alternative] No match found for: ${keyword}`);
    return null;
};

// ============ 类型定义 ============

interface KugouSong {
    hash: string;
    songName: string;
    singerName: string;
    albumId?: string;
    duration: number;
}

interface MiguSong {
    id: string;
    copyrightId: string;
    songName: string;
    singerName: string;
    mp3?: string;
    listenUrl?: string;
}
