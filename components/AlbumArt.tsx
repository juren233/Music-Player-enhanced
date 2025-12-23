
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
    <div className={`flex-1 flex items-center justify-center p-8 lg:p-12 relative min-h-0 min-w-0 ${layoutTransitionClass}`}>
        <div key={currentTrack?.id} className={`relative aspect-square w-full max-w-[280px] lg:max-w-[550px] transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] animate-smooth-appear ${isPlaying ? 'scale-100' : 'scale-[0.8]'}`}>
            <div 
                className={`absolute inset-0 rounded-xl blur-3xl scale-110 -z-10 transition-colors duration-[2000ms] ${layoutTransitionClass}`} 
                style={{ background: `rgb(${dominantColor})`, opacity: isDarkMode ? 0.6 : 0.3 }}
            />
            {currentTrack?.al.picUrl && (
                <img 
                    src={currentTrack.al.picUrl} 
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className={`w-full h-full object-cover rounded-xl relative z-20 ${layoutTransitionClass} 
                        ${isDarkMode 
                            ? 'shadow-[0_20px_40px_rgba(0,0,0,0.6)] border border-white/5' 
                            : 'shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-black/5 ring-1 ring-black/5'
                        }`}
                />
            )}
        </div>
    </div>
  );
});
