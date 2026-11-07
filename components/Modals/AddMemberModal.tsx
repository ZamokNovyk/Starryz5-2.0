'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  Loader2, 
  Mail, 
  GraduationCap, 
  Users, 
  UserPlus, 
  ListPlus,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { createIsppuMember, createBulkIsppuMembers, parseBulkMembersText, CreateIsppuMemberData } from '@/src/lib/isppu';
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

  // Modo de ingreso: individual o masivo
  const [creationMode, setCreationMode] = useState<'individual' | 'masivo'>('individual');

  // Tipo: estudiante o profesor
  const [tipo, setTipo] = useState<'estudiante' | 'profesor'>(
    mode === 'student' || defaultRole === 'Alumno' ? 'estudiante' : 'profesor'
  );

  // Campos para modo Individual
  const [firstName, setFirstName] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [carrera, setCarrera] = useState('');

  // Campos para modo Masivo
  const [bulkText, setBulkText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<{ valid: CreateIsppuMemberData[]; invalid: string[] }>({ valid: [], invalid: [] });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  // Sincronizar tipo con props al abrir
  useEffect(() => {
    setTipo(mode === 'student' || defaultRole === 'Alumno' ? 'estudiante' : 'profesor');
  }, [mode, defaultRole, isOpen]);

  // Parser reactivo para modo masivo
  useEffect(() => {
    if (creationMode === 'masivo') {
      if (bulkText.trim()) {
        const res = parseBulkMembersText(bulkText, tipo, carrera, instituteId);
        setParsedPreview(res);
      } else {
        setParsedPreview({ valid: [], invalid: [] });
      }
    }
  }, [bulkText, tipo, carrera, instituteId, creationMode]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
      setFirstName('');
      setApellidoPaterno('');
      setApellidoMaterno('');
      setInstitutionalEmail('');
      setCarrera('');
      setBulkText('');
      setParsedPreview({ valid: [], invalid: [] });
      setCreationMode('individual');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Manejo de envío Individual
  const handleIndividualSubmit = async (e: React.FormEvent) => {
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
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Ingresa un correo institucional válido.');
      return;
    }

    if (tipo === 'estudiante' && !carrera.trim()) {
      setError('Por favor, ingresa la Carrera del estudiante.');
      return;
    }

    try {
      setSubmitting(true);
      
      await createIsppuMember({
        nombres: firstName.trim(),
        apellido_paterno: apellidoPaterno.trim(),
        apellido_materno: apellidoMaterno.trim() || undefined,
        institutional_email: cleanEmail,
        carrera: tipo === 'estudiante' ? carrera.trim() : undefined,
        tipo,
        instituteId,
      }, user.uid);

      setSuccess(`¡${tipo === 'estudiante' ? 'Estudiante' : 'Profesor'} añadido con éxito!`);
      setTimeout(() => {
        setSuccess(null);
        setFirstName('');
        setApellidoPaterno('');
        setApellidoMaterno('');
        setInstitutionalEmail('');
        onSuccess();
        onClose();
      }, 1400);

    } catch (err: any) {
      console.error('Error al registrar miembro:', err);
      setError(err.message || 'Error al conectar con la base de datos.');
    } finally {
      setSubmitting(false);
    }
  };

  // Manejo de envío Masivo
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || !isAdmin) {
      setError('Solo el administrador tiene permisos para crear perfiles en lote.');
      return;
    }

    if (tipo === 'estudiante' && !carrera.trim()) {
      setError('Por favor ingresa el nombre de la Carrera antes de procesar el lote.');
      return;
    }

    if (parsedPreview.valid.length === 0) {
      setError('No se encontraron perfiles válidos en la lista. Revisa el formato.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await createBulkIsppuMembers(parsedPreview.valid, user.uid);

      setSuccess(`¡Se registraron con éxito ${res.inserted} perfiles en el padrón!`);
      setTimeout(() => {
        setSuccess(null);
        setBulkText('');
        onSuccess();
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error('Error al registrar miembros masivos:', err);
      setError(err.message || 'Error al guardar los perfiles en la base de datos.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className="relative w-full max-w-xl bg-[#0a0a0a] border border-[#ffffff15] rounded-2xl p-5 sm:p-6 space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] max-h-[92vh] overflow-y-auto my-auto"
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
        <div className="space-y-1 pr-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-black text-[#eab308] uppercase tracking-wide flex items-center gap-2">
              {creationMode === 'masivo' ? <ListPlus className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              <span>{tipo === 'estudiante' ? 'Crear Perfil de Estudiante' : 'Crear Perfil de Profesor'}</span>
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase">
              Admin
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            {creationMode === 'masivo' 
              ? 'Registra decenas de perfiles simultáneamente pegando una lista.' 
              : 'Registra a un miembro del padrón ISPPU con su correo institucional.'}
          </p>
        </div>

        {/* Selector de Rol (Estudiante / Profesor) */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => setTipo('estudiante')}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tipo === 'estudiante'
                ? 'bg-[#eab308] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Estudiante</span>
          </button>
          <button
            type="button"
            onClick={() => setTipo('profesor')}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tipo === 'profesor'
                ? 'bg-[#eab308] text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Profesor</span>
          </button>
        </div>

        {/* Switch de Modo: Individual vs Masivo */}
        <div className="flex items-center justify-center gap-2 border-b border-zinc-800/80 pb-3">
          <button
            type="button"
            onClick={() => setCreationMode('individual')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              creationMode === 'individual'
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            1 a 1 (Individual)
          </button>
          <button
            type="button"
            onClick={() => setCreationMode('masivo')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              creationMode === 'masivo'
                ? 'bg-[#eab308]/20 text-[#eab308] border border-[#eab308]/40 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span>⚡ Masivo (Lotes)</span>
          </button>
        </div>

        {/* Pantalla de Éxito */}
        {success ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white uppercase tracking-wider">
              {success}
            </p>
            <p className="text-xs text-zinc-400">
              Los perfiles ya están listos en el padrón para ser reclamados por correo institucional.
            </p>
          </div>
        ) : !isAdmin ? (
          /* Pantalla no admin */
          <div className="text-center space-y-4 py-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#eab308] flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-white uppercase tracking-wide">
              Exclusivo para el Administrador
            </h3>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              Solo el administrador tiene permisos para registrar perfiles en el padrón oficial.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase"
            >
              Entendido
            </button>
          </div>
        ) : creationMode === 'individual' ? (
          /* ======================================================== */
          /* MODO INDIVIDUAL                                          */
          /* ======================================================== */
          <form onSubmit={handleIndividualSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Campo Carrera para Estudiantes */}
            {tipo === 'estudiante' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-[#eab308]" />
                  Carrera Profesional
                </label>
                <input
                  type="text"
                  required
                  value={carrera}
                  onChange={(e) => setCarrera(e.target.value)}
                  placeholder="Ej: Educación Inicial, Educación Física, etc."
                  className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors"
                />
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
                placeholder="Ej: Juan Carlos"
                className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors"
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
                  placeholder="Ej: Mendoza"
                  className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors"
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
                  className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#eab308]" />
                Correo Institucional (Teams)
              </label>
              <input
                type="email"
                required
                value={institutionalEmail}
                onChange={(e) => setInstitutionalEmail(e.target.value)}
                placeholder="Ej: 60036463@iesppuchiza.edu.pe"
                className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#eab308] hover:bg-[#d9a307] disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-[#eab308]/15 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Guardar en Padrón Oficial</span>
              )}
            </button>
          </form>
        ) : (
          /* ======================================================== */
          /* MODO MASIVO (ESTERIODES)                                 */
          /* ======================================================== */
          <form onSubmit={handleBulkSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Campo Carrera (solo para Estudiante) */}
            {tipo === 'estudiante' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-[#eab308]" />
                  Carrera para este Lote
                </label>
                <input
                  type="text"
                  required
                  value={carrera}
                  onChange={(e) => setCarrera(e.target.value)}
                  placeholder="Escribe el nombre de la carrera (ej: Educación Inicial)"
                  className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#eab308]/40 transition-colors"
                />
              </div>
            )}

            {/* Textarea Masivo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Pega aquí la lista de personas y correos
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">1 persona por línea</span>
              </div>
              <textarea
                rows={6}
                required
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`Juan Carlos Mendoza Silva 60036463@iesppuchiza.edu.pe\nAlan Perez Vega 60012345@iesppuchiza.edu.pe\nMaria Elena Rojas Diaz m.rojas@iesppuchiza.edu.pe`}
                className="w-full bg-[#111111] border border-[#ffffff10] rounded-xl p-3.5 text-xs text-white placeholder-zinc-700 font-mono focus:outline-none focus:border-[#eab308]/40 transition-colors leading-relaxed"
              />
              <p className="text-[11px] text-zinc-500">
                El sistema detectará automáticamente: los <strong>nombres</strong>, el <strong>apellido paterno</strong> (penúltima palabra), el <strong>apellido materno</strong> (última palabra) y el <strong>correo</strong>.
              </p>
            </div>

            {/* Vista previa inteligente */}
            {bulkText.trim() && (
              <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Detectados: <strong className="text-[#eab308]">{parsedPreview.valid.length}</strong> perfiles listos
                  </span>
                  {parsedPreview.invalid.length > 0 && (
                    <span className="text-red-400 text-[11px] font-medium">
                      {parsedPreview.invalid.length} líneas con error
                    </span>
                  )}
                </div>

                {parsedPreview.valid.length > 0 && (
                  <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] font-mono border-t border-zinc-800 pt-2">
                    {parsedPreview.valid.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-zinc-400 py-0.5 border-b border-zinc-800/40">
                        <span className="truncate pr-2">
                          <strong className="text-zinc-200">{item.nombres}</strong> {item.apellido_paterno} {item.apellido_materno}
                        </span>
                        <span className="text-[#eab308] shrink-0">{item.institutional_email}</span>
                      </div>
                    ))}
                  </div>
                )}

                {parsedPreview.invalid.length > 0 && (
                  <div className="p-2 bg-red-950/20 border border-red-500/20 rounded-lg text-[10px] text-red-400 space-y-0.5">
                    {parsedPreview.invalid.map((inv, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate">{inv}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || parsedPreview.valid.length === 0}
              className="w-full py-3.5 rounded-xl bg-[#eab308] hover:bg-[#d9a307] disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-[#eab308]/15 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Creando {parsedPreview.valid.length} perfiles...</span>
                </>
              ) : (
                <span>Crear {parsedPreview.valid.length > 0 ? `${parsedPreview.valid.length} Perfiles Ahora` : 'Perfiles Masivos'}</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
