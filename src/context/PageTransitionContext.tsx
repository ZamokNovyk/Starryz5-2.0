import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export type TransitionType = 
  | 'airplane'   // ✈️ Avión de Papel 3D & Vuelo
  | 'glass'      // 🔨 Vidrio Cristal Shards
  | 'curtains'   // 🎭 Cortinas de Teatro
  | 'crumple'    // 📄 Papel Arrugado & Lanzamiento
  | 'pageflip'   // 📖 Voltear Página Estilo Libro
  | 'cube3d'     // 🎲 Cubo 3D Rotación
  | 'origami'    // 🕊️ Ave de Papel (Grulla 3D)
  | 'none';      // ⚡ Sin Animación

export type TransitionSpeed = 'fast' | 'normal' | 'slow';

export interface TransitionDefinition {
  id: TransitionType;
  name: string;
  emoji: string;
  badge: string;
  description: string;
  durationMs: number;
  apexRatio: number;
}

export const TRANSITIONS_LIST: TransitionDefinition[] = [
  {
    id: 'airplane',
    name: 'Avión de Papel',
    emoji: '✈️',
    badge: 'Plegado 3D & Vuelo',
    description: 'Tu pantalla actual se pliega tridimensionalmente formando el cuerpo del avión y despega hacia el cielo con estela de viento.',
    durationMs: 850,
    apexRatio: 0.38,
  },
  {
    id: 'glass',
    name: 'Vidrio Cristal',
    emoji: '🔨',
    badge: 'Fragmentos Voronoi',
    description: 'La pantalla sufre un impacto fractal y estalla en fragmentos geométricos de cristal que caen con gravedad física y destellos.',
    durationMs: 750,
    apexRatio: 0.35,
  },
  {
    id: 'curtains',
    name: 'Cortinas de Teatro',
    emoji: '🎭',
    badge: 'Apertura de Telón',
    description: 'Majestuosas cortinas de terciopelo teatral con ribetes y borlas doradas que se abren con pliegues ondulados revelando la nueva página.',
    durationMs: 700,
    apexRatio: 0.45,
  },
  {
    id: 'crumple',
    name: 'Papel Arrugado',
    emoji: '📄',
    badge: 'Pelota 3D & Lanzamiento',
    description: 'La interfaz entera se arruga y comprime en una bola de papel 3D giratoria que sale lanzada en un arco parabólico.',
    durationMs: 750,
    apexRatio: 0.45,
  },
  {
    id: 'pageflip',
    name: 'Voltear Página',
    emoji: '📖',
    badge: 'Efecto Libro Realista',
    description: 'La página se levanta y se dobla con curvatura 3D y sombra de lomo como al pasar la hoja de un libro o revista.',
    durationMs: 650,
    apexRatio: 0.45,
  },
  {
    id: 'cube3d',
    name: 'Cubo 3D',
    emoji: '🎲',
    badge: 'Rotación Espacial',
    description: 'La pantalla gira en el espacio como la cara de un cubo tridimensional con perspectiva cinematográfica y sombras de profundidad.',
    durationMs: 600,
    apexRatio: 0.5,
  },
  {
    id: 'origami',
    name: 'Ave de Papel',
    emoji: '🕊️',
    badge: 'Grulla 3D & Aleteo',
    description: 'La página se pliega en una grulla de origami 3D que aletea sus alas rítmicamente y vuela hacia el espacio.',
    durationMs: 850,
    apexRatio: 0.38,
  },
  {
    id: 'none',
    name: 'Sin Animación',
    emoji: '⚡',
    badge: 'Instantáneo',
    description: 'Navegación normal directa y estándar sin efectos de transición.',
    durationMs: 0,
    apexRatio: 0,
  },
];

interface PageTransitionContextType {
  activeTransition: TransitionType;
  setActiveTransition: (t: TransitionType) => void;
  speed: TransitionSpeed;
  setSpeed: (s: TransitionSpeed) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  isTransitioning: boolean;
  transitionPhase: 'idle' | 'in' | 'apex' | 'out';
  currentEffect: TransitionType;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;
  startTransition: (onApexCallback?: () => void, customType?: TransitionType) => void;
  previewTransition: (type?: TransitionType) => void;
}

const PageTransitionContext = createContext<PageTransitionContextType | undefined>(undefined);

// Web Audio API Synthesizer exactly as provided in the user's script
function playSynthesizedSound(type: string, speedMultiplier: number = 1.0) {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (type === 'airplane') {
      // 1. Fold paper crease sound
      const duration = 0.3;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(2800, now + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);

      // 2. Wind swoosh for flight
      const swooshDur = 0.75 / speedMultiplier;
      const swooshBufSize = ctx.sampleRate * swooshDur;
      const swooshBuf = ctx.createBuffer(1, swooshBufSize, ctx.sampleRate);
      const sData = swooshBuf.getChannelData(0);
      for (let i = 0; i < swooshBufSize; i++) {
        sData[i] = (Math.random() * 2 - 1);
      }
      const sNoise = ctx.createBufferSource();
      sNoise.buffer = swooshBuf;

      const sFilter = ctx.createBiquadFilter();
      sFilter.type = 'lowpass';
      sFilter.frequency.setValueAtTime(250, now + 0.3);
      sFilter.frequency.exponentialRampToValueAtTime(1600, now + 0.3 + swooshDur * 0.4);
      sFilter.frequency.exponentialRampToValueAtTime(120, now + 0.3 + swooshDur);

      const sGain = ctx.createGain();
      sGain.gain.setValueAtTime(0.01, now + 0.3);
      sGain.gain.linearRampToValueAtTime(0.4, now + 0.3 + swooshDur * 0.3);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + swooshDur);

      sNoise.connect(sFilter);
      sFilter.connect(sGain);
      sGain.connect(ctx.destination);
      sNoise.start(now + 0.3);

    } else if (type === 'glass') {
      // 1. Initial High Impact Snap (Transient noise burst)
      const snapDur = 0.08;
      const snapBuf = ctx.createBuffer(1, ctx.sampleRate * snapDur, ctx.sampleRate);
      const snapData = snapBuf.getChannelData(0);
      for (let i = 0; i < snapData.length; i++) {
        snapData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (snapData.length * 0.15));
      }
      const snapSource = ctx.createBufferSource();
      snapSource.buffer = snapBuf;

      const snapFilter = ctx.createBiquadFilter();
      snapFilter.type = 'highpass';
      snapFilter.frequency.setValueAtTime(2500, now);

      const snapGain = ctx.createGain();
      snapGain.gain.setValueAtTime(0.8, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + snapDur);

      snapSource.connect(snapFilter);
      snapFilter.connect(snapGain);
      snapGain.connect(ctx.destination);
      snapSource.start(now);

      // 2. Shattering Main Glass Explosive Noise
      const duration = 0.9 / speedMultiplier;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(6500, now + 0.12);
      filter.frequency.exponentialRampToValueAtTime(1200, now + duration);
      filter.Q.setValueAtTime(3, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);

      // 3. High-Frequency Glass Shard Clink Harmonic Tones
      for (let c = 0; c < 5; c++) {
        const osc = ctx.createOscillator();
        const clinkGain = ctx.createGain();

        const delay = Math.random() * 0.22;
        const freq = 4200 + Math.random() * 4500;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + delay);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + delay + 0.15);

        clinkGain.gain.setValueAtTime(0, now);
        clinkGain.gain.setValueAtTime(0.14, now + delay);
        clinkGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);

        osc.connect(clinkGain);
        clinkGain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.16);
      }

    } else if (type === 'curtains') {
      // Heavy fabric velour curtain swoosh
      const duration = 1.1 / speedMultiplier;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, now);
      filter.frequency.linearRampToValueAtTime(800, now + duration * 0.5);
      filter.frequency.linearRampToValueAtTime(100, now + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.45, now + duration * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);

    } else if (type === 'crumple') {
      // Paper ball crumple crunch
      const duration = 0.6;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.linearRampToValueAtTime(2200, now + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);

    } else if (type === 'pageflip') {
      // Crisp book page flip turn sound
      const duration = 0.45;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(3500, now + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);

    } else if (type === 'origami') {
      // Origami wing flap cycle sound
      const duration = 0.32 / speedMultiplier;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(350, now);
      filter.frequency.exponentialRampToValueAtTime(1100, now + duration * 0.5);
      filter.frequency.exponentialRampToValueAtTime(250, now + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.35, now + duration * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);

    } else {
      // Default swoosh
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.35);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch {
    // Autoplay policy safety
  }
}

export const PageTransitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTransition, setActiveTransitionState] = useState<TransitionType>(() => {
    try {
      const saved = localStorage.getItem('starryz_page_transition');
      if (saved && TRANSITIONS_LIST.some(t => t.id === saved)) {
        return saved as TransitionType;
      }
    } catch {}
    return 'none'; // Por defecto: Sin Animación (Instantáneo)
  });

  const [speed, setSpeedState] = useState<TransitionSpeed>(() => {
    try {
      const saved = localStorage.getItem('starryz_transition_speed');
      if (saved === 'fast' || saved === 'normal' || saved === 'slow') return saved;
    } catch {}
    return 'normal';
  });

  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('starryz_transition_sound');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'in' | 'apex' | 'out'>('idle');
  const [currentEffect, setCurrentEffect] = useState<TransitionType>('none');

  const animationTimerRef = useRef<NodeJS.Timeout[]>([]);
  const onApexCallbackRef = useRef<(() => void) | null>(null);

  const clearTimers = () => {
    animationTimerRef.current.forEach(t => clearTimeout(t));
    animationTimerRef.current = [];
  };

  const setActiveTransition = (t: TransitionType) => {
    setActiveTransitionState(t);
    try {
      localStorage.setItem('starryz_page_transition', t);
    } catch {}
  };

  const setSpeed = (s: TransitionSpeed) => {
    setSpeedState(s);
    try {
      localStorage.setItem('starryz_transition_speed', s);
    } catch {}
  };

  const setSoundEnabled = (v: boolean) => {
    setSoundEnabledState(v);
    try {
      localStorage.setItem('starryz_transition_sound', String(v));
    } catch {}
  };

  const startTransition = useCallback((onApexCallback?: () => void, customType?: TransitionType) => {
    const effectType = customType || activeTransition;

    if (effectType === 'none') {
      if (onApexCallback) onApexCallback();
      return;
    }

    clearTimers();

    const config = TRANSITIONS_LIST.find(t => t.id === effectType) || TRANSITIONS_LIST[0];
    const speedMultiplier = speed === 'fast' ? 0.75 : speed === 'slow' ? 1.35 : 1;
    const totalDuration = config.durationMs * speedMultiplier;
    const apexTime = totalDuration * config.apexRatio;

    onApexCallbackRef.current = onApexCallback || null;
    setCurrentEffect(effectType);
    setIsTransitioning(true);
    setTransitionPhase('in');

    if (soundEnabled) {
      playSynthesizedSound(effectType, speedMultiplier);
    }

    // 1. Apex reached: Page is covered or folded, execute route swap
    const apexTimer = setTimeout(() => {
      setTransitionPhase('apex');
      if (onApexCallbackRef.current) {
        try {
          onApexCallbackRef.current();
          onApexCallbackRef.current = null;
        } catch (err) {
          console.error('Error navigating during transition apex:', err);
        }
      }

      const outTimer = setTimeout(() => {
        setTransitionPhase('out');
      }, 50);
      animationTimerRef.current.push(outTimer);
    }, apexTime);

    // 2. Flight / Transition complete
    const finishTimer = setTimeout(() => {
      setIsTransitioning(false);
      setTransitionPhase('idle');
      setCurrentEffect('none');
    }, totalDuration);

    animationTimerRef.current.push(apexTimer, finishTimer);
  }, [activeTransition, speed, soundEnabled]);

  const previewTransition = useCallback((type?: TransitionType) => {
    startTransition(undefined, type || activeTransition);
  }, [startTransition, activeTransition]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  return (
    <PageTransitionContext.Provider
      value={{
        activeTransition,
        setActiveTransition,
        speed,
        setSpeed,
        soundEnabled,
        setSoundEnabled,
        isTransitioning,
        transitionPhase,
        currentEffect,
        isSettingsModalOpen,
        setIsSettingsModalOpen,
        startTransition,
        previewTransition,
      }}
    >
      {children}
    </PageTransitionContext.Provider>
  );
};

export function usePageTransition() {
  const context = useContext(PageTransitionContext);
  if (!context) {
    throw new Error('usePageTransition must be used within a PageTransitionProvider');
  }
  return context;
}
