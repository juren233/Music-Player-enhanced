/**
 * 多平台音乐源 - VIP 歌曲解锁服务
 * 
 * 当网易云 VIP 歌曲无法播放时，从酷狗搜索替代源
 * 优先级：酷狗 -> 网易云 API -> 切歌
 */

import { searchSong, getSongUrl, isLoggedIn } from './kugouApi';

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
    // 标准化字符串（处理 undefined/null）
    const normalize = (s: string | undefined | null) => (s || '').toLowerCase().trim()
        .replace(/\s+/g, '')
        .replace(/[（）()【】\[\]「」『』《》<>]/g, '')
        .replace(/\s*-\s*/g, '');

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
 * 从酷狗获取歌曲播放 URL
 * 
 * @param songName 歌曲名
 * @param artistName 歌手名
 * @returns 包含播放 URL 和 kugouHash 的对象，或 null
 */
export const getAlternativeUrl = async (
    songName: string,
    artistName: string
): Promise<{ url: string; kugouHash: string } | null> => {
    const keyword = `${songName} ${artistName}`;
    const MATCH_THRESHOLD = 0.6; // 匹配度阈值

    console.log(`[Kugou] Searching for: ${keyword}`);
    console.log(`[Kugou] Login status: ${isLoggedIn() ? '已登录' : '未登录'}`);

    try {
        const results = await searchSong(keyword);

        if (results.length === 0) {
            console.log('[Kugou] No search results');
            return null;
        }

        // 找最佳匹配
        let bestMatch = null;
        let bestScore = 0;

        for (const song of results) {
            const score = calculateMatchScore(songName, artistName, song.songName, song.singerName);
            console.log(`[Kugou] Match: "${song.songName}" by "${song.singerName}" - Score: ${score.toFixed(2)}`);

            if (score > bestScore) {
                bestScore = score;
                bestMatch = song;
            }
        }

        // 检查匹配度是否达到阈值
        if (!bestMatch || bestScore < MATCH_THRESHOLD) {
            console.log(`[Kugou] No good match found (best score: ${bestScore.toFixed(2)})`);
            return null;
        }

        console.log(`[Kugou] Best match: "${bestMatch.songName}" - Score: ${bestScore.toFixed(2)}`);

        // 获取播放 URL
        const url = await getSongUrl(bestMatch.hash, bestMatch.albumId);

        if (url) {
            console.log('[Kugou] ✓ Got URL successfully');
            return { url, kugouHash: bestMatch.hash };
        }

        console.log('[Kugou] Failed to get URL (may need VIP login)');
        return null;

    } catch (e) {
        console.error('[Kugou] Error:', e);
        return null;
    }
};

// ============ 导出类型 ============

export { isLoggedIn } from './kugouApi';
