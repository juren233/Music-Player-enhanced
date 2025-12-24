
import React from 'react';
import { Track } from '../types';

interface AlbumArtProps {
    currentTrack: Track | undefined;
    isPlaying: boolean;
    dominantColor: string;
    isDarkMode: boolean;
    layoutTransitionClass: string;
}

export const AlbumArt: React.FC<AlbumArtProps> = React.memo(({ currentTrack, isPlaying, dominantColor, isDarkMode, layoutTransitionClass }) => {
    return (
        <div className={`flex-1 flex items-center justify-center p-6 lg:p-10 relative min-h-0 min-w-0 ${layoutTransitionClass}`}>
            {/* Animated glow behind album */}
            <div
                className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-40'}`}
            >
                <div
                    className="w-[60%] max-w-[500px] aspect-square rounded-full blur-[100px] lg:blur-[150px] animate-gradient-pulse"
                    style={{ background: `rgb(${dominantColor})`, opacity: isDarkMode ? 0.5 : 0.25 }}
                />
            </div>

            <div className={`relative aspect-square w-full max-w-[320px] lg:max-w-[480px] transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isPlaying ? 'scale-100' : 'scale-[0.88]'}`}>
                {/* Softer multi-layer shadow */}
                <div
                    className={`absolute inset-0 rounded-[28px] lg:rounded-[32px] -z-10 transition-all duration-[2500ms] ${layoutTransitionClass}`}
                    style={{
                        background: `rgb(${dominantColor})`,
                        opacity: isDarkMode ? 0.4 : 0.2,
                        transform: 'scale(1.05) translateY(8px)',
                        filter: 'blur(50px)'
                    }}
                />
                {currentTrack?.al.picUrl && (
                    <img
                        src={currentTrack.al.picUrl}
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        className={`w-full h-full object-cover rounded-[24px] lg:rounded-[28px] relative z-20 ${layoutTransitionClass} 
                        ${isDarkMode
                                ? 'shadow-[0_8px_30px_rgba(0,0,0,0.12),0_30px_60px_rgba(0,0,0,0.25)] ring-1 ring-white/[0.08]'
                                : 'shadow-[0_8px_30px_rgba(0,0,0,0.08),0_30px_60px_rgba(0,0,0,0.15)] ring-1 ring-black/[0.04]'
                            }`}
                    />
                )}
            </div>
        </div>
    );
});
