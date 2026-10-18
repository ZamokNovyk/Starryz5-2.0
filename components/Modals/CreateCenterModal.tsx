'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Sparkles, GraduationCap, Building2, BookOpen, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { createEducationalCenter } from '@/src/lib/centers';

interface CreateCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type CenterType = 'colegio' | 'instituto' | 'universidad';

export default function CreateCenterModal({ isOpen, onClose, onSuccess }: CreateCenterModalProps) {
  const { user, loginWithGoogle, linkWithGoogle } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<CenterType>('universidad');
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const isGoogleUser = user && !user.isAnonymous;

  const handleGoogleConnect = async () => {
    try {
      setAuthLoading(true);
      setErrorMsg(null);
      if (user?.isAnonymous) {
        await linkWithGoogle();
      } else {
        await loginWithGoogle();
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request' || err?.isUserCancellation) {
        return;
      }
      console.error('Error al autenticar con Google:', err);
      setErrorMsg('No se pudo completar el inicio de sesión con Google. Intenta nuevamente.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.isAnonymous) {
      setErrorMsg('Solo los usuarios verificados con cuenta de Google pueden registrar un centro educativo.');
      return;
    }

    if (!name.trim()) {
      setErrorMsg('El nombre del centro educativo es obligatorio.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await createEducationalCenter(
        {
          name: name.trim(),
          type: selectedType,
          photoUrl: photoUrl.trim() || undefined,
        },
        user.uid
      );

      setSuccess(true);
      setTimeout(() => {
        // Reiniciar estados, llamar onSuccess y cerrar
        setStep(1);
        setName('');
        setPhotoUrl('');
        setSuccess(false);
        onSuccess();
        onClose();
      }, 2500);

    } catch (err: any) {
      console.error('Error al registrar centro educativo:', err);
      setErrorMsg(
        err?.message || 
        'No se pudo registrar el centro. Por favor asegúrate de haber creado la tabla "educational_centers" en Supabase.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0d0d0d] border border-[#ffffff10] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden">
        
        {/* Banner decorativo arriba */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#eab308] via-amber-500 to-yellow-600"></div>

        {/* Header del modal */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#ffffff0a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#eab30810] flex items-center justify-center text-[#eab308]">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">Registrar Centro Educativo</h3>
              <p className="text-[10px] text-zinc-500 font-mono">PASO {step} DE 2</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#141414] hover:bg-[#1a1a1a] text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          /* Pantalla de Éxito */
          <div className="p-8 text-center space-y-4 py-12 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xl font-black text-white uppercase tracking-tight">¡Creado con Éxito!</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                El centro educativo <strong className="text-white">"{name}"</strong> se ha registrado en Supabase correctamente.
              </p>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono animate-pulse pt-2">Refrescando red de campus...</p>
          </div>
        ) : !isGoogleUser ? (
          /* Restricción: Exclusivo para usuarios con Google */
          <div className="p-8 text-center space-y-6 py-10">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#eab308] flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(234,179,8,0.15)]">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2 max-w-sm mx-auto">
              <h4 className="text-lg font-black text-white uppercase tracking-wide">
                Registro Exclusivo con Google
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Para evitar perfiles falsos y proteger la autenticidad de la comunidad, solo los usuarios registrados con una <strong>cuenta de Google</strong> pueden crear nuevos centros educativos.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleGoogleConnect}
                disabled={authLoading}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-[0_4px_20px_rgba(234,179,8,0.25)] cursor-pointer disabled:opacity-50"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Conectando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{user?.isAnonymous ? 'Vincular Google y Continuar' : 'Iniciar con Google'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-3 rounded-xl border border-zinc-800 bg-[#141414] hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          /* Flujo de 2 pasos */
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            
            {errorMsg && (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <AlertCircle className="w-4.5 h-4.5 text-red-400 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {step === 1 ? (
              /* PASO 1: Selección de Tipo */
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-wide">Selecciona el tipo de centro</h4>
                  <p className="text-xs text-zinc-400 mt-1">Elige la categoría que mejor describa a esta institución educativa.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  
                  {/* Tarjeta Colegio */}
                  <button
                    type="button"
                    onClick={() => setSelectedType('colegio')}
                    className={`p-5 rounded-2xl border text-left flex flex-col justify-between h-36 transition-all duration-300 cursor-pointer ${
                      selectedType === 'colegio'
                        ? 'bg-[#eab3080c] border-[#eab308] text-[#eab308] shadow-[0_0_20px_rgba(234,179,8,0.08)]'
                        : 'bg-[#141414] border-[#ffffff0a] text-zinc-400 hover:text-white hover:border-[#ffffff15]'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                      <BookOpen className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h5 className="font-black text-xs uppercase tracking-wider">Colegio</h5>
                      <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">Escuelas, primarias y secundarias locales.</p>
                    </div>
                  </button>

                  {/* Tarjeta Instituto */}
                  <button
                    type="button"
                    onClick={() => setSelectedType('instituto')}
                    className={`p-5 rounded-2xl border text-left flex flex-col justify-between h-36 transition-all duration-300 cursor-pointer ${
                      selectedType === 'instituto'
                        ? 'bg-[#eab3080c] border-[#eab308] text-[#eab308] shadow-[0_0_20px_rgba(234,179,8,0.08)]'
                        : 'bg-[#141414] border-[#ffffff0a] text-zinc-400 hover:text-white hover:border-[#ffffff15]'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                      <Building2 className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h5 className="font-black text-xs uppercase tracking-wider">Instituto</h5>
                      <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">Centros tecnológicos y escuelas superiores.</p>
                    </div>
                  </button>

                  {/* Tarjeta Universidad */}
                  <button
                    type="button"
                    onClick={() => setSelectedType('universidad')}
                    className={`p-5 rounded-2xl border text-left flex flex-col justify-between h-36 transition-all duration-300 cursor-pointer ${
                      selectedType === 'universidad'
                        ? 'bg-[#eab3080c] border-[#eab308] text-[#eab308] shadow-[0_0_20px_rgba(234,179,8,0.08)]'
                        : 'bg-[#141414] border-[#ffffff0a] text-zinc-400 hover:text-white hover:border-[#ffffff15]'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                      <GraduationCap className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h5 className="font-black text-xs uppercase tracking-wider">Universidad</h5>
                      <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">Pregrado, posgrado y campus universitarios.</p>
                    </div>
                  </button>

                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-5 py-3 rounded-xl bg-[#eab308] text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-[#d9a307] transition-all cursor-pointer shadow-md"
                  >
                    <span>Siguiente Paso</span>
                    <ArrowRight className="w-4 h-4 text-black" />
                  </button>
                </div>
              </div>
            ) : (
              /* PASO 2: Formulario */
              <div className="space-y-5">
                <div className="space-y-4">
                  {/* Nombre */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
                      Nombre Completo del Centro Educativo <span className="text-[#eab308]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej. Universidad Peruana de Ciencias Aplicadas"
                      className="w-full bg-[#151515] border border-[#ffffff15] focus:border-[#eab308] focus:ring-1 focus:ring-[#eab308] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all"
                    />
                  </div>

                  {/* URL de foto de perfil */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
                      URL del Logo / Foto de Portada <span className="text-zinc-600">(Opcional)</span>
                    </label>
                    <input
                      type="url"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="Ej. https://images.unsplash.com/... o vacío para predeterminado"
                      className="w-full bg-[#151515] border border-[#ffffff15] focus:border-[#eab308] focus:ring-1 focus:ring-[#eab308] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all"
                    />
                    <p className="text-[9px] text-zinc-500">
                      Te recomendamos usar una URL de imagen válida. Si se deja en blanco, asignaremos un diseño al azar según la categoría.
                    </p>
                  </div>
                </div>

                {/* Botones de navegación inferior */}
                <div className="pt-4 border-t border-[#ffffff0a] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2.5 rounded-xl border border-[#ffffff10] bg-[#141414] hover:bg-[#1a1a1a] text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Atrás</span>
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 rounded-xl bg-[#eab308] text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-[#d9a307] transition-all cursor-pointer shadow-[0_4px_25px_rgba(234,179,8,0.25)] disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>REGISTRANDO...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-black" />
                        <span>CREAR CENTRO</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </form>
        )}

      </div>
    </div>
  );
}
