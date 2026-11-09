'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Star, 
  Send, 
  Loader2, 
  CornerDownRight, 
  Reply, 
  MessageSquare,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { 
  UserPublication, 
  PublicationReviewComment, 
  getPublicationById, 
  getPublicationReviews, 
  submitPublicationReview 
} from '@/src/lib/publications';

interface PublicationNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicationId: string | null;
  commentId?: string | null;
  currentUser: any;
  onNavigate?: (url: string) => void;
}

export default function PublicationNotificationModal({
  isOpen,
  onClose,
  publicationId,
  commentId,
  currentUser,
  onNavigate,
}: PublicationNotificationModalProps) {
  const [loading, setLoading] = useState(true);
  const [publication, setPublication] = useState<UserPublication | null>(null);
  const [comments, setComments] = useState<PublicationReviewComment[]>([]);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replySuccessMsg, setReplySuccessMsg] = useState<string | null>(null);
  const [targetTarget, setTargetTarget] = useState<{ id: string; name: string; uid: string } | null>(null);

  const replyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !publicationId) return;

    let isMounted = true;
    setLoading(true);
    setReplySuccessMsg(null);
    setReplyText('');

    async function loadData() {
      try {
        const [pub, revs] = await Promise.all([
          getPublicationById(publicationId!),
          getPublicationReviews(publicationId!)
        ]);

        if (isMounted) {
          setPublication(pub);
          setComments(revs);

          // Si hay commentId, determinar a quién responder por defecto
          if (commentId) {
            const target = revs.find((c) => (c.id || (c as any).uuid) === commentId);
            if (target) {
              setTargetTarget({
                id: target.parent_id || target.id,
                name: target.user_display_name || 'Compañero',
                uid: target.user_uid,
              });
            }
          } else if (pub) {
            // Responder al creador de la publicación por defecto
            setTargetTarget({
              id: '',
              name: pub.user_display_name || 'Autor de la publicación',
              uid: pub.user_id,
            });
          }
        }
      } catch (err) {
        console.warn('[PublicationNotificationModal] Error al cargar detalles:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, publicationId, commentId]);

  if (!isOpen) return null;

  // Encontrar el comentario o respuesta notificada
  const highlightedComment = commentId 
    ? comments.find((c) => (c.id || (c as any).uuid) === commentId) 
    : null;

  // Si es respuesta a un comentario, buscar el comentario padre original
  const parentComment = highlightedComment?.parent_id 
    ? comments.find((c) => (c.id || (c as any).uuid) === highlightedComment.parent_id) 
    : null;

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !publicationId || !replyText.trim()) return;

    try {
      setSubmittingReply(true);

      const targetParentId = targetTarget?.id || highlightedComment?.parent_id || highlightedComment?.id || null;
      const targetUserName = targetTarget?.name || highlightedComment?.user_display_name || null;
      const targetUserUid = targetTarget?.uid || highlightedComment?.user_uid || null;

      const res = await submitPublicationReview({
        publicationId: publicationId,
        userUid: currentUser.uid,
        stars: null, // Respuesta de puro texto
        comment: replyText.trim(),
        parentId: targetParentId,
        replyToUserName: targetUserName,
        replyToUserUid: targetUserUid,
        publicationAuthorUid: publication?.user_id,
        authorInfo: {
          displayName: currentUser.displayName || 'Usuario Starryz',
          avatarUrl: currentUser.photoURL || null,
        }
      });

      if (res.success && res.newReview) {
        setComments((prev) => [...prev, res.newReview!]);
        setReplyText('');
        setReplySuccessMsg('¡Respuesta enviada con éxito!');
        setTimeout(() => setReplySuccessMsg(null), 3000);
      } else if (res.error) {
        alert(res.error);
      }
    } catch (err) {
      console.error('[PublicationNotificationModal] Error al enviar respuesta:', err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return 'Ahora';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    } catch {
      return 'Reciente';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-[#0d0e12] border border-zinc-800/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del Modal */}
        <div className="px-5 py-4 border-b border-zinc-800/80 bg-[#111217] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse" />
            <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
              Detalle de Notificación en Publicación
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              <span className="text-xs text-zinc-400 font-medium">Cargando publicación y comentarios...</span>
            </div>
          ) : !publication ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No se encontró la información de esta publicación o fue eliminada.
            </div>
          ) : (
            <>
              {/* Tarjeta de la publicación origen */}
              <div className="bg-[#14151b] border border-zinc-800/80 rounded-2xl p-3 sm:p-4 space-y-3 shadow-md">
                <div className="flex items-center justify-between gap-2 border-b border-zinc-800/60 pb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {publication.user_avatar_url ? (
                      <img 
                        src={publication.user_avatar_url} 
                        alt="Autor" 
                        className="w-8 h-8 rounded-full object-cover border border-zinc-700 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-300 text-xs font-black flex items-center justify-center uppercase flex-shrink-0">
                        {(publication.user_display_name || 'U').charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-white truncate">
                        {publication.user_display_name || 'Usuario Starryz'}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        Publicado el {formatTime(publication.created_at)}
                      </p>
                    </div>
                  </div>

                  {publication.rating_avg !== undefined && publication.rating_avg > 0 && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{publication.rating_avg.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Imagen si existe */}
                {publication.image_url && (
                  <div className="rounded-xl overflow-hidden max-h-56 bg-black flex items-center justify-center border border-zinc-800/60">
                    <img 
                      src={publication.image_url} 
                      alt="Publicación" 
                      className="w-full h-auto max-h-56 object-contain"
                    />
                  </div>
                )}

                {/* Descripción */}
                {publication.description && (
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {publication.description}
                  </p>
                )}
              </div>

              {/* SECCIÓN DESTACADA: Comentario / Reseña que originó la notificación */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Interacción de la notificación:</span>
                </span>

                {/* Si es una respuesta a un comentario, mostrar primero el comentario original */}
                {parentComment && (
                  <div className="bg-[#111217] border border-zinc-800 rounded-xl p-3 space-y-1.5 opacity-80">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="font-bold text-zinc-300 flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3 text-zinc-500" />
                        <span>Comentario original de <strong>@{parentComment.user_display_name || 'Compañero'}</strong>:</span>
                      </span>
                      <span className="text-[9px] text-zinc-500">{formatTime(parentComment.created_at)}</span>
                    </div>
                    {parentComment.stars && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span>{parentComment.stars} estrellas</span>
                      </div>
                    )}
                    <p className="text-xs text-zinc-300 pl-4 border-l-2 border-zinc-700/60">
                      {parentComment.comment}
                    </p>
                  </div>
                )}

                {/* Comentario notificado (o respuesta destacada) */}
                {highlightedComment ? (
                  <div className="bg-amber-500/10 border-2 border-amber-500/50 rounded-2xl p-3.5 space-y-2 shadow-lg shadow-amber-500/5 animate-in fade-in">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {highlightedComment.user_avatar_url ? (
                          <img 
                            src={highlightedComment.user_avatar_url} 
                            alt="Autor" 
                            className="w-6 h-6 rounded-full object-cover border border-amber-400/40"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black flex items-center justify-center uppercase">
                            {(highlightedComment.user_display_name || 'U').charAt(0)}
                          </div>
                        )}
                        <span className="text-xs font-extrabold text-white truncate">
                          {highlightedComment.user_display_name || 'Compañero'}
                        </span>
                        {highlightedComment.parent_id && (
                          <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-1">
                            <CornerDownRight className="w-3 h-3 text-amber-400" />
                            <span>respondió a @{highlightedComment.reply_to_user_name || parentComment?.user_display_name || 'ti'}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {highlightedComment.stars && (
                          <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{highlightedComment.stars}★</span>
                          </div>
                        )}
                        <span className="text-[10px] text-zinc-400">
                          {formatTime(highlightedComment.created_at)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-zinc-100 font-medium leading-relaxed pl-2 border-l-2 border-amber-400/60">
                      {highlightedComment.comment}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">
                    Revisa las opiniones y comentarios en esta publicación.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer con opción directa para responder */}
        <div className="p-3 sm:p-4 border-t border-zinc-800 bg-[#111217] space-y-2 shrink-0">
          {replySuccessMsg && (
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center animate-in fade-in">
              {replySuccessMsg}
            </div>
          )}

          {targetTarget && (
            <div className="flex items-center justify-between text-xs text-blue-300 px-2">
              <span className="flex items-center gap-1">
                <Reply className="w-3 h-3 text-blue-400" />
                <span>Respondiendo a: <strong className="text-white font-bold">@{targetTarget.name}</strong></span>
              </span>
            </div>
          )}

          <form onSubmit={handleSendReply} className="flex items-center gap-2">
            <input
              ref={replyInputRef}
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={targetTarget ? `Escribe tu respuesta a @${targetTarget.name}...` : "Escribe una respuesta a esta notificación..."}
              maxLength={400}
              className="flex-1 bg-[#14151b] border border-zinc-700/80 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={submittingReply || !replyText.trim()}
              className="px-4 py-2.5 rounded-xl bg-[#eab308] hover:bg-yellow-400 text-black font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex-shrink-0"
            >
              {submittingReply ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Responder</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
