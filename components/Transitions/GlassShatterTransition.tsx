import React, { useEffect, useRef, useState, useMemo } from 'react';

interface GlassShatterTransitionProps {
  durationMs?: number;
}

export const GlassShatterTransition: React.FC<GlassShatterTransitionProps> = ({ 
  durationMs = 750 
}) => {
  const [clonedHtml, setClonedHtml] = useState<string>('');
  const [scrollY, setScrollY] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 8 High-Impact Geometric Glass Shards (100% Screen Coverage at t=0, Zero Gaps)
  const shards = useMemo(() => [
    {
      id: 'shard-top-left',
      clip: 'polygon(50% 50%, 0% 0%, 28% 0%)',
      vx: -190,
      vy: -150,
      rotZ: -35,
      rotX: 45,
      rotY: -30,
      gravity: 540,
      delay: 0.0,
    },
    {
      id: 'shard-top-mid',
      clip: 'polygon(50% 50%, 28% 0%, 68% 0%)',
      vx: 30,
      vy: -200,
      rotZ: 20,
      rotX: 55,
      rotY: 15,
      gravity: 580,
      delay: 0.02,
    },
    {
      id: 'shard-top-right',
      clip: 'polygon(50% 50%, 68% 0%, 100% 0%, 100% 38%)',
      vx: 220,
      vy: -140,
      rotZ: 40,
      rotX: 35,
      rotY: 40,
      gravity: 550,
      delay: 0.04,
    },
    {
      id: 'shard-mid-right',
      clip: 'polygon(50% 50%, 100% 38%, 100% 75%)',
      vx: 250,
      vy: 40,
      rotZ: 25,
      rotX: -20,
      rotY: 50,
      gravity: 600,
      delay: 0.02,
    },
    {
      id: 'shard-bottom-right',
      clip: 'polygon(50% 50%, 100% 75%, 100% 100%, 65% 100%)',
      vx: 200,
      vy: 170,
      rotZ: 45,
      rotX: -45,
      rotY: 35,
      gravity: 660,
      delay: 0.05,
    },
    {
      id: 'shard-bottom-mid',
      clip: 'polygon(50% 50%, 65% 100%, 25% 100%)',
      vx: -20,
      vy: 220,
      rotZ: -15,
      rotX: -55,
      rotY: -20,
      gravity: 700,
      delay: 0.03,
    },
    {
      id: 'shard-bottom-left',
      clip: 'polygon(50% 50%, 25% 100%, 0% 100%, 0% 62%)',
      vx: -210,
      vy: 180,
      rotZ: -45,
      rotX: -40,
      rotY: -35,
      gravity: 670,
      delay: 0.04,
    },
    {
      id: 'shard-mid-left',
      clip: 'polygon(50% 50%, 0% 62%, 0% 0%)',
      vx: -240,
      vy: -30,
      rotZ: -30,
      rotX: 25,
      rotY: -45,
      gravity: 600,
      delay: 0.01,
    },
  ], []);

  // Snapshot the real DOM once on mount
  useEffect(() => {
    const sourceEl = document.getElementById('page-view-container') || document.getElementById('root');
    if (sourceEl) {
      setClonedHtml(sourceEl.innerHTML);
      setScrollY(window.scrollY || 0);
    }
  }, []);

  // Micro-dust particle sparks & shard physics 60fps render loop
  useEffect(() => {
    const start = performance.now();
    let animId: number;

    const canvas = particleCanvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    const ctx = canvas ? canvas.getContext('2d') : null;

    // Generate 35 micro-dust glass sparks at impact origin
    const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number }> = [];
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 4;
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 3,
        size: Math.random() * 3.5 + 1.2,
        alpha: 1.0,
      });
    }

    const renderFrame = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(1.0, elapsed / durationMs);

      // Flash & spiderweb crack fadeout
      if (flashRef.current) {
        const flashOpacity = Math.max(0, 1 - p * 3.5);
        flashRef.current.style.opacity = `${flashOpacity}`;
        if (p >= 0.3) {
          flashRef.current.style.display = 'none';
        }
      }

      // Update shard physics directly via DOM refs (ZERO React re-renders)
      shards.forEach((s, idx) => {
        const el = shardRefs.current[idx];
        if (!el) return;

        const effectiveP = Math.max(0, (p - s.delay) / (1.0 - s.delay));
        if (effectiveP <= 0) {
          el.style.transform = 'none';
          el.style.opacity = '1';
          return;
        }

        const ease = Math.pow(effectiveP, 1.3);
        const tx = s.vx * ease;
        const ty = s.vy * ease + 0.5 * s.gravity * Math.pow(effectiveP, 2);
        const tz = -ease * 350;
        const rz = s.rotZ * ease;
        const rx = s.rotX * ease;
        const ry = s.rotY * ease;
        const opacity = Math.max(0, 1 - Math.pow(effectiveP, 1.5));

        el.style.transform = `translate3d(${tx}px, ${ty}px, ${tz}px) rotateZ(${rz}deg) rotateX(${rx}deg) rotateY(${ry}deg)`;
        el.style.opacity = `${opacity}`;
      });

      // Render Micro-dust glass sparks on canvas
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((pt) => {
          const px = pt.x + pt.vx * p * 55;
          const py = pt.y + pt.vy * p * 55 + 0.5 * 350 * Math.pow(p, 2);
          const pAlpha = Math.max(0, 1.0 - p * 1.6);

          if (pAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = pAlpha;
            ctx.fillStyle = '#22d3ee';
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(px, py, pt.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });
      }

      if (p < 1.0) {
        animId = requestAnimationFrame(renderFrame);
      }
    };

    animId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [durationMs, shards]);

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
      {/* Spiderweb glass fracture & impact spark flash */}
      <div 
        ref={flashRef}
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.7) 0%, rgba(34,211,238,0.25) 35%, transparent 75%)',
          willChange: 'opacity',
        }}
      >
        {/* Radial spiderweb crack lines */}
        <svg className="w-full h-full opacity-80" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="50" y1="50" x2="0" y2="0" stroke="rgba(255,255,255,0.9)" strokeWidth="0.4" />
          <line x1="50" y1="50" x2="28" y2="0" stroke="rgba(255,255,255,0.85)" strokeWidth="0.3" />
          <line x1="50" y1="50" x2="68" y2="0" stroke="rgba(255,255,255,0.9)" strokeWidth="0.4" />
          <line x1="50" y1="50" x2="100" y2="0" stroke="rgba(255,255,255,0.85)" strokeWidth="0.3" />
          <line x1="50" y1="50" x2="100" y2="38" stroke="rgba(255,255,255,0.9)" strokeWidth="0.4" />
          <line x1="50" y1="50" x2="100" y2="75" stroke="rgba(255,255,255,0.85)" strokeWidth="0.3" />
          <line x1="50" y1="50" x2="100" y2="100" stroke="rgba(255,255,255,0.9)" strokeWidth="0.4" />
          <line x1="50" y1="50" x2="65" y2="100" stroke="rgba(255,255,255,0.85)" strokeWidth="0.3" />
          <line x1="50" y1="50" x2="25" y2="100" stroke="rgba(255,255,255,0.9)" strokeWidth="0.4" />
          <line x1="50" y1="50" x2="0" y2="100" stroke="rgba(255,255,255,0.85)" strokeWidth="0.3" />
          <line x1="50" y1="50" x2="0" y2="62" stroke="rgba(255,255,255,0.9)" strokeWidth="0.4" />
          {/* Concentric fracture rings */}
          <circle cx="50" cy="50" r="10" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="0.35" strokeDasharray="2,1" />
          <circle cx="50" cy="50" r="22" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.3" strokeDasharray="3,1.5" />
          <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.25" strokeDasharray="4,2" />
        </svg>
      </div>

      {/* 8 Geometric Glass Shards (Zero React Re-renders, 100% GPU composited) */}
      {shards.map((s, idx) => (
        <div
          key={s.id}
          ref={(el) => { shardRefs.current[idx] = el; }}
          className="absolute inset-0 w-full h-full overflow-hidden"
          style={{
            clipPath: s.clip,
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
            willChange: 'transform, opacity',
          }}
        >
          {/* Cloned Real Webpage (mounted only once) */}
          <div
            className="absolute top-0 left-0 w-screen h-screen pointer-events-none"
            style={{ transform: `translateY(-${scrollY}px)` }}
            dangerouslySetInnerHTML={{ __html: clonedHtml }}
          />

          {/* Glass shard specular highlight & glint border */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 45%, rgba(0,0,0,0.3) 100%)',
              border: '1.2px solid rgba(255,255,255,0.6)',
              boxShadow: 'inset 0 0 15px rgba(255,255,255,0.2)',
            }}
          />
        </div>
      ))}

      {/* Micro-dust glowing cyan sparks canvas */}
      <canvas 
        ref={particleCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-30"
      />
    </div>
  );
};
