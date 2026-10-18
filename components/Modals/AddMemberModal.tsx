'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Lock } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { createProfessor } from '@/src/lib/professors';
import { createStudent } from '@/src/lib/students';
import { supabase } from '@/src/lib/supabase';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  instituteId: string; // The slug/id of the current educational center
  defaultRole?: 'Alumno' | 'Profesor';
  mode?: 'professor' | 'student';
  onSuccess: () => void; // Refresh callback
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
  const [lastName, setLastName] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [dni, setDni] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Determinar si el usuario actual es administrador (con soporte para wikibot3, wikistars12 y rol admin de BD)
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

  // Determine if adding student or professor
  const isStudent = mode === 'student' || defaultRole === 'Alumno';

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(false);
      setFirstName('');
      setLastName('');
      setApellidoPaterno('');
      setApellidoMaterno('');
      setDni('');
    }
  }, [isOpen, isStudent]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || !isAdmin) {
      setError('Solo el administrador del sistema puede registrar perfiles en el padrón.');
      return;
    }

    if (isStudent) {
      if (!firstName.trim() || !apellidoPaterno.trim()) {
        setError('Por favor, ingresa los nombres y el apellido paterno del estudiante.');
        return;
      }
    } else {
      if (!firstName.trim() || !lastName.trim()) {
        setError('Por favor, ingresa los nombres y apellidos completos del profesor.');
        return;
      }
    }

    const cleanDni = dni.trim().replace(/\D/g, '');
    if (isStudent && cleanDni.length !== 8) {
      setError('El número de DNI para estudiantes debe contener exactamente 8 dígitos.');
      return;
    }

    try {
      setSubmitting(true);
      
      if (isStudent) {
        // Guarda en la tabla 'students' de Supabase con nombres, apellido_paterno y apellido_materno
        await createStudent({
          nombres: firstName.trim(),
          apellido_paterno: apellidoPaterno.trim(),
          apellido_materno: apellidoMaterno.trim(),
          nombre: firstName.trim(),
          apellidos: `${apellidoPaterno.trim()} ${apellidoMaterno.trim()}`.trim(),
          instituteId,
          dni: cleanDni,
        }, user.uid);
      } else {
        // Guarda en la tabla 'professors' de Supabase
        await createProfessor({
          nombre: firstName.trim(),
          apellidos: lastName.trim(),
          role: 'Profesor',
          instituteId,
        }, user.uid);
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setFirstName('');
        setLastName('');
        setApellidoPaterno('');
        setApellidoMaterno('');
        setDni('');
        onSuccess();
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('Error al registrar miembro:', err);
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
              {isStudent ? 'Crear Perfil de Estudiante' : 'Crear Perfil de Profesor'}
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase">
              Admin
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            {isStudent 
              ? 'Registra un nuevo estudiante en el padrón del instituto con su DNI.' 
              : 'Añade un nuevo profesor a esta institución.'}
          </p>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white uppercase tracking-wider">
              {isStudent ? '¡Estudiante añadido al padrón!' : '¡Profesor añadido con éxito!'}
            </p>
            <p className="text-xs text-zinc-400">
              {isStudent 
                ? 'El estudiante ya podrá buscar y reclamar su perfil ingresando su DNI.' 
                : 'Se guardó correctamente en el padrón de profesores.'}
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
                Solo el administrador del sistema tiene permisos para dar de alta nuevos estudiantes y profesores en el padrón oficial.
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
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isStudent ? (
              /* Formularios con 3 separaciones: NOMBRES, APELLIDO PATERNO y APELLIDO MATERNO */
              <div className="space-y-4">
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
              </div>
            ) : (
              /* Inputs Nombres y Apellidos para Profesores */
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Nombres
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ej: Manuel"
                    className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Apellidos
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ej: Gonzalez Silva"
                    className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Input DNI para Estudiantes */}
            {isStudent && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#eab308]" />
                    DNI Oficial (8 dígitos)
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">Para verificación</span>
                </div>
                <input
                  type="text"
                  maxLength={8}
                  required
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ej: 60036463"
                  className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors font-mono tracking-widest text-center"
                />
                <p className="text-[11px] text-zinc-500">
                  El estudiante ingresará este número de DNI para reclamar su cuenta y mostrar su nombre real.
                </p>
              </div>
            )}

            {/* Botón de Envío */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#eab308] hover:bg-[#d9a307] disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-[#eab308]/15 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>{isStudent ? 'Guardando en Padrón...' : 'Añadiendo Profesor...'}</span>
                </>
              ) : (
                <span>{isStudent ? 'Guardar en Padrón Oficial' : 'Añadir Profesor'}</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
