import React, { useEffect, useRef, useCallback } from 'react';

interface FluidBackgroundProps {
    bgPalette: { c1: string; c2: string; c3: string; c4: string; c5: string };
    extractedColors?: string[];
    isDarkMode: boolean;
}

// --- Global Cache (Survives Remounts) ---
let globalColorCache: string[] = [];

// --- BLOB GENERATOR UTILITY ---
const initializeBlobPhysics = (blob: HTMLDivElement, index: number, color: string) => {
    const isBase = index < 3;
    const isMelter = index >= 9;
    const isInvader = !isBase && !isMelter;

    // Size - add aspect ratio variation
    let sizeBase = 65;
    if (isBase) sizeBase = 85;
    if (isMelter) sizeBase = 55;

    const size = sizeBase + Math.random() * 40;
    // Random aspect ratio: some are wide, some are tall, some are square
    const aspectRatio = 0.6 + Math.random() * 0.8; // 0.6 to 1.4
    blob.style.width = `${size}vw`;
    blob.style.height = `${size * aspectRatio}vw`;
    blob.style.background = color;
    blob.style.opacity = '0.9';

    // EXTREMELY IRREGULAR SHAPES: Wild border-radius variations
    // Creates weird amoeba/blob shapes that blur into organic gradients
    const r1 = 10 + Math.random() * 70; // 10-80% - wider range
    const r2 = 10 + Math.random() * 70;
    const r3 = 10 + Math.random() * 70;
    const r4 = 10 + Math.random() * 70;
    const r5 = 10 + Math.random() * 70;
    const r6 = 10 + Math.random() * 70;
    const r7 = 10 + Math.random() * 70;
    const r8 = 10 + Math.random() * 70;
    blob.style.borderRadius = `${r1}% ${r2}% ${r3}% ${r4}% / ${r5}% ${r6}% ${r7}% ${r8}%`;

    // START OFF-SCREEN: Random edge position
    const startEdge = Math.floor(Math.random() * 4);
    let startX: number, startY: number;
    switch (startEdge) {
        case 0: startX = Math.random() * 100; startY = -60; break; // Top
        case 1: startX = 160; startY = Math.random() * 100; break; // Right
        case 2: startX = Math.random() * 100; startY = 160; break; // Bottom
        default: startX = -60; startY = Math.random() * 100; break; // Left
    }
    blob.style.top = `${startY}%`;
    blob.style.left = `${startX}%`;

    // END OFF-SCREEN: Different edge from start
    const endEdge = (startEdge + 1 + Math.floor(Math.random() * 3)) % 4;
    let endX: number, endY: number;
    switch (endEdge) {
        case 0: endX = Math.random() * 100; endY = -60; break;
        case 1: endX = 160; endY = Math.random() * 100; break;
        case 2: endX = Math.random() * 100; endY = 160; break;
        default: endX = -60; endY = Math.random() * 100; break;
    }

    // Animation Duration - FASTER for more color cycling
    const duration = isInvader
        ? 12000 + Math.random() * 8000   // 12-20s
        : 18000 + Math.random() * 12000; // 18-30s

    // Calculate movement
    const totalMoveX = endX - startX;
    const totalMoveY = endY - startY;

    // CURVED PATH: Add random intermediate waypoints that deviate from straight line
    const curveOffset = () => (Math.random() - 0.5) * 80; // ±40vw deviation

    // Random scale variations with different values for each keyframe
    const s1 = 0.7 + Math.random() * 0.3;  // 0.7-1.0
    const s2 = 0.9 + Math.random() * 0.4;  // 0.9-1.3
    const s3 = 0.8 + Math.random() * 0.4;  // 0.8-1.2
    const s4 = 1.0 + Math.random() * 0.3;  // 1.0-1.3
    const s5 = 0.75 + Math.random() * 0.35; // 0.75-1.1

    // CURVED PATH KEYFRAMES with opacity fade in/out
    const keyframes = [
        {
            transform: `translate3d(0, 0, 0) scale(${s1}) rotate(0deg)`,
            opacity: 0, // Fade in
            offset: 0
        },
        {
            transform: `translate3d(${totalMoveX * 0.15 + curveOffset()}vw, ${totalMoveY * 0.15 + curveOffset()}vh, 0) scale(${s2}) rotate(${Math.random() * 60}deg)`,
            opacity: 0.9,
            offset: 0.15
        },
        {
            transform: `translate3d(${totalMoveX * 0.35 + curveOffset()}vw, ${totalMoveY * 0.35 + curveOffset()}vh, 0) scale(${s3}) rotate(${Math.random() * 120}deg)`,
            opacity: 0.9,
            offset: 0.35
        },
        {
            transform: `translate3d(${totalMoveX * 0.5 + curveOffset()}vw, ${totalMoveY * 0.5 + curveOffset()}vh, 0) scale(${s4}) rotate(${Math.random() * 180}deg)`,
            opacity: 0.9,
            offset: 0.5
        },
        {
            transform: `translate3d(${totalMoveX * 0.65 + curveOffset()}vw, ${totalMoveY * 0.65 + curveOffset()}vh, 0) scale(${s3}) rotate(${Math.random() * 240}deg)`,
            opacity: 0.9,
            offset: 0.65
        },
        {
            transform: `translate3d(${totalMoveX * 0.85 + curveOffset()}vw, ${totalMoveY * 0.85 + curveOffset()}vh, 0) scale(${s5}) rotate(${Math.random() * 300}deg)`,
            opacity: 0.9,
            offset: 0.85
        },
        {
            transform: `translate3d(${totalMoveX}vw, ${totalMoveY}vh, 0) scale(${s1}) rotate(${Math.random() * 360}deg)`,
            opacity: 0, // Fade out
            offset: 1
        }
    ];

    blob.animate(keyframes, {
        duration: duration,
        iterations: Infinity,
        direction: 'normal', // NO REVERSE - continuous flow
        easing: 'ease-in-out', // Non-linear: slow-fast-slow
        delay: Math.random() * -duration // Random phase offset
    });
};

// --- MAIN COMPONENT ---
export const FluidBackground: React.FC<FluidBackgroundProps> = React.memo(({ bgPalette, extractedColors, isDarkMode }) => {
    // MORE BLOBS = More instances of same color from different directions
    const BLOB_COUNT = 18;

    const layerARef = useRef<HTMLDivElement>(null);
    const layerBRef = useRef<HTMLDivElement>(null);
    const activeLayerRef = useRef<'A' | 'B'>('A');
    const previousColorsRef = useRef<string[]>([]);

    // Color resolution logic
    const isFallback = React.useMemo(() => {
        if (!extractedColors || extractedColors.length === 0) return false;
        const c1 = extractedColors[0];
        return c1 === '#555' || c1 === '#FF5733' || c1 === '#3357FF';
    }, [extractedColors]);

    if (extractedColors && extractedColors.length > 0) {
        if (!isFallback) {
            globalColorCache = extractedColors;
        } else if (globalColorCache.length === 0) {
            globalColorCache = extractedColors;
        }
    } else if (globalColorCache.length === 0 && bgPalette) {
        globalColorCache = Object.values(bgPalette);
    }

    const targetColors = React.useMemo(() => {
        const resolved = (extractedColors && extractedColors.length > 0 && !isFallback)
            ? extractedColors
            : (globalColorCache.length > 0 ? globalColorCache : Object.values(bgPalette));
        const colors = [...resolved];
        while (colors.length < 4) {
            colors.push(colors[0]);
        }
        return colors;
    }, [extractedColors, bgPalette, isFallback]);

    const [stableBaseColor, setStableBaseColor] = React.useState(targetColors[0]);

    const initializeLayer = useCallback((layer: HTMLDivElement, colors: string[]) => {
        layer.innerHTML = '';
        for (let i = 0; i < BLOB_COUNT; i++) {
            const blob = document.createElement('div');
            blob.className = 'absolute rounded-full';
            const color = colors[i % colors.length];
            initializeBlobPhysics(blob, i, color);
            layer.appendChild(blob);
        }
    }, []);

    // Initial setup
    useEffect(() => {
        if (layerARef.current && previousColorsRef.current.length === 0) {
            initializeLayer(layerARef.current, targetColors);
            previousColorsRef.current = targetColors;
            if (layerARef.current) layerARef.current.style.opacity = '1';
            if (layerBRef.current) layerBRef.current.style.opacity = '0';
        }
    }, []);

    // Color Change with debounce
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const colorKey = targetColors.join(',');
        if (previousColorsRef.current.join(',') === colorKey) return;

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            previousColorsRef.current = targetColors;

            const isLayerAActive = activeLayerRef.current === 'A';
            const incomingLayer = isLayerAActive ? layerBRef.current : layerARef.current;
            const outgoingLayer = isLayerAActive ? layerARef.current : layerBRef.current;

            if (!incomingLayer || !outgoingLayer) return;

            initializeLayer(incomingLayer, targetColors);
            incomingLayer.style.opacity = '0';
            incomingLayer.style.transition = 'opacity 3s ease-in-out';

            setTimeout(() => {
                incomingLayer.style.opacity = '1';
            }, 100);

            outgoingLayer.style.transition = 'opacity 3s ease-in-out';
            setTimeout(() => {
                outgoingLayer.style.opacity = '0';
            }, 500);

            setTimeout(() => {
                setStableBaseColor(targetColors[0]);
            }, 200);

            activeLayerRef.current = isLayerAActive ? 'B' : 'A';
        }, 1000);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [targetColors, initializeLayer]);

    return (
        <div
            className="fixed inset-0 overflow-hidden transition-colors duration-[4000ms] ease-in-out"
            style={{
                backgroundColor: stableBaseColor,
                zIndex: 0
            }}
        >
            {/* Vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />

            {/* Fluid Container */}
            <div className="absolute inset-0">
                <div
                    className="absolute inset-0"
                    style={{
                        transform: 'translateZ(0)',
                        filter: 'blur(120px) saturate(0.65)'
                    }}
                >
                    {/* Layer A */}
                    <div
                        ref={layerARef}
                        className="absolute inset-0"
                        style={{ opacity: 1, transition: 'opacity 3s ease-in-out' }}
                    />

                    {/* Layer B */}
                    <div
                        ref={layerBRef}
                        className="absolute inset-0"
                        style={{ opacity: 0, transition: 'opacity 3s ease-in-out' }}
                    />

                    {/* Dark Overlay */}
                    <div className="absolute inset-0 bg-black/15 pointer-events-none" />
                </div>
            </div>

            {/* Noise Texture */}
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay z-10"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />

            {/* Light Mode Overlay */}
            {!isDarkMode && <div className="absolute inset-0 bg-white/20 mix-blend-overlay z-20 pointer-events-none" />}
        </div>
    );
});
