'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  CreditCard,
  UserCheck,
  Lock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { Student, claimStudentProfile } from '@/src/lib/students';
import { supabase } from '@/src/lib/supabase';

interface ClaimProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  onSuccess: (updatedStudent: Student) => void;
}

export default function ClaimProfileModal({
  isOpen,
  onClose,
  student,
  onSuccess,
}: ClaimProfileModalProps) {
  const { user, loginWithGoogle, refreshUserProfile } = useAuth();
  const [userDni, setUserDni] = useState<string | null>(null);
  const [loadingDni, setLoadingDni] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkUserDni() {
      if (!isOpen) return;
      setError(student.is_claimed ? 'Este perfil ya se encuentra reclamado y verificado.' : null);
      setSuccess(null);

      if (!user || user.isAnonymous || !user.email) {
        setUserDni(null);
        return;
      }

      setLoadingDni(true);
      try {
        const { data } = await supabase
          .from('users')
          .select('dni, claimed_student_id, is_verified_student, profile_appeal')
          .eq('email', user.email)
          .maybeSingle();

        if (isMounted) {
          if (data?.dni) {
            setUserDni(data.dni);
          } else {
            setUserDni(null);
          }

          const hasAlreadyClaimed = Boolean(
            data?.profile_appeal || 
            data?.claimed_student_id || 
            data?.is_verified_student || 
            user?.profile_appeal || 
            user?.claimed_student_id
          );

          if (hasAlreadyClaimed && data?.claimed_student_id !== student.id) {
            setError('Ya has reclamado un perfil oficial de estudiante anteriormente. Cada usuario solo puede tener un único perfil reclamado.');
          }
        }
      } catch (err) {
        console.warn('Aviso comprobando DNI de usuario en Supabase:', err);
      } finally {
        if (isMounted) setLoadingDni(false);
      }
    }

    checkUserDni();

    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.email, student.id, student.is_claimed]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setAuthLoading(true);
      setError(null);
      await loginWithGoogle();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return;
      setError('No se pudo iniciar sesión con Google. Intenta nuevamente.');
    } finally {
      setAuthLoading(false);
    }
  };

  const isGoogleLinked = Boolean(user && !user.isAnonymous && user.email);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || user.isAnonymous || !user.email) {
      setError('Solo los usuarios con una cuenta vinculada a Google pueden reclamar un perfil.');
      return;
    }

    if (!userDni || userDni.trim().length !== 8) {
      setError('Debes ingresar tu DNI oficial de 8 dígitos en tu perfil antes de reclamar.');
      return;
    }

    try {
      setLoading(true);
      const res = await claimStudentProfile(student.id, userDni, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });

      setSuccess(res.message);
      
      try {
        if (refreshUserProfile) {
          await refreshUserProfile();
        }
      } catch (e) {}

      setTimeout(() => {
        onSuccess(res.student);
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error('Error al reclamar perfil:', err);
      setError(err.message || 'No se pudo reclamar el perfil. Verifica la información.');
    } finally {
      setLoading(false);
    }
  };

  const goToProfile = () => {
    onClose();
    window.history.pushState(null, '', '/perfil');
    window.dispatchEvent(new Event('popstate'));
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div 
        className="w-full max-w-md bg-[#0e0e0e] border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow de fondo */}
        <div className="absolute top-0 right-0 w-52 h-52 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#eab308]/15 border border-[#eab308]/30 flex items-center justify-center text-[#eab308]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Reclamar Perfil
              </h3>
              <p className="text-xs text-zinc-400">
                Verificación de identidad oficial con DNI
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tarjeta del perfil que se va a reclamar */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3.5 relative z-10">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500/20 to-yellow-400/20 border border-amber-500/40 flex items-center justify-center text-[#eab308] font-black text-base flex-shrink-0">
            {student.nombre ? student.nombre.charAt(0) : 'E'}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-black text-white truncate">
              {student.nombre_completo || `${student.nombre} ${student.apellidos}`}
            </h4>
            <div className="flex items-center gap-2 text-xs text-zinc-400 pt-0.5">
              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-semibold text-[10px] uppercase">
                Estudiante
              </span>
              <span className="text-[11px] text-amber-400 font-bold">
                ★ {(student.score || 0).toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Mensajes de Alerta / Error */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Mensaje de Éxito */}
        {success && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-3 animate-in zoom-in-95 duration-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Contenido según estado del usuario */}
        {!success && (
          <>
            {!isGoogleLinked ? (
              /* PASO 1: VINCULAR GOOGLE SI NO ESTÁ AUTENTICADO */
              <div className="text-center py-2 space-y-4">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs text-left flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    {user?.isAnonymous
                      ? 'Estás en modo anónimo. Para reclamar y certificar que eres el dueño de este perfil estudiantil, es obligatorio iniciar sesión con Google.'
                      : 'Para reclamar y verificar tu identidad oficial en este perfil con tu DNI, primero debes iniciar sesión con tu cuenta de Google.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={authLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-black font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98"
                >
                  {authLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 text-black" />
                      <span>{user?.isAnonymous ? 'Vincular con Google' : 'Iniciar Sesión con Google'}</span>
                    </>
                  )}
                </button>
              </div>
            ) : loadingDni ? (
              /* CARGANDO COMPROBACIÓN DE DNI */
              <div className="py-6 flex flex-col items-center justify-center gap-3 text-zinc-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-[#eab308]" />
                <span>Verificando datos de tu cuenta...</span>
              </div>
            ) : !userDni ? (
              /* PASO 2: NO TIENE DNI REGISTRADO EN SU PERFIL */
              <div className="space-y-4 relative z-10">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-zinc-300 truncate">
                      Conectado como: <strong className="text-white">{user?.email}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                    Google
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-white text-sm">
                        DNI no registrado en tu perfil
                      </p>
                      <p className="text-zinc-300 leading-relaxed text-xs">
                        Para poder reclamar este perfil, la nueva normativa de seguridad requiere que primero registres tu número de DNI oficial en tu perfil de usuario.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={goToProfile}
                    className="w-full py-3 px-4 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
                  >
                    <CreditCard className="w-4 h-4 text-black" />
                    <span>Ir a mi perfil a registrar mi DNI</span>
                    <ArrowRight className="w-4 h-4 text-black" />
                  </button>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              /* PASO 3: TIENE DNI REGISTRADO -> RECLAMAR DIRECTO SIN INPUT */
              <form onSubmit={handleClaim} className="space-y-4 relative z-10">
                {/* Badge de cuenta Google vinculada */}
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-zinc-300 truncate">
                      Cuenta: <strong className="text-white">{user?.email}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                    Google
                  </span>
                </div>

                {/* Tarjeta del DNI registrado en la cuenta */}
                <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#eab308]" />
                      <span className="text-xs font-bold text-zinc-300">
                        DNI registrado en tu perfil
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                      Listo
                    </span>
                  </div>

                  <div className="text-2xl font-black font-mono text-center tracking-widest text-[#eab308] py-1 bg-black/40 rounded-xl border border-zinc-800/60">
                    {userDni}
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed text-center pt-1">
                    Al pulsar el botón <strong className="text-white">Reclamar Perfil</strong>, el sistema verificará automáticamente si tu DNI coincide con el del perfil institucional.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={loading || Boolean(error)}
                    className="px-5 py-2.5 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(234,179,8,0.35)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Verificando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-black stroke-[2.5]" />
                        <span>Reclamar Perfil</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

      </div>
    </div>
  );
}
