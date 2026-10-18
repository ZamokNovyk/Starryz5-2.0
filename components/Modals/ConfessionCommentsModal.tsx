'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  MessageCircle, 
  Building2, 
  CornerDownRight, 
  CheckCircle2, 
  Trash,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { 
  CenterConfession, 
  ConfessionComment, 
  getConfessionComments, 
  createConfessionComment,
  deleteConfessionComment,
  formatTimeAgo,
  getDisplayAuthorName,
  getMyConfessionIds
} from '@/src/lib/confessions';
import { promptNotificationOnAction } from '@/src/lib/notificationHelper';
import GenderBadge from '@/components/GenderBadge';

interface ConfessionCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  confession: CenterConfession | null;
  onCommentAdded: (confessionId: string) => void;
  onCommentDeleted?: (confessionId: string) => void;
}

export default function ConfessionCommentsModal({
  isOpen,
  onClose,
  confession,
  onCommentAdded,
  onCommentDeleted,
}: ConfessionCommentsModalProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<ConfessionComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para responder a un comentario (Nivel 2)
  // root_id: el ID del comentario de Nivel 1 donde se agrupará la respuesta
  const [replyingTo, setReplyingTo] = useState<{ 
    root_id: string; 
    author_name: string 
  } | null>(null);

  // Estado para expandir/colapsar "Ver respuestas (X)" por cada comentario de nivel 1
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && confession) {
      loadComments();
    } else {
      setComments([]);
      setContent('');
      setError(null);
      setReplyingTo(null);
      setCommentToDelete(null);
      setExpandedReplies({});
    }
  }, [isOpen, confession]);

  if (!isOpen || !confession) return null;

  const loadComments = async () => {
    try {
      setLoading(true);
      const list = await getConfessionComments(confession.id);
      setComments(list);
    } catch (err) {
      console.error('Error al cargar comentarios:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  // Responder a un comentario de Nivel 1
  const handleReplyToLevel1 = (comment: ConfessionComment) => {
    const authorDisplayName = getDisplayAuthorName(comment.author_name, comment.firebase_uid, comment.is_anonymous);
    setReplyingTo({
      root_id: comment.id,
      author_name: authorDisplayName,
    });
    setExpandedReplies(prev => ({ ...prev, [comment.id]: true }));
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Responder a una respuesta de Nivel 2 (se queda en Nivel 2 bajo la misma raíz)
  const handleReplyToLevel2 = (rootCommentId: string, subComment: ConfessionComment) => {
    const authorDisplayName = getDisplayAuthorName(subComment.author_name, subComment.firebase_uid, subComment.is_anonymous);
    setReplyingTo({
      root_id: rootCommentId,
      author_name: authorDisplayName,
    });
    setExpandedReplies(prev => ({ ...prev, [rootCommentId]: true }));
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleDeleteClick = (commentId: string) => {
    setCommentToDelete(commentId);
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;
    const commentId = commentToDelete;
    setCommentToDelete(null);
    
    const previousComments = [...comments];
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId));
    
    try {
      setError(null);
      const { success, error: deleteErr } = await deleteConfessionComment(commentId, confession.id);
      if (success) {
        if (onCommentDeleted) {
          onCommentDeleted(confession.id);
        }
      } else {
        setComments(previousComments);
        setError(deleteErr || 'No se pudo eliminar el comentario.');
      }
    } catch (err) {
      console.error('Error al eliminar comentario:', err);
      setComments(previousComments);
      setError('Error al conectar con la base de datos.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError('Por favor, escribe tu respuesta.');
      return;
    }

    if (trimmedContent.length > 500) {
      setError('La respuesta no puede exceder los 500 caracteres.');
      return;
    }

    const authorName = user ? (user.displayName || user.email?.split('@')[0] || 'Anónimo') : 'Anónimo';

    try {
      setSubmitting(true);
      const newComment = await createConfessionComment({
        confession_id: confession.id,
        firebase_uid: user?.uid || null,
        author_name: authorName,
        content: trimmedContent,
        is_anonymous: true,
        parent_id: replyingTo?.root_id || null,
        reply_to_author: replyingTo?.author_name || null,
      });

      setComments((prev) => [...prev, newComment]);
      if (replyingTo?.root_id) {
        setExpandedReplies(prev => ({ ...prev, [replyingTo.root_id]: true }));
      }
      setContent('');
      setReplyingTo(null);
      promptNotificationOnAction('comment');
      onCommentAdded(confession.id);
    } catch (err: any) {
      console.error('Error al enviar respuesta:', err);
      setError('Error al guardar respuesta en la base de datos.');
    } finally {
      setSubmitting(false);
    }
  };

  // Separación en 2 niveles
  const commentIds = new Set(comments.map(c => c.id));
  const level1Comments = comments.filter(c => !c.parent_id || !commentIds.has(c.parent_id));
  const getRepliesForLevel1 = (parentId: string) => {
    return comments.filter(c => c.parent_id === parentId);
  };

  // Category badge styling
  let categoryLabel = 'Anécdotas';
  let categoryBadgeClass = 'bg-[#181818] text-zinc-300 border-zinc-700/60';

  if (confession.category === 'crush') {
    categoryLabel = 'Crush / Amor';
    categoryBadgeClass = 'bg-pink-950/50 text-pink-400 border-pink-500/40';
  } else if (confession.category === 'professors') {
    categoryLabel = 'Profesores';
    categoryBadgeClass = 'bg-emerald-950/50 text-emerald-400 border-emerald-500/40';
  } else if (confession.category === 'exams') {
    categoryLabel = 'Exámenes';
    categoryBadgeClass = 'bg-blue-950/50 text-blue-400 border-blue-500/40';
  } else if (confession.category === 'anecdotes') {
    categoryLabel = 'Anécdotas';
    categoryBadgeClass = 'bg-amber-950/50 text-amber-400 border-amber-500/40';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div
        className="relative w-full max-w-2xl bg-[#0d0d0d] border border-zinc-800 rounded-3xl p-5 sm:p-7 space-y-6 shadow-[0_25px_70px_rgba(0,0,0,0.95)] max-h-[90vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#eab308]/15 border border-[#eab308]/30 flex items-center justify-center text-[#eab308] shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Respuestas a la Confesión</h2>
              <p className="text-xs text-zinc-400">Muro Interactivo de la Comunidad</p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 transition-colors cursor-pointer border border-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-6 pr-1 flex-1">
          {/* Confession Preview Card */}
          {(() => {
            const myConfessionIds = getMyConfessionIds();
            const isMyConfession = !!(((user?.uid && confession.firebase_uid === user.uid) || myConfessionIds.includes(confession.id)));
            const displayAuthor = getDisplayAuthorName(confession.author_name, confession.firebase_uid, confession.is_anonymous);

            return (
              <div className={`rounded-2xl p-4 sm:p-5 space-y-3 shadow-inner transition-all ${
                isMyConfession
                  ? 'border-2 border-[#eab308] bg-[#141209] shadow-[0_0_25px_rgba(234,179,8,0.18)] ring-1 ring-[#eab308]/40'
                  : 'bg-[#141414] border border-zinc-800'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isMyConfession
                        ? 'bg-[#eab308]/20 border border-[#eab308] text-[#eab308]'
                        : 'bg-[#1c1c1c] border border-amber-500/30 text-[#eab308]'
                    }`}>
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-extrabold text-xs tracking-wide ${isMyConfession ? 'text-[#eab308]' : 'text-white'}`}>
                          {displayAuthor}
                        </span>
                        <GenderBadge 
                          gender={
                            confession.author_gender || 
                            (isMyConfession && user?.uid ? (localStorage.getItem(`user_gender_${user.uid}`) || localStorage.getItem('starryz_user_gender')) : null)
                          } 
                          size="sm" 
                        />
                        {isMyConfession && (
                          <span className="inline-flex items-center gap-1 bg-[#eab308] text-black text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm tracking-wider">
                            Tu Confesión
                          </span>
                        )}
                        {!confession.is_anonymous && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#eab308] fill-[#eab308]/20 shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500">
                        {formatTimeAgo(confession.created_at)}
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg border uppercase tracking-wider ${categoryBadgeClass}`}>
                    {categoryLabel}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-zinc-200 font-medium leading-relaxed">
                  {confession.content}
                </p>

                {/* Reactions preview */}
                <div className="flex items-center gap-2 pt-2 text-xs text-zinc-400 flex-wrap">
                  <span className="bg-zinc-900/80 border border-zinc-800 px-2 py-1 rounded-lg text-xs font-semibold">❤️ {confession.reactions.heart}</span>
                  <span className="bg-zinc-900/80 border border-zinc-800 px-2 py-1 rounded-lg text-xs font-semibold">😂 {confession.reactions.laugh}</span>
                  <span className="bg-zinc-900/80 border border-zinc-800 px-2 py-1 rounded-lg text-xs font-semibold">🔥 {confession.reactions.fire}</span>
                  <span className="bg-zinc-900/80 border border-zinc-800 px-2 py-1 rounded-lg text-xs font-semibold">😭 {confession.reactions.cry}</span>
                  <span className="bg-zinc-900/80 border border-zinc-800 px-2 py-1 rounded-lg text-xs font-semibold">🤯 {confession.reactions.shock}</span>
                </div>
              </div>
            );
          })()}

          {/* Form: Responder a la confesión o responder en Nivel 2 */}
          <form onSubmit={handleSubmit} className="bg-[#141414] border border-zinc-800/90 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-white flex items-center gap-1.5 uppercase tracking-wider">
                <CornerDownRight className="w-4 h-4 text-[#eab308]" />
                <span>
                  {replyingTo ? `Respondiendo a @${replyingTo.author_name}` : 'Responder a esta confesión'}
                </span>
              </h3>
              <span className={`text-[11px] font-semibold ${content.length >= 480 ? 'text-amber-400' : 'text-zinc-500'}`}>
                {content.length}/500
              </span>
            </div>

            {/* Banner indicador de respuesta (Nivel 2) */}
            {replyingTo && (
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <CornerDownRight className="w-3.5 h-3.5" />
                  <span>En respuesta a <strong className="text-white">@{replyingTo.author_name}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={cancelReply}
                  className="text-zinc-400 hover:text-white p-0.5 rounded cursor-pointer"
                  title="Cancelar respuesta a este usuario"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 p-2.5 rounded-xl">
                {error}
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
              <textarea
                ref={inputRef}
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 500))}
                maxLength={500}
                rows={2}
                placeholder={replyingTo ? `Escribe tu respuesta para @${replyingTo.author_name}...` : "Escribe tu respuesta anónima (máx. 500 caracteres)..."}
                className="flex-1 bg-[#0d0d0d] border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#eab308] transition-colors resize-none leading-relaxed"
                required
              />

              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-3 bg-[#eab308] hover:bg-[#ca8a04] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_4px_15px_rgba(234,179,8,0.3)] flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 fill-current" />
                    <span>Responder</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Respuestas de la comunidad (2 niveles) */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <span>💬 Respuestas de la comunidad</span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-white text-[10px]">
                {comments.length}
              </span>
            </h3>

            {loading ? (
              <div className="p-8 text-center text-xs text-zinc-500 space-y-2">
                <div className="w-6 h-6 border-2 border-[#eab308] border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Cargando respuestas...</p>
              </div>
            ) : level1Comments.length === 0 ? (
              <div className="p-8 bg-[#141414] border border-zinc-800/60 rounded-2xl text-center space-y-2 text-xs text-zinc-500">
                <p className="text-white font-bold">Aún no hay respuestas en esta confesión.</p>
                <p>Sé el primero en compartir tu opinión o apoyo.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {level1Comments.map((comment) => {
                  const replies = getRepliesForLevel1(comment.id);
                  const hasReplies = replies.length > 0;
                  const isExpanded = !!expandedReplies[comment.id];
                  const isMyComment = !!(user && comment.firebase_uid === user.uid);
                  const commentAuthor = getDisplayAuthorName(comment.author_name, comment.firebase_uid, comment.is_anonymous);

                  return (
                    <div
                      key={comment.id}
                      className={`p-3.5 rounded-2xl space-y-2.5 transition-all shadow-sm ${
                        isMyComment
                          ? 'bg-[#16140b] border-2 border-[#eab308]/80 shadow-[0_0_20px_rgba(234,179,8,0.12)] ring-1 ring-[#eab308]/30'
                          : 'bg-[#141414] border border-zinc-800/90 hover:border-zinc-700'
                      }`}
                    >
                      {/* Cabecera Nivel 1 */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs text-[#eab308]">
                            {commentAuthor}
                          </span>
                          <GenderBadge 
                            gender={
                              comment.author_gender || 
                              (isMyComment && user?.uid ? (localStorage.getItem(`user_gender_${user.uid}`) || localStorage.getItem('starryz_user_gender')) : null)
                            } 
                            size="sm" 
                          />
                          {isMyComment && (
                            <span className="bg-[#eab308] text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm">
                              Tú
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-500 font-medium">
                            {formatTimeAgo(comment.created_at)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Botón Responder Nivel 1 */}
                          <button
                            type="button"
                            onClick={() => handleReplyToLevel1(comment)}
                            className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 px-2 py-0.5 rounded-md transition-all cursor-pointer"
                            title={`Responder a ${commentAuthor}`}
                          >
                            <CornerDownRight className="w-3 h-3" />
                            <span>Responder</span>
                          </button>

                          {isMyComment && (
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(comment.id)}
                              className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Eliminar mi respuesta"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Contenido Nivel 1 */}
                      <p className="text-xs text-zinc-200 leading-relaxed font-medium whitespace-pre-wrap">
                        {comment.content}
                      </p>

                      {/* Botón Ver Respuestas / Ocultar Respuestas (Nivel 2) */}
                      {hasReplies && (
                        <div className="pt-1 border-t border-zinc-800/60 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => toggleReplies(comment.id)}
                            className="flex items-center gap-1.5 text-xs font-bold text-[#eab308] hover:text-[#facc15] py-1 cursor-pointer transition-colors"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" />
                                <span>Ocultar respuestas ({replies.length})</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" />
                                <span>Ver {replies.length} {replies.length === 1 ? 'respuesta' : 'respuestas'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Respuestas de Nivel 2 agrupadas */}
                      {hasReplies && isExpanded && (
                        <div className="space-y-2 pl-3.5 sm:pl-4 border-l-2 border-amber-500/30 pt-1">
                          {replies.map((subComment) => {
                            const isMySubComment = !!(user && subComment.firebase_uid === user.uid);
                            const subCommentAuthor = getDisplayAuthorName(subComment.author_name, subComment.firebase_uid, subComment.is_anonymous);
                            const repliedToDisplayName = getDisplayAuthorName(subComment.reply_to_author || comment.author_name, null, false);

                            return (
                              <div
                                key={subComment.id}
                                className={`p-3 rounded-xl space-y-1.5 transition-all ${
                                  isMySubComment
                                    ? 'bg-[#15130b] border-2 border-[#eab308]/70 shadow-sm ring-1 ring-[#eab308]/20'
                                    : 'bg-[#0d0d10] border border-zinc-800/80 hover:border-zinc-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-extrabold text-xs text-white">
                                      {subCommentAuthor}
                                    </span>
                                    <GenderBadge 
                                      gender={
                                        subComment.author_gender || 
                                        (isMySubComment && user?.uid ? (localStorage.getItem(`user_gender_${user.uid}`) || localStorage.getItem('starryz_user_gender')) : null)
                                      } 
                                      size="sm" 
                                    />
                                    {isMySubComment && (
                                      <span className="bg-[#eab308] text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm">
                                        Tú
                                      </span>
                                    )}

                                    {/* Indicador 'X ha respondido a @Y' */}
                                    <span className="inline-flex items-center gap-1 bg-[#eab308]/15 text-[#eab308] border border-[#eab308]/30 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                      <CornerDownRight className="w-2.5 h-2.5" />
                                      <span>ha respondido a @{repliedToDisplayName}</span>
                                    </span>

                                    <span className="text-[10px] text-zinc-500 font-medium">
                                      {formatTimeAgo(subComment.created_at)}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {/* Botón Responder en Nivel 2 */}
                                    <button
                                      type="button"
                                      onClick={() => handleReplyToLevel2(comment.id, subComment)}
                                      className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 px-1.5 py-0.5 rounded transition-all cursor-pointer"
                                      title={`Responder a ${subCommentAuthor}`}
                                    >
                                      <CornerDownRight className="w-2.5 h-2.5" />
                                      <span>Responder</span>
                                    </button>

                                    {isMySubComment && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteClick(subComment.id)}
                                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                                        title="Eliminar mi respuesta"
                                      >
                                        <Trash className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <p className="text-xs text-zinc-200 leading-relaxed font-medium whitespace-pre-wrap">
                                  {subComment.content}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {commentToDelete && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 rounded-[24px]">
          <div className="bg-[#111217] border border-zinc-800 p-6 rounded-2xl w-full max-w-[290px] text-center space-y-4 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <Trash className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-white">¿Eliminar respuesta?</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                ¿Estás seguro de que quieres eliminar tu respuesta? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCommentToDelete(null)}
                className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteComment}
                className="flex-1 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
