
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchPlaylist, getAudioUrl, fetchLyrics, fetchComments, fetchRecommendedPlaylists, searchPlaylists } from './services/musicApi';
import { Track, LyricLine, Comment, RecommendedPlaylist } from './types';
import { MusicPlayer } from './components/MusicPlayer';
import { APP_VERSION, DEFAULT_VOLUME } from './constants';
import { MessageSquare, ListMusic, Loader2, Heart, X, Search, Disc, AlertCircle, RefreshCw, Grid, Play, Music2, ArrowLeft } from 'lucide-react';

const DEFAULT_PLAYLIST_ID = '833444858'; 

export type ThemeMode = 'dark' | 'light' | 'system';

// Helper to adjust color vibrancy
const adjustColor = (r: number, g: number, b: number, saturationBoost: number = 1.2) => {
  // Convert RGB to HSL logic roughly to boost saturation if needed, 
  // or simply ensure the color isn't too dark/washed out.
  // For simplicity and performance in JS, we'll keep RGB but clamp minimum brightness.
  const max = Math.max(r, g, b);
  if (max < 30) return { r: r + 20, g: g + 20, b: b + 20 }; // Too dark
  return { r, g, b };
};

const App: React.FC = () => {
  // Data State
  const [playlistId, setPlaylistId] = useState(DEFAULT_PLAYLIST_ID);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  
  // Recommendations & Search State
  const [recommendations, setRecommendations] = useState<RecommendedPlaylist[]>([]);
  const [searchResults, setSearchResults] = useState<RecommendedPlaylist[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI State for Playlist Input
  const [tempPlaylistId, setTempPlaylistId] = useState(DEFAULT_PLAYLIST_ID);
  
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
  const [comments, setComments] = useState<Comment[]>([]);
  const [isRefreshingComments, setIsRefreshingComments] = useState(false);
  
  // Visual Engine State
  const [dominantColor, setDominantColor] = useState('20, 20, 20');
  const [bgPalette, setBgPalette] = useState<{c1: string, c2: string, c3: string}>({
      c1: 'rgba(50,50,50,0.8)',
      c2: 'rgba(30,30,30,0.8)',
      c3: 'rgba(20,20,20,0.8)'
  });
  
  // UI Toggles
  const [showQueue, setShowQueue] = useState(false);
  const [viewTab, setViewTab] = useState<'recommend' | 'queue'>('recommend');
  const [showComments, setShowComments] = useState(false);
  
  // Theme State
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('vinyl_theme') as ThemeMode) || 'system';
  });
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Error handling
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const loadingTrackRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  
  // State Refs for Animation Loop
  const activeIndexRef = useRef(0);
  const isUserScrollingRef = useRef(false);

  // --- Theme Logic (No Reload) ---
  useEffect(() => {
    localStorage.setItem('vinyl_theme', themeMode);
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const resolveTheme = () => {
        if (themeMode === 'system') return mediaQuery.matches;
        return themeMode === 'dark';
    };

    setIsDarkMode(resolveTheme());

    const handler = (e: MediaQueryListEvent) => {
        if (themeMode === 'system') {
            setIsDarkMode(e.matches);
        }
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [themeMode]);

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

  const handlePlaylistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempPlaylistId.trim()) return;

    const extractedId = extractIdFromInput(tempPlaylistId);
    
    // Case 1: Valid ID or Link found -> Direct Load
    if (extractedId) {
        setTempPlaylistId(extractedId);
        if (extractedId === playlistId) return; 
        loadPlaylistData(extractedId);
        setShowQueue(false);
        setIsSearching(false);
        return;
    }

    // Case 2: Not an ID -> Perform Search
    setIsSearching(true);
    setIsSearchLoading(true);
    setViewTab('recommend'); // Switch to grid view to show results
    try {
        const results = await searchPlaylists(tempPlaylistId.trim());
        setSearchResults(results);
    } catch (e) {
        console.error("Search failed", e);
        setSearchResults([]);
    } finally {
        setIsSearchLoading(false);
    }
  };

  const clearSearch = () => {
      setIsSearching(false);
      setSearchResults([]);
      setTempPlaylistId('');
  };

  const currentTrack = playlist[currentIndex];

  // --- Track Change Logic ---
  useEffect(() => {
    if (!currentTrack) return;

    let isMounted = true;
    loadingTrackRef.current = currentTrack.id;

    const loadTrack = async () => {
        setLyrics([]);
        setComments([]);
        setPlayError(null);

        try {
            const url = await getAudioUrl(currentTrack.id);
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

        fetchLyrics(currentTrack.id).then(data => {
            if (isMounted && loadingTrackRef.current === currentTrack.id) setLyrics(data);
        }).catch(() => {});
        
        fetchComments(currentTrack.id).then(data => {
            if (isMounted && loadingTrackRef.current === currentTrack.id) setComments(data);
        }).catch(() => {});

        // Color Extraction Logic
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = currentTrack.al.picUrl;
        img.onload = () => {
            if (!isMounted || loadingTrackRef.current !== currentTrack.id) return;
            const canvas = document.createElement('canvas');
            canvas.width = 1; canvas.height = 1;
            const ctx = canvas.getContext('2d');
            if(ctx) {
                ctx.drawImage(img, 0, 0, 1, 1);
                const [rawR, rawG, rawB] = ctx.getImageData(0,0,1,1).data;
                const { r, g, b } = adjustColor(rawR, rawG, rawB);

                setDominantColor(`${r},${g},${b}`);

                // Generate a pseudo-palette by shifting hue/lightness roughly
                // This creates that rich "Apple Music" multi-tone gradient look
                setBgPalette({
                    c1: `rgb(${r}, ${g}, ${b})`,
                    // Shift 2: Slightly lighter/different hue simulation
                    c2: `rgb(${Math.min(255, r * 1.2)}, ${Math.min(255, g * 0.8)}, ${Math.min(255, b * 1.1)})`,
                    // Shift 3: Darker/complementary simulation
                    c3: `rgb(${Math.max(0, r * 0.8)}, ${Math.max(0, g * 1.1)}, ${Math.max(0, b * 0.9)})`
                });
            }
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
      if (audioRef.current) {
          const newTime = ms / 1000;
          if (isFinite(newTime)) {
            audioRef.current.currentTime = newTime;
            setCurrentTime(ms);
          }
      }
  }, []);

  const handleRefreshComments = useCallback(async () => {
      if (!currentTrack) return;
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
  const handleToggleTheme = useCallback(() => {
      const modes: ThemeMode[] = ['dark', 'light', 'system'];
      const next = modes[(modes.indexOf(themeMode) + 1) % modes.length];
      setThemeMode(next);
  }, [themeMode]);
  const handleToggleShuffle = useCallback(() => setIsShuffle(prev => !prev), []);
  const handleToggleReverse = useCallback(() => setIsReverse(prev => !prev), []);

  // --- Auto-Scroll & Visual Engine ---
  const activeIndex = lyrics.findIndex((l, i) => l.time <= currentTime && (i === lyrics.length - 1 || lyrics[i+1].time > currentTime));
  
  // Sync refs for animation loop
  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

  const updateLyricVisuals = useCallback(() => {
    if (!lyricsContainerRef.current) return;
    const container = lyricsContainerRef.current;
    
    // PERFORMANCE: Read Layout (Batch Read)
    const containerRect = container.getBoundingClientRect();
    const activeZone = containerRect.height * 0.45; 
    const center = containerRect.top + containerRect.height / 2;
    const activeIdx = activeIndexRef.current;
    const isScrolling = isUserScrollingRef.current;
    
    const children = Array.from(container.children) as HTMLElement[];
    const childrenStates = children.map((child, i) => {
        const rect = child.getBoundingClientRect();
        const elementCenter = rect.top + rect.height / 2;
        const distance = Math.abs(center - elementCenter);
        return { child, distance, i, rectHeight: rect.height };
    });

    // PERFORMANCE: Write Layout (Batch Write)
    childrenStates.forEach(({ child, distance, i }) => {
        if (distance > containerRect.height) {
            child.style.transform = `scale(0.9)`;
            child.style.filter = `blur(0px)`; 
            child.style.opacity = `0.1`; 
            return;
        }

        let isActiveForce = (!isScrolling && i === activeIdx);

        if (isActiveForce) {
             child.style.transform = `scale(1)`;
             child.style.filter = `blur(0px)`;
             child.style.opacity = `1`;
        } else {
             let intensity = Math.min(distance / activeZone, 1);
             intensity = Math.pow(intensity, 1.3); // Ease

             const scale = 1 - (intensity * 0.15); 
             const blur = (intensity * 4).toFixed(1); 
             const opacity = (1 - (intensity * 0.7)).toFixed(2); 

             child.style.transform = `scale(${scale})`;
             child.style.filter = `blur(${blur}px)`;
             child.style.opacity = opacity;
        }
    });
  }, []);

  // Animation Loop for Visuals
  useEffect(() => {
    let frameId: number;
    const loop = () => {
        updateLyricVisuals();
        frameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frameId);
  }, [updateLyricVisuals]);

  // Auto-scroll logic
  const isAutoScrolling = useRef(false);
  const userScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
      if (!isUserScrollingRef.current && lyricsContainerRef.current && activeIndex !== -1) {
          const el = lyricsContainerRef.current.children[activeIndex] as HTMLElement;
          if (el) {
              isAutoScrolling.current = true;
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }
  }, [activeIndex]);

  const handleLyricsScroll = () => {
      if (isAutoScrolling.current) {
          isAutoScrolling.current = false;
          return;
      }
      isUserScrollingRef.current = true;
      if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);
      userScrollTimeout.current = setTimeout(() => {
          isUserScrollingRef.current = false;
      }, 2500); // Resume auto-scroll after delay
  };

  // --- Apple Music Style Fluid Background ---
  const backgroundLayer = useMemo(() => (
    <>
      <div className="fixed inset-0 -z-50 bg-[#050505] overflow-hidden">
         {/* Base dark layer to ensure text contrast */}
         <div className="absolute inset-0 bg-black/40 z-0" />
         
         {/* Animated Blob Container - Transitions colors smoothly */}
         <div className="absolute inset-0 transition-opacity duration-[1500ms]" style={{ opacity: isDarkMode ? 0.6 : 0.8 }}>
             
             {/* Blob 1: Top Left - Primary Dominant */}
             <div 
                 className="absolute top-[-10%] left-[-10%] w-[70vw] h-[70vw] rounded-full mix-blend-screen filter blur-[80px] md:blur-[120px] animate-blob opacity-70 transition-colors duration-[2000ms]"
                 style={{ backgroundColor: bgPalette.c1 }}
             />
             
             {/* Blob 2: Top Right/Center - Secondary (Hue Shift) */}
             <div 
                 className="absolute top-[10%] right-[-10%] w-[60vw] h-[60vw] rounded-full mix-blend-screen filter blur-[80px] md:blur-[120px] animate-blob animation-delay-2000 opacity-60 transition-colors duration-[2000ms]"
                 style={{ backgroundColor: bgPalette.c2 }}
             />
             
             {/* Blob 3: Bottom Left - Tertiary */}
             <div 
                 className="absolute -bottom-[20%] -left-[20%] w-[80vw] h-[80vw] rounded-full mix-blend-screen filter blur-[80px] md:blur-[120px] animate-blob animation-delay-4000 opacity-60 transition-colors duration-[2000ms]"
                 style={{ backgroundColor: bgPalette.c3 }}
             />

              {/* Blob 4: Rotating accent for movement */}
              <div 
                 className="absolute top-[20%] left-[20%] w-[50vw] h-[50vw] rounded-full mix-blend-overlay filter blur-[60px] md:blur-[100px] animate-rotate-scale opacity-40 transition-colors duration-[2000ms]"
                 style={{ backgroundColor: bgPalette.c1 }}
             />
         </div>

         {/* Noise Texture Overlay (Optional for that gritty Apple look) */}
         <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
         
         {/* Glass Overlay for Light Mode */}
         {!isDarkMode && <div className="absolute inset-0 bg-white/30 backdrop-blur-[100px] z-10 mix-blend-overlay" />}
      </div>
    </>
  ), [bgPalette, isDarkMode]);

  const transitionClass = "transition-[color,background-color,border-color,opacity,shadow,transform,filter] duration-500 ease-[cubic-bezier(0.2,0,0,1)]";
  const textColor = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSubColor = isDarkMode ? 'text-white/50' : 'text-slate-500';
  const lyricInactiveColor = isDarkMode ? 'text-white/40' : 'text-slate-400';
  const drawerBg = isDarkMode ? 'bg-neutral-900/95' : 'bg-white/90';
  const drawerBorder = isDarkMode ? 'border-white/5' : 'border-black/5';

  const queueOverlay = useMemo(() => {
    // Determine what content to show in the Grid area
    const displayItems = isSearching ? searchResults : recommendations;
    const showSkeleton = isSearchLoading || (viewTab === 'recommend' && !isSearching && recommendations.length === 0);
    const emptySearch = isSearching && !isSearchLoading && searchResults.length === 0;

    return (
      <div className={`fixed inset-0 z-[60] transition-opacity duration-500 flex items-center justify-center ${showQueue ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          {/* Backdrop - Lighter now because content behind is dimmed */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-500" 
            onClick={() => setShowQueue(false)} 
          />
  
          {/* Content Container */}
          <div className={`relative w-full h-full md:inset-10 md:w-auto md:h-auto md:fixed md:rounded-2xl bg-[#0f0f10]/80 border border-white/10 flex flex-col overflow-hidden shadow-2xl transition-transform duration-500 md:max-w-6xl md:min-w-[80vw] ${showQueue ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}>
              
              {/* Header / Tabs / Search */}
              <div className="flex-none p-4 md:p-6 border-b border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between bg-black/20">
                   {/* Tabs / Back Button */}
                   <div className="flex bg-black/30 p-1 rounded-lg self-start md:self-auto w-full md:w-auto">
                      {isSearching ? (
                           <button 
                               onClick={clearSearch}
                               className="px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 bg-white/10 text-white shadow-lg border border-white/5 hover:bg-white/20 transition-all w-full md:w-auto"
                           >
                               <ArrowLeft className="w-4 h-4" /> 返回推荐
                           </button>
                      ) : (
                          <>
                            <button 
                                onClick={() => setViewTab('recommend')}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${viewTab === 'recommend' ? 'bg-white/10 text-white shadow-lg border border-white/5' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                            >
                                <Grid className="w-4 h-4" /> 推荐歌单
                            </button>
                            <button 
                                onClick={() => setViewTab('queue')}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${viewTab === 'queue' ? 'bg-white/10 text-white shadow-lg border border-white/5' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                            >
                                <ListMusic className="w-4 h-4" /> 当前播放 ({playlist.length})
                            </button>
                          </>
                      )}
                   </div>
  
                   <div className="flex gap-4 w-full md:w-auto items-center">
                       {/* Search Input */}
                       <form onSubmit={handlePlaylistSubmit} className="relative flex-1 md:w-80 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-white/70 transition-colors" />
                            <input 
                                value={tempPlaylistId}
                                onChange={(e) => setTempPlaylistId(e.target.value)}
                                placeholder="输入 ID, 链接 或 关键词搜索..."
                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:bg-black/40 focus:border-white/30 outline-none transition-all placeholder:text-white/20"
                            />
                            {tempPlaylistId && (
                                <button type="button" onClick={() => setTempPlaylistId('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white">
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                       </form>
                       
                       <button onClick={() => setShowQueue(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0">
                          <X className="w-6 h-6 text-white/70 hover:text-white" />
                       </button>
                   </div>
              </div>
  
              {/* Content Body */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth no-scrollbar">
                  {viewTab === 'recommend' ? (
                      <div className="pb-20">
                          {isSearching && (
                              <h3 className="text-lg font-bold text-white mb-6">
                                  {isSearchLoading ? '正在搜索...' : `"${tempPlaylistId}" 的搜索结果`}
                              </h3>
                          )}
                          
                          {emptySearch ? (
                              <div className="flex flex-col items-center justify-center opacity-40 py-20">
                                  <Search className="w-12 h-12 mb-4" />
                                  <p>未找到相关歌单</p>
                              </div>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-8">
                                {showSkeleton ? (
                                    Array(10).fill(0).map((_, i) => (
                                        <div key={i} className="flex flex-col gap-3 animate-pulse">
                                            <div className="aspect-square rounded-xl bg-white/5" />
                                            <div className="h-4 bg-white/5 rounded w-3/4" />
                                        </div>
                                    ))
                                ) : (
                                    displayItems.map(list => (
                                        <div 
                                            key={list.id} 
                                            onClick={() => handleRecommendationClick(list.id)}
                                            className="group cursor-pointer flex flex-col gap-3"
                                        >
                                            <div className="aspect-square rounded-xl overflow-hidden relative shadow-lg bg-white/5">
                                                <img src={list.picUrl} className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-105" loading="lazy" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-white/10 transition-colors duration-300" />
                                                {/* Play overlay */}
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                                                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                                        </div>
                                                </div>
                                                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] flex items-center gap-1 text-white/90 font-medium">
                                                    <Play className="w-3 h-3 fill-current" /> {(list.playCount / 10000).toFixed(0)}万
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-medium text-white/80 line-clamp-2 leading-relaxed group-hover:text-white transition-colors">{list.name}</h3>
                                                {list.copywriter && <p className="text-xs text-white/40 mt-1 truncate">{list.copywriter}</p>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                          )}
                      </div>
                  ) : (
                      <div className="space-y-1 pb-20 max-w-4xl mx-auto">
                          {playlist.map((track, i) => (
                              <div 
                                  key={track.id} 
                                  onClick={() => { setCurrentIndex(i); setIsPlaying(true); }}
                                  className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer group transition-all duration-300 ${
                                      i === currentIndex 
                                          ? 'bg-white/10 text-white' 
                                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                                  }`}
                              >
                                  <div className="relative w-12 h-12 shrink-0">
                                    <img src={track.al.picUrl} loading="lazy" className="w-full h-full rounded-md object-cover shadow-sm" />
                                    {i === currentIndex && (
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-md backdrop-blur-[1px]">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                                        </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                      <div className={`text-base font-medium truncate ${i === currentIndex ? 'text-white' : 'text-white/90'}`}>{track.name}</div>
                                      <div className="text-xs truncate text-white/40 group-hover:text-white/60">{track.ar.map(a => a.name).join(', ')}</div>
                                  </div>

                                  <div className="text-xs font-mono text-white/20 w-12 text-right group-hover:text-white/40">
                                      {Math.floor(track.dt / 1000 / 60)}:{(Math.floor(track.dt / 1000) % 60).toString().padStart(2, '0')}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
  
          </div>
      </div>
    );
  }, [showQueue, viewTab, recommendations, searchResults, isSearching, isSearchLoading, playlist, currentIndex, tempPlaylistId, isPlaying]);

  const commentsDrawer = useMemo(() => (
      <>
        <div 
            className={`fixed inset-0 z-[55] bg-black/20 backdrop-blur-[1px] transition-opacity duration-500 ${showComments ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setShowComments(false)}
        />
        <div className={`fixed inset-y-0 right-0 w-full sm:w-[450px] backdrop-blur-3xl border-l shadow-2xl z-[60] transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${showComments ? 'translate-x-0' : 'translate-x-full'} ${drawerBg} ${drawerBorder} ${textColor} ${transitionClass}`}>
                <div className="flex flex-col h-full">
                    <div className={`p-6 pt-8 border-b flex items-center justify-between ${transitionClass} ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
                        <h2 className="text-lg font-bold flex items-center gap-2"><MessageSquare className="w-5 h-5" /> 精选评论</h2>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handleRefreshComments} 
                                className={`p-2 rounded-full ${transitionClass} ${isDarkMode ? 'bg-white/5 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}
                                title="刷新评论"
                            >
                                <RefreshCw className={`w-4 h-4 ${isRefreshingComments ? 'animate-spin' : ''}`} />
                            </button>
                            <button onClick={() => setShowComments(false)} className={`p-2 rounded-full ${transitionClass} ${isDarkMode ? 'bg-white/5 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {comments.length > 0 ? comments.map(c => (
                            <div key={c.commentId} className="flex gap-4 group">
                                <img src={c.user.avatarUrl} loading="lazy" className={`w-10 h-10 rounded-full border shadow-sm ${transitionClass} ${isDarkMode ? 'border-white/10' : 'border-black/10'}`} />
                                <div className="flex-1">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-sm font-semibold opacity-90">{c.user.nickname}</span>
                                        <span className="text-xs opacity-30">{new Date(c.time).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-base opacity-90 leading-relaxed font-normal">{c.content}</p>
                                    <div className="flex items-center gap-1 mt-2 text-xs opacity-30 group-hover:opacity-50 transition-opacity">
                                        <Heart className="w-3 h-3" /> {c.likedCount}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center opacity-30 mt-20">暂无评论</div>
                        )}
                    </div>
                </div>
        </div>
      </>
  ), [showComments, comments, isDarkMode, drawerBg, drawerBorder, textColor, isRefreshingComments, handleRefreshComments]);

  const AlbumArt = useMemo(() => (
    <div className={`flex-1 flex items-center justify-center p-8 lg:p-12 relative min-h-0 min-w-0 ${transitionClass}`}>
        <div className={`relative aspect-square w-full max-w-[280px] lg:max-w-[550px] transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isPlaying ? 'scale-100' : 'scale-[0.8]'}`}>
            <div 
                className={`absolute inset-0 rounded-xl blur-3xl scale-110 -z-10 transition-colors duration-[2000ms] ${transitionClass}`} 
                style={{ background: `rgb(${dominantColor})`, opacity: isDarkMode ? 0.6 : 0.3 }}
            />
            {currentTrack?.al.picUrl && (
                <img 
                    src={currentTrack.al.picUrl} 
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className={`w-full h-full object-cover rounded-xl relative z-20 ${transitionClass} 
                        ${isDarkMode 
                            ? 'shadow-[0_20px_40px_rgba(0,0,0,0.6)] border border-white/5' 
                            : 'shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-black/5 ring-1 ring-black/5'
                        }`}
                />
            )}
        </div>
    </div>
  ), [currentTrack?.al.picUrl, isPlaying, dominantColor, isDarkMode]);

  if (isLoading) {
      return <div className="h-screen w-screen flex items-center justify-center bg-black text-white"><Loader2 className="animate-spin w-10 h-10" /></div>;
  }

  if (playlist.length === 0) {
       return (
          <div className={`h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden ${isDarkMode ? 'bg-black text-white' : 'bg-[#f5f5f7] text-black'}`}>
               <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 50%, #555, transparent 70%)` }} />
               <div className="z-10 flex flex-col items-center gap-6 p-8 max-w-md w-full text-center">
                   <div className="w-20 h-20 rounded-2xl bg-neutral-800/50 flex items-center justify-center mb-2">
                        <AlertCircle className="w-10 h-10 text-red-500" />
                   </div>
                   <div>
                       <h2 className="text-2xl font-bold mb-2">加载失败</h2>
                       <p className="opacity-60 text-sm leading-relaxed">{playError || "无法连接到音乐服务，请检查网络或稍后重试。"}</p>
                   </div>
                   <button 
                       onClick={() => loadPlaylistData(playlistId)}
                       className={`px-8 py-3 rounded-full font-bold text-sm transition-transform active:scale-95 ${isDarkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-black text-white hover:bg-neutral-800'}`}
                   >
                       重新加载
                   </button>
                   <div className="w-full h-px bg-white/10 my-2" />
                   <form onSubmit={handlePlaylistSubmit} className="w-full">
                       <p className="text-xs opacity-50 mb-3 text-left">尝试其他歌单 ID</p>
                       <div className="relative">
                            <input 
                                value={tempPlaylistId}
                                onChange={(e) => setTempPlaylistId(e.target.value)}
                                placeholder="输入歌单 ID..."
                                className={`w-full border rounded-lg py-3 pl-4 pr-12 text-sm focus:outline-none ${transitionClass} ${isDarkMode ? 'bg-white/10 border-white/10 focus:border-white/30 text-white' : 'bg-black/5 border-black/10 focus:border-black/20 text-black'}`}
                            />
                            <button type="submit" className="absolute right-2 top-2 p-1 rounded-md opacity-60 hover:opacity-100">
                                <Search className="w-5 h-5" />
                            </button>
                       </div>
                   </form>
               </div>
               <div className="absolute bottom-4 opacity-30 text-xs font-mono">v{APP_VERSION}</div>
          </div>
       );
  }

  return (
    <div className={`h-screen w-screen flex flex-col relative overflow-hidden font-sans select-none ${isDarkMode ? 'bg-black' : 'bg-[#f5f5f7]'} ${transitionClass}`}>
      <audio 
        key={currentTrack?.id}
        ref={audioRef}
        onDurationChange={handleDurationChange}
        onEnded={handleEnded}
        onError={handleAudioError}
        preload="auto"
      />

      {backgroundLayer}

      {playError && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2 animate-bounce">
              <AlertCircle className="w-4 h-4" /> {playError}
          </div>
      )}
      
      <div className={`flex-1 flex flex-col lg:flex-row relative z-10 overflow-hidden min-h-0 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] transform-gpu ${showQueue ? 'scale-95 opacity-40 blur-sm grayscale-[0.5]' : 'scale-100 opacity-100 blur-0 grayscale-0'}`}>
        
        {AlbumArt}

        <div className="flex-1 h-full relative overflow-hidden lg:mr-8 flex flex-col min-h-0">
            <div 
                ref={lyricsContainerRef}
                onScroll={handleLyricsScroll}
                className="flex-1 overflow-y-auto no-scrollbar py-[50vh] px-8 lg:px-4 text-left lyric-mask will-change-transform"
            >
                {lyrics.length > 0 ? lyrics.map((line, i) => {
                    const isActive = i === activeIndex;
                    
                    const textClass = isActive 
                        ? "font-extrabold text-3xl lg:text-5xl drop-shadow-sm" 
                        : `font-bold text-lg lg:text-2xl ${lyricInactiveColor}`;

                    const renderActiveContent = () => {
                        const progress = currentTime < line.time ? 0 : 
                                         currentTime > line.time + line.duration ? 1 : 
                                         (currentTime - line.time) / line.duration;
                        
                        const chars = line.text.split('');
                        const totalChars = chars.length;
                        const activeCharIndex = Math.floor(progress * totalChars);
                        const subProgress = (progress * totalChars) % 1; 

                        return (
                            <span className={`inline-block w-full break-words leading-tight tracking-tight py-1 ${textClass}`}>
                                {chars.map((char, charIdx) => {
                                    if (charIdx < activeCharIndex) {
                                        return <span key={charIdx} className={isDarkMode ? 'text-white' : 'text-black'}>{char}</span>;
                                    } else if (charIdx > activeCharIndex) {
                                        return <span key={charIdx} className={isDarkMode ? 'text-white/30' : 'text-black/30'}>{char}</span>;
                                    } else {
                                        const p = subProgress * 100;
                                        const activeColor = isDarkMode ? '#ffffff' : '#000000';
                                        const dimColor = isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
                                        return (
                                            <span 
                                                key={charIdx} 
                                                style={{
                                                    backgroundImage: `linear-gradient(90deg, ${activeColor} ${p}%, ${dimColor} ${p}%)`,
                                                    WebkitBackgroundClip: 'text',
                                                    WebkitTextFillColor: 'transparent',
                                                    backgroundClip: 'text',
                                                    color: 'transparent'
                                                }}
                                            >
                                                {char}
                                            </span>
                                        );
                                    }
                                })}
                            </span>
                        );
                    };

                    return (
                        <div 
                            key={i} 
                            className={`origin-left cursor-pointer hover:opacity-80 group w-full ${line.isContinuation ? "mt-3" : "mt-10"}`}
                            onClick={() => handleSeek(line.time)}
                        >
                            {isActive ? renderActiveContent() : (
                                <span className={`inline-block leading-tight tracking-tight py-1 break-words text-balance ${textClass}`}>
                                    {line.text}
                                </span>
                            )}
                            
                            {line.trans && (
                                <p 
                                    className={`font-medium mt-2 leading-tight transition-all duration-300 ${
                                        isActive 
                                            ? (isDarkMode ? 'text-white/60' : 'text-black/60') 
                                            : (isDarkMode ? 'text-white/30' : 'text-black/30')
                                    } ${
                                        isActive 
                                            ? 'text-lg lg:text-2xl' 
                                            : 'text-sm lg:text-lg'
                                    }`} 
                                >
                                    {line.trans}
                                </p>
                            )}
                        </div>
                    )
                }) : (
                    <div className="flex items-center justify-center h-full">
                        <span className={`text-2xl font-bold flex items-center gap-3 animate-pulse transition-colors duration-300 ${isDarkMode ? 'text-white/30' : 'text-black/20'}`}>
                            <Disc className="animate-spin-slow" /> 纯音乐 / 暂无歌词
                        </span>
                    </div>
                )}
            </div>
        </div>
      </div>

      {queueOverlay}
      {commentsDrawer}

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
        onToggleTheme={handleToggleTheme}
        isDarkMode={isDarkMode}
        isShuffle={isShuffle}
        onToggleShuffle={handleToggleShuffle}
        isReverse={isReverse}
        onToggleReverse={handleToggleReverse}
      />
    </div>
  );
};

export default App;
