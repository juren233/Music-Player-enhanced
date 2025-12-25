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

    // SMOOTH PARABOLIC CURVE: Calculate a consistent curve control point
    // The curve bows perpendicular to the direction of travel
    // Limited intensity to ensure bending angle >= 135 degrees (gentler curves)
    const curveIntensity = (Math.random() - 0.5) * 30; // How much the curve bows (±15vw max)

    // Calculate perpendicular direction for the curve
    const pathLength = Math.sqrt(totalMoveX * totalMoveX + totalMoveY * totalMoveY);
    const perpX = pathLength > 0 ? -totalMoveY / pathLength : 0;
    const perpY = pathLength > 0 ? totalMoveX / pathLength : 0;

    // Quadratic bezier curve function for smooth parabolic motion
    // t goes from 0 to 1, returns position along the curve
    const bezierX = (t: number) => {
        // Quadratic bezier: (1-t)²*P0 + 2*(1-t)*t*P1 + t²*P2
        const controlX = totalMoveX * 0.5 + perpX * curveIntensity;
        return 2 * (1 - t) * t * controlX + t * t * totalMoveX;
    };
    const bezierY = (t: number) => {
        const controlY = totalMoveY * 0.5 + perpY * curveIntensity;
        return 2 * (1 - t) * t * controlY + t * t * totalMoveY;
    };

    // Random scale variations with different values for each keyframe
    const s1 = 0.7 + Math.random() * 0.3;  // 0.7-1.0
    const s2 = 0.9 + Math.random() * 0.4;  // 0.9-1.3
    const s3 = 0.8 + Math.random() * 0.4;  // 0.8-1.2
    const s4 = 1.0 + Math.random() * 0.3;  // 1.0-1.3
    const s5 = 0.75 + Math.random() * 0.35; // 0.75-1.1

    // Determine rotation direction: 1 for clockwise, -1 for counterclockwise
    const rotationDirection = Math.random() < 0.5 ? 1 : -1;
    // Total rotation amount (between 180 and 360 degrees)
    const totalRotation = 180 + Math.random() * 180;

    // SMOOTH PARABOLIC PATH KEYFRAMES with opacity fade in/out
    const keyframes = [
        {
            transform: `translate3d(0, 0, 0) scale(${s1}) rotate(0deg)`,
            opacity: 0,
            offset: 0
        },
        {
            transform: `translate3d(${bezierX(0.15)}vw, ${bezierY(0.15)}vh, 0) scale(${s2}) rotate(${rotationDirection * totalRotation * 0.15}deg)`,
            opacity: 0.9,
            offset: 0.15
        },
        {
            transform: `translate3d(${bezierX(0.35)}vw, ${bezierY(0.35)}vh, 0) scale(${s3}) rotate(${rotationDirection * totalRotation * 0.35}deg)`,
            opacity: 0.9,
            offset: 0.35
        },
        {
            transform: `translate3d(${bezierX(0.5)}vw, ${bezierY(0.5)}vh, 0) scale(${s4}) rotate(${rotationDirection * totalRotation * 0.5}deg)`,
            opacity: 0.9,
            offset: 0.5
        },
        {
            transform: `translate3d(${bezierX(0.65)}vw, ${bezierY(0.65)}vh, 0) scale(${s3}) rotate(${rotationDirection * totalRotation * 0.65}deg)`,
            opacity: 0.9,
            offset: 0.65
        },
        {
            transform: `translate3d(${bezierX(0.85)}vw, ${bezierY(0.85)}vh, 0) scale(${s5}) rotate(${rotationDirection * totalRotation * 0.85}deg)`,
            opacity: 0.9,
            offset: 0.85
        },
        {
            transform: `translate3d(${totalMoveX}vw, ${totalMoveY}vh, 0) scale(${s1}) rotate(${rotationDirection * totalRotation}deg)`,
            opacity: 0,
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
    // BLOB COUNT - More instances for color variety
    const BLOB_COUNT = 8;

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

    // Update global cache in useEffect, not during render
    useEffect(() => {
        if (extractedColors && extractedColors.length > 0) {
            if (!isFallback) {
                globalColorCache = extractedColors;
            } else if (globalColorCache.length === 0) {
                globalColorCache = extractedColors;
            }
        } else if (globalColorCache.length === 0 && bgPalette) {
            globalColorCache = Object.values(bgPalette);
        }
    }, [extractedColors, bgPalette, isFallback]);

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

    // Color Change with debounce - track all timers to prevent interrupted transitions
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const transitionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    // Helper to clear all transition timers
    const clearAllTransitionTimers = useCallback(() => {
        transitionTimersRef.current.forEach(timer => clearTimeout(timer));
        transitionTimersRef.current = [];
    }, []);

    useEffect(() => {
        const colorKey = targetColors.join(',');
        if (previousColorsRef.current.join(',') === colorKey) return;

        // Clear any pending debounce
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Clear any ongoing transition timers from previous transitions
        clearAllTransitionTimers();

        debounceTimerRef.current = setTimeout(() => {
            previousColorsRef.current = targetColors;

            const isLayerAActive = activeLayerRef.current === 'A';
            const incomingLayer = isLayerAActive ? layerBRef.current : layerARef.current;
            const outgoingLayer = isLayerAActive ? layerARef.current : layerBRef.current;

            if (!incomingLayer || !outgoingLayer) return;

            // Clear previous timers before starting new transition
            clearAllTransitionTimers();

            // IMPORTANT: Snap layers to their expected states before starting new transition
            // This prevents jumps when a new transition starts before the previous one completes
            // Remove transition temporarily to snap instantly
            outgoingLayer.style.transition = 'none';
            incomingLayer.style.transition = 'none';

            // Outgoing should be visible (it was the active layer)
            outgoingLayer.style.opacity = '1';
            // Incoming starts invisible
            incomingLayer.style.opacity = '0';

            // Force browser to apply the instant changes before setting up new transitions
            void outgoingLayer.offsetHeight;
            void incomingLayer.offsetHeight;

            initializeLayer(incomingLayer, targetColors);

            // Now set up the new crossfade transition
            // Duration shorter than debounce (1s) to ensure transition completes before next change
            const transitionDuration = '0.9s';
            incomingLayer.style.transition = `opacity ${transitionDuration} ease-in-out`;
            outgoingLayer.style.transition = `opacity ${transitionDuration} ease-in-out`;

            // Fade in the incoming layer
            const fadeInTimer = setTimeout(() => {
                incomingLayer.style.opacity = '1';
            }, 50);
            transitionTimersRef.current.push(fadeInTimer);

            // Fade out the outgoing layer simultaneously
            const fadeOutTimer = setTimeout(() => {
                outgoingLayer.style.opacity = '0';
            }, 100);
            transitionTimersRef.current.push(fadeOutTimer);

            // Update base color
            const colorTimer = setTimeout(() => {
                setStableBaseColor(targetColors[0]);
            }, 100);
            transitionTimersRef.current.push(colorTimer);

            activeLayerRef.current = isLayerAActive ? 'B' : 'A';
        }, 1000); // Keep 1 second debounce for stability

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            clearAllTransitionTimers();
        };
    }, [targetColors, initializeLayer, clearAllTransitionTimers]);

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
                        filter: 'blur(70px) saturate(0.65)'
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
