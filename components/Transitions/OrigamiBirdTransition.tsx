import React, { useEffect, useState } from 'react';

interface OrigamiBirdTransitionProps {
  durationMs?: number;
}

export const OrigamiBirdTransition: React.FC<OrigamiBirdTransitionProps> = ({ 
  durationMs = 850 
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

  const foldP = Math.min(1.0, progress / 0.38);
  const flyP = Math.max(0.0, (progress - 0.38) / 0.62);

  // Flight path calculations
  const ease = Math.pow(flyP, 1.5);
  const flyX = ease * 120; // vw
  const flyY = -ease * 120; // vh
  const flyZ = -ease * 400; // px
  const scale = 1.0 - foldP * 0.4 - ease * 0.2;

  // Wing flapping oscillation
  const flapAngle = flyP > 0 ? Math.sin(flyP * Math.PI * 12) * 45 : 0; // deg

  const craneTransform = flyP > 0
    ? `translate3d(${flyX}vw, ${flyY}vh, ${flyZ}px) rotateZ(${20 + ease * 30}deg) rotateX(${-20 - ease * 25}deg) scale(${scale})`
    : `scale(${scale})`;

  // Origami crane 4 main body & wing facets
  const craneFacets = [
    {
      id: 'crane-left-body',
      clipPath: 'polygon(50% 10%, 50% 90%, 25% 50%)',
      origin: '50% 50%',
      transform: `rotateY(${-30 * foldP}deg) translateZ(${-20 * foldP}px)`,
      shadow: `rgba(0,0,0,${0.3 * foldP})`,
    },
    {
      id: 'crane-right-body',
      clipPath: 'polygon(50% 10%, 50% 90%, 75% 50%)',
      origin: '50% 50%',
      transform: `rotateY(${30 * foldP}deg) translateZ(${-20 * foldP}px)`,
      shadow: `rgba(0,0,0,${0.15 * foldP})`,
    },
    {
      id: 'crane-left-wing',
      clipPath: 'polygon(50% 10%, 25% 50%, 0% 30%)',
      origin: '25% 50%',
      transform: `rotateY(${45 * foldP}deg) rotateZ(${-flapAngle}deg)`,
      shadow: `rgba(255,255,255,${0.1 * foldP})`,
    },
    {
      id: 'crane-right-wing',
      clipPath: 'polygon(50% 10%, 75% 50%, 100% 30%)',
      origin: '75% 50%',
      transform: `rotateY(${-45 * foldP}deg) rotateZ(${flapAngle}deg)`,
      shadow: `rgba(0,0,0,${0.25 * foldP})`,
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden select-none"
      style={{ perspective: '1400px' }}
      aria-hidden="true"
    >
      <div 
        className="w-full h-full relative"
        style={{
          transformStyle: 'preserve-3d',
          transform: craneTransform,
          willChange: 'transform',
        }}
      >
        {craneFacets.map((facet) => (
          <div
            key={facet.id}
            className="absolute inset-0 w-full h-full overflow-hidden"
            style={{
              clipPath: facet.clipPath,
              transformOrigin: facet.origin,
              transform: facet.transform,
              transformStyle: 'preserve-3d',
              backfaceVisibility: 'hidden',
              willChange: 'transform',
            }}
          >
            {/* Real Cloned Webpage */}
            <div
              className="absolute top-0 left-0 w-screen h-screen pointer-events-none"
              style={{ transform: `translateY(-${scrollY}px)` }}
              dangerouslySetInnerHTML={{ __html: clonedHtml }}
            />

            {/* Shading overlay */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: facet.shadow,
                border: foldP > 0.1 ? '1px solid rgba(255,255,255,0.25)' : 'none',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
