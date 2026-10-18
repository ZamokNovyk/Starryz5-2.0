import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Sparkles, X, CheckCircle2, Shield } from 'lucide-react';
import { useFCMNotifications } from '@/hooks/useFCMNotifications';
import { NotificationPromptEventDetail } from '@/src/lib/notificationHelper';

export default function ActionNotificationPromptModal() {
  const { requestPermission } = useFCMNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [promptInfo, setPromptInfo] = useState<NotificationPromptEventDetail | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [activatedSuccess, setActivatedSuccess] = useState(false);

  useEffect(() => {
    const handleShowPrompt = (e: CustomEvent<NotificationPromptEventDetail>) => {
      setPromptInfo(e.detail);
      setIsOpen(true);
    };

    window.addEventListener('starryz_show_notification_prompt' as any, handleShowPrompt);
    return () => {
      window.removeEventListener('starryz_show_notification_prompt' as any, handleShowPrompt);
    };
  }, []);

  if (!isOpen || !promptInfo) return null;

  const handleAccept = async () => {
    try {
      setIsActivating(true);
      const granted = await requestPermission();
      if (granted) {
        setActivatedSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setActivatedSuccess(false);
        }, 1500);
      } else {
        // Usuario cerró o rechazó el diálogo nativo
        localStorage.setItem('starryz_notif_prompt_dismissed', 'true');
        setIsOpen(false);
      }
    } catch (e) {
      console.warn('Error al activar notificaciones:', e);
      setIsOpen(false);
    } finally {
      setIsActivating(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('starryz_notif_prompt_dismissed', 'true');
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#0d0d0d] border border-amber-500/30 rounded-3xl p-6 sm:p-7 space-y-5 shadow-[0_25px_70px_rgba(0,0,0,0.95)] text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          onClick={handleDismiss}
          type="button"
          className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 transition-colors cursor-pointer border border-zinc-800"
          title="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icono animado */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#eab308] shadow-[0_0_25px_rgba(234,179,8,0.2)]">
          {activatedSuccess ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-in zoom-in duration-300" />
          ) : (
            <BellRing className="w-8 h-8 text-[#eab308] animate-bounce" />
          )}
        </div>

        {/* Textos */}
        <div className="space-y-2">
          <h3 className="text-lg font-black text-white uppercase tracking-tight">
            {activatedSuccess ? '¡Notificaciones Activadas! 🎉' : promptInfo.title}
          </h3>
          <p className="text-xs text-zinc-300 leading-relaxed px-2">
            {activatedSuccess
              ? 'A partir de ahora recibirás alertas instantáneas y chismes en vivo cada vez que interactúen con tus posts.'
              : promptInfo.description}
          </p>
        </div>

        {/* Ventajas destacadas */}
        {!activatedSuccess && (
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#ffffff0a] text-left space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-zinc-300">
              <Sparkles className="w-3.5 h-3.5 text-[#eab308] flex-shrink-0" />
              <span>Enterarte cuando respondan a tus confesiones</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-300">
              <Bell className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>Avisos en vivo dentro y fuera de la web</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-300">
              <Shield className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>100% anónimo y seguro</span>
            </div>
          </div>
        )}

        {/* Acciones */}
        {!activatedSuccess && (
          <div className="space-y-2 pt-2">
            <button
              type="button"
              disabled={isActivating}
              onClick={handleAccept}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(234,179,8,0.35)] transition-all cursor-pointer active:scale-98"
            >
              <BellRing className="w-4 h-4 text-black stroke-[2.5]" />
              <span>{isActivating ? 'ACTIVANDO...' : 'ACTIVAR NOTIFICACIONES'}</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2.5 px-4 rounded-xl text-zinc-400 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Quizás más tarde
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
