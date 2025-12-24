import React from 'react';
import { FluidBackground } from './FluidBackground';

// Types
interface BackgroundLayerProps {
     bgPalette: { c1: string; c2: string; c3: string; c4: string; c5: string };
     extractedColors?: string[];
     isDarkMode: boolean;
}

/**
 * BackgroundLayer Wrapper
 * Now delegates all rendering to FluidBackground which handles the dynamic WAAPI animations.
 */
export const BackgroundLayer: React.FC<BackgroundLayerProps> = React.memo(({ bgPalette, extractedColors, isDarkMode }) => {
     return (
          <FluidBackground
               bgPalette={bgPalette}
               extractedColors={extractedColors}
               isDarkMode={isDarkMode}
          />
     );
});
