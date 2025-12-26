/**
 * 酷狗音乐 API 服务
 * 
 * API 地址：https://kgmusicapi.juren233.workers.dev/
 * 文档：https://kugoumusicapi-docs.4everland.app/
 */

// ============ 配置 ============

const KUGOU_API_BASE = 'https://player.kgmusicapi.win';

// 本地存储 key
const STORAGE_KEYS = {
    TOKEN: 'kugou_token',
    USER_ID: 'kugou_user_id',
    VIP_TYPE: 'kugou_vip_type',
    NICKNAME: 'kugou_nickname',
    DFID: 'kugou_dfid'
};

// ============ 工具函数 ============

/**
 * 发起请求（自动携带凭证）
 */
const kugouFetch = async (path: string, options: RequestInit = {}): Promise<any> => {
    const url = `${KUGOU_API_BASE}${path}`;
    console.log('[Kugou API] Fetching:', url);

    try {
        const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        console.log('[Kugou API] Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('[Kugou API] Response data:', data);
        return data;
    } catch (e) {
        console.error(`[Kugou API] Request failed: ${path}`, e);
        throw e;
    }
};

/**
 * 添加时间戳防止缓存
 */
const withTimestamp = (path: string): string => {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}timestamp=${Date.now()}`;
};

// ============ DFID 注册（未登录时需要） ============

/**
 * 获取已保存的 dfid
 */
const getDfid = (): string | null => {
    try {
        return localStorage.getItem(STORAGE_KEYS.DFID);
    } catch {
        return null;
    }
};

/**
 * 保存 dfid
 */
const saveDfid = (dfid: string) => {
    try {
        localStorage.setItem(STORAGE_KEYS.DFID, dfid);
    } catch {
        console.warn('[Kugou] Failed to save dfid');
    }
};

/**
 * 注册设备获取 dfid（未登录时搜索需要）
 */
export const registerDev = async (): Promise<string | null> => {
    // 先检查是否已有 dfid
    const existingDfid = getDfid();
    if (existingDfid) {
        console.log('[Kugou] Using existing dfid:', existingDfid);
        return existingDfid;
    }

    console.log('[Kugou] Registering device to get dfid...');
    try {
        const data = await kugouFetch(withTimestamp('/register/dev'));

        if (data.status === 1 && data.data?.dfid) {
            saveDfid(data.data.dfid);
            console.log('[Kugou] Got dfid:', data.data.dfid);
            return data.data.dfid;
        }

        console.warn('[Kugou] registerDev: no dfid in response');
        return null;
    } catch (e) {
        console.error('[Kugou] registerDev error:', e);
        return null;
    }
};

// ============ 登录相关 ============

/**
 * 发送验证码
 */
export const sendCaptcha = async (mobile: string): Promise<{ success: boolean; message: string }> => {
    try {
        const data = await kugouFetch(`/captcha/sent?mobile=${mobile}`);

        if (data.status === 1 || data.data?.status === 1) {
            return { success: true, message: '验证码已发送' };
        }

        return { success: false, message: data.data?.tip || '发送验证码失败' };
    } catch (e) {
        return { success: false, message: '发送验证码失败，请重试' };
    }
};

/**
 * 手机验证码登录
 */
export const loginWithPhone = async (
    mobile: string,
    code: string
): Promise<{ success: boolean; message: string; userInfo?: KugouUserInfo }> => {
    try {
        const data = await kugouFetch(withTimestamp(`/login/cellphone?mobile=${mobile}&code=${code}`));

        if (data.status === 1 && data.data?.token) {
            // 保存登录信息
            const userInfo: KugouUserInfo = {
                token: data.data.token,
                userId: data.data.userid || data.data.user_id,
                nickname: data.data.nickname || data.data.user_name,
                vipType: data.data.vip_type || 0
            };

            saveLoginInfo(userInfo);

            return { success: true, message: '登录成功', userInfo };
        }

        return { success: false, message: data.error_msg || data.data?.tip || '登录失败' };
    } catch (e) {
        return { success: false, message: '登录失败，请重试' };
    }
};

/**
 * 获取二维码 key 和图片
 * API 直接返回 key (qrcode字段) 和图片 (qrcode_img字段)
 */
export const getQrKey = async (): Promise<{ success: boolean; key?: string; qrimg?: string }> => {
    console.log('[Kugou] getQrKey called');
    try {
        const data = await kugouFetch(withTimestamp('/login/qr/key'));
        console.log('[Kugou] getQrKey response:', data);

        if (data.status === 1 && data.data) {
            // API 返回 qrcode 作为 key，qrcode_img 作为二维码图片
            const key = data.data.qrcode || data.data.key;
            const qrimg = data.data.qrcode_img || data.data.qrimg;

            if (key) {
                console.log('[Kugou] getQrKey success, key:', key);
                return { success: true, key, qrimg };
            }
        }

        console.warn('[Kugou] getQrKey: no key in response');
        return { success: false };
    } catch (e) {
        console.error('[Kugou] getQrKey error:', e);
        return { success: false };
    }
};

/**
 * 生成二维码
 */
export const createQrCode = async (key: string): Promise<{ success: boolean; qrimg?: string; url?: string }> => {
    try {
        const data = await kugouFetch(withTimestamp(`/login/qr/create?key=${key}&qrimg=1`));

        console.log('[Kugou] QR create response:', data);

        // 处理不同的响应格式
        if (data.status === 1) {
            // 尝试多种可能的字段名 (包括 qrcode)
            const qrimg = data.data?.qrimg || data.data?.qrcode || data.data?.qr_img || data.data?.base64 || data.qrimg || data.qrcode || data.base64;
            const url = data.data?.url || data.data?.qrurl || data.url;

            if (qrimg) {
                return { success: true, qrimg, url };
            }
        }

        // 如果响应本身就是 base64 图片
        if (typeof data === 'string' && data.startsWith('data:image')) {
            return { success: true, qrimg: data };
        }

        // 检查 data 字段是否直接是 base64
        if (data.data && typeof data.data === 'string' && data.data.startsWith('data:image')) {
            return { success: true, qrimg: data.data };
        }

        console.warn('[Kugou] QR code response format not recognized:', data);
        return { success: false };
    } catch (e) {
        console.error('[Kugou] QR create error:', e);
        return { success: false };
    }
};

/**
 * 检查二维码扫描状态
 * 状态码: 0=过期, 1=等待扫码, 2=待确认, 4=登录成功
 */
export const checkQrStatus = async (key: string): Promise<QrCheckResult> => {
    try {
        const data = await kugouFetch(withTimestamp(`/login/qr/check?key=${key}`));

        const status = data.data?.status ?? data.status;

        if (status === 4 && data.data?.token) {
            // 登录成功
            const userInfo: KugouUserInfo = {
                token: data.data.token,
                userId: data.data.userid || data.data.user_id,
                nickname: data.data.nickname || data.data.user_name,
                vipType: data.data.vip_type || 0
            };

            saveLoginInfo(userInfo);

            return { status: 4, message: '登录成功', userInfo };
        }

        const messages: Record<number, string> = {
            0: '二维码已过期',
            1: '等待扫码',
            2: '请在手机上确认登录'
        };

        return { status, message: messages[status] || '未知状态' };
    } catch (e) {
        return { status: -1, message: '检查状态失败' };
    }
};

/**
 * 获取用户 VIP 信息
 */
export const getUserVipInfo = async (): Promise<{ isVip: boolean; vipType: number; expireTime?: number }> => {
    try {
        const data = await kugouFetch('/user/vip/detail');

        if (data.status === 1 && data.data) {
            return {
                isVip: data.data.is_vip === 1 || data.data.vip_type > 0,
                vipType: data.data.vip_type || 0,
                expireTime: data.data.expire_time
            };
        }

        return { isVip: false, vipType: 0 };
    } catch (e) {
        return { isVip: false, vipType: 0 };
    }
};

// ============ 登录状态管理 ============

/**
 * 保存登录信息到本地
 */
const saveLoginInfo = (userInfo: KugouUserInfo) => {
    try {
        localStorage.setItem(STORAGE_KEYS.TOKEN, userInfo.token);
        localStorage.setItem(STORAGE_KEYS.USER_ID, userInfo.userId);
        localStorage.setItem(STORAGE_KEYS.NICKNAME, userInfo.nickname || '');
        localStorage.setItem(STORAGE_KEYS.VIP_TYPE, String(userInfo.vipType || 0));
    } catch (e) {
        console.warn('[Kugou] Failed to save login info');
    }
};

/**
 * 获取保存的登录信息
 */
export const getLoginInfo = (): KugouUserInfo | null => {
    try {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const userId = localStorage.getItem(STORAGE_KEYS.USER_ID);

        if (!token || !userId) return null;

        return {
            token,
            userId,
            nickname: localStorage.getItem(STORAGE_KEYS.NICKNAME) || '',
            vipType: parseInt(localStorage.getItem(STORAGE_KEYS.VIP_TYPE) || '0', 10)
        };
    } catch (e) {
        return null;
    }
};

/**
 * 检查是否已登录
 */
export const isLoggedIn = (): boolean => {
    return getLoginInfo() !== null;
};

/**
 * 退出登录
 */
export const logout = () => {
    try {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_ID);
        localStorage.removeItem(STORAGE_KEYS.NICKNAME);
        localStorage.removeItem(STORAGE_KEYS.VIP_TYPE);
    } catch (e) {
        console.warn('[Kugou] Failed to clear login info');
    }
};

// ============ 搜索 ============

/**
 * 搜索歌曲
 * 未登录时需要通过 dfid 才能搜索
 */
export const searchSong = async (keywords: string): Promise<KugouSearchResult[]> => {
    try {
        // 构建搜索 URL
        let searchUrl = `/search?keywords=${encodeURIComponent(keywords)}&pagesize=10`;

        // 如果未登录，需要获取 dfid 并添加到 cookie 参数
        if (!isLoggedIn()) {
            const dfid = await registerDev();
            if (dfid) {
                searchUrl += `&cookie=dfid=${dfid}`;
                console.log('[Kugou] Searching with dfid');
            } else {
                console.warn('[Kugou] No dfid available, search may fail');
            }
        } else {
            console.log('[Kugou] Searching as logged in user');
        }

        const data = await kugouFetch(searchUrl);

        if (data.status === 1 && data.data?.lists) {
            return data.data.lists.map((item: any) => ({
                hash: item.FileHash || item.Hash || item.hash,
                songName: item.SongName || item.songname || item.song_name,
                singerName: item.SingerName || item.singername || item.singer_name,
                albumId: item.AlbumID || item.album_id,
                albumAudioId: item.AlbumAudioID || item.album_audio_id,
                duration: item.Duration || item.duration,
                mvHash: item.MvHash || item.mvhash
            }));
        }

        // 尝试另一种返回格式
        if (data.data?.info) {
            return data.data.info.map((item: any) => ({
                hash: item.hash,
                songName: item.songname,
                singerName: item.singername,
                albumId: item.album_id,
                duration: item.duration
            }));
        }

        return [];
    } catch (e) {
        console.error('[Kugou] Search failed:', e);
        return [];
    }
};

// ============ 播放 ============

/**
 * 获取歌曲播放 URL
 * @param hash 歌曲 hash
 * @param albumId 专辑 ID (可选，有的话更准确)
 * @param quality 音质 (128, 320, flac, high)
 */
export const getSongUrl = async (
    hash: string,
    albumId?: string,
    quality: '128' | '320' | 'flac' | 'high' = '320'
): Promise<string | null> => {
    try {
        let path = `/song/url?hash=${hash}&quality=${quality}`;
        if (albumId) {
            path += `&album_id=${albumId}`;
        }

        const data = await kugouFetch(path);

        if (data.status === 1) {
            // 辅助函数：提取 URL（处理数组或字符串）
            const extractUrl = (urlField: any): string | null => {
                if (!urlField) return null;
                if (Array.isArray(urlField)) {
                    return urlField[0] || null;
                }
                return urlField;
            };

            // 尝试 data.data.play_url
            if (data.data?.play_url) {
                console.log('[Kugou] Got URL:', data.data.play_url);
                return data.data.play_url;
            }

            // 尝试 data.data.url
            if (data.data?.url) {
                const url = extractUrl(data.data.url);
                if (url) {
                    console.log('[Kugou] Got URL:', url);
                    return url;
                }
            }

            // URL 可能直接在顶层：data.url
            if (data.url) {
                const url = extractUrl(data.url);
                if (url) {
                    console.log('[Kugou] Got URL:', url);
                    return url;
                }
            }

            // 尝试 backupUrl（可能在 data.data 或顶层）
            const backupUrl = data.data?.backupUrl || data.backupUrl;
            if (backupUrl) {
                const url = extractUrl(backupUrl);
                if (url) {
                    console.log('[Kugou] Got URL:', url);
                    return url;
                }
            }
        }

        console.warn('[Kugou] No URL in response:', data);
        return null;
    } catch (e) {
        console.error('[Kugou] Get URL failed:', e);
        return null;
    }
};

// ============ 类型定义 ============

export interface KugouUserInfo {
    token: string;
    userId: string;
    nickname?: string;
    vipType: number;
}

export interface QrCheckResult {
    status: number; // 0=过期, 1=等待, 2=待确认, 4=成功
    message: string;
    userInfo?: KugouUserInfo;
}

export interface KugouSearchResult {
    hash: string;
    songName: string;
    singerName: string;
    albumId?: string;
    albumAudioId?: string;
    duration?: number;
    mvHash?: string;
}
