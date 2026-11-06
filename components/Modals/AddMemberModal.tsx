'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Mail } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { createIsppuMember } from '@/src/lib/isppu';
import { supabase } from '@/src/lib/supabase';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  instituteId: string;
  defaultRole?: 'Alumno' | 'Profesor';
  mode?: 'professor' | 'student';
  onSuccess: () => void;
}

export default function AddMemberModal({
  isOpen,
  onClose,
  instituteId,
  defaultRole = 'Profesor',
  mode,
  onSuccess,
}: AddMemberModalProps) {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [tipo, setTipo] = useState<'estudiante' | 'profesor'>(
    mode === 'student' || defaultRole === 'Alumno' ? 'estudiante' : 'profesor'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Determinar si el usuario actual es administrador
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return (
      (user as any)?.role === 'admin' ||
      user?.email?.toLowerCase() === 'wikistars12@gmail.com' ||
      user?.email?.toLowerCase() === 'wikibot3@gmail.com'
    );
  });

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    if (
      (user as any)?.role === 'admin' ||
      user?.email?.toLowerCase() === 'wikistars12@gmail.com' ||
      user?.email?.toLowerCase() === 'wikibot3@gmail.com'
    ) {
      setIsAdmin(true);
      return;
    }

    supabase
      .from('users')
      .select('role')
      .or(`id.eq.${user.uid},email.eq.${user.email}`)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data?.role === 'admin') {
          setIsAdmin(true);
        }
      })
      .catch(() => {});
  }, [user, isOpen]);

  // Actualizar tipo por defecto según props
  useEffect(() => {
    setTipo(mode === 'student' || defaultRole === 'Alumno' ? 'estudiante' : 'profesor');
  }, [mode, defaultRole, isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(false);
      setFirstName('');
      setApellidoPaterno('');
      setApellidoMaterno('');
      setInstitutionalEmail('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || !isAdmin) {
      setError('Solo el administrador del sistema puede registrar perfiles en el padrón.');
      return;
    }

    if (!firstName.trim() || !apellidoPaterno.trim()) {
      setError('Por favor, ingresa los nombres y el apellido paterno.');
      return;
    }

    const cleanEmail = institutionalEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError('El correo institucional es obligatorio.');
      return;
    }

    // Validar formato de correo institucional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Ingresa un formato de correo institucional válido.');
      return;
    }

    try {
      setSubmitting(true);
      
      await createIsppuMember({
        nombres: firstName.trim(),
        apellido_paterno: apellidoPaterno.trim(),
        apellido_materno: apellidoMaterno.trim(),
        institutional_email: cleanEmail,
        tipo,
        instituteId,
      }, user.uid);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setFirstName('');
        setApellidoPaterno('');
        setApellidoMaterno('');
        setInstitutionalEmail('');
        onSuccess();
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('Error al registrar miembro en ISPPU:', err);
      setError(err.message || 'Error al conectar con la base de datos.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#0a0a0a] border border-[#ffffff10] rounded-2xl p-6 space-y-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón de cierre superior derecho */}
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
              {tipo === 'estudiante' ? 'Crear Perfil de Estudiante' : 'Crear Perfil de Profesor'}
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase">
              Admin
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Registra a un miembro del padrón ISPPU con su correo institucional para verificación segura.
          </p>
        </div>

        {/* Selector de Tipo (Estudiante / Profesor) */}
        <div className="flex items-center gap-2 p-1 bg-zinc-900/80 border border-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => setTipo('estudiante')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tipo === 'estudiante'
                ? 'bg-[#eab308] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Estudiante
          </button>
          <button
            type="button"
            onClick={() => setTipo('profesor')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tipo === 'profesor'
                ? 'bg-[#eab308] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Profesor
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white uppercase tracking-wider">
              ¡Perfil añadido al padrón de ISPPU!
            </p>
            <p className="text-xs text-zinc-400">
              El {tipo} ya podrá buscar y reclamar su perfil recibiendo su código en Teams / Outlook.
            </p>
          </div>
        ) : !isAdmin ? (
          /* Pantalla de restricción para no administradores */
          <div className="text-center space-y-4 py-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#eab308] flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(234,179,8,0.15)]">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-white uppercase tracking-wide">
                Exclusivo para el Administrador
              </h3>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                Solo el administrador del sistema tiene permisos para dar de alta perfiles en el padrón oficial de ISPPU.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider transition"
            >
              Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Nombres
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ej: Daniel Gustavo"
                className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Apellido Paterno
                </label>
                <input
                  type="text"
                  required
                  value={apellidoPaterno}
                  onChange={(e) => setApellidoPaterno(e.target.value)}
                  placeholder="Ej: Castillo"
                  className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Apellido Materno
                  </label>
                  <span className="text-[10px] text-zinc-500 font-medium">Opcional</span>
                </div>
                <input
                  type="text"
                  value={apellidoMaterno}
                  onChange={(e) => setApellidoMaterno(e.target.value)}
                  placeholder="Ej: Ramirez"
                  className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors"
                />
              </div>
            </div>

            {/* Input Correo Institucional en vez de DNI */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#eab308]" />
                  Correo Institucional (Teams)
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">Para verificación</span>
              </div>
              <input
                type="email"
                required
                value={institutionalEmail}
                onChange={(e) => setInstitutionalEmail(e.target.value)}
                placeholder="Ej: 60036463@iesppuchiza.edu.pe"
                className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors font-mono"
              />
              <p className="text-[11px] text-zinc-500">
                Se enviará el código OTP a este correo institucional para que reclamen su perfil.
              </p>
            </div>

            {/* Botón de Envío */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#eab308] hover:bg-[#d9a307] disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-[#eab308]/15 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Guardando en Padrón ISPPU...</span>
                </>
              ) : (
                <span>Guardar en Padrón Oficial</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
