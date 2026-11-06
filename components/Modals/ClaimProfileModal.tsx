'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Mail, 
  KeyRound, 
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { requestClaimOtp, verifyAndClaimProfile } from '@/src/lib/isppu';

interface ClaimProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Soporta tanto 'member' como 'student' para retrocompatibilidad
  member?: {
    id: string;
    nombre_completo?: string;
    nombre?: string;
    tipo?: string;
    is_claimed?: boolean;
    institutional_email?: string;
  };
  student?: {
    id: string;
    nombre_completo?: string;
    nombre?: string;
    tipo?: string;
    is_claimed?: boolean;
    institutional_email?: string;
  };
  onSuccess: (updatedMember?: any) => void;
}

export default function ClaimProfileModal({
  isOpen,
  onClose,
  member: propMember,
  student: propStudent,
  onSuccess,
}: ClaimProfileModalProps) {
  const currentMember = propMember || propStudent;
  const { user, loginWithGoogle, refreshUserProfile } = useAuth();
  
  // Pasos: 1 = Pedir correo institucional, 2 = Ingresar código OTP
  const [step, setStep] = useState<1 | 2>(1);
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string>('');

  useEffect(() => {
    if (isOpen && currentMember) {
      setStep(1);
      setEmailInput('');
      setOtpInput('');
      setError(currentMember.is_claimed ? 'Este perfil ya se encuentra reclamado y verificado.' : null);
      setSuccess(null);
    }
  }, [isOpen, currentMember?.id, currentMember?.is_claimed]);

  if (!isOpen || !currentMember) return null;

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

  // Paso 1: Enviar correo con el OTP usando Brevo
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || user.isAnonymous || !user.email) {
      setError('Debes iniciar sesión con tu cuenta antes de reclamar tu perfil.');
      return;
    }

    const clean = emailInput.trim().toLowerCase();
    if (!clean) {
      setError('Por favor, ingresa tu correo institucional de Teams.');
      return;
    }

    try {
      setLoading(true);
      const res = await requestClaimOtp(currentMember.id, clean);
      setMaskedEmail(res.maskedEmail || clean);
      setStep(2);
    } catch (err: any) {
      console.error('Error al solicitar código OTP:', err);
      setError(err.message || 'No se pudo enviar el código. Verifica el correo.');
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: Verificar el OTP y adjudicar perfil
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = otpInput.trim();
    if (cleanCode.length !== 6) {
      setError('El código de verificación debe contener 6 dígitos.');
      return;
    }

    try {
      setLoading(true);
      const res = await verifyAndClaimProfile(currentMember.id, cleanCode, {
        uid: user!.uid,
        email: user!.email,
        displayName: user!.displayName,
      });

      setSuccess(res.message);

      try {
        if (refreshUserProfile) {
          await refreshUserProfile();
        }
      } catch (e) {}

      setTimeout(() => {
        onSuccess(res.member);
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error('Error al verificar código:', err);
      setError(err.message || 'Código incorrecto o expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#0a0a0a] border border-[#ffffff10] rounded-2xl p-6 space-y-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón de cierre */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-[#eab308] uppercase tracking-wide">
              Reclamar Perfil
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase">
              {currentMember.tipo || 'ISPPU'}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Vincula tu cuenta personal con tu perfil oficial de <strong className="text-white">{currentMember.nombre_completo || currentMember.nombre}</strong>.
          </p>
        </div>

        {/* Mensaje de éxito final */}
        {success ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white uppercase tracking-wider">
              ¡Perfil Verificado con Éxito!
            </p>
            <p className="text-xs text-zinc-400">
              {success}
            </p>
          </div>
        ) : !isGoogleLinked ? (
          /* Requerir sesión */
          <div className="space-y-4 py-2">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-[#eab308] font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Paso 1: Inicia Sesión</span>
              </div>
              <p className="text-xs text-zinc-400">
                Para garantizar la autoría del perfil, debes vincularlo a tu cuenta.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="w-full py-3.5 rounded-xl bg-white hover:bg-zinc-100 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg"
            >
              {authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continuar con Google</span>
                </>
              )}
            </button>
          </div>
        ) : step === 1 ? (
          /* Formulario Paso 1: Pedir Correo Institucional */
          <form onSubmit={handleSendCode} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#eab308]" />
                Correo Institucional (Teams)
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="60036463@iesppuchiza.edu.pe"
                className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors font-mono"
              />
              <p className="text-[11px] text-zinc-500">
                Te enviaremos un código de seguridad de 6 dígitos a tu bandeja de Teams/Outlook para verificar que eres tú.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || Boolean(currentMember.is_claimed)}
              className="w-full py-3.5 rounded-xl bg-[#eab308] hover:bg-[#d9a307] disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-[#eab308]/15 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Enviando código a Teams...</span>
                </>
              ) : (
                <>
                  <span>Enviar Código a mi Correo</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Formulario Paso 2: Ingresar Código de 6 dígitos */
          <form onSubmit={handleVerifyCode} className="space-y-4 animate-in fade-in duration-150">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-center space-y-1">
              <span className="text-[11px] text-zinc-400">Código enviado a:</span>
              <p className="text-xs font-mono font-bold text-[#eab308]">{maskedEmail}</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#eab308]" />
                Ingresa el Código de 6 Dígitos
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-3 text-lg text-white placeholder-zinc-700 focus:outline-none focus:border-[#eab308]/40 transition-colors font-mono tracking-widest text-center"
              />
              <p className="text-[11px] text-zinc-500 text-center">
                El código expira en 10 minutos.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#eab308] hover:bg-[#d9a307] disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-[#eab308]/15 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Verificando...</span>
                </>
              ) : (
                <span>Confirmar y Reclamar Perfil</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError(null);
                setOtpInput('');
              }}
              className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1 cursor-pointer pt-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Cambiar correo o reenviar código</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
