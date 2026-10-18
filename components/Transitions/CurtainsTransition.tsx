import React, { useEffect, useState } from 'react';

interface CurtainsTransitionProps {
  durationMs?: number;
}

export const CurtainsTransition: React.FC<CurtainsTransitionProps> = ({ 
  durationMs = 700 
}) => {
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
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

  // Phase 1 (0 to 0.45): Close curtains over old page
  // Phase 2 (0.45 to 1.0): Open curtains revealing new page
  const isClosing = progress < 0.45;
  const closeP = isClosing ? progress / 0.45 : 1.0;
  const openP = isClosing ? 0 : (progress - 0.45) / 0.55;

  const curtainShift = isClosing 
    ? (1 - closeP) * 100 
    : openP * 105; // slide out past screen

  return (
    <div 
      className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden select-none flex w-full h-full"
      aria-hidden="true"
    >
      {/* Cortina Izquierda */}
      <div 
        className="w-1/2 h-full relative"
        style={{
          transform: `translateX(-${curtainShift}%)`,
          background: 'repeating-linear-gradient(90deg, #450a0a 0px, #991b1b 35px, #350808 70px, #7f1d1d 105px)',
          boxShadow: 'inset -20px 0 50px rgba(0,0,0,0.85), 10px 0 40px rgba(0,0,0,0.9)',
          borderRight: '4px solid #f59e0b',
          willChange: 'transform',
        }}
      >
        {/* Pliegues de tela ondulados */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/60 pointer-events-none" />
        
        {/* Borla dorada inferior */}
        <div className="absolute bottom-12 right-3 w-8 h-20 bg-gradient-to-b from-[#f59e0b] via-[#b45309] to-[#fcd34d] rounded-b-full shadow-2xl border border-amber-200/50 flex flex-col items-center justify-end pb-1">
          <div className="w-5 h-5 rounded-full bg-amber-200 shadow-inner" />
        </div>
      </div>

      {/* Cortina Derecha */}
      <div 
        className="w-1/2 h-full relative"
        style={{
          transform: `translateX(${curtainShift}%)`,
          background: 'repeating-linear-gradient(90deg, #7f1d1d 0px, #350808 35px, #991b1b 70px, #450a0a 105px)',
          boxShadow: 'inset 20px 0 50px rgba(0,0,0,0.85), -10px 0 40px rgba(0,0,0,0.9)',
          borderLeft: '4px solid #f59e0b',
          willChange: 'transform',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-l from-black/40 via-transparent to-black/60 pointer-events-none" />

        <div className="absolute bottom-12 left-3 w-8 h-20 bg-gradient-to-b from-[#f59e0b] via-[#b45309] to-[#fcd34d] rounded-b-full shadow-2xl border border-amber-200/50 flex flex-col items-center justify-end pb-1">
          <div className="w-5 h-5 rounded-full bg-amber-200 shadow-inner" />
        </div>
      </div>

      {/* Foco central teatral en el apex */}
      <div 
        className="absolute inset-0 bg-radial from-amber-400/25 via-transparent to-transparent pointer-events-none transition-opacity duration-200"
        style={{ opacity: progress > 0.35 && progress < 0.65 ? 1 : 0 }}
      />
    </div>
  );
};
