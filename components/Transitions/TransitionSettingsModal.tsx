import React from 'react';
import { 
  X, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Gauge, 
  CheckCircle2, 
  Play,
  Wand2
} from 'lucide-react';
import { 
  usePageTransition, 
  TRANSITIONS_LIST, 
  TransitionType, 
  TransitionSpeed 
} from '../../src/context/PageTransitionContext';

export const TransitionSettingsModal: React.FC = () => {
  const { 
    isSettingsModalOpen, 
    setIsSettingsModalOpen, 
    activeTransition, 
    setActiveTransition, 
    speed, 
    setSpeed, 
    soundEnabled, 
    setSoundEnabled,
    previewTransition,
    isTransitioning
  } = usePageTransition();

  if (!isSettingsModalOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[99990] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => setIsSettingsModalOpen(false)}
    >
      <div 
        className="relative w-full max-w-2xl bg-[#0e121b] border border-zinc-800 rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-[#131926]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-wide">
                  Estudio de Transiciones
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                  7 Efectos 3D
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Tu propia pantalla con tus colores forma el cuerpo de la animación al cambiar de página.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(false)}
            className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Ajustes Globales (Velocidad y Sonido) */}
        <div className="px-5 py-3 bg-[#151c2c] border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Selector de Velocidad */}
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-blue-400" />
            <span className="text-slate-300 font-bold">Velocidad:</span>
            <div className="flex bg-black/60 p-1 rounded-xl border border-slate-800 gap-1">
              {(['fast', 'normal', 'slow'] as TransitionSpeed[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    speed === s
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s === 'fast' ? '⚡ Rápido' : s === 'normal' ? '🎯 Normal' : '🎬 Suave'}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle de Sonido Web Audio */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/25'
                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Activar o desactivar sonido sintetizado en las transiciones"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Sonido Activado</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-500" />
                <span>Silenciado</span>
              </>
            )}
          </button>
        </div>

        {/* Grid de Transiciones Disponibles */}
        <div className="p-5 overflow-y-auto space-y-2.5 custom-scrollbar">
          {TRANSITIONS_LIST.map((item) => {
            const isActive = activeTransition === item.id;
            return (
              <div 
                key={item.id}
                className={`p-3.5 rounded-2xl transition-all border flex items-center justify-between gap-3 ${
                  isActive 
                    ? 'bg-blue-600/15 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]' 
                    : 'bg-[#111724]/70 hover:bg-[#151d2e] border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="text-3xl p-2.5 rounded-2xl bg-[#090d15] border border-slate-800 shrink-0 shadow-inner">
                    {item.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white">
                        {item.name}
                      </h4>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-800 text-blue-300 border border-blue-500/20">
                        {item.badge}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Activa
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 shrink-0">
                  {item.id !== 'none' && (
                    <button
                      type="button"
                      disabled={isTransitioning}
                      onClick={() => previewTransition(item.id)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
                      title="Probar esta animación con tu pantalla actual ahora"
                    >
                      <Play className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
                      <span>Probar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTransition(item.id)}
                    className={`px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.35)]'
                        : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'
                    }`}
                  >
                    {isActive ? 'Seleccionada' : 'Elegir'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer del Modal */}
        <div className="px-5 py-3.5 bg-[#131926] border-t border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Guarda automáticamente en tu navegador.</span>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(false)}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs tracking-wider transition-all shadow-[0_4px_15px_rgba(37,99,235,0.35)] cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
