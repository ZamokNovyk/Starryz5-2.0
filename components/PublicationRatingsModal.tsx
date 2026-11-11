'use client';

import React, { useState, useEffect } from 'react';
import { X, Star, Loader2, User, ChevronRight } from 'lucide-react';
import { getPublicationRatingsList, PublicationRatingVoter } from '@/src/lib/publications';
import { getFlagUrl } from '@/src/data/countries';

interface PublicationRatingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicationId: string;
  ratingAvg?: string | number;
  totalVotes?: number;
  onNavigateToUser?: (userId: string) => void;
}

export default function PublicationRatingsModal({
  isOpen,
  onClose,
  publicationId,
  ratingAvg = '0.00',
  totalVotes = 0,
  onNavigateToUser,
}: PublicationRatingsModalProps) {
  const [voters, setVoters] = useState<PublicationRatingVoter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(totalVotes);

  useEffect(() => {
    if (!isOpen || !publicationId) return;

    let isMounted = true;
    async function loadInitial() {
      setLoading(true);
      setPage(0);
      const res = await getPublicationRatingsList(publicationId, 0, 10);
      if (isMounted) {
        setVoters(res.voters);
        setHasMore(res.hasMore);
        setTotalCount(res.totalCount);
        setLoading(false);
      }
    }

    loadInitial();
    return () => {
      isMounted = false;
    };
  }, [isOpen, publicationId]);

  if (!isOpen) return null;

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const res = await getPublicationRatingsList(publicationId, nextPage, 10);
    setVoters(prev => [...prev, ...res.voters]);
    setHasMore(res.hasMore);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) return 'Ahora';
      if (diffMinutes < 60) return `hace ${diffMinutes} min`;
      if (diffHours < 24) return `hace ${diffHours} h`;
      if (diffDays < 30) return `hace ${diffDays} d`;
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  const handleUserClick = (uid: string) => {
    if (!uid) return;
    onClose();
    if (onNavigateToUser) {
      onNavigateToUser(uid);
    } else {
      window.location.href = `/perfil/${uid}`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#0e0e12] border border-zinc-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-[#121217]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Calificaciones
              </h3>
              <p className="text-[11px] text-zinc-400 font-medium">
                Promedio: <span className="text-amber-400 font-bold">{ratingAvg}</span> ({totalCount} {totalCount === 1 ? 'voto' : 'votos'})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido / Lista de Votantes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar">
          {loading ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 className="w-7 h-7 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs text-zinc-500 font-medium">Cargando votantes...</p>
            </div>
          ) : voters.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
                <Star className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-zinc-300">Aún no hay calificaciones</p>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                Esta publicación aún no ha recibido votos de la comunidad.
              </p>
            </div>
          ) : (
            <>
              {voters.map((voter) => {
                const flagUrl = voter.country_code ? getFlagUrl(voter.country_code) : null;

                return (
                  <div
                    key={voter.id}
                    onClick={() => handleUserClick(voter.user_uid)}
                    className="group flex items-center justify-between p-3 rounded-2xl bg-[#141418] hover:bg-[#1a1a22] border border-zinc-800/80 hover:border-amber-500/30 transition-all cursor-pointer shadow-xs"
                  >
                    {/* Usuario (Avatar + Nombre) */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {voter.user_avatar_url ? (
                          <img
                            src={voter.user_avatar_url}
                            alt={voter.user_display_name || 'Votante'}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-5 h-5 text-zinc-500" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white group-hover:text-amber-400 transition-colors truncate">
                            {voter.user_display_name || 'Usuario'}
                          </span>
                          {flagUrl && (
                            <img
                              src={flagUrl}
                              alt=""
                              className="w-4 h-3 object-cover rounded-xs flex-shrink-0"
                            />
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500">
                          {formatRelativeTime(voter.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Estrellas otorgadas */}
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex-shrink-0">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-black font-mono">{voter.stars}</span>
                    </div>
                  </div>
                );
              })}

              {/* Botón Cargar Más (Paginación anti-saturación) */}
              {hasMore && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full py-2.5 rounded-xl bg-[#181820] hover:bg-[#20202c] border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        <span>Cargando más...</span>
                      </>
                    ) : (
                      <>
                        <span>Ver más calificaciones</span>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

