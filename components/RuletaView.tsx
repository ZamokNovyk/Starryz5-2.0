'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Trophy,
  Play,
  RotateCcw,
  Edit3,
  Shuffle,
  Trash2,
  Copy,
  Check,
  UserMinus,
  Disc,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';

interface RuletaViewProps {
  onBack: () => void;
  onNavigate?: (url: string) => void;
}

interface WinnerItem {
  name: string;
  time: string;
}

const COLOR_PALETTE = [
  '#6366F1', '#EC4899', '#10B981', '#F59E0B', 
  '#8B5CF6', '#06B6D4', '#F43F5E', '#3B82F6',
  '#84CC16', '#D946EF', '#14B8A6', '#F97316'
];

export default function RuletaView({ onBack }: RuletaViewProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(true);

  // Lists state
  const [names, setNames] = useState<string[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [winners, setWinners] = useState<WinnerItem[]>([]);
  
  // Controls state
  const [activeTab, setActiveTab] = useState<'input' | 'winners'>('input');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRemove, setAutoRemove] = useState(false);

  // Spinning state
  const [isSpinning, setIsSpinning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<React.ReactNode>(
    <span>Haz clic en <strong className="text-indigo-400">GIRAR</strong> o presiona <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300">Espacio</kbd></span>
  );

  // Winner Modal state
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [currentWinnerName, setCurrentWinnerName] = useState('');

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const currentAngleRef = useRef(0);
  const lastSegmentIndexRef = useRef(-1);
  const mainContainerRef = useRef<HTMLDivElement | null>(null);

  // Check Admin role
  useEffect(() => {
    async function checkRole() {
      if (!user) {
        setIsAdmin(false);
        setLoadingCheck(false);
        return;
      }
      try {
        let query = supabase.from('users').select('role');
        if (user.email) {
          query = query.eq('email', user.email);
        } else {
          query = query.eq('id', user.uid);
        }
        const { data, error } = await query.maybeSingle();
        if (!error && data && data.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error checking admin role in RuletaView:', err);
        setIsAdmin(false);
      } finally {
        setLoadingCheck(false);
      }
    }
    checkRole();
  }, [user]);

  // Start with empty names by default
  useEffect(() => {
    setRawText('');
    setNames([]);
  }, []);

  // Update canvas when names, rotation angle, or theme changes
  useEffect(() => {
    drawWheel();
  }, [names, theme]);

  // Handle keyboard events (Space key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
          return;
        }
        e.preventDefault();
        spinWheel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [names, isSpinning]);

  // Fullscreen event listener to keep state in sync
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playTickSound = () => {
    if (!soundEnabled) return;
    try {
      const actx = getAudioContext();
      if (!actx) return;

      const osc = actx.createOscillator();
      const gain = actx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, actx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, actx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.2, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(actx.destination);

      osc.start();
      osc.stop(actx.currentTime + 0.04);
    } catch (e) {
      console.warn('Audio Context Error:', e);
    }
  };

  const playWinSound = () => {
    if (!soundEnabled) return;
    try {
      const actx = getAudioContext();
      if (!actx) return;

      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, idx) => {
        const osc = actx.createOscillator();
        const gain = actx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, actx.currentTime + idx * 0.1);

        gain.gain.setValueAtTime(0.25, actx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + idx * 0.1 + 0.3);

        osc.connect(gain);
        gain.connect(actx.destination);

        osc.start(actx.currentTime + idx * 0.1);
        osc.stop(actx.currentTime + idx * 0.1 + 0.3);
      });
    } catch (e) {
      console.warn('Audio Context Error:', e);
    }
  };

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = width / 2 - 20;

    ctx.clearRect(0, 0, width, height);
    const isLight = typeof document !== 'undefined' && (document.body.classList.contains('light-theme') || document.documentElement.classList.contains('light-theme'));

    if (names.length === 0) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isLight ? '#f1f5f9' : '#1e293b';
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = isLight ? '#cbd5e1' : '#334155';
      ctx.stroke();

      ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
      ctx.font = "bold 30px 'Plus Jakarta Sans', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Ingresa nombres abajo', 0, 0);
      ctx.restore();
      return;
    }

    const arcSize = (2 * Math.PI) / names.length;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(currentAngleRef.current);

    for (let i = 0; i < names.length; i++) {
      const startAngle = i * arcSize;
      const endAngle = startAngle + arcSize;
      const color = COLOR_PALETTE[i % COLOR_PALETTE.length];

      // Slice sector
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Slice divider
      ctx.lineWidth = 3;
      ctx.strokeStyle = isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(15, 23, 42, 0.4)';
      ctx.stroke();

      // Text label
      ctx.save();
      ctx.rotate(startAngle + arcSize / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';

      let fontSize = Math.max(16, Math.min(32, 400 / names.length));
      ctx.font = `800 ${fontSize}px 'Plus Jakarta Sans', sans-serif`;

      let text = names[i];
      if (text.length > 18) {
        text = text.substring(0, 16) + '...';
      }

      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(text, radius - 35, 0);
      ctx.restore();
    }

    // Outer ring border
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 12;
    ctx.strokeStyle = isLight ? '#94a3b8' : '#0F172A';
    ctx.stroke();

    ctx.restore();
  };

  const handleTextareaChange = (val: string) => {
    setRawText(val);
    const parsed = val
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0);
    setNames(parsed);
  };

  const loadDemoNames = () => {
    const demo = ['María López', 'Carlos Gómez', 'Ana Rodríguez', 'Juan Pérez', 'Lucía Fernández', 'Diego Torres', 'Sofia Morales'];
    setRawText(demo.join('\n'));
    setNames(demo);
  };

  const clearNamesList = () => {
    setRawText('');
    setNames([]);
  };

  const shuffleNamesList = () => {
    if (names.length <= 1) return;
    const shuffled = [...names];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setRawText(shuffled.join('\n'));
    setNames(shuffled);
  };

  const spinWheel = () => {
    if (isSpinning) return;
    if (names.length === 0) {
      alert('Por favor, ingresa al menos un nombre en la lista antes de girar.');
      return;
    }

    getAudioContext();
    setIsSpinning(true);
    setStatusMsg(
      <span className="text-amber-400 font-bold animate-pulse">
        <Disc className="inline-block w-4 h-4 mr-1.5 animate-spin" />
        Girando ruleta...
      </span>
    );

    const minSpins = 5;
    const maxSpins = 8;
    const totalRotation = (minSpins + Math.random() * (maxSpins - minSpins)) * 2 * Math.PI;

    const startAngle = currentAngleRef.current;
    const targetAngle = startAngle + totalRotation;
    const duration = 4500 + Math.random() * 1000;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeOut = 1 - Math.pow(1 - progress, 3);
      currentAngleRef.current = startAngle + (targetAngle - startAngle) * easeOut;

      drawWheel();

      // Top indicator calculation
      const arcSize = (2 * Math.PI) / names.length;
      const normalizedAngle = ((currentAngleRef.current % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
      const pointerAngle = ((1.5 * Math.PI - normalizedAngle) + (2 * Math.PI)) % (2 * Math.PI);
      const currentSegment = Math.floor(pointerAngle / arcSize) % names.length;

      if (currentSegment !== lastSegmentIndexRef.current) {
        playTickSound();
        lastSegmentIndexRef.current = currentSegment;

        // Visual pointer kick
        const pointer = document.getElementById('tickerPointerSvg');
        if (pointer) {
          pointer.style.transform = 'rotate(-15deg)';
          setTimeout(() => {
            pointer.style.transform = 'rotate(0deg)';
          }, 60);
        }
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        setStatusMsg(
          <span>Haz clic en <strong className="text-indigo-400">GIRAR</strong> o presiona <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300">Espacio</kbd></span>
        );

        const winner = names[currentSegment];
        handleWinnerSelected(winner);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const handleWinnerSelected = (winner: string) => {
    // Add to history list
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setWinners(prev => [{ name: winner, time: timestamp }, ...prev]);

    // Sound and burst
    playWinSound();
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });

    setCurrentWinnerName(winner);

    if (autoRemove) {
      setTimeout(() => {
        removeWinnerByName(winner);
      }, 1200);
    } else {
      setWinnerModalOpen(true);
    }
  };

  const removeWinnerByName = (winner: string) => {
    setNames(prev => {
      const next = prev.filter(n => n !== winner);
      setRawText(next.join('\n'));
      return next;
    });
  };

  const removeWinnerAndClose = () => {
    removeWinnerByName(currentWinnerName);
    setWinnerModalOpen(false);
  };

  const keepWinnerAndClose = () => {
    setWinnerModalOpen(false);
  };

  const clearWinnersList = () => {
    setWinners([]);
  };

  const copyWinnersToClipboard = () => {
    if (winners.length === 0) return;
    const text = winners.map((w, idx) => `${winners.length - idx}. ${w.name} (${w.time})`).join('\n');
    navigator.clipboard.writeText(text)
      .then(() => alert('¡Lista de ganadores copiada al portapapeles!'))
      .catch(err => console.error('Error copying text:', err));
  };

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
  };

  const toggleFullscreen = () => {
    const container = mainContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  if (loadingCheck) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-32 text-center space-y-6 px-4">
        <div className="text-rose-500 font-black text-2xl uppercase tracking-wider">Acceso Restringido</div>
        <p className="text-zinc-400 text-xs leading-relaxed">
          Esta herramienta está disponible únicamente para administradores de Starryz 5.
        </p>
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer"
        >
          Volver a Herramientas
        </button>
      </div>
    );
  }

  return (
    <div ref={mainContainerRef} className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-[#6366F1] selection:text-white">
      
      {/* Top Header */}
      <header className="bg-[#0e1318]/90 backdrop-blur-md border-b border-zinc-800/80 sticky top-0 z-40 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-indigo-500/60 transition-colors cursor-pointer"
              title="Volver a Herramientas"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">
              <Disc className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight tracking-tight text-white flex items-center gap-2">
                Ruleta de Nombres <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/30 font-extrabold">Sorteo</span>
              </h1>
              <p className="text-[11px] text-zinc-400 hidden sm:block">Sorteos y selecciones aleatorias en vivo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleSound}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition shadow-sm border border-zinc-800 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title={soundEnabled ? 'Desactivar sonido' : 'Activar sonido'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-indigo-400 animate-bounce" />
                  <span className="hidden sm:inline">Sonido</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-zinc-500" />
                  <span className="hidden sm:inline">Silenciado</span>
                </>
              )}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition shadow-sm border border-zinc-800 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Pantalla Completa"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">Pantalla</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 items-center">
        
        {/* TOP PANEL: ROULETTE CANVAS & CONTROLS */}
        <section className="w-full flex flex-col items-center justify-center bg-[#0c0d10] border border-zinc-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          
          {/* Wheel Outer Container */}
          <div className="relative w-full max-w-[360px] sm:max-w-[400px] aspect-square flex items-center justify-center">
            
            {/* Pointer / Arrow Indicator (12 o'clock position) */}
            <div id="tickerPointer" className="absolute -top-3 z-20 left-1/2 -translate-x-1/2 filter drop-shadow-[0_8px_6px_rgba(0,0,0,0.6)] transition-transform duration-75 origin-bottom">
              <svg id="tickerPointerSvg" width="44" height="50" viewBox="0 0 46 54" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform duration-75 origin-bottom">
                <path d="M23 54L0 6L11.5 0L23 12L34.5 0L46 6L23 54Z" fill="#EF4444"/>
                <path d="M23 42L7 8L15 4L23 14L31 4L39 8L23 42Z" fill="#F87171"/>
              </svg>
            </div>

            {/* Glow Background Effect */}
            <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-3xl -z-10 animate-pulse"></div>

            {/* Canvas Element */}
            <canvas
              ref={canvasRef}
              width={800}
              height={800}
              onClick={spinWheel}
              className="w-full h-full cursor-pointer transition-all duration-300 transform rounded-full shadow-2xl bg-slate-900/40"
            ></canvas>

            {/* Center Knob / Spin Trigger Button */}
            <button 
              onClick={spinWheel} 
              disabled={isSpinning}
              className="absolute z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white font-black text-xs sm:text-sm shadow-[0_0_25px_rgba(99,102,241,0.6)] border-4 border-[#09090b] flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-all group disabled:opacity-50 cursor-pointer"
            >
              <span className="tracking-wider uppercase group-hover:hidden">¡GIRAR!</span>
              <Play className="w-6 h-6 hidden group-hover:block ml-1" />
              <span className="text-[9px] text-indigo-200 font-semibold mt-0.5 group-hover:hidden">Sorteo</span>
            </button>
          </div>

          {/* Spin Controls Bar */}
          <div className="mt-6 w-full max-w-sm flex items-center justify-between gap-4">
            <button 
              onClick={spinWheel} 
              disabled={isSpinning}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-500/20 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-5 h-5" />
              <span>¡GIRAR RULETA!</span>
            </button>
          </div>

          {/* Status Indicator Message */}
          <p className="mt-3 text-[11px] font-semibold text-zinc-400 text-center">
            {statusMsg}
          </p>

        </section>

        {/* BOTTOM PANEL: WHITE WINDOW (Ventana Blanca de Nombres) */}
        <section className="w-full bg-white text-slate-800 rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden min-h-[400px]">
          
          {/* Panel Header */}
          <div className="bg-slate-100 border-b border-slate-200 p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-rose-400 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block"></span>
              <h2 className="ml-2 text-xs font-black text-slate-700 uppercase tracking-widest">Lista de Participantes</h2>
            </div>
            <span className="bg-indigo-100 text-indigo-700 text-[11px] font-extrabold px-3.5 py-1 rounded-full border border-indigo-200">
              {names.length} Nombre{names.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Tab Buttons */}
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
            <button
              onClick={() => setActiveTab('input')}
              className={`flex-1 py-3 px-4 transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'input'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white font-extrabold'
                  : 'hover:text-slate-800'
              }`}
            >
              <Edit3 className="w-4 h-4 text-indigo-500" />
              <span>Editar Lista</span>
            </button>
            <button
              onClick={() => setActiveTab('winners')}
              className={`flex-1 py-3 px-4 transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'winners'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white font-extrabold'
                  : 'hover:text-slate-800'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Ganadores</span>
              {winners.length > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {winners.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: INPUT LIST */}
          {activeTab === 'input' && (
            <div className="flex-1 p-5 flex flex-col justify-between gap-4">
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-slate-600 mb-2 flex justify-between items-center">
                  <span>Escribe un nombre por línea:</span>
                  <span className="text-[11px] text-slate-400 font-normal">Se actualiza automáticamente</span>
                </label>
                <textarea 
                  value={rawText}
                  onChange={(e) => handleTextareaChange(e.target.value)}
                  className="w-full h-44 p-3.5 bg-slate-50 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none text-slate-800 text-sm font-medium resize-y focus:bg-white transition leading-relaxed shadow-inner"
                  placeholder="Ejemplo:&#10;María López&#10;Carlos Gómez&#10;Ana Rodríguez&#10;Juan Pérez&#10;Lucía Fernández"
                  spellcheck="false"
                ></textarea>
              </div>

              {/* Settings Options */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs text-slate-700">
                <label className="font-semibold cursor-pointer flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={autoRemove}
                    onChange={(e) => setAutoRemove(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-0 accent-indigo-600"
                  />
                  <span>Eliminar ganador automáticamente al salir en la ruleta</span>
                </label>
              </div>

              {/* Quick Presets & Utility Buttons */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={shuffleNamesList}
                  className="px-3 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  title="Mezclar Orden"
                >
                  <Shuffle className="w-4 h-4 text-indigo-600" />
                  <span>Mezclar</span>
                </button>
                <button
                  onClick={loadDemoNames}
                  className="px-3 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  title="Cargar Ejemplos"
                >
                  <Info className="w-4 h-4 text-amber-500" />
                  <span>Ejemplo</span>
                </button>
                <button
                  onClick={clearNamesList}
                  className="px-3 py-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  title="Borrar Todo"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Limpiar</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: WINNERS LIST */}
          {activeTab === 'winners' && (
            <div className="flex-1 p-5 flex flex-col justify-between gap-4">
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px] max-h-[300px]">
                {winners.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                    <Trophy className="w-10 h-10 mb-2 opacity-30 text-amber-500" />
                    <p className="text-xs font-semibold">Aún no hay ganadores registrados.</p>
                  </div>
                ) : (
                  winners.map((w, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl shadow-2xs">
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-extrabold text-xs flex items-center justify-center border border-amber-300 shrink-0">
                          {winners.length - idx}
                        </span>
                        <span className="font-bold text-slate-800 text-sm">{w.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium shrink-0">{w.time}</span>
                    </div>
                  ))
                )}
              </div>
              
              <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-xs font-bold">
                <button
                  onClick={clearWinnersList}
                  className="text-rose-600 hover:text-rose-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reiniciar historial</span>
                </button>
                <button
                  onClick={copyWinnersToClipboard}
                  disabled={winners.length === 0}
                  className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copiar lista</span>
                </button>
              </div>
            </div>
          )}
        </section>

      </main>

      {/* WINNER MODAL DIALOG */}
      {winnerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center relative overflow-hidden transform scale-100 transition-transform">
            
            {/* Confetti Glow Background */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>

            <div className="w-16 h-16 bg-gradient-to-tr from-amber-400 to-amber-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-amber-500/40 mb-4 animate-bounce">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            
            <p className="text-xs uppercase font-extrabold tracking-widest text-indigo-600 mb-1">¡Tenemos un Ganador!</p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 break-words mb-6 py-2 border-y border-slate-100">
              {currentWinnerName}
            </h3>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={removeWinnerAndClose}
                className="w-full py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider"
              >
                <UserMinus className="w-4 h-4" />
                <span>Eliminar de la ruleta</span>
              </button>
              <button
                onClick={keepWinnerAndClose}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider"
              >
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Conservar en la lista</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
