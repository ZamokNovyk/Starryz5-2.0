'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, Sparkles, User, LogOut } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';

interface JoinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JoinModal({ isOpen, onClose }: JoinModalProps) {
  const { user, loginWithGoogle, loginAnonymously, logout } = useAuth();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingAnon, setLoadingAnon] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setLoadingGoogle(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request' || err?.isUserCancellation) {
        return;
      }
      console.error('Error al iniciar sesión con Google:', err);
      setErrorMsg(err?.message || 'Ocurrió un error al conectar con Google.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleAnonAuth = async () => {
    setErrorMsg(null);
    setLoadingAnon(true);
    try {
      await loginAnonymously();
      onClose();
    } catch (err: any) {
      console.error('Error al iniciar sesión anónima:', err);
      setErrorMsg(err?.message || 'Ocurrió un error al iniciar sesión anónima.');
    } finally {
      setLoadingAnon(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0d0d0d] border border-[#eab308] rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(234,179,8,0.2)] space-y-6 overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-[#151515] border border-[#ffffff15] text-zinc-400 hover:text-white hover:border-[#eab308] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center sm:text-left pr-8">
          <span className="text-xs font-bold text-[#eab308] uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#eab308]" /> Acceso a STARRYZ 5
          </span>
          <h3 className="text-2xl font-black text-white uppercase tracking-tight mt-1">
            INICIAR SESIÓN
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Elige tu método preferido para ingresar y participar en la comunidad.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs text-center">
            {errorMsg}
          </div>
        )}

        {user ? (
          <div className="py-2 text-center space-y-5 animate-in zoom-in-95">
            <CheckCircle2 className="w-12 h-12 text-[#eab308] mx-auto" />
            <div>
              <h4 className="text-lg font-extrabold text-white">¡Sesión Activa!</h4>
              <p className="text-xs text-zinc-400 mt-1">
                {user.isAnonymous ? (
                  <span>Ingresaste como <strong className="text-white">Usuario Anónimo</strong> (los datos se conservan localmente).</span>
                ) : (
                  <span>Ingresaste con la cuenta <strong className="text-white">{user.displayName || 'Usuario'}</strong></span>
                )}
              </p>
              {user.email && (
                <p className="text-[10px] text-zinc-500 mt-0.5">{user.email}</p>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-lg bg-[#eab308] hover:bg-[#d9a307] text-black font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                CONTINUAR AL SITIO
              </button>
              {!user.isAnonymous && (
                <button
                  onClick={() => logout()}
                  className="w-full py-2.5 rounded-lg border border-red-500/30 text-red-400 font-semibold text-xs tracking-widest uppercase bg-red-950/10 hover:bg-red-950/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>CERRAR SESIÓN</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Google Login */}
            <button
              type="button"
              disabled={loadingGoogle || loadingAnon}
              onClick={handleGoogleAuth}
              className="w-full py-3.5 px-4 rounded-xl border border-[#ffffff15] bg-[#141414] hover:bg-[#1a1a1a] hover:border-[#eab308]/60 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.336 0 3.327 2.682 1.386 6.573L5.266 9.765z"
                />
                <path
                  fill="#4285F4"
                  d="M16.04 15.345c-1.077.737-2.43 1.146-4.04 1.146a7.067 7.067 0 0 1-6.734-4.855L1.386 14.81C3.327 18.72 7.336 21.4 12 21.4c3.136 0 5.927-1.036 7.91-2.827l-3.87-3.228z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.266 12a7.1 7.1 0 0 1 0-2.235L1.386 6.573A11.967 11.967 0 0 0 0 12c0 1.927.455 3.745 1.264 5.373l4.002-3.138A7.01 7.01 0 0 1 5.266 12z"
                />
                <path
                  fill="#34A853"
                  d="M23.49 12.273c0-.818-.082-1.609-.227-2.364H12v4.51h6.445a5.51 5.51 0 0 1-2.39 3.618l3.873 3.227c2.264-2.09 3.564-5.173 3.564-8.99z"
                />
              </svg>
              <span>{loadingGoogle ? 'CONECTANDO...' : 'CONTINUAR CON GOOGLE'}</span>
            </button>

            {/* Anonymous Login */}
            <button
              type="button"
              disabled={loadingGoogle || loadingAnon}
              onClick={handleAnonAuth}
              className="w-full py-3.5 px-4 rounded-xl border border-[#eab30840] bg-[#eab3080d] hover:bg-[#eab3081a] hover:border-[#eab30880] text-[#eab308] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              <User className="w-5 h-5 text-[#eab308]" />
              <span>{loadingAnon ? 'INGRESANDO...' : 'ENTRAR COMO ANÓNIMO'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
