import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Volume1, VolumeX, ListMusic, MessageSquare, Moon, Sun, Laptop, Shuffle, ArrowRight } from 'lucide-react';
import { Track } from '../types';
import { ThemeMode } from '../App';

interface MusicPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  onToggleQueue: () => void;
  onToggleComments: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  isDarkMode: boolean;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  isReverse: boolean;
  onToggleReverse: () => void;
  onArtistClick: (artistId: number) => void;
}

export const MusicPlayer = React.memo<MusicPlayerProps>(({
  currentTrack, isPlaying, onPlayPause, onNext, onPrev, 
  currentTime, duration, onSeek, volume, onVolumeChange, onToggleQueue, onToggleComments,
  themeMode, onToggleTheme, isDarkMode,
  isShuffle, onToggleShuffle, isReverse, onToggleReverse,
  onArtistClick
}) => {
  
  const [animatingTheme, setAnimatingTheme] = useState(false);
  const [animatingReverse, setAnimatingReverse] = useState(false);
  const [animatingShuffle, setAnimatingShuffle] = useState(false); // Added state for shuffle animation
  const [animatingComments, setAnimatingComments] = useState(false);
  
  // Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Volume Memory for Mute Toggle
  const lastVolumeRef = useRef(volume > 0 ? volume : 0.5);

  // Update last volume when user changes it (so we know what to restore to)
  useEffect(() => {
    if (volume > 0) {
      lastVolumeRef.current = volume;
    }
  }, [volume]);

  // Trigger animation state on theme change
  useEffect(() => {
    setAnimatingTheme(true);
    const timer = setTimeout(() => setAnimatingTheme(false), 500); // Sync with CSS transition
    return () => clearTimeout(timer);
  }, [themeMode]);

  // Trigger animation on reverse toggle
  useEffect(() => {
    setAnimatingReverse(true);
    const timer = setTimeout(() => setAnimatingReverse(false), 400);
    return () => clearTimeout(timer);
  }, [isReverse]);

  // Trigger animation on shuffle toggle
  useEffect(() => {
    setAnimatingShuffle(true);
    const timer = setTimeout(() => setAnimatingShuffle(false), 500);
    return () => clearTimeout(timer);
  }, [isShuffle]);

  const handleCommentsClick = () => {
    setAnimatingComments(true);
    onToggleComments();
    const timer = setTimeout(() => setAnimatingComments(false), 300);
    return () => clearTimeout(timer);
  };

  const toggleMute = () => {
    if (volume > 0) {
      onVolumeChange(0);
    } else {
      onVolumeChange(lastVolumeRef.current);
    }
  };

  // --- Dragging Logic ---
  const calculateTimeFromEvent = (clientX: number) => {
    if (!progressBarRef.current || !duration) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    // Calculate percentage (0 to 1), clamped
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Prevent default browser dragging of the element
    e.preventDefault();
    setIsDragging(true);
    
    // Immediately update visual position to where user clicked
    const newTime = calculateTimeFromEvent(e.clientX);
    setDragTime(newTime);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const newTime = calculateTimeFromEvent(e.clientX);
      setDragTime(newTime);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const newTime = calculateTimeFromEvent(e.clientX);
      // Commit the seek operation only when release
      onSeek(newTime);
      setIsDragging(false);
    };

    // Attach to window to handle drags that go outside the element
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, duration, onSeek]);

  // Determine what to display: current playback time OR dragging time
  const effectiveTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration ? (effectiveTime / duration) * 100 : 0;

  const formatTime = (ms: number) => {
    if (!ms && ms !== 0) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  
  // Theme Colors
  const transitionClass = "transition-[color,background-color,border-color,opacity,shadow,transform,filter] duration-500 ease-[cubic-bezier(0.2,0,0,1)]";
  const textColor = isDarkMode ? 'text-white' : 'text-slate-900';
  const textDimColor = isDarkMode ? 'text-white/50' : 'text-slate-500';
  const iconHoverClass = isDarkMode ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-black/5 hover:text-black';
  const glassBg = isDarkMode ? 'bg-neutral-900/60 border-white/5' : 'bg-white/70 border-black/5';

  // Control Buttons Logic
  const controlBtnClass = `p-2 rounded-lg relative ${transitionClass} ${iconHoverClass} active:scale-95`;
  const shuffleActiveClass = isShuffle 
      ? (isDarkMode ? 'bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'bg-black/10 text-black shadow-[0_0_10px_rgba(0,0,0,0.1)]') 
      : textDimColor;
      
  // Active Color (Brand Red/Rose) for PROGRESS BAR ONLY
  const activeBarColor = 'bg-rose-500';
  const activeShadow = 'shadow-[0_0_10px_rgba(244,63,94,0.6)]'; // rose-500 glow

  return (
    <div className="w-full h-[96px] relative z-50">
        <div className={`absolute inset-0 backdrop-blur-2xl border-t ${transitionClass} ${glassBg}`} />
        
        <div className="relative h-full max-w-screen-2xl mx-auto px-6 flex items-center justify-between gap-8">
            
            {/* 1. Track Info (Left) */}
            <div key={currentTrack?.id} className="flex items-center gap-4 w-[25%] min-w-[200px] animate-smooth-appear">
                {currentTrack && (
                <>
                    <div className="relative group cursor-pointer" onClick={onToggleQueue}>
                        <img 
                            src={currentTrack.al.picUrl} 
                            alt="art" 
                            className={`w-12 h-12 rounded-md shadow-md object-cover ${transitionClass} ${isDarkMode ? 'border border-white/5' : 'border border-black/5'}`}
                        />
                        <div className="absolute inset-0 bg-black/20 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ListMusic className="w-5 h-5 text-white" />
                        </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h4 className={`font-medium truncate text-sm ${transitionClass} ${textColor}`}>{currentTrack.name}</h4>
                        <div className={`text-xs truncate ${transitionClass} ${textDimColor}`}>
                            {currentTrack.ar.map((a, idx) => (
                                <span key={a.id}>
                                    {idx > 0 && ", "}
                                    <span 
                                        className="cursor-pointer hover:underline hover:text-opacity-80 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onArtistClick(a.id);
                                        }}
                                    >
                                        {a.name}
                                    </span>
                                </span>
                            ))}
                        </div>
                    </div>
                </>
                )}
            </div>

            {/* 2. Controls & Progress (Center) */}
            <div className="flex-1 flex flex-col items-center justify-center max-w-[600px]">
                {/* Buttons - Redesigned */}
                <div className="flex items-center gap-8 mb-3">
                    {/* Shuffle Button - With refined animation */}
                    <button 
                        onClick={onToggleShuffle} 
                        className={`${controlBtnClass} ${shuffleActiveClass}`}
                        title={isShuffle ? "关闭随机" : "开启随机"}
                    >
                        <div className={`relative transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isShuffle ? 'rotate-180' : 'rotate-0'}`}>
                            <Shuffle className={`w-4 h-4 transition-transform duration-300 ${animatingShuffle ? 'scale-125' : 'scale-100'}`} />
                        </div>
                        {/* Animated Dot Indicator */}
                        <div className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isShuffle ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-0 translate-y-2'}`}></div>
                    </button>

                    {/* Prev Button */}
                    <button 
                        onClick={onPrev} 
                        className={`group p-2.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 active:scale-90 ${isDarkMode ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-black/60 hover:text-black hover:bg-black/5'}`}
                    >
                        <SkipBack className="w-7 h-7 fill-current" />
                    </button>

                    {/* Play/Pause Button - Hero Element - Resized from w-16 to w-14 */}
                    <button 
                        onClick={onPlayPause}
                        className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 active:scale-90 shadow-xl hover:shadow-2xl ${
                            isDarkMode 
                                ? 'bg-white text-black shadow-white/20' 
                                : 'bg-black text-white shadow-black/30'
                        }`}
                    >
                         {/* Icon Morph Container */}
                         <div className="relative w-8 h-8 flex items-center justify-center">
                             <Pause className={`absolute w-full h-full fill-current transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isPlaying ? 'scale-100 rotate-0 opacity-100' : 'scale-50 -rotate-90 opacity-0'}`} />
                             <Play className={`absolute w-full h-full fill-current ml-1 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${!isPlaying ? 'scale-100 rotate-0 opacity-100' : 'scale-50 rotate-90 opacity-0'}`} />
                         </div>
                    </button>

                    {/* Next Button */}
                    <button 
                        onClick={onNext} 
                        className={`group p-2.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 active:scale-90 ${isDarkMode ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-black/60 hover:text-black hover:bg-black/5'}`}
                    >
                        <SkipForward className="w-7 h-7 fill-current" />
                    </button>

                    {/* Order/Reverse Toggle Button */}
                    <button 
                        onClick={onToggleReverse} 
                        className={`${controlBtnClass} ${textDimColor}`}
                        title={isReverse ? "倒序播放" : "顺序播放"}
                    >
                        <div className={`transition-transform duration-500 ease-spring ${isReverse ? 'rotate-180' : 'rotate-0'}`}>
                            <ArrowRight className="w-5 h-5" />
                        </div>
                    </button>
                </div>
                
                {/* Scrubber - USES BRAND COLOR (RED) */}
                <div className={`w-full flex items-center gap-3 text-[10px] font-medium tracking-wide ${transitionClass} ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                    <span className="w-8 text-right tabular-nums">{formatTime(effectiveTime)}</span>
                    <div 
                        ref={progressBarRef}
                        className="flex-1 h-1 relative group cursor-pointer touch-none flex items-center" 
                        onPointerDown={handlePointerDown}
                    >
                        {/* Hit Area Expansion */}
                        <div className="absolute -top-3 -bottom-3 inset-x-0 bg-transparent z-10" />
                        
                        {/* Background Track */}
                        <div className={`absolute inset-0 rounded-full ${transitionClass} ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`} />

                        {/* Filled Bar - BRAND COLOR */}
                        <div 
                            className={`h-full rounded-full relative z-0 ${transitionClass} ${activeBarColor} ${activeShadow}`} 
                            style={{ width: `${progressPercent}%` }}
                        >
                            {/* Thumb */}
                            <div 
                                className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-md transition-all duration-200 bg-white
                                ${isDragging ? 'opacity-100 scale-125' : 'opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100'}`} 
                            />
                        </div>
                    </div>
                    <span className="w-8 tabular-nums">{formatTime(duration)}</span>
                </div>
            </div>

            {/* 3. Volume & Tools (Right) */}
            <div className="w-[25%] flex items-center justify-end gap-5">
                <button 
                    onClick={onToggleTheme}
                    className={`p-2 rounded-lg relative overflow-hidden group ${transitionClass} ${textDimColor} ${iconHoverClass} ${animatingTheme ? 'scale-90' : 'scale-100'}`}
                    title={`Theme: ${themeMode}`}
                >
                   <div className={`relative w-5 h-5 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${animatingTheme ? '-rotate-90 opacity-50' : 'rotate-0 opacity-100'}`}>
                       {themeMode === 'dark' && <Moon className="w-full h-full" />}
                       {themeMode === 'light' && <Sun className="w-full h-full" />}
                       {themeMode === 'system' && <Laptop className="w-full h-full" />}
                   </div>
                </button>

                <button 
                    onClick={handleCommentsClick} 
                    className={`p-2 rounded-lg relative overflow-hidden ${transitionClass} ${textDimColor} ${iconHoverClass} ${animatingComments ? 'scale-90' : 'scale-100'}`}
                    title="Comments"
                >
                    <div className={`transition-transform duration-300 ease-spring ${animatingComments ? 'scale-90 rotate-6' : 'scale-100 rotate-0'}`}>
                        <MessageSquare className="w-5 h-5" />
                    </div>
                </button>

                <div className="flex items-center gap-3 w-32">
                    <button 
                        onClick={toggleMute}
                        className={`p-1 rounded-md relative flex items-center justify-center ${transitionClass} ${textDimColor} ${iconHoverClass} active:scale-90`}
                        title={volume === 0 ? "取消静音" : "静音"}
                    >
                        <div className="relative w-5 h-5">
                             {volume === 0 ? <VolumeX className="w-5 h-5 opacity-50" /> : (volume < 0.5 ? <Volume1 className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />)}
                             <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox="0 0 24 24">
                                <line 
                                    x1="4" y1="4" x2="20" y2="20" 
                                    stroke="currentColor" 
                                    strokeWidth="2.5" 
                                    strokeLinecap="round"
                                    className={`transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
                                    style={{ 
                                        strokeDasharray: 24, 
                                        strokeDashoffset: volume === 0 ? 0 : 24, 
                                        opacity: volume === 0 ? 1 : 0
                                    }}
                                />
                             </svg>
                        </div>
                    </button>
                    
                    {/* Volume Slider - USES ORIGINAL MONOCHROME */}
                    <div className="flex-1 relative h-8 flex items-center group cursor-pointer select-none">
                        {/* Native Range Input (Top Layer) - Hit Area */}
                        <input 
                            type="range" min="0" max="1" step="0.01" value={volume}
                            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 m-0 p-0"
                            title="Volume"
                        />
                        
                        {/* Background Track */}
                        <div className={`w-full h-1 rounded-full overflow-hidden relative ${transitionClass} ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`}>
                             {/* Filled Part - ORIGINAL COLORS */}
                             <div className={`h-full ${transitionClass} ${isDarkMode ? 'bg-white' : 'bg-black'}`} style={{ width: `${volume * 100}%` }} />
                        </div>

                        {/* Visual Thumb */}
                        <div 
                             className="absolute left-0 top-0 bottom-0 pointer-events-none"
                             style={{ width: `${volume * 100}%` }}
                        >
                             <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-md transition-all duration-200 ${isDarkMode ? 'bg-white' : 'bg-black'}
                                 translate-x-1/2 opacity-0 group-hover:opacity-100 group-active:opacity-100 scale-50 group-hover:scale-100 group-active:scale-125`} 
                             />
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
});