import React, { useState } from 'react';
import { Flag, AlertTriangle, ShieldAlert, X, Loader2 } from 'lucide-react';
import { createProfileReport, ProfileReport } from '@/src/lib/profileReports';

interface ReportProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: 'student' | 'professor';
  targetName: string;
  instituteId: string;
  currentUserId: string;
  currentUserName: string;
  onReportCreated: (report: ProfileReport) => void;
}

export default function ReportProfileModal({
  isOpen,
  onClose,
  targetId,
  targetType,
  targetName,
  instituteId,
  currentUserId,
  currentUserName,
  onReportCreated,
}: ReportProfileModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      setError('Debes iniciar sesión para iniciar una votación de moderación.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const report = await createProfileReport({
        targetId,
        targetType,
        targetName,
        instituteId,
        reportedBy: currentUserId,
        reporterName: currentUserName || 'Miembro del campus',
        reason: 'No pertenece a este instituto / Perfil falso',
        threshold: 5, // 5 votos requeridos para expulsar
      });

      onReportCreated(report);
      onClose();
    } catch (err: any) {
      console.error('Error al iniciar reporte:', err);
      setError(err?.message || 'Ocurrió un error al registrar el reporte.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#0e0e11] border border-red-500/30 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden text-white animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior con gradiente de alerta */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

        {/* Cabecera compacta */}
        <div className="p-5 pb-3 flex items-start justify-between gap-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                Reportar Perfil
                <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                  Moderación
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[220px]">
                {targetName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido directo sin opciones redundantes */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/20 flex gap-3 text-xs text-zinc-300">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-red-300 text-xs">¿Esta persona no pertenece al instituto?</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Se abrirá una votación comunitaria en la cabecera del perfil de <strong className="text-white">{targetName}</strong>. Si la comunidad suma 5 votos para expulsar, el perfil será eliminado automáticamente del campus.
              </p>
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 flex items-center justify-between">
            <span className="text-zinc-400">Motivo de expulsión:</span>
            <span className="font-semibold text-red-300">No pertenece / Perfil falso</span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-xs font-bold text-zinc-300 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Iniciando...</span>
                </>
              ) : (
                <>
                  <Flag className="w-3.5 h-3.5" />
                  <span>Iniciar Votación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
