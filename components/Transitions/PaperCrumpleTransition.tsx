import React, { useEffect, useState } from 'react';

interface PaperCrumpleTransitionProps {
  durationMs?: number;
}

export const PaperCrumpleTransition: React.FC<PaperCrumpleTransitionProps> = ({ 
  durationMs = 750 
}) => {
  const [clonedHtml, setClonedHtml] = useState<string>('');
  const [scrollY, setScrollY] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    const sourceEl = document.getElementById('page-view-container') || document.getElementById('root');
    if (sourceEl) {
      setClonedHtml(sourceEl.innerHTML);
      setScrollY(window.scrollY || 0);
    }

    const start = performance.now();
    let animId: number;

    const frame = (now: number) => {
      const p = Math.min(1.0, (now - start) / durationMs);
      setProgress(p);
      if (p < 1.0) animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [durationMs]);

  // Phase 1 (0 to 0.45): Crumpling into 3D ball
  // Phase 2 (0.45 to 1.0): Tossed in arc trajectory off screen
  const crumpleP = Math.min(1.0, progress / 0.45);
  const tossP = Math.max(0.0, (progress - 0.45) / 0.55);

  const scale = 1.0 - crumpleP * 0.75;
  const radius = `${crumpleP * 50}%`;

  const tossX = tossP * 110; // vw
  const tossY = Math.pow(tossP, 2) * 130 - tossP * 45; // vh
  const rotZ = progress * 720; // deg

  return (
    <div 
      className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden select-none flex items-center justify-center"
      style={{ perspective: '1200px' }}
      aria-hidden="true"
    >
      <div 
        className="relative w-screen h-screen overflow-hidden shadow-2xl"
        style={{
          transform: `translate(${tossX}vw, ${tossY}vh) rotate(${rotZ}deg) scale(${scale})`,
          borderRadius: radius,
          willChange: 'transform',
          boxShadow: crumpleP > 0.2 ? '0 20px 60px rgba(0,0,0,0.85)' : 'none',
        }}
      >
        {/* Real Cloned Webpage */}
        <div 
          className="absolute top-0 left-0 w-screen h-screen pointer-events-none"
          style={{ transform: `translateY(-${scrollY}px)` }}
          dangerouslySetInnerHTML={{ __html: clonedHtml }}
        />

        {/* Wrinkle crease shadow overlays */}
        {crumpleP > 0.1 && (
          <div 
            className="absolute inset-0 pointer-events-none bg-radial from-transparent via-black/40 to-black/80"
            style={{
              opacity: crumpleP,
              boxShadow: 'inset 0 0 50px rgba(0,0,0,0.9)',
            }}
          />
        )}
      </div>
    </div>
  );
};
