import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  BellRing, 
  Heart, 
  MessageSquareHeart, 
  Users, 
  Star, 
  Check, 
  X, 
  Sparkles, 
  Loader2
} from 'lucide-react';
import { 
  StudentNotificationPreferences, 
  getStudentNotificationPreferences, 
  saveStudentNotificationPreferences, 
  removeStudentNotificationSubscription 
} from '@/src/lib/students';

interface StudentNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  studentAvatar?: string | null;
  userUid: string;
  onSubscriptionChange?: (isSubscribed: boolean) => void;
}

export default function StudentNotificationModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  studentAvatar,
  userUid,
  onSubscriptionChange
}: StudentNotificationModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successSaved, setSuccessSaved] = useState(false);

  const [preferences, setPreferences] = useState<StudentNotificationPreferences>({
    notify_crush: true,
    notify_love_message: true,
    notify_known: true,
    notify_fan: true
  });

  // Cargar estado inicial de la suscripción
  useEffect(() => {
    if (!isOpen || !studentId || !userUid) return;

    let isMounted = true;
    setLoading(true);
    setSuccessSaved(false);

    getStudentNotificationPreferences(studentId, userUid)
      .then((prefs) => {
        if (isMounted) {
          if (prefs) {
            setPreferences(prefs);
          } else {
            // Predeterminado todo activo si es la primera vez que abre
            setPreferences({
              notify_crush: true,
              notify_love_message: true,
              notify_known: true,
              notify_fan: true
            });
          }
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, studentId, userUid]);

  if (!isOpen) return null;

  const hasAnyActive = Object.values(preferences).some(Boolean);

  const handleToggle = (key: keyof StudentNotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!hasAnyActive) {
        await removeStudentNotificationSubscription(studentId, userUid);
        if (onSubscriptionChange) onSubscriptionChange(false);
      } else {
        await saveStudentNotificationPreferences(studentId, userUid, preferences);
        if (onSubscriptionChange) onSubscriptionChange(true);
      }

      setSuccessSaved(true);
      setTimeout(() => {
        setSuccessSaved(false);
        onClose();
      }, 1000);
    } catch (e) {
      console.error('Error guardando preferencias:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDisableAll = async () => {
    setSaving(true);
    try {
      setPreferences({
        notify_crush: false,
        notify_love_message: false,
        notify_known: false,
        notify_fan: false
      });
      await removeStudentNotificationSubscription(studentId, userUid);
      if (onSubscriptionChange) onSubscriptionChange(false);
      setSuccessSaved(true);
      setTimeout(() => {
        setSuccessSaved(false);
        onClose();
      }, 800);
    } catch (e) {
      console.error('Error desactivando suscripción:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-[#0e0e0e] border border-amber-500/30 rounded-3xl p-6 sm:p-7 space-y-6 shadow-[0_25px_80px_rgba(0,0,0,0.95)] animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 transition-colors cursor-pointer border border-zinc-800"
          title="Cerrar ventana"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Encabezado con Avatar y Título */}
        <div className="flex items-center gap-4 pr-8">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-zinc-900 border border-amber-500/30 flex items-center justify-center flex-shrink-0 shadow-lg">
              {studentAvatar ? (
                <img src={studentAvatar} alt={studentName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-black text-[#eab308]">
                  {studentName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 bg-amber-500 rounded-full text-black">
              <BellRing className="w-3 h-3 stroke-[2.5]" />
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-[#eab308] border border-amber-500/30">
                Suscripción de Actividad
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white leading-tight line-clamp-1">
              {studentName}
            </h3>
            <p className="text-xs text-zinc-400">
              Elige qué avisos deseas recibir sobre este perfil.
            </p>
          </div>
        </div>

        {/* Listado de Interruptores / Toggles */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#eab308]" />
            <span className="text-xs">Cargando tus preferencias...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Opción 1: Flechazos / Crushes */}
            <div 
              onClick={() => handleToggle('notify_crush')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-start justify-between gap-3 ${
                preferences.notify_crush 
                  ? 'bg-pink-500/10 border-pink-500/40 shadow-[0_0_20px_rgba(236,72,153,0.15)]' 
                  : 'bg-[#141414] border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  preferences.notify_crush ? 'bg-pink-500/20 text-pink-400' : 'bg-zinc-900 text-zinc-500'
                }`}>
                  <Heart className={`w-5 h-5 ${preferences.notify_crush ? 'fill-pink-500 text-pink-500' : ''}`} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Flechazos y Crushes
                    </h4>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 font-semibold">
                      💘 Sonido Romance
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Notificarme cuando este estudiante reciba un nuevo flechazo o cuando el contador de crushes cambie.
                  </p>
                </div>
              </div>

              <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center flex-shrink-0 p-0.5 cursor-pointer ${
                preferences.notify_crush ? 'bg-pink-500' : 'bg-zinc-800'
              }`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  preferences.notify_crush ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>

            {/* Opción 2: Mensajes de Amor */}
            <div 
              onClick={() => handleToggle('notify_love_message')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-start justify-between gap-3 ${
                preferences.notify_love_message 
                  ? 'bg-rose-500/10 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.15)]' 
                  : 'bg-[#141414] border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  preferences.notify_love_message ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-900 text-zinc-500'
                }`}>
                  <MessageSquareHeart className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Mensajes de Amor
                    </h4>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-semibold">
                      💌 Confesiones
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Notificarme en tiempo real cuando alguien publique una carta, confesión o mensaje de amor en su perfil.
                  </p>
                </div>
              </div>

              <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center flex-shrink-0 p-0.5 cursor-pointer ${
                preferences.notify_love_message ? 'bg-rose-500' : 'bg-zinc-800'
              }`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  preferences.notify_love_message ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>

            {/* Opción 3: Yo te conozco */}
            <div 
              onClick={() => handleToggle('notify_known')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-start justify-between gap-3 ${
                preferences.notify_known 
                  ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.15)]' 
                  : 'bg-[#141414] border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  preferences.notify_known ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-900 text-zinc-500'
                }`}>
                  <Users className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    "Yo te conozco"
                  </h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Avisarme cuando otros estudiantes del campus confirmen que conocen a este estudiante.
                  </p>
                </div>
              </div>

              <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center flex-shrink-0 p-0.5 cursor-pointer ${
                preferences.notify_known ? 'bg-blue-500' : 'bg-zinc-800'
              }`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  preferences.notify_known ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>

            {/* Opción 4: Fans */}
            <div 
              onClick={() => handleToggle('notify_fan')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-start justify-between gap-3 ${
                preferences.notify_fan 
                  ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(234,179,8,0.15)]' 
                  : 'bg-[#141414] border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  preferences.notify_fan ? 'bg-amber-500/20 text-[#eab308]' : 'bg-zinc-900 text-zinc-500'
                }`}>
                  <Star className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Comunidad de Fans
                  </h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Avisarme cuando sume nuevos fans o haya cambios en su club de seguidores.
                  </p>
                </div>
              </div>

              <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center flex-shrink-0 p-0.5 cursor-pointer ${
                preferences.notify_fan ? 'bg-[#eab308]' : 'bg-zinc-800'
              }`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  preferences.notify_fan ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="space-y-2 pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSave}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(234,179,8,0.35)] transition-all cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Guardando cambios...</span>
              </>
            ) : successSaved ? (
              <>
                <Check className="w-4 h-4 text-black stroke-[3]" />
                <span>¡Preferencias Guardadas!</span>
              </>
            ) : (
              <>
                <BellRing className="w-4 h-4 text-black stroke-[2.5]" />
                <span>Guardar Suscripción</span>
              </>
            )}
          </button>

          {hasAnyActive && (
            <button
              type="button"
              disabled={saving || loading}
              onClick={handleDisableAll}
              className="w-full py-2.5 px-4 rounded-xl text-zinc-400 hover:text-rose-400 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer text-center"
            >
              Desactivar todas las alertas de este estudiante
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
