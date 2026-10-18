import React, { useEffect, useRef, useState } from 'react';
import { usePageTransition } from '../../src/context/PageTransitionContext';

interface PaperAirplaneTransitionProps {
  durationMs?: number;
  onApex?: () => void;
}

export const PaperAirplaneTransition: React.FC<PaperAirplaneTransitionProps> = ({ 
  durationMs = 850,
  onApex 
}) => {
  const { soundEnabled } = usePageTransition();
  const [clonedHtml, setClonedHtml] = useState<string>('');
  const [scrollY, setScrollY] = useState<number>(0);
  const [animProgress, setAnimProgress] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasTriggeredApexRef = useRef(false);

  // Capture the real DOM of the webpage instantly on mount
  useEffect(() => {
    const sourceEl = document.getElementById('page-view-container') || document.getElementById('root');
    if (sourceEl) {
      setClonedHtml(sourceEl.innerHTML);
      setScrollY(window.scrollY || 0);
    }
  }, []);

  // Animation timeline loop
  useEffect(() => {
    let animId: number;
    const startTime = performance.now();
    hasTriggeredApexRef.current = false;

    const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; size: number }> = [];

    const pCanvas = particleCanvasRef.current;
    if (pCanvas) {
      pCanvas.width = window.innerWidth;
      pCanvas.height = window.innerHeight;
    }

    const pCtx = pCanvas ? pCanvas.getContext('2d') : null;

    const updateFrame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      setAnimProgress(progress);

      // Trigger apex route swap at 38%
      if (progress >= 0.38 && !hasTriggeredApexRef.current) {
        hasTriggeredApexRef.current = true;
        if (onApex) {
          try {
            onApex();
          } catch (err) {
            console.error('Error executing navigation during transition apex:', err);
          }
        }
      }

      // Wind stream particles behind the airplane during flight
      if (pCtx && pCanvas && progress > 0.38 && progress < 0.95) {
        const w = pCanvas.width;
        const h = pCanvas.height;
        pCtx.clearRect(0, 0, w, h);

        const flightT = (progress - 0.38) / 0.62;
        const ease = Math.pow(flightT, 1.8);
        const planeX = (w * 0.5) + ease * (w * 0.85);
        const planeY = (h * 0.5) - ease * (h * 0.95);

        // Emit wind trail particles
        for (let i = 0; i < 3; i++) {
          particles.push({
            x: planeX + (Math.random() - 0.5) * 20,
            y: planeY + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 2 - 3,
            vy: (Math.random() - 0.5) * 2 + 2,
            life: 1.0,
            size: Math.random() * 5 + 2,
          });
        }

        // Draw and update particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.035;
          p.size *= 0.95;

          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }

          pCtx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.45})`;
          pCtx.beginPath();
          pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          pCtx.fill();
        }
      }

      if (progress < 1.0) {
        animId = requestAnimationFrame(updateFrame);
      }
    };

    animId = requestAnimationFrame(updateFrame);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [durationMs, onApex]);

  // Folding progress (0.0 to 1.0 during the first 38% of total time)
  const foldP = Math.min(1.0, animProgress / 0.38);
  // Flight progress (0.0 to 1.0 during the remaining 62%)
  const flightP = Math.max(0.0, (animProgress - 0.38) / 0.62);

  // Compute 3D flight translation and rotation
  const flightEase = Math.pow(flightP, 1.8);
  const flightX = flightEase * 135; // vw
  const flightY = -flightEase * 125; // vh
  const flightZ = -flightEase * 450; // px
  const flightPitch = -25 - flightEase * 30; // deg
  const flightRoll = 25 + flightEase * 40; // deg
  const flightYaw = 15 + flightEase * 20; // deg

  // Overall scale of the airplane as it folds and takes off
  const scale = foldP === 0 ? 1.0 : 1.0 - foldP * 0.35 - flightEase * 0.15;

  const airplaneTransform = flightP > 0
    ? `translate3d(${flightX}vw, ${flightY}vh, ${flightZ}px) rotateZ(${flightRoll}deg) rotateX(${flightPitch}deg) rotateY(${flightYaw}deg) scale(${scale})`
    : `scale(${scale})`;

  // 6 Origami Panels that fold the user's real webpage DOM
  const panels = [
    {
      id: 'fuselage-left',
      name: 'Fuselaje Izquierdo',
      clipPath: 'polygon(50% 0%, 50% 100%, 25% 100%)',
      origin: '50% 50%',
      transform: `rotateY(${-28 * foldP}deg) translateZ(${-40 * foldP}px)`,
      shadow: `rgba(0, 0, 0, ${0.35 * foldP})`,
      creaseBorder: `${foldP > 0.05 ? '1px solid rgba(255,255,255,0.3)' : 'none'}`,
    },
    {
      id: 'fuselage-right',
      name: 'Fuselaje Derecho',
      clipPath: 'polygon(50% 0%, 50% 100%, 75% 100%)',
      origin: '50% 50%',
      transform: `rotateY(${28 * foldP}deg) translateZ(${-40 * foldP}px)`,
      shadow: `rgba(0, 0, 0, ${0.15 * foldP})`,
      creaseBorder: `${foldP > 0.05 ? '1px solid rgba(255,255,255,0.3)' : 'none'}`,
    },
    {
      id: 'main-wing-left',
      name: 'Ala Principal Izquierda',
      clipPath: 'polygon(50% 0%, 25% 100%, 0% 100%)',
      origin: '25% 100%',
      transform: `rotateY(${50 * foldP}deg) translateZ(${25 * foldP}px)`,
      shadow: `rgba(255, 255, 255, ${0.08 * foldP})`,
      creaseBorder: `${foldP > 0.05 ? '1px solid rgba(255,255,255,0.3)' : 'none'}`,
    },
    {
      id: 'main-wing-right',
      name: 'Ala Principal Derecha',
      clipPath: 'polygon(50% 0%, 75% 100%, 100% 100%)',
      origin: '75% 100%',
      transform: `rotateY(${-50 * foldP}deg) translateZ(${25 * foldP}px)`,
      shadow: `rgba(0, 0, 0, ${0.28 * foldP})`,
      creaseBorder: `${foldP > 0.05 ? '1px solid rgba(255,255,255,0.3)' : 'none'}`,
    },
    {
      id: 'top-left-fold',
      name: 'Pliegue Superior Izquierdo',
      clipPath: 'polygon(50% 0%, 0% 0%, 0% 100%)',
      origin: '0% 50%',
      transform: `rotateY(${35 * foldP}deg) translateZ(${-15 * foldP}px)`,
      shadow: `rgba(0, 0, 0, ${0.3 * foldP})`,
      creaseBorder: `${foldP > 0.05 ? '1px solid rgba(255,255,255,0.2)' : 'none'}`,
    },
    {
      id: 'top-right-fold',
      name: 'Pliegue Superior Derecho',
      clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%)',
      origin: '100% 50%',
      transform: `rotateY(${-35 * foldP}deg) translateZ(${-15 * foldP}px)`,
      shadow: `rgba(0, 0, 0, ${0.4 * foldP})`,
      creaseBorder: `${foldP > 0.05 ? '1px solid rgba(255,255,255,0.2)' : 'none'}`,
    },
  ];

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden select-none"
      style={{
        perspective: '1400px',
        perspectiveOrigin: '50% 50%',
      }}
      aria-hidden="true"
    >
      {/* 3D Paper Airplane Rig formed directly by the user's real webpage */}
      <div 
        className="absolute inset-0 w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: airplaneTransform,
          willChange: 'transform',
          transition: 'none',
        }}
      >
        {panels.map((panel) => (
          <div
            key={panel.id}
            className="absolute inset-0 w-full h-full overflow-hidden"
            style={{
              clipPath: panel.clipPath,
              transformOrigin: panel.origin,
              transform: panel.transform,
              transformStyle: 'preserve-3d',
              backfaceVisibility: 'hidden',
              willChange: 'transform',
            }}
          >
            {/* The Real Cloned Webpage Content showing the exact pink titles, custom colors, buttons */}
            <div
              className="absolute top-0 left-0 w-screen h-screen pointer-events-none overflow-hidden"
              style={{
                transform: `translateY(-${scrollY}px)`,
              }}
              dangerouslySetInnerHTML={{ __html: clonedHtml }}
            />

            {/* Dynamic 3D lighting shadow overlay reflecting origami fold angle */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: panel.shadow,
                borderRight: panel.creaseBorder,
                borderLeft: panel.creaseBorder,
                transition: 'none',
              }}
            />
          </div>
        ))}
      </div>

      {/* Particle trail canvas for wind streaks emitted during flight */}
      <canvas 
        ref={particleCanvasRef} 
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
};
