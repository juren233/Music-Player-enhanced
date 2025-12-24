import { useState, useEffect, useRef } from 'react';
import { Track } from '../types';

// Helper to adjust color vibrancy and brightness
const adjustColor = (r: number, g: number, b: number) => {
  // Convert to HSL
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const cMax = Math.max(rNorm, gNorm, bNorm);
  const cMin = Math.min(rNorm, gNorm, bNorm);
  const delta = cMax - cMin;

  let h = 0;
  let s = 0;
  let l = (cMax + cMin) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - cMax - cMin) : delta / (cMax + cMin);
    switch (cMax) {
      case rNorm: h = (gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0); break;
      case gNorm: h = (bNorm - rNorm) / delta + 2; break;
      case bNorm: h = (rNorm - gNorm) / delta + 4; break;
    }
    h /= 6;
  }

  // REFINED Logic: Respect Grayscale, Boost Brightness

  // 1. Saturation: DO NOT force color if it's grayscale.
  // Only boost if there is already some color signal (s > 0.15)
  if (s > 0.15) {
    s = Math.min(s * 1.5, 0.95); // Boost existing color
  } else {
    s = s * 0.5; // If it's grey, let it be elegantly grey (dampen noise)
  }

  // 2. Brightness: Still prevent "Pitch Black", but map gracefully
  // Range: [0.0 -> 0.2] (Dark) to [0.3 -> 0.8] (Light)
  l = Math.max(0.25, l);
  l = Math.min(l, 0.85);

  // Convert back to RGB
  let c: number, x: number, m: number;
  if (s === 0) {
    r = g = b = l * 255;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3) * 255;
    g = hue2rgb(p, q, h) * 255;
    b = hue2rgb(p, q, h - 1 / 3) * 255;
  }

  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b)
  };
};

// Fallback colors so it's never just black
const DEFAULT_PALETTE = {
  c1: 'rgba(255, 0, 0, 0.5)',
  c2: 'rgba(255, 100, 0, 0.5)',
  c3: 'rgba(255, 0, 100, 0.5)',
  c4: 'rgba(0, 100, 255, 0.5)',
  c5: 'rgba(100, 0, 255, 0.5)'
};

export function useVisuals(currentTrack: Track | undefined) {
  const [dominantColor, setDominantColor] = useState('20, 20, 20');
  const [bgPalette, setBgPalette] = useState(DEFAULT_PALETTE);
  const [extractedColors, setExtractedColors] = useState<string[]>([]); // New State

  const loadingTrackRef = useRef<number | null>(null);

  useEffect(() => {
    if (!currentTrack) return;
    loadingTrackRef.current = currentTrack.id;

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = currentTrack.al.picUrl;

    img.onload = () => {
      if (loadingTrackRef.current !== currentTrack.id) return;

      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw image to smaller canvas (32x32 = 1024 pixels is enough for color sampling)
        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(img, 0, 0, 32, 32);

        // PERFORMANCE: Single getImageData call
        const imageData = ctx.getImageData(0, 0, 32, 32).data;

        // Coarser grid (step 5 = ~36 sample points) - much faster, still good quality
        const samples: { r: number, g: number, b: number, score: number }[] = [];

        for (let y = 3; y < 29; y += 5) {
          for (let x = 3; x < 29; x += 5) {
            const i = (y * 32 + x) * 4;
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];

            // Fast vibrancy score calculation
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const l = (max + min) >> 1; // Bit shift for fast divide by 2
            const delta = max - min;
            const s = delta === 0 ? 0 : delta / (255 - Math.abs(2 * l - 255));

            // Score: favor saturation, penalize extremes
            let score = s * 5 + l * 0.001;
            if (l > 250 || l < 15) score -= 2;

            samples.push({ r, g, b, score });
          }
        }

        // Sort by score (only ~36 items, very fast)
        samples.sort((a, b) => b.score - a.score);

        // Select distinct colors using SQUARED distance (avoid expensive sqrt)
        const DIST_THRESHOLD_SQ = 45 * 45; // 2025
        const distinct: { r: number, g: number, b: number }[] = [];

        for (const s of samples) {
          let isDistinct = true;
          for (const d of distinct) {
            const dr = d.r - s.r;
            const dg = d.g - s.g;
            const db = d.b - s.b;
            if (dr * dr + dg * dg + db * db <= DIST_THRESHOLD_SQ) {
              isDistinct = false;
              break; // Early exit
            }
          }
          if (isDistinct) {
            distinct.push(s);
            if (distinct.length >= 12) break;
          }
        }

        // If we don't have enough, fill with default
        if (distinct.length === 0) distinct.push({ r: 40, g: 40, b: 40 });

        // Convert to Adjust Color strings
        const finalColors = distinct.map(c => {
          const adj = adjustColor(c.r, c.g, c.b);
          return `rgb(${adj.r}, ${adj.g}, ${adj.b})`;
        });

        // Set State individually
        const main = finalColors[0];
        setDominantColor(main);
        setBgPalette({
          c1: finalColors[0],
          c2: finalColors[1] || finalColors[0],
          c3: finalColors[2] || finalColors[0],
          c4: finalColors[3] || finalColors[1] || finalColors[0],
          c5: finalColors[4] || finalColors[0]
        });
        setExtractedColors(finalColors);

      } catch (e) {
        console.warn("Failed to extract colors (likely CORS), using fallback", e);
        // Fallbacks
        const fallback = currentTrack.id % 2 === 0
          ? { c1: '#FF5733', c2: '#C70039', c3: '#900C3F', c4: '#581845', c5: '#FFC300' }
          : { c1: '#3357FF', c2: '#33FF57', c3: '#33FFF5', c4: '#F533FF', c5: '#FF3333' };

        setBgPalette(fallback);
        setDominantColor(fallback.c1);
        setExtractedColors(Object.values(fallback));
      }
    };

    img.onerror = () => {
      setBgPalette({ c1: '#555', c2: '#666', c3: '#777', c4: '#888', c5: '#999' });
      setExtractedColors(['#555', '#666', '#777', '#888', '#999']);
    };

  }, [currentTrack]);

  // Return new 'extractedColors' along with legacy palette
  return { dominantColor, bgPalette, extractedColors };
}

