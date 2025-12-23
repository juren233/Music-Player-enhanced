
import React, { useRef, useEffect, useCallback } from 'react';
import { LyricLine, Track } from '../types';
import { Disc } from 'lucide-react';

interface LyricsViewProps {
  lyrics: LyricLine[];
  currentTime: number;
  activeIndex: number;
  handleSeek: (ms: number) => void;
  isDarkMode: boolean;
  currentTrack: Track | undefined;
}

export const LyricsView: React.FC<LyricsViewProps> = ({
  lyrics, currentTime, activeIndex, handleSeek, isDarkMode, currentTrack
}) => {
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const activeIndexRef = useRef(0);
  const userScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync ref for animation loop
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
        // Optimize: If completely off screen (far away), set static style to avoid calculation
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
             // Smoother easing curve
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

  useEffect(() => {
      // Trigger scroll immediately when active index changes, unless user is scrolling
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

  const lyricInactiveColor = isDarkMode ? 'text-white/40' : 'text-slate-400';
  const lyricTransitionClass = "transition-colors duration-300 ease-out"; 

  return (
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
                    
                    // Word-by-word reveal (approximate karaoke)
                    return (
                        <span className="relative inline-block">
                            <span className="absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50" style={{ 
                                backgroundImage: `linear-gradient(to right, ${isDarkMode ? '#fff' : '#000'} ${progress * 100}%, transparent ${progress * 100}%)`,
                                WebkitBackgroundClip: 'text'
                            }}>
                                {line.text}
                            </span>
                            <span className={isDarkMode ? 'text-white/20' : 'text-black/20'}>{line.text}</span>
                        </span>
                    );
                };

                return (
                    <div 
                        key={i} 
                        onClick={() => handleSeek(line.time)}
                        className={`mb-8 cursor-pointer transition-all duration-500 origin-left ${textClass} ${lyricTransitionClass}`}
                    >
                        {isActive ? renderActiveContent() : line.text}
                        {line.trans && isActive && <div className={`text-lg lg:text-xl font-medium mt-2 opacity-80 ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>{line.trans}</div>}
                        {line.trans && !isActive && <div className={`text-sm lg:text-base font-medium mt-1 opacity-40 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>{line.trans}</div>}
                    </div>
                );
            }) : (
                <div className="h-full flex flex-col items-center justify-center opacity-40">
                        {currentTrack?.sourceUrl ? (
                            <div className="text-xl font-bold">本地音乐</div>
                        ) : (
                            <>
                            <Disc className="w-16 h-16 mb-4 animate-spin-slow" />
                            <p>纯音乐，请欣赏</p>
                            </>
                        )}
                </div>
            )}
        </div>
        
        <div className="h-12 w-full shrink-0" />
    </div>
  );
};
