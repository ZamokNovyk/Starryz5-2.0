import React, { useState } from 'react';
import { X, Star, Check, Sparkles, Layers, UserCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { NosediveScore } from '@/components/NosediveScore';

interface ScoreDisplayModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentMode: 'profile' | 'combined';
  profileScore: number;
  profilePostsScore: number;
  pubScore: number;
  onModeSaved: (newMode: 'profile' | 'combined') => void;
}

export default function ScoreDisplayModeModal({
  isOpen,
  onClose,
  userId,
  currentMode = 'profile',
  profileScore,
  profilePostsScore,
  pubScore,
  onModeSaved,
}: ScoreDisplayModeModalProps) {
  const [selectedMode, setSelectedMode] = useState<'profile' | 'combined'>(currentMode || 'profile');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!userId) return;
    try {
      setSaving(true);
      setError(null);

      const { error: updateErr } = await supabase
        .from('users')
        .update({ score_display_mode: selectedMode })
        .eq('id', userId);

      if (updateErr) {
        throw updateErr;
      }

      onModeSaved(selectedMode);
      onClose();
    } catch (err: any) {
      console.error('Error guardando modo de calificación:', err);
      setError(err?.message || 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#0f0f13] border border-zinc-800/80 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón Cerrar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado */}
        <div className="space-y-2 pr-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Configuración de Reputación
          </div>
          <h3 className="text-xl font-black text-white tracking-tight">
            Calificación General Visible
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Elige qué puntuación verán todos los usuarios en la insignia principal debajo de tu foto de perfil.
          </p>
        </div>

        {/* Opciones */}
        <div className="space-y-3">
          {/* Opción 1: Solo Perfil */}
          <div
            onClick={() => setSelectedMode('profile')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 select-none ${
              selectedMode === 'profile'
                ? 'bg-amber-500/10 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              selectedMode === 'profile'
                ? 'border-amber-400 bg-amber-400 text-black'
                : 'border-zinc-600 bg-transparent'
            }`}>
              {selectedMode === 'profile' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-white flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  Solo mi Perfil
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/70 border border-amber-400/50 text-amber-400 text-xs font-bold">
                  ★ <NosediveScore score={profileScore} subClassName="text-[0.72em] font-semibold opacity-80 ml-0.5 text-amber-300" />
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Muestra exclusivamente los votos y estrellas que te han dejado otros usuarios en tu perfil.
              </p>
            </div>
          </div>

          {/* Opción 2: Perfil + Publicaciones */}
          <div
            onClick={() => setSelectedMode('combined')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 select-none ${
              selectedMode === 'combined'
                ? 'bg-amber-500/10 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              selectedMode === 'combined'
                ? 'border-amber-400 bg-amber-400 text-black'
                : 'border-zinc-600 bg-transparent'
            }`}>
              {selectedMode === 'combined' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-400" />
                  Perfil + Publicaciones
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/70 border border-amber-400/50 text-amber-400 text-xs font-bold">
                  ★ <NosediveScore score={profilePostsScore || profileScore} subClassName="text-[0.72em] font-semibold opacity-80 ml-0.5 text-amber-300" />
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Promedia en partes iguales tu perfil ({profileScore > 0 ? profileScore.toFixed(1) : '5.0'}) y todas tus publicaciones ({pubScore > 0 ? pubScore.toFixed(1) : '5.0'}) para una reputación global estilo Nosedive.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-center font-medium">
            {error}
          </p>
        )}

        {/* Acciones */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black tracking-wide shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Cambios'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

