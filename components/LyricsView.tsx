
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
        const activeZone = containerRect.height * 0.42;
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
            // OPTIMIZATION 1: Hide past lyrics when not scrolling (reduce render)
            if (!isScrolling && i < activeIdx) {
                child.style.transform = `scale(0.88)`;
                child.style.filter = `blur(0px)`;
                child.style.opacity = `0`;
                child.style.visibility = 'hidden';
                return;
            }

            // Show element if it was hidden
            child.style.visibility = 'visible';

            // If completely off screen, use static minimal style
            if (distance > containerRect.height) {
                child.style.transform = `scale(0.88)`;
                child.style.filter = `blur(0px)`;
                child.style.opacity = `0.08`;
                return;
            }

            // OPTIMIZATION 2: No blur when user is scrolling
            if (isScrolling) {
                // Simplified style during scroll (no blur, just opacity based on distance)
                const intensity = Math.min(distance / activeZone, 1);
                child.style.transform = `scale(1)`;
                child.style.filter = `blur(0px)`;
                child.style.opacity = `${1 - intensity * 0.5}`;
                return;
            }

            let isActiveForce = (i === activeIdx);

            if (isActiveForce) {
                child.style.transform = `scale(1)`;
                child.style.filter = `blur(0px)`;
                child.style.opacity = `1`;
            } else {
                // Smoother Apple-style easing curve
                let intensity = Math.min(distance / activeZone, 1);
                intensity = Math.pow(intensity, 1.5);

                const scale = 1 - (intensity * 0.12);
                const blur = (intensity * 3).toFixed(1);
                const opacity = (1 - (intensity * 0.75)).toFixed(2);

                child.style.transform = `scale(${scale})`;
                child.style.filter = `blur(${blur}px)`;
                child.style.opacity = opacity;
            }
        });
    }, []);

    // PERFORMANCE: Update visuals only on scroll or activeIndex change (not every frame!)
    // Debounced scroll update
    const scrollRAFRef = useRef<number | null>(null);

    const triggerVisualUpdate = useCallback(() => {
        if (scrollRAFRef.current) return; // Already pending
        scrollRAFRef.current = requestAnimationFrame(() => {
            updateLyricVisuals();
            scrollRAFRef.current = null;
        });
    }, [updateLyricVisuals]);

    // Update on activeIndex change
    useEffect(() => {
        updateLyricVisuals();
    }, [activeIndex, updateLyricVisuals]);

    // Auto-scroll logic
    const isAutoScrolling = useRef(false);
    const autoScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Trigger scroll immediately when active index changes, unless user is scrolling
        if (!isUserScrollingRef.current && lyricsContainerRef.current && activeIndex !== -1) {
            const el = lyricsContainerRef.current.children[activeIndex] as HTMLElement;
            if (el) {
                // Clear any existing timeout
                if (autoScrollTimeout.current) clearTimeout(autoScrollTimeout.current);

                isAutoScrolling.current = true;
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Keep isAutoScrolling true for 500ms to cover entire smooth scroll
                autoScrollTimeout.current = setTimeout(() => {
                    isAutoScrolling.current = false;
                }, 500);
            }
        }
    }, [activeIndex]);

    const handleLyricsScroll = () => {
        // IMPORTANT: Skip all scroll logic if this is auto-scroll
        if (isAutoScrolling.current) {
            return; // Don't trigger user scroll logic for auto-scroll
        }

        // Only for USER scroll: trigger visual update and set scrolling state
        triggerVisualUpdate();
        isUserScrollingRef.current = true;
        if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);
        userScrollTimeout.current = setTimeout(() => {
            isUserScrollingRef.current = false;
            // Trigger visual update to restore blur and hide past lyrics
            updateLyricVisuals();
        }, 3000);
    };

    const lyricInactiveColor = isDarkMode ? 'text-white/35' : 'text-slate-400';
    const lyricTransitionClass = "transition-colors duration-500 ease-out";

    return (
        <div className="flex-1 h-full relative overflow-hidden lg:mr-6 flex flex-col min-h-0">
            <div
                ref={lyricsContainerRef}
                onScroll={handleLyricsScroll}
                className="flex-1 overflow-y-auto no-scrollbar py-[50vh] px-6 lg:px-4 text-left lyric-mask will-change-transform"
            >
                {lyrics.length > 0 ? lyrics.map((line, i) => {
                    const isActive = i === activeIndex;

                    // Apple Music style: much larger active lyrics
                    const textClass = isActive
                        ? "font-black text-[2rem] lg:text-[3.5rem] tracking-tight leading-[1.15]"
                        : `font-bold text-xl lg:text-3xl tracking-tight ${lyricInactiveColor}`;

                    const renderActiveContent = () => {
                        const progress = currentTime < line.time ? 0 :
                            currentTime > line.time + line.duration ? 1 :
                                (currentTime - line.time) / line.duration;

                        // Apple Music karaoke reveal effect
                        return (
                            <span className="relative inline-block">
                                <span
                                    className="absolute inset-0 text-transparent bg-clip-text"
                                    style={{
                                        backgroundImage: `linear-gradient(to right, ${isDarkMode ? '#fff' : '#1d1d1f'} ${progress * 100}%, transparent ${progress * 100}%)`,
                                        WebkitBackgroundClip: 'text'
                                    }}
                                >
                                    {line.text}
                                </span>
                                <span className={isDarkMode ? 'text-white/20' : 'text-black/15'}>{line.text}</span>
                            </span>
                        );
                    };

                    return (
                        <div
                            key={i}
                            onClick={() => handleSeek(line.time)}
                            className={`mb-6 lg:mb-8 cursor-pointer transition-all duration-500 origin-left ${textClass} ${lyricTransitionClass} hover:opacity-80`}
                        >
                            {isActive ? renderActiveContent() : line.text}
                            {line.trans && isActive && (
                                <div className={`text-lg lg:text-2xl font-medium mt-3 opacity-70 tracking-normal ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                                    {line.trans}
                                </div>
                            )}
                            {line.trans && !isActive && (
                                <div className={`text-sm lg:text-lg font-medium mt-1.5 opacity-35 tracking-normal ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>
                                    {line.trans}
                                </div>
                            )}
                        </div>
                    );
                }) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-30">
                        {currentTrack?.sourceUrl ? (
                            <div className="text-xl font-semibold tracking-tight">本地音乐</div>
                        ) : (
                            <>
                                <Disc className="w-16 h-16 mb-4 animate-spin-slow" />
                                <p className="text-lg font-medium">纯音乐，请欣赏</p>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="h-10 w-full shrink-0" />
        </div>
    );
};
