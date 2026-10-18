import React, { useEffect, useState } from 'react';

interface PageFlipTransitionProps {
  durationMs?: number;
}

export const PageFlipTransition: React.FC<PageFlipTransitionProps> = ({ 
  durationMs = 650 
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

  const ease = Math.sin((progress * Math.PI) / 2);
  const flipAngle = ease * -160; // deg

  return (
    <div 
      className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden select-none"
      style={{ perspective: '1600px' }}
      aria-hidden="true"
    >
      <div 
        className="w-full h-full relative"
        style={{
          transformOrigin: 'left center',
          transform: `rotateY(${flipAngle}deg)`,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          boxShadow: `${progress * -40}px 0 60px rgba(0,0,0,0.85)`,
        }}
      >
        {/* Real Cloned Webpage (Front of page) */}
        <div 
          className="absolute inset-0 w-full h-full overflow-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div 
            className="absolute top-0 left-0 w-screen h-screen pointer-events-none"
            style={{ transform: `translateY(-${scrollY}px)` }}
            dangerouslySetInnerHTML={{ __html: clonedHtml }}
          />

          {/* Book Spine Curl Shadow */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,${0.2 * progress}) 15%, transparent 60%)`,
            }}
          />
        </div>

        {/* Back of page (Subtle paper backing with reverse gradient) */}
        <div 
          className="absolute inset-0 w-full h-full bg-zinc-900 border-r border-zinc-700"
          style={{
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden',
            background: 'linear-gradient(to left, #18181b 0%, #09090b 100%)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-l from-white/10 to-transparent" />
        </div>
      </div>
    </div>
  );
};
