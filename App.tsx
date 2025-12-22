
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { fetchPlaylist, getAudioUrl, fetchLyrics, fetchComments } from './services/musicApi';
import { Track, LyricLine, Comment } from './types';
import { MusicPlayer } from './components/MusicPlayer';
import { APP_VERSION, DEFAULT_VOLUME } from './constants';
import { MessageSquare, ListMusic, Loader2, Heart, X, Search, Disc, AlertCircle } from 'lucide-react';

const DEFAULT_PLAYLIST_ID = '833444858'; 

export type ThemeMode = 'dark' | 'light' | 'system';

const App: React.FC = () => {
  // Data State
  const [playlistId, setPlaylistId] = useState(DEFAULT_PLAYLIST_ID);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI State for Playlist Input
  const [tempPlaylistId, setTempPlaylistId] = useState(DEFAULT_PLAYLIST_ID);
  
  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Volume with Persistence
  const [volume, setVolume] = useState(() => {
      const saved = localStorage.getItem('vinyl_volume');
      return saved !== null ? parseFloat(saved) : DEFAULT_VOLUME;
  });

  const [playError, setPlayError] = useState<string | null>(null);
  
  // View State
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [dominantColor, setDominantColor] = useState('20, 20, 20');
  
  // UI Toggles
  const [showQueue, setShowQueue] = useState(false);
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

  // --- Theme Logic (No Reload) ---
  useEffect(() => {
    localStorage.setItem('vinyl_theme', themeMode);
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Function to calculate efficient state without side effects
    const resolveTheme = () => {
        if (themeMode === 'system') return mediaQuery.matches;
        return themeMode === 'dark';
    };

    // Apply immediately
    setIsDarkMode(resolveTheme());

    // Listener for system changes (Only active if mode is system)
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
        setPlaylistId(id); // Confirm ID only on success
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
  }, []); // Run once on mount

  const extractIdFromInput = (input: string): string | null => {
      const clean = input.trim();
      const idParamMatch = clean.match(/[?&]id=(\d+)/);
      if (idParamMatch) return idParamMatch[1];
      const pathMatch = clean.match(/\/playlist\/(\d+)/);
      if (pathMatch) return pathMatch[1];
      if (/^\d+$/.test(clean)) return clean;
      return null;
  };

  const handlePlaylistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempPlaylistId) {
        const extractedId = extractIdFromInput(tempPlaylistId);
        
        if (!extractedId) {
            setPlayError("无效的歌单链接或ID");
            return;
        }
        setTempPlaylistId(extractedId);
        if (extractedId === playlistId) return; 
        loadPlaylistData(extractedId);
        setShowQueue(false);
    }
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
                const [r,g,b] = ctx.getImageData(0,0,1,1).data;
                setDominantColor(`${r},${g},${b}`);
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
              setCurrentTime(audioRef.current.currentTime * 1000);
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

  const playNext = () => {
      if (playlist.length === 0) return;
      setCurrentIndex((prev) => (prev + 1) % playlist.length);
  };

  const playPrev = () => {
      if (playlist.length === 0) return;
      setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
      setConsecutiveErrors(0);
  };

  const togglePlay = async () => {
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
  };

  const handleSeek = (ms: number) => {
      if (audioRef.current) {
          const newTime = ms / 1000;
          if (isFinite(newTime)) {
            audioRef.current.currentTime = newTime;
            setCurrentTime(ms);
          }
      }
  };

  useEffect(() => {
      if (audioRef.current) audioRef.current.volume = volume;
      localStorage.setItem('vinyl_volume', volume.toString());
  }, [volume]);

  // --- Auto-Scroll Lyrics ---
  const activeIndex = lyrics.findIndex((l, i) => l.time <= currentTime && (i === lyrics.length - 1 || lyrics[i+1].time > currentTime));

  useEffect(() => {
      if (lyricsContainerRef.current && activeIndex !== -1) {
          const el = lyricsContainerRef.current.children[activeIndex] as HTMLElement;
          if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }
  }, [activeIndex]);

  if (isLoading) {
      return <div className="h-screen w-screen flex items-center justify-center bg-black text-white"><Loader2 className="animate-spin w-10 h-10" /></div>;
  }

  // --- Apple-style Transition Config ---
  const transitionClass = "transition-[color,background-color,border-color,opacity,shadow,transform,filter] duration-500 ease-[cubic-bezier(0.2,0,0,1)]";
  
  // Dynamic Styles
  const textColor = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSubColor = isDarkMode ? 'text-white/50' : 'text-slate-500';
  const lyricInactiveColor = isDarkMode ? 'text-white/40' : 'text-slate-400';
  const drawerBg = isDarkMode ? 'bg-neutral-900/95' : 'bg-white/90';
  const drawerBorder = isDarkMode ? 'border-white/5' : 'border-black/5';

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

      {/* --- High-Quality Background Layering System --- */}
      {/* BASE LAYER: DARK (Screen Blend) */}
      <div className="fixed inset-0 -z-50 bg-[#050505]">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute inset-0 opacity-20 transition-colors duration-[2000ms]" style={{ background: `rgb(${dominantColor})` }} />
              <div 
                 className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] rounded-full filter blur-[100px] animate-spin-slow mix-blend-screen opacity-40 transition-colors duration-[3000ms]"
                 style={{ background: `radial-gradient(circle at 50% 50%, rgb(${dominantColor}), transparent 60%)`, animationDuration: '45s' }}
              />
              <div 
                 className="absolute -bottom-[50%] -right-[50%] w-[200%] h-[200%] rounded-full filter blur-[100px] animate-spin-slow mix-blend-screen opacity-40 transition-colors duration-[3000ms]"
                 style={{ background: `radial-gradient(circle at 50% 50%, rgb(${dominantColor}), transparent 60%)`, animationDirection: 'reverse', animationDuration: '35s' }}
              />
          </div>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[100px]" />
      </div>

      {/* OVERLAY LAYER: LIGHT (Multiply Blend) - Fades in/out */}
      <div className={`fixed inset-0 -z-40 transition-opacity duration-500 ease-[cubic-bezier(0.2,0,0,1)] ${isDarkMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="absolute inset-0 bg-[#f5f5f7]" /> {/* Opaque base to hide dark layer */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute inset-0 opacity-10 transition-colors duration-[2000ms]" style={{ background: `rgb(${dominantColor})` }} />
              <div 
                 className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] rounded-full filter blur-[120px] animate-spin-slow mix-blend-multiply opacity-15 transition-colors duration-[3000ms]"
                 style={{ background: `radial-gradient(circle at 50% 50%, rgb(${dominantColor}), transparent 70%)`, animationDuration: '50s' }}
              />
              <div 
                 className="absolute -bottom-[50%] -right-[50%] w-[200%] h-[200%] rounded-full filter blur-[120px] animate-spin-slow mix-blend-multiply opacity-15 transition-colors duration-[3000ms]"
                 style={{ background: `radial-gradient(circle at 50% 50%, rgb(${dominantColor}), transparent 70%)`, animationDirection: 'reverse', animationDuration: '40s' }}
              />
          </div>
          <div className="absolute inset-0 bg-white/30 backdrop-blur-[100px]" />
      </div>


      {/* --- Watermark --- */}
      <div className={`fixed bottom-3 right-4 z-[100] text-[10px] font-mono pointer-events-none select-none tracking-widest ${transitionClass} ${isDarkMode ? 'text-white/50' : 'text-black/30'}`}>
         v{APP_VERSION}
      </div>

      {/* --- Error Toast --- */}
      {playError && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2 animate-bounce">
              <AlertCircle className="w-4 h-4" /> {playError}
          </div>
      )}
      
      {/* --- Main Content --- */}
      <div className="flex-1 flex flex-col lg:flex-row relative z-10 overflow-hidden min-h-0">
        
        {/* Album Art */}
        <div className={`flex-1 flex items-center justify-center p-8 lg:p-12 relative min-h-0 min-w-0 ${transitionClass}`}>
            <div className={`relative aspect-square w-full max-w-[280px] lg:max-w-[550px] transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isPlaying ? 'scale-100' : 'scale-[0.8]'}`}>
                <div 
                    className={`absolute inset-0 rounded-xl blur-3xl scale-110 -z-10 transition-colors duration-[2000ms] ${transitionClass}`} 
                    style={{ background: `rgb(${dominantColor})`, opacity: isDarkMode ? 0.6 : 0.3 }}
                />
                <img 
                    src={currentTrack?.al.picUrl} 
                    className={`w-full h-full object-cover rounded-xl relative z-20 ${transitionClass} 
                        ${isDarkMode 
                            ? 'shadow-[0_20px_40px_rgba(0,0,0,0.6)] border border-white/5' 
                            : 'shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-black/5 ring-1 ring-black/5'
                        }`}
                />
            </div>
        </div>

        {/* Lyrics */}
        <div className="flex-1 h-full relative overflow-hidden lg:mr-8 flex flex-col min-h-0">
            <div 
                ref={lyricsContainerRef}
                className="flex-1 overflow-y-auto no-scrollbar py-[50vh] px-8 lg:px-4 text-left lyric-mask"
            >
                {lyrics.length > 0 ? lyrics.map((line, i) => {
                    const isActive = i === activeIndex;
                    const distance = Math.abs(activeIndex - i);
                    
                    let containerClass = "";
                    let textClass = "";
                    
                    // Logic for spacing: Continuations are closer
                    const marginClass = line.isContinuation ? "mt-3" : "mt-10";

                    if (isActive) {
                        containerClass = "scale-100 blur-0 opacity-100";
                        textClass = "font-extrabold text-3xl lg:text-5xl drop-shadow-sm";
                    } else if (distance === 1) {
                        containerClass = "scale-[0.98] blur-[0.5px] opacity-60";
                        textClass = `font-bold text-2xl lg:text-4xl ${isDarkMode ? 'text-white/90' : 'text-black/80'}`;
                    } else if (distance === 2) {
                        containerClass = "scale-[0.95] blur-[1.5px] opacity-30";
                        textClass = `font-bold text-xl lg:text-3xl ${isDarkMode ? 'text-white/80' : 'text-black/60'}`;
                    } else {
                        containerClass = "scale-[0.9] blur-[3px] opacity-10";
                        textClass = `font-bold text-lg lg:text-2xl ${lyricInactiveColor}`;
                    }

                    // --- Character Level Rendering for Active Line ---
                    // This solves the issue where gradients span the entire box width, breaking on multi-line text.
                    const renderActiveContent = () => {
                        const progress = currentTime < line.time ? 0 : 
                                         currentTime > line.time + line.duration ? 1 : 
                                         (currentTime - line.time) / line.duration;
                        
                        const chars = line.text.split('');
                        const totalChars = chars.length;
                        const activeCharIndex = Math.floor(progress * totalChars);
                        const subProgress = (progress * totalChars) % 1; // 0 to 1 for the current char

                        return (
                            <span className={`inline-block w-full break-words leading-tight tracking-tight py-1 ${textClass} ${transitionClass}`}>
                                {chars.map((char, charIdx) => {
                                    if (charIdx < activeCharIndex) {
                                        // Past characters: Fully Opaque
                                        return <span key={charIdx} className={isDarkMode ? 'text-white' : 'text-black'}>{char}</span>;
                                    } else if (charIdx > activeCharIndex) {
                                        // Future characters: Transparent/Dim
                                        return <span key={charIdx} className={isDarkMode ? 'text-white/30' : 'text-black/30'}>{char}</span>;
                                    } else {
                                        // Current character: Gradient
                                        // We limit the gradient to just this character, so wrapping doesn't break it.
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
                            className={`transition-[transform,opacity,filter,margin] duration-700 ease-out origin-left cursor-pointer hover:opacity-80 group w-full ${containerClass} ${marginClass}`}
                            onClick={() => handleSeek(line.time)}
                        >
                            {isActive ? renderActiveContent() : (
                                <span className={`inline-block leading-tight tracking-tight py-1 break-words text-balance ${textClass} ${transitionClass}`}>
                                    {line.text}
                                </span>
                            )}
                            
                            {line.trans && (
                                <p 
                                    className={`font-medium mt-3 opacity-90 ${transitionClass} ${isDarkMode ? 'text-white/80' : 'text-black/80'}`} 
                                    style={{ fontSize: '1.4em' }}
                                >
                                    {line.trans}
                                </p>
                            )}
                        </div>
                    )
                }) : (
                    <div className="flex items-center justify-center h-full">
                        <span className={`text-2xl font-bold flex items-center gap-3 animate-pulse ${transitionClass} ${isDarkMode ? 'text-white/30' : 'text-black/20'}`}>
                            <Disc className="animate-spin-slow" /> 纯音乐 / 暂无歌词
                        </span>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* --- Queue Sidebar --- */}
      <div className={`fixed inset-y-0 left-0 w-80 backdrop-blur-2xl border-r shadow-2xl z-40 transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${showQueue ? 'translate-x-0' : '-translate-x-full'} ${drawerBg} ${drawerBorder} ${transitionClass}`}>
            <div className={`p-6 pt-12 flex flex-col h-full ${textColor} ${transitionClass}`}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2"><ListMusic /> 播放列表</h2>
                    <button onClick={() => setShowQueue(false)} className={`p-2 rounded-full ${transitionClass} ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}><X className="w-5 h-5" /></button>
                </div>
                
                <form onSubmit={handlePlaylistSubmit} className="mb-6">
                    <label className={`text-xs mb-1 block pl-1 ${transitionClass} ${textSubColor}`}>切换歌单 (支持网易云歌单ID或链接)</label>
                    <div className="relative">
                        <input 
                            value={tempPlaylistId}
                            onChange={(e) => setTempPlaylistId(e.target.value)}
                            placeholder="输入歌单 ID 或 粘贴链接..."
                            className={`w-full border rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none ${transitionClass} ${isDarkMode ? 'bg-white/10 border-white/10 focus:border-white/30 focus:bg-white/20 text-white' : 'bg-black/5 border-black/10 focus:border-black/20 focus:bg-black/10 text-black'}`}
                        />
                        <Search className={`w-4 h-4 absolute left-3 top-2.5 ${transitionClass} ${isDarkMode ? 'text-white/40' : 'text-black/40'}`} />
                    </div>
                    <button type="submit" className={`w-full mt-2 font-bold py-2 rounded-lg text-xs ${transitionClass} ${isDarkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-black text-white hover:bg-neutral-800'}`}>
                        加载歌单
                    </button>
                </form>

                <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 pb-20">
                    {playlist.map((track, i) => (
                        <div 
                            key={track.id} 
                            onClick={() => { setCurrentIndex(i); setIsPlaying(true); }}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${transitionClass} ${
                                i === currentIndex 
                                    ? (isDarkMode ? 'bg-white/20 text-white' : 'bg-black/10 text-black') 
                                    : (isDarkMode ? 'hover:bg-white/5 text-white/80' : 'hover:bg-black/5 text-black/80')
                            }`}
                        >
                            <img src={track.al.picUrl} className="w-10 h-10 rounded-md object-cover" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{track.name}</div>
                                <div className={`text-xs truncate ${transitionClass} ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>{track.ar.map(a => a.name).join(', ')}</div>
                            </div>
                            {i === currentIndex && <div className={`w-2 h-2 rounded-full animate-pulse ${isDarkMode ? 'bg-white' : 'bg-black'}`} />}
                        </div>
                    ))}
                </div>
            </div>
      </div>

      {/* --- Comments Drawer --- */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-[450px] backdrop-blur-3xl border-l shadow-2xl z-40 transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${showComments ? 'translate-x-0' : 'translate-x-full'} ${drawerBg} ${drawerBorder} ${textColor} ${transitionClass}`}>
            <div className="flex flex-col h-full">
                <div className={`p-6 pt-8 border-b flex items-center justify-between ${transitionClass} ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
                    <h2 className="text-lg font-bold flex items-center gap-2"><MessageSquare className="w-5 h-5" /> 精选评论</h2>
                    <button onClick={() => setShowComments(false)} className={`p-2 rounded-full ${transitionClass} ${isDarkMode ? 'bg-white/5 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {comments.length > 0 ? comments.map(c => (
                        <div key={c.commentId} className="flex gap-4 group">
                            <img src={c.user.avatarUrl} className={`w-10 h-10 rounded-full border shadow-sm ${transitionClass} ${isDarkMode ? 'border-white/10' : 'border-black/10'}`} />
                            <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-sm font-semibold opacity-90">{c.user.nickname}</span>
                                    <span className="text-xs opacity-30">{new Date(c.time).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm opacity-70 leading-relaxed font-light">{c.content}</p>
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

      {/* --- Player Bar --- */}
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
        onToggleQueue={() => setShowQueue(!showQueue)}
        onToggleComments={() => setShowComments(!showComments)}
        themeMode={themeMode}
        onToggleTheme={() => {
            const modes: ThemeMode[] = ['dark', 'light', 'system'];
            const next = modes[(modes.indexOf(themeMode) + 1) % modes.length];
            setThemeMode(next);
        }}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default App;
