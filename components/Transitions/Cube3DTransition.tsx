import React, { useEffect, useState } from 'react';

interface Cube3DTransitionProps {
  durationMs?: number;
}

export const Cube3DTransition: React.FC<Cube3DTransitionProps> = ({ 
  durationMs = 600 
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

  const angle = progress * -90; // deg
  const scale = 1.0 - Math.sin(progress * Math.PI) * 0.2;

  return (
    <div 
      className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden select-none flex items-center justify-center"
      style={{ perspective: '1400px' }}
      aria-hidden="true"
    >
      <div 
        className="w-full h-full relative"
        style={{
          transformOrigin: '50% 50% -50vw',
          transform: `scale(${scale}) rotateY(${angle}deg)`,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        {/* Front Face: Real Cloned Webpage */}
        <div 
          className="absolute inset-0 w-full h-full overflow-hidden shadow-2xl"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div 
            className="absolute top-0 left-0 w-screen h-screen pointer-events-none"
            style={{ transform: `translateY(-${scrollY}px)` }}
            dangerouslySetInnerHTML={{ __html: clonedHtml }}
          />

          {/* Shading overlay as face turns away from camera */}
          <div 
            className="absolute inset-0 bg-black pointer-events-none transition-opacity"
            style={{ opacity: progress * 0.65 }}
          />
        </div>
      </div>
    </div>
  );
};
