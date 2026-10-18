import React, { useState, useEffect } from 'react';
import { ShieldAlert, Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { ProfileReport, ReportVoteType, submitReportVote, getUserVoteOnReport } from '@/src/lib/profileReports';

interface CommunityVoteBannerProps {
  report: ProfileReport;
  targetName: string;
  targetId: string;
  targetType: 'student' | 'professor';
  currentUserId: string | null;
  onRequireAuth?: () => void;
  onVoteUpdated: (updatedReport: ProfileReport) => void;
  onProfileExpelled: () => void;
}

export default function CommunityVoteBanner({
  report,
  targetName,
  targetId,
  targetType,
  currentUserId,
  onRequireAuth,
  onVoteUpdated,
  onProfileExpelled,
}: CommunityVoteBannerProps) {
  const [userVote, setUserVote] = useState<ReportVoteType | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteOutcomeMessage, setVoteOutcomeMessage] = useState<string | null>(null);

  // Cargar voto previo del usuario desde Supabase backend
  useEffect(() => {
    let isMounted = true;
    async function loadVote() {
      if (!currentUserId || !report?.id) return;
      const v = await getUserVoteOnReport(report.id, currentUserId, targetId, targetType);
      if (isMounted) setUserVote(v);
    }
    loadVote();
    return () => {
      isMounted = false;
    };
  }, [report.id, currentUserId, targetId, targetType]);

  const handleVote = async (type: ReportVoteType) => {
    if (!currentUserId) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    try {
      setVoting(true);
      const result = await submitReportVote({
        reportId: report.id,
        userId: currentUserId,
        voteType: type,
        targetId,
        targetType,
      });

      setUserVote(type);
      onVoteUpdated(result.report);

      if (result.outcome === 'expelled') {
        setVoteOutcomeMessage('⚠️ La comunidad ha decidido expulsar este perfil. El perfil ha sido eliminado del campus.');
        setTimeout(() => {
          onProfileExpelled();
        }, 2200);
      } else if (result.outcome === 'dismissed') {
        setVoteOutcomeMessage('✅ La comunidad confirmó que esta persona sí pertenece al instituto. Votación superada con éxito.');
      }
    } catch (err) {
      console.error('Error al emitir voto en moderación comunitaria:', err);
    } finally {
      setVoting(false);
    }
  };

  const threshold = report.threshold || 5;
  const expelProgress = Math.min(100, Math.round((report.votes_expel / threshold) * 100));

  if (voteOutcomeMessage) {
    return (
      <div className="w-full max-w-2xl mx-auto mb-4 p-4 rounded-2xl bg-zinc-950 border border-amber-500/40 shadow-[0_0_30px_rgba(234,179,8,0.15)] text-center animate-in fade-in zoom-in-95 duration-300">
        <p className="text-sm font-black text-amber-300 tracking-tight flex items-center justify-center gap-2">
          {voteOutcomeMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto mb-4 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#110d0d] border border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.12)] relative overflow-hidden animate-in fade-in slide-in-from-top-3 duration-300">
      {/* Fondo con brillo sutil */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cabecera de moderación comunitaria */}
      <div className="flex items-center justify-between gap-2 border-b border-red-500/20 pb-2 mb-2">
        <div className="flex items-center gap-1.5 text-red-400">
          <ShieldAlert className="w-4 h-4 animate-pulse shrink-0" />
          <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-red-300">
            VOTACIÓN DE EXPULSIÓN
          </span>
        </div>
        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 shrink-0">
          Moderación Activa
        </span>
      </div>

      {/* Motivo del reporte */}
      <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-red-950/30 border border-red-500/20 text-[11px] sm:text-xs text-zinc-300 flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-zinc-300 truncate">
          <strong className="text-white">Motivo:</strong> {report.reason}
        </span>
      </div>

      {/* La Pregunta Central Solicitada */}
      <div className="text-center py-1">
        <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
          ¿Pertenece realmente a este instituto?
        </h3>
        <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
          Tu voto ayuda a moderar la comunidad y decidir si se conserva o se expulsa el perfil.
        </p>
      </div>

      {/* Botones de Votación: Uno al lado del otro (grid-cols-2) y más compactos */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2.5">
        {/* SÍ, PERTENECE (CONSERVAR) */}
        <button
          onClick={() => handleVote('keep')}
          disabled={voting}
          className={`relative p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center group ${
            userVote === 'keep'
              ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)]'
              : 'bg-[#151d18] border-emerald-500/30 hover:border-emerald-500/70 hover:bg-emerald-500/10 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="text-[11px] sm:text-xs font-black tracking-tight text-emerald-400 group-hover:text-emerald-300 uppercase truncate">
              SÍ, PERTENECE
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 group-hover:text-zinc-300 mt-0.5">
            Conservar ({report.votes_keep} {report.votes_keep === 1 ? 'voto' : 'votos'})
          </span>

          {userVote === 'keep' && (
            <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
              <Check className="w-2.5 h-2.5" /> Tu voto
            </span>
          )}
        </button>

        {/* NO, EXPULSAR (ELIMINAR) */}
        <button
          onClick={() => handleVote('expel')}
          disabled={voting}
          className={`relative p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center group ${
            userVote === 'expel'
              ? 'bg-red-500/20 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.25)]'
              : 'bg-[#201314] border-red-500/30 hover:border-red-500/70 hover:bg-red-500/10 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <X className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="text-[11px] sm:text-xs font-black tracking-tight text-red-400 group-hover:text-red-300 uppercase truncate">
              NO, EXPULSAR
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 group-hover:text-zinc-300 mt-0.5">
            Eliminar ({report.votes_expel}/{threshold})
          </span>

          {userVote === 'expel' && (
            <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full">
              <X className="w-2.5 h-2.5" /> Tu voto
            </span>
          )}
        </button>
      </div>

      {/* Barra de progreso hacia la expulsión comunitaria */}
      <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] text-zinc-400">
        <div className="flex items-center gap-2 w-full">
          <div className="w-24 sm:w-28 bg-zinc-800 h-1.5 rounded-full overflow-hidden shrink-0">
            <div 
              className="bg-red-500 h-full transition-all duration-300"
              style={{ width: `${expelProgress}%` }}
            />
          </div>
          <span className="text-[10px] sm:text-[11px] font-bold text-red-400 truncate">
            {report.votes_expel} de {threshold} votos para expulsar
          </span>
        </div>
        {voting && (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 shrink-0">
            <Loader2 className="w-3 h-3 animate-spin" /> Guardando...
          </span>
        )}
      </div>
    </div>
  );
}
