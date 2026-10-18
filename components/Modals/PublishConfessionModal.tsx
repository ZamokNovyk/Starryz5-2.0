'use client';

import React, { useState } from 'react';
import { X, Send, Building2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { createCenterConfession, CardStyle } from '@/src/lib/confessions';
import { promptNotificationOnAction } from '@/src/lib/notificationHelper';

interface PublishConfessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  institutionId: string;
  institutionName: string;
  onSuccess: () => void;
}

export default function PublishConfessionModal({
  isOpen,
  onClose,
  institutionId,
  institutionName,
  onSuccess,
}: PublishConfessionModalProps) {
  const { user, loginAnonymously } = useAuth();
  const [category, setCategory] = useState<'crush' | 'professors' | 'exams' | 'anecdotes'>('crush');
  const [content, setContent] = useState('');
  const [cardStyle, setCardStyle] = useState<CardStyle>('dark');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError('Por favor, escribe tu confesión antes de publicar.');
      return;
    }

    try {
      setSubmitting(true);
      
      let currentUser = user;
      if (!currentUser?.uid) {
        try {
          currentUser = await loginAnonymously();
        } catch (anonErr) {
          console.warn('Error al iniciar sesión anónima:', anonErr);
        }
      }
      
      let authorName = currentUser 
        ? (currentUser.displayName || currentUser.email?.split('@')[0] || '') 
        : '';

      if (currentUser?.uid) {
        try {
          const { data: dbU } = await supabase
            .from('users')
            .select('username, display_name')
            .eq('firebase_uid', currentUser.uid)
            .maybeSingle();

          if (dbU) {
            const picked = (dbU.username || dbU.display_name || '').trim();
            if (picked && picked.toLowerCase() !== 'anónimo' && picked.toLowerCase() !== 'usuario anónimo') {
              authorName = picked;
            }
          }
        } catch (dbErr) {
          // Ignorar
        }
      }

      if (!authorName) {
        authorName = currentUser?.uid ? `user_${currentUser.uid.substring(0, 5)}` : 'Anónimo';
      }

      await createCenterConfession({
        center_id: institutionId,
        firebase_uid: currentUser?.uid || null,
        author_name: authorName,
        content: trimmedContent,
        category,
        card_style: cardStyle,
        is_anonymous: true,
      });

      setSuccess(true);
      promptNotificationOnAction('confession');
      setTimeout(() => {
        setSuccess(false);
        setContent('');
        setCardStyle('dark');
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Error al publicar confesión:', err);
      setError(err?.message || 'Error al conectar con la base de datos.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-[#0d0d0d] border border-zinc-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-[0_25px_70px_rgba(0,0,0,0.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 transition-colors cursor-pointer border border-zinc-800/80"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#eab308]/15 border border-[#eab308]/30 flex items-center justify-center text-[#eab308] shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Publicar Confesión</h2>
            <p className="text-xs text-zinc-400 font-medium">
              {institutionName} • <span className="text-[#eab308]">Muro Público</span>
            </p>
          </div>
        </div>

        {success ? (
          <div className="py-10 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-white">¡Confesión Publicada!</h3>
            <p className="text-xs text-zinc-400">Ya está visible en el muro para todos los estudiantes.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-400 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Categoría */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">Categoría</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-[#141414] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#eab308] transition-colors appearance-none cursor-pointer"
                >
                  <option value="crush">❤️ Crush / Amor</option>
                  <option value="professors">👨‍🏫 Profesores</option>
                  <option value="exams">📝 Exámenes</option>
                  <option value="anecdotes">🔥 Anécdotas</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Tu Confesión */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300">
                  Tu Confesión <span className="text-[#eab308]">*</span>
                </label>
                <span className={`text-[11px] font-semibold ${content.length >= 480 ? 'text-amber-400' : 'text-zinc-500'}`}>
                  {content.length}/500
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 500))}
                maxLength={500}
                rows={4}
                placeholder="Escribe aquí tu secreto, confesión o anécdota sin miedo (máx. 500 caracteres)..."
                className="w-full bg-[#141414] border border-zinc-800 rounded-xl p-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#eab308] transition-colors resize-none leading-relaxed"
                required
              />
            </div>

            {/* Estilo de Tarjeta */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-zinc-300">Estilo de Tarjeta</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCardStyle('dark')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    cardStyle === 'dark'
                      ? 'bg-zinc-800/80 border-[#eab308] text-white shadow-[0_0_15px_rgba(234,179,8,0.15)]'
                      : 'bg-[#141414] border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${cardStyle === 'dark' ? 'bg-[#eab308]' : 'bg-zinc-600'}`} />
                  <span>Estándar Oscuro</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCardStyle('pink')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    cardStyle === 'pink'
                      ? 'bg-pink-950/40 border-pink-500 text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.2)]'
                      : 'bg-[#141414] border-zinc-800 text-zinc-400 hover:text-pink-300 hover:border-pink-500/40'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${cardStyle === 'pink' ? 'bg-pink-500' : 'bg-zinc-600'}`} />
                  <span className="text-pink-400">Crush (Rosa)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCardStyle('fire')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    cardStyle === 'fire'
                      ? 'bg-amber-950/40 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                      : 'bg-[#141414] border-zinc-800 text-zinc-400 hover:text-amber-300 hover:border-amber-500/40'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${cardStyle === 'fire' ? 'bg-amber-500' : 'bg-zinc-600'}`} />
                  <span className="text-amber-400">Picante (Fuego)</span>
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-3 py-3.5 px-4 bg-[#eab308] hover:bg-[#ca8a04] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_4px_20px_rgba(234,179,8,0.3)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 fill-current" />
                  <span>PUBLICAR EN EL MURO</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
