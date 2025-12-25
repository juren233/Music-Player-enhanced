
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchPlaylist, getAudioUrl, fetchLyrics, fetchComments, fetchRecommendedPlaylists, searchPlaylists, searchSongs, searchArtists, fetchArtistSongsList, fetchArtistDetail } from './services/musicApi';
import { processLocalArchive } from './services/localMusicService';
import { Track, LyricLine, Comment, RecommendedPlaylist, Artist } from './types';
import { MusicPlayer } from './components/MusicPlayer';
import { APP_VERSION, DEFAULT_VOLUME } from './constants';
import { Loader2, AlertCircle, Search } from 'lucide-react';

// New Components & Hooks
import { useTheme } from './hooks/useTheme';
import { useVisuals } from './hooks/useVisuals';
import { BackgroundLayer } from './components/BackgroundLayer';
import { AlbumArt } from './components/AlbumArt';
import { LyricsView } from './components/LyricsView';
import { CommentsDrawer } from './components/CommentsDrawer';
import { QueueDrawer, SearchType, ViewType } from './components/QueueDrawer';

const DEFAULT_PLAYLIST_ID = '833444858';

const App: React.FC = () => {
    // Theme Hook
    const { themeMode, isDarkMode, toggleTheme } = useTheme();

    // Data State
    const [playlistId, setPlaylistId] = useState(DEFAULT_PLAYLIST_ID);
    const [playlist, setPlaylist] = useState<Track[]>([]);

    // Recommendations & Search State
    const [recommendations, setRecommendations] = useState<RecommendedPlaylist[]>([]);

    // Search Results State
    const [searchType, setSearchType] = useState<SearchType>('playlist');
    const [playlistSearchResults, setPlaylistSearchResults] = useState<RecommendedPlaylist[]>([]);
    const [songSearchResults, setSongSearchResults] = useState<Track[]>([]);
    const [artistSearchResults, setArtistSearchResults] = useState<Artist[]>([]);

    const [isSearching, setIsSearching] = useState(false);
    const [isSearchLoading, setIsSearchLoading] = useState(false);

    // Artist Detail State
    const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);
    const [artistDetail, setArtistDetail] = useState<any>(null);
    const [artistSongs, setArtistSongs] = useState<Track[]>([]);
    const [artistSortOrder, setArtistSortOrder] = useState<'hot' | 'time'>('hot');
    const [isArtistLoading, setIsArtistLoading] = useState(false);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // UI State for Playlist Input
    const [tempPlaylistId, setTempPlaylistId] = useState('');

    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Playback Mode State
    const [isShuffle, setIsShuffle] = useState(false);
    const [isReverse, setIsReverse] = useState(false);

    // Volume with Persistence
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem('vinyl_volume');
        return saved !== null ? parseFloat(saved) : DEFAULT_VOLUME;
    });

    const [playError, setPlayError] = useState<string | null>(null);

    // View State
    const [lyrics, setLyrics] = useState<LyricLine[]>([]);
    const [isLyricsLoading, setIsLyricsLoading] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [isRefreshingComments, setIsRefreshingComments] = useState(false);

    // UI Toggles
    const [showQueue, setShowQueue] = useState(false);
    const [viewTab, setViewTab] = useState<ViewType>('recommend');
    const [showComments, setShowComments] = useState(false);

    // Error handling
    const [consecutiveErrors, setConsecutiveErrors] = useState(0);

    // Refs
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const loadingTrackRef = useRef<number | null>(null);
    const rafRef = useRef<number | null>(null);

    // --- Load Playlist ---
    const loadPlaylistData = async (id: string) => {
        setIsLoading(true);
        setPlayError(null);
        try {
            const tracks = await fetchPlaylist(id);
            if (tracks.length > 0) {
                setPlaylist(tracks);
                setCurrentIndex(0);
                setIsPlaying(false);
                setConsecutiveErrors(0);
                setPlaylistId(id);
            } else {
                setPlayError("无法加载歌单，ID无效或歌单为空");
            }
        } catch (e) {
            console.error("Init failed", e);
            setPlayError("网络连接失败，请检查网络或代理");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPlaylistData(playlistId);
    }, []);

    // Fetch recommendations when queue view opens
    useEffect(() => {
        if (showQueue && recommendations.length === 0) {
            fetchRecommendedPlaylists().then(setRecommendations);
        }
    }, [showQueue]);

    const extractIdFromInput = (input: string): string | null => {
        const clean = input.trim();
        const idParamMatch = clean.match(/[?&]id=(\d+)/);
        if (idParamMatch) return idParamMatch[1];
        const pathMatch = clean.match(/\/playlist\/(\d+)/);
        if (pathMatch) return pathMatch[1];
        if (/^\d{5,}$/.test(clean)) return clean; // Assuming IDs are at least 5 digits
        return null;
    };

    // Perform the search based on current searchType
    const executeSearch = async (query: string, type: SearchType) => {
        if (!query.trim()) return;

        setIsSearching(true);
        setIsSearchLoading(true);
        setViewTab('recommend');

        try {
            if (type === 'playlist') {
                const results = await searchPlaylists(query);
                setPlaylistSearchResults(results);
            } else if (type === 'song') {
                const results = await searchSongs(query);
                setSongSearchResults(results);
            } else if (type === 'artist') {
                const results = await searchArtists(query);
                setArtistSearchResults(results);
            }
        } catch (e) {
            console.error("Search failed", e);
        } finally {
            setIsSearchLoading(false);
        }
    };

    const handleSearchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempPlaylistId.trim()) return;

        const extractedId = extractIdFromInput(tempPlaylistId);

        // Case 1: Valid ID or Link found -> Direct Load (Playlist Only)
        if (extractedId) {
            setTempPlaylistId(extractedId);
            if (extractedId === playlistId) return;
            loadPlaylistData(extractedId);
            setShowQueue(false);
            setIsSearching(false);
            return;
        }

        // Case 2: Not an ID -> Perform Search
        executeSearch(tempPlaylistId, searchType);
    };

    const handleTabChange = (newType: SearchType) => {
        setSearchType(newType);
        // If we already have a search query, re-search immediately for the new type
        if (tempPlaylistId && isSearching) {
            executeSearch(tempPlaylistId, newType);
        }
    };

    const clearSearch = () => {
        setIsSearching(false);
        setPlaylistSearchResults([]);
        setSongSearchResults([]);
        setArtistSearchResults([]);
        setTempPlaylistId('');
        setSearchType('playlist'); // Reset to default
    };

    const handleSongResultClick = (track: Track) => {
        // Logic: Playing a song from search replaces current queue with search results (or just plays it)
        setPlaylist(songSearchResults);
        const idx = songSearchResults.findIndex(t => t.id === track.id);
        setCurrentIndex(idx !== -1 ? idx : 0);
        setIsPlaying(true);
        setPlayError(null);
        // Close overlay to show player
        setShowQueue(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const tracks = await processLocalArchive(file);
            if (tracks.length > 0) {
                setPlaylist(tracks);
                setCurrentIndex(0);
                setIsPlaying(false);
                setPlaylistId('local-import');
                setShowQueue(false);
                setPlayError(null);
            } else {
                setPlayError("未在压缩包中找到音频文件 (支持 mp3/wav/ogg/m4a)");
            }
        } catch (err: any) {
            setPlayError(err.message || "解析文件失败");
        } finally {
            setIsLoading(false);
            // Reset file input logic is handled inside component if necessary, or we just rely on new selection
            e.target.value = '';
        }
    };

    // Load Artist Data (Detail + Songs)
    const loadArtistData = async (artistId: number, order: 'hot' | 'time' = 'hot') => {
        setIsArtistLoading(true);
        setSelectedArtistId(artistId);
        setArtistSortOrder(order);
        // Ensure the view switches to artist detail
        setViewTab('artist');
        setShowQueue(true);

        try {
            // Parallel fetch: detail + songs
            const [detail, songs] = await Promise.all([
                fetchArtistDetail(artistId),
                fetchArtistSongsList(artistId, order)
            ]);

            setArtistDetail(detail);
            setArtistSongs(songs);
        } catch (e) {
            console.error("Failed to load artist data", e);
        } finally {
            setIsArtistLoading(false);
        }
    };

    // Click handler from Search
    const handleArtistResultClick = (artistId: number) => {
        loadArtistData(artistId, 'hot');
    };

    // Click handler from Player (Bottom Left)
    const handlePlayerArtistClick = (artistId: number) => {
        // Local artists have id=0, ignore
        if (artistId === 0) return;
        loadArtistData(artistId, 'hot');
    };

    // Sort toggle handler - Optimized to only fetch songs
    const handleArtistSortChange = async (order: 'hot' | 'time') => {
        if (!selectedArtistId) return;
        if (order === artistSortOrder) return; // No change

        setArtistSortOrder(order);
        setIsArtistLoading(true); // Reuse loading state for list part

        try {
            // Only fetch songs, keep detail
            const songs = await fetchArtistSongsList(selectedArtistId, order);
            setArtistSongs(songs);
        } catch (e) {
            console.error("Failed to switch sort order", e);
        } finally {
            setIsArtistLoading(false);
        }
    };

    // Play from Artist List
    const handleArtistSongClick = (track: Track) => {
        setPlaylist(artistSongs);
        const idx = artistSongs.findIndex(t => t.id === track.id);
        setCurrentIndex(idx !== -1 ? idx : 0);
        setIsPlaying(true);
        setPlayError(null);
        setShowQueue(false);
    };

    const currentTrack = playlist[currentIndex];

    // Visuals Hook (Dominant Color)
    const { dominantColor, bgPalette, extractedColors } = useVisuals(currentTrack);

    // --- Track Change Logic ---
    useEffect(() => {
        if (!currentTrack) return;

        let isMounted = true;
        loadingTrackRef.current = currentTrack.id;

        const loadTrack = async () => {
            setLyrics([]);
            setIsLyricsLoading(true);
            setComments([]);
            setPlayError(null);

            try {
                let url: string;
                // Check if track has a local source URL (from zip import)
                if (currentTrack.sourceUrl) {
                    url = currentTrack.sourceUrl;
                } else {
                    // 传入歌曲名和歌手名，以便 VIP 歌曲可以搜索备用源
                    const artistNames = currentTrack.ar.map(a => a.name).join(' ');
                    url = await getAudioUrl(currentTrack.id, currentTrack.name, artistNames, currentTrack.fee);
                }

                if (!isMounted || loadingTrackRef.current !== currentTrack.id) return;

                if (audioRef.current) {
                    audioRef.current.src = url;
                    audioRef.current.volume = volume;
                    audioRef.current.load();
                    if (isPlaying) {
                        audioRef.current.play().catch(e => {
                            if (e.name !== 'NotAllowedError') handlePlayError(e);
                            else setIsPlaying(false);
                        });
                    }
                }
            } catch (e) {
                if (isMounted) handleAudioError(null as any);
            }

            // Only fetch metadata for non-local tracks (local tracks have negative IDs)
            if (!currentTrack.sourceUrl && currentTrack.id > 0) {
                fetchLyrics(currentTrack.id).then(data => {
                    if (isMounted && loadingTrackRef.current === currentTrack.id) {
                        setLyrics(data);
                        setIsLyricsLoading(false);
                    }
                }).catch(() => { setIsLyricsLoading(false); });

                fetchComments(currentTrack.id).then(data => {
                    if (isMounted && loadingTrackRef.current === currentTrack.id) setComments(data);
                }).catch(() => { });
            }
        };

        loadTrack();
        return () => { isMounted = false; };
    }, [currentTrack]);

    // --- Smooth Timer Loop ---
    useEffect(() => {
        const loop = () => {
            if (audioRef.current && !audioRef.current.paused) {
                const time = audioRef.current.currentTime * 1000;
                setCurrentTime(time);
            }
            rafRef.current = requestAnimationFrame(loop);
        };

        if (isPlaying) {
            loop();
        } else {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        }

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isPlaying]);

    const handleDurationChange = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration * 1000 || 0);
        }
    };

    const handleEnded = () => {
        setConsecutiveErrors(0);
        playNext();
    };

    const handlePlayError = (error: any) => {
        if (consecutiveErrors >= 10) {
            setIsPlaying(false);
            setPlayError("连续多首歌曲无法播放，可能为VIP专享或版权限制");
            return;
        }
        setConsecutiveErrors(prev => prev + 1);
        setTimeout(() => playNext(), 500);
    };

    const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
        handlePlayError("音频加载失败");
    };

    const getRandomIndex = useCallback((current: number, length: number) => {
        if (length <= 1) return 0;
        let next = Math.floor(Math.random() * length);
        while (next === current) {
            next = Math.floor(Math.random() * length);
        }
        return next;
    }, []);

    const playNext = useCallback(() => {
        if (playlist.length === 0) return;
        setCurrentIndex((prev) => {
            if (isShuffle) {
                return getRandomIndex(prev, playlist.length);
            }
            if (isReverse) {
                return (prev - 1 + playlist.length) % playlist.length;
            }
            return (prev + 1) % playlist.length;
        });
    }, [playlist.length, isShuffle, isReverse, getRandomIndex]);

    const playPrev = useCallback(() => {
        if (playlist.length === 0) return;
        setConsecutiveErrors(0);
        setCurrentIndex((prev) => {
            if (isShuffle) {
                return getRandomIndex(prev, playlist.length);
            }
            if (isReverse) {
                return (prev + 1) % playlist.length;
            }
            return (prev - 1 + playlist.length) % playlist.length;
        });
    }, [playlist.length, isShuffle, isReverse, getRandomIndex]);

    const togglePlay = useCallback(async () => {
        if (!audioRef.current || !currentTrack) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            try {
                await audioRef.current.play();
                setIsPlaying(true);
                setConsecutiveErrors(0);
                setPlayError(null);
            } catch (e) {
                if (e instanceof Error && e.name === 'NotAllowedError') { /* User interaction needed */ }
                else { audioRef.current.load(); audioRef.current.play().catch(() => playNext()); }
            }
        }
    }, [isPlaying, currentTrack, playNext]);

    const handleSeek = useCallback((ms: number) => {
        // Optimistic UI update - Don't wait for audio event
        setCurrentTime(ms);

        // Audio Update
        if (audioRef.current) {
            const newTime = ms / 1000;
            if (isFinite(newTime)) {
                audioRef.current.currentTime = newTime;
            }
        }
    }, []);

    const handleRefreshComments = useCallback(async () => {
        if (!currentTrack || currentTrack.sourceUrl) return; // Disable comments for local
        setIsRefreshingComments(true);
        try {
            const data = await fetchComments(currentTrack.id);
            setComments(data);
        } catch (e) {
            console.error("Failed to refresh comments", e);
        } finally {
            setTimeout(() => setIsRefreshingComments(false), 500);
        }
    }, [currentTrack]);

    const handleRecommendationClick = async (id: number) => {
        await loadPlaylistData(id.toString());
        setShowQueue(false);
    };

    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume;
        localStorage.setItem('vinyl_volume', volume.toString());
    }, [volume]);

    // Memoized handlers for MusicPlayer to prevent unnecessary re-renders
    const handleToggleQueue = useCallback(() => setShowQueue(prev => !prev), []);
    const handleToggleComments = useCallback(() => setShowComments(prev => !prev), []);
    const handleToggleShuffle = useCallback(() => setIsShuffle(prev => !prev), []);
    const handleToggleReverse = useCallback(() => setIsReverse(prev => !prev), []);

    // --- Auto-Scroll Helpers ---
    const activeIndex = lyrics.findIndex((l, i) => l.time <= currentTime && (i === lyrics.length - 1 || lyrics[i + 1].time > currentTime));

    // Transitions
    const layoutTransitionClass = "transition-[background-color,border-color,opacity,shadow] duration-500 ease-[cubic-bezier(0.2,0,0,1)]";

    // --- STRUCTURAL FIX: Persistent Background (Overlay Pattern) ---
    // The previous fix broke the layout because it didn't respect flexbox filling.
    // This refined version uses absolute positioning for Loading/Error overlays
    // to ensure they sit ON TOP of the background without disrupting the flex layout underneath.

    return (
        <div className={`h-screen w-screen flex flex-col relative overflow-hidden font-sans select-none ${isDarkMode ? 'bg-black' : 'bg-[#f5f5f7]'} ${layoutTransitionClass}`}>

            {/* BACKGROUND LAYER - PERSISTENT */}
            <BackgroundLayer bgPalette={bgPalette} extractedColors={extractedColors} isDarkMode={isDarkMode} />

            {/* --- LOADING OVERLAY --- */}
            {isLoading && (
                <div className={`absolute inset-0 z-50 flex items-center justify-center ${isDarkMode ? 'bg-black' : 'bg-[#f5f5f7]'}`}>
                    <Loader2 className={`animate-spin w-10 h-10 ${isDarkMode ? 'text-white' : 'text-black'}`} />
                </div>
            )}

            {/* --- ERROR OVERLAY --- */}
            {!isLoading && playlist.length === 0 && (
                <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center ${isDarkMode ? 'bg-black' : 'bg-[#f5f5f7]'}`}>
                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 50%, #555, transparent 70%)` }} />
                    <div className="z-10 flex flex-col items-center gap-6 p-8 max-w-md w-full text-center">
                        <div className="w-20 h-20 rounded-2xl bg-neutral-800/50 flex items-center justify-center mb-2">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <div>
                            <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>加载失败</h2>
                            <p className={`opacity-60 text-sm leading-relaxed ${isDarkMode ? 'text-white' : 'text-black'}`}>{playError || "无法连接到音乐服务，请检查网络或稍后重试。"}</p>
                        </div>
                        <button
                            onClick={() => loadPlaylistData(playlistId)}
                            className={`px-8 py-3 rounded-full font-bold text-sm transition-transform active:scale-95 ${isDarkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-black text-white hover:bg-neutral-800'}`}
                        >
                            重新加载
                        </button>
                        <div className="w-full h-px bg-white/10 my-2" />
                        <form onSubmit={handleSearchSubmit} className="w-full">
                            <p className={`text-xs opacity-50 mb-3 text-left ${isDarkMode ? 'text-white' : 'text-black'}`}>尝试其他歌单 ID</p>
                            <div className="relative">
                                <input
                                    value={tempPlaylistId}
                                    onChange={(e) => setTempPlaylistId(e.target.value)}
                                    placeholder="输入歌单 ID..."
                                    className={`w-full border rounded-lg py-3 pl-4 pr-12 text-sm focus:outline-none ${layoutTransitionClass} ${isDarkMode ? 'bg-white/10 border-white/10 focus:border-white/30 text-white' : 'bg-black/5 border-black/10 focus:border-black/20 text-black'}`}
                                />
                                <button type="submit" className="absolute right-2 top-2 p-1 rounded-md opacity-60 hover:opacity-100">
                                    <Search className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-black'}`} />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <audio
                key={currentTrack?.id}
                ref={audioRef}
                onDurationChange={handleDurationChange}
                onEnded={handleEnded}
                onError={handleAudioError}
                preload="auto"
            />

            {/* Error Notification Toast */}
            {playError && !isLoading && playlist.length > 0 && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2 animate-bounce">
                    <AlertCircle className="w-4 h-4" /> {playError}
                </div>
            )}

            {/* Main Content - Always Rendered but hidden if Loading/Error to prevent layout shifts */}
            <div className={`flex-1 flex flex-col lg:flex-row relative z-10 overflow-hidden min-h-0 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] transform-gpu ${showQueue ? 'scale-95 opacity-40 blur-sm grayscale-[0.5]' : 'scale-100 opacity-100 blur-0 grayscale-0'}`}>

                <AlbumArt
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    dominantColor={dominantColor}
                    isDarkMode={isDarkMode}
                    layoutTransitionClass={layoutTransitionClass}
                />

                <LyricsView
                    lyrics={lyrics}
                    currentTime={currentTime}
                    activeIndex={activeIndex}
                    handleSeek={handleSeek}
                    isDarkMode={isDarkMode}
                    currentTrack={currentTrack}
                    isLoading={isLyricsLoading}
                />
            </div>

            {/* Overlay - Queue / Search / Recommendations / Artist */}
            <QueueDrawer
                showQueue={showQueue}
                setShowQueue={setShowQueue}
                viewTab={viewTab}
                setViewTab={setViewTab}
                isSearching={isSearching}
                searchType={searchType}
                handleTabChange={handleTabChange}
                clearSearch={clearSearch}
                tempPlaylistId={tempPlaylistId}
                setTempPlaylistId={setTempPlaylistId}
                handleSearchSubmit={handleSearchSubmit}

                // Search & Recommendation Data
                recommendations={recommendations}
                playlistSearchResults={playlistSearchResults}
                songSearchResults={songSearchResults}
                artistSearchResults={artistSearchResults}
                isSearchLoading={isSearchLoading}

                // Artist Data
                isArtistLoading={isArtistLoading}
                artistDetail={artistDetail}
                artistSongs={artistSongs}
                artistSortOrder={artistSortOrder}
                handleArtistSortChange={handleArtistSortChange}

                // Interaction Handlers
                handleSongResultClick={handleSongResultClick}
                handleArtistResultClick={handleArtistResultClick}
                handleRecommendationClick={handleRecommendationClick}
                handleArtistSongClick={handleArtistSongClick}
                handleFileUpload={handleFileUpload}

                // Playback State
                playlist={playlist}
                currentIndex={currentIndex}
                setCurrentIndex={setCurrentIndex}
                setIsPlaying={setIsPlaying}
                isDarkMode={isDarkMode}
            />

            <CommentsDrawer
                showComments={showComments}
                setShowComments={setShowComments}
                comments={comments}
                isRefreshingComments={isRefreshingComments}
                handleRefreshComments={handleRefreshComments}
                isDarkMode={isDarkMode}
                layoutTransitionClass={layoutTransitionClass}
            />

            {/* Music Player Bar - Conditionally hidden if no playlist */}
            {playlist.length > 0 && (
                <MusicPlayer
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onPlayPause={togglePlay}
                    onNext={playNext}
                    onPrev={playPrev}
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={handleSeek}
                    volume={volume}
                    onVolumeChange={setVolume}
                    onToggleQueue={handleToggleQueue}
                    onToggleComments={handleToggleComments}
                    themeMode={themeMode}
                    onToggleTheme={toggleTheme}
                    isDarkMode={isDarkMode}
                    isShuffle={isShuffle}
                    onToggleShuffle={handleToggleShuffle}
                    isReverse={isReverse}
                    onToggleReverse={handleToggleReverse}
                    onArtistClick={handlePlayerArtistClick}
                />
            )}
        </div>
    );
};

export default App;
