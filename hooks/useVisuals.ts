
import { useState, useEffect, useRef } from 'react';
import { Track } from '../types';

// Helper to adjust color vibrancy
const adjustColor = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  if (max < 30) return { r: r + 20, g: g + 20, b: b + 20 }; // Too dark
  return { r, g, b };
};

export function useVisuals(currentTrack: Track | undefined) {
  const [dominantColor, setDominantColor] = useState('20, 20, 20');
  const [bgPalette, setBgPalette] = useState<{c1: string, c2: string, c3: string}>({
      c1: 'rgba(50,50,50,0.8)',
      c2: 'rgba(30,30,30,0.8)',
      c3: 'rgba(20,20,20,0.8)'
  });
  
  const loadingTrackRef = useRef<number | null>(null);

  useEffect(() => {
    if (!currentTrack) return;
    loadingTrackRef.current = currentTrack.id;

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = currentTrack.al.picUrl;
    img.onload = () => {
        if (loadingTrackRef.current !== currentTrack.id) return;
        const canvas = document.createElement('canvas');
        canvas.width = 1; canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if(ctx) {
            ctx.drawImage(img, 0, 0, 1, 1);
            const [rawR, rawG, rawB] = ctx.getImageData(0,0,1,1).data;
            const { r, g, b } = adjustColor(rawR, rawG, rawB);

            setDominantColor(`${r},${g},${b}`);

            // Generate a pseudo-palette by shifting hue/lightness roughly
            setBgPalette({
                c1: `rgb(${r}, ${g}, ${b})`,
                c2: `rgb(${Math.min(255, r * 1.2)}, ${Math.min(255, g * 0.8)}, ${Math.min(255, b * 1.1)})`,
                c3: `rgb(${Math.max(0, r * 0.8)}, ${Math.max(0, g * 1.1)}, ${Math.max(0, b * 0.9)})`
            });
        }
    }
  }, [currentTrack]);

  return { dominantColor, bgPalette };
}
