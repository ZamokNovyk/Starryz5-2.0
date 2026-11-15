import React from 'react';
import { X, Sparkles, UserCheck, Image as ImageIcon, Award, TrendingUp, Info } from 'lucide-react';

interface UserPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayName?: string | null;
  totalPoints: number;
  profilePoints: number;
  pubPoints: number;
  isOwnProfile?: boolean;
}

export default function UserPointsModal({
  isOpen,
  onClose,
  displayName,
  totalPoints = 0,
  profilePoints = 0,
  pubPoints = 0,
  isOwnProfile = true,
}: UserPointsModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-[#0a0a0d] border border-amber-500/25 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(0,0,0,0.9)] space-y-5 animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow de fondo decorativo */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Encabezado */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(234,179,8,0.2)]">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight flex items-center gap-1.5">
                {isOwnProfile ? 'Mis Puntos Acumulados' : `Puntos de ${displayName || 'Usuario'}`}
              </h3>
              <p className="text-[11px] text-zinc-400 font-medium">
                Desglose oficial de reputación en Starryz 5
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hero Card: Total de Puntos */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/15 via-yellow-600/10 to-zinc-950 border border-amber-400/40 p-5 text-center shadow-inner">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-amber-400 mb-1">
            <Sparkles className="w-3.5 h-3.5 fill-amber-400" />
            <span>Puntos Totales</span>
          </div>

          <div className="text-4xl sm:text-5xl font-black text-white tracking-tight my-1 drop-shadow-[0_0_20px_rgba(234,179,8,0.3)]">
            {totalPoints.toLocaleString()}
            <span className="text-base sm:text-lg font-bold text-amber-400 ml-1.5">pts</span>
          </div>

          <p className="text-[11px] text-zinc-400 max-w-[280px] mx-auto mt-2 leading-relaxed">
            Suma global de la reputación que has obtenido por interacción de otros usuarios en Starryz.
          </p>
        </div>

        {/* Desglose en 2 tarjetas: Perfil vs Publicaciones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          {/* Puntos por Perfil */}
          <div className="rounded-2xl bg-[#0f0f14] border border-zinc-800/90 p-4 space-y-2 hover:border-sky-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
              <span className="text-lg font-black text-white">
                {profilePoints.toLocaleString()} <span className="text-xs font-semibold text-sky-400">pts</span>
              </span>
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Por Perfil
              </h4>
              <p className="text-[10px] text-zinc-400 leading-snug mt-1">
                Puntos ganados por votos y calificaciones de estrellas recibidas directamente en tu perfil.
              </p>
            </div>
          </div>

          {/* Puntos por Publicaciones */}
          <div className="rounded-2xl bg-[#0f0f14] border border-zinc-800/90 p-4 space-y-2 hover:border-pink-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                <ImageIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-lg font-black text-white">
                {pubPoints.toLocaleString()} <span className="text-xs font-semibold text-pink-400">pts</span>
              </span>
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Por Publicaciones
              </h4>
              <p className="text-[10px] text-zinc-400 leading-snug mt-1">
                Puntos obtenidos por estrellas y reacciones de la comunidad en tus fotos y publicaciones.
              </p>
            </div>
          </div>

        </div>

        {/* Nota informativa de ayuda */}
        <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/60 p-3 flex items-start gap-2.5 text-[11px] text-zinc-400 leading-relaxed">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <span>
            Cada estrella nueva que recibes de otros estudiantes en tu perfil o publicaciones suma puntos a tu cuenta de forma acumulativa y permanente.
          </span>
        </div>

        {/* Botón de acción */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] cursor-pointer"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

