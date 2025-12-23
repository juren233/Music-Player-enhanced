
import React, { useMemo } from 'react';

interface BackgroundLayerProps {
  bgPalette: { c1: string; c2: string; c3: string };
  isDarkMode: boolean;
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = React.memo(({ bgPalette, isDarkMode }) => {
  return (
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

         {/* Noise Texture Overlay */}
         <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
         
         {/* Glass Overlay for Light Mode */}
         {!isDarkMode && <div className="absolute inset-0 bg-white/30 backdrop-blur-[100px] z-10 mix-blend-overlay" />}
      </div>
  );
});
