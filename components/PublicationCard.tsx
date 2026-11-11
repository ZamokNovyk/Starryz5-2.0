'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Star,
  MessageSquare,
  Bookmark,
  Eye,
  Share2,
  Trash2,
  Send,
  X,
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  Twitter,
  Facebook,
  Loader2,
  Pencil,
  AlertCircle,
  Lock,
  Unlock,
  Users,
  Heart,
  Globe,
  Flag,
  ChevronDown,
  MoreVertical,
  Reply,
  CornerDownRight
} from 'lucide-react';
import {
  UserPublication,
  PublicationReviewComment,
  getPublicationReviews,
  getUserPublicationRating,
  submitPublicationPureRating,
  submitPublicationReview,
  updatePublicationReviewComment,
  deletePublicationReviewComment,
  isPublicationSavedByUser,
  toggleSavePublication,
  incrementPublicationView,
  incrementPublicationShare,
  updateOpenGraphMeta,
  updatePublicationVisibility
} from '@/src/lib/publications';
import { getFlagUrl } from '@/src/data/countries';
import { useAuth } from '@/src/context/AuthContext';
import PublicationRatingsModal from './PublicationRatingsModal';

interface PublicationCardProps {
  publication: UserPublication;
  currentUserId?: string | null;
  onDelete?: (id: string) => void;
  isOwner?: boolean;
}

export default function PublicationCard({
  publication,
  onDelete,
  isOwner = false,
  currentUserId: propUserId,
}: PublicationCardProps) {
  const { user } = useAuth();

  // SEGURIDAD: Para decisiones de autorización (editar/borrar),
  // SIEMPRE usamos el uid de la sesión autenticada actual.
  // NUNCA confiamos en propUserId para autorización — puede llegar con un valor incorrecto.
  // propUserId solo se usa donde se requiere un fallback de visualización (interacciones públicas).
  const sessionUserId = user?.uid || null;

  // Para otras interacciones que no son destructivas (votar, calificar), también usamos la sesión.
  const effectiveUserId = sessionUserId;

  // Control anti-doble clic rápido (mouse defectuoso / rebotes)
  const isVotingRef = useRef(false);
  const lastVoteTimeRef = useRef(0);

  // Estados de interacción
  const [userVote, setUserVote] = useState<number | null>(null);
  const [userRatingRecord, setUserRatingRecord] = useState<PublicationReviewComment | null>(null);
  const [ratingErrorMsg, setRatingErrorMsg] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [savesCount, setSavesCount] = useState<number>(publication.saves_count || 0);
  const [viewsCount, setViewsCount] = useState<number>(publication.views_count || 0);
  const [sharesCount, setSharesCount] = useState<number>(publication.shares_count || 0);

  // Estados de calificación
  const [publicationAvg, setPublicationAvg] = useState<string>(
    publication.rating_avg && publication.rating_avg > 0 ? publication.rating_avg.toFixed(2) : '0.00'
  );
  const [publicationVotesCount, setPublicationVotesCount] = useState<number>(
    (publication.star_1 || 0) +
    (publication.star_2 || 0) +
    (publication.star_3 || 0) +
    (publication.star_4 || 0) +
    (publication.star_5 || 0) || 0
  );

  // Estados de comentarios y filtros ("Todo" vs "Mi interacción")
  const [showComments, setShowComments] = useState(false);
  const [commentsFilter, setCommentsFilter] = useState<'todo' | 'mi_interaccion'>('todo');
  const [commentMode, setCommentMode] = useState<'comentario' | 'reseña'>('comentario');
  const [commentsList, setCommentsList] = useState<PublicationReviewComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [reviewStars, setReviewStars] = useState<number | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [commentsCount, setCommentsCount] = useState<number>(publication.comments_count || 0);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Estado para responder a un comentario específico ("X respondió a X")
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string; userUid: string } | null>(null);
  const [replyInputText, setReplyInputText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Paginación de comentarios y respuestas (máximo 5 + Ver más)
  const [visibleCommentsLimit, setVisibleCommentsLimit] = useState<number>(5);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [repliesLimit, setRepliesLimit] = useState<Record<string, number>>({});

  // Estados de edición de comentario/reseña
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [editingStars, setEditingStars] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Estado del modal de compartir
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Estados de visibilidad / ocultar publicación (candado)
  const [visibility, setVisibility] = useState<string>(publication.estado_de_vista || 'todos');
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  // Estado para reporte visual
  const [showReportToast, setShowReportToast] = useState(false);

  // Estado modal de calificaciones (quién votó)
  const [showRatingsModal, setShowRatingsModal] = useState(false);

  // ¿El usuario ya tiene una reseña (calificación con comentario de texto)?
  const hasExistingReview = Boolean(
    userRatingRecord &&
    userRatingRecord.stars !== null &&
    userRatingRecord.comment &&
    userRatingRecord.comment.trim() !== ''
  );

  // Reproducción de sonidos al calificar con estrellas (star1.mp3 a star5.mp3)
  const playStarAudio = (stars: number) => {
    try {
      const audio = new Audio(`/sonidos/star${stars}.mp3`);
      audio.volume = 0.6;
      audio.play().catch(() => { });
    } catch { }
  };

  // Formateo de fecha relativo y directo (ej: 5 min, 3 horas, ayer, 5 días, 1 semana, o fecha exacta si pasa de 7 días)
  const formatTimeAgo = (dateStr: string) => {
    try {
      if (!dateStr) return 'Reciente';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Reciente';
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSecs < 60) return 'Ahora';
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `${diffDays} días`;
      if (diffDays === 7) return '1 semana';

      // Si pasa de 7 días, mostrar la fecha exacta en la que se subió la publicación
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    } catch {
      return 'Reciente';
    }
  };

  // Formatear conteos grandes (ej: 2400 -> 2.4k)
  const formatCount = (count: number) => {
    if (!count) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  // 1. Cargar estado de guardado y calificación previa del usuario
  useEffect(() => {
    if (!effectiveUserId || !publication.id) return;

    let isMounted = true;

    async function loadUserState() {
      try {
        const [isSaved, ratingRecord] = await Promise.all([
          isPublicationSavedByUser(publication.id, effectiveUserId),
          getUserPublicationRating(publication.id, effectiveUserId)
        ]);

        if (isMounted) {
          setSaved(isSaved);
          if (ratingRecord && ratingRecord.stars) {
            setUserRatingRecord(ratingRecord);
            setUserVote(ratingRecord.stars);
            // Refleja en las estrellas de comentario las que dejó previamente como calificación
            setReviewStars(ratingRecord.stars);
          } else {
            setUserRatingRecord(null);
            setUserVote(null);
            setReviewStars(null);
          }
        }
      } catch (e) { }
    }

    loadUserState();

    return () => {
      isMounted = false;
    };
  }, [publication.id, effectiveUserId]);

  // 2. Registro y conteo de vistas único por sesión
  useEffect(() => {
    if (!publication.id) return;
    const sessionKey = `viewed_pub_${publication.id}`;
    if (typeof window !== 'undefined' && !sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, '1');
      incrementPublicationView(publication.id).then((newViews) => {
        if (newViews > 0) setViewsCount(newViews);
        else setViewsCount((prev) => prev + 1);
      });
    }
  }, [publication.id]);

  // Cargar comentarios si se abre la sección
  const handleToggleComments = async () => {
    const nextState = !showComments;
    setShowComments(nextState);

    if (nextState) {
      try {
        setLoadingComments(true);
        const reviews = await getPublicationReviews(publication.id);
        setCommentsList(Array.isArray(reviews) ? reviews : []);
      } catch (err) {
        console.warn('Error al cargar comentarios:', err);
        setCommentsList([]);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  // Votar directamente con puras estrellas en la barra de 5 estrellas grandes
  const handleDirectStarVote = async (stars: number) => {
    if (!effectiveUserId) {
      alert('Debes iniciar sesión para calificar esta publicación.');
      return;
    }

    // Prevención estricta de doble clic rápido (debounce de 600ms y bloqueo activo)
    const now = Date.now();
    if (isVotingRef.current || (now - lastVoteTimeRef.current < 600)) {
      return;
    }
    isVotingRef.current = true;
    lastVoteTimeRef.current = now;

    playStarAudio(stars);
    setUserVote(stars);
    setReviewStars(stars);
    setRatingErrorMsg(null);

    try {
      const res = await submitPublicationPureRating({
        publicationId: publication.id,
        userUid: effectiveUserId,
        stars: stars,
        authorInfo: {
          displayName: user?.displayName || 'Usuario Starryz',
          avatarUrl: user?.photoURL || null,
        }
      });

      if (res.success) {
        if (res.updatedReview) {
          setUserRatingRecord(res.updatedReview);
        }
        if (typeof res.rating_avg === 'number') {
          setPublicationAvg(res.rating_avg.toFixed(2));
        }
        if (typeof res.total_votes === 'number') {
          setPublicationVotesCount(res.total_votes);
        }
        setFeedbackMsg(`¡Calificado con ${stars} ${stars === 1 ? 'estrella' : 'estrellas'}!`);
        setTimeout(() => setFeedbackMsg(null), 3000);
      } else if (res.error) {
        setRatingErrorMsg(res.error);
        setTimeout(() => setRatingErrorMsg(null), 5000);
      }
    } catch (e) {
      console.warn('Error al votar estrellas:', e);
    } finally {
      setTimeout(() => {
        isVotingRef.current = false;
      }, 350);
    }
  };

  // Enviar comentario o reseña
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId) {
      alert('Debes iniciar sesión para comentar.');
      return;
    }

    const trimmed = commentText.trim();
    const isReseña = commentMode === 'reseña';

    if (isReseña) {
      if (!userVote) {
        alert('Para dejar una reseña, primero califica esta publicación con las estrellas de arriba.');
        return;
      }
      if (!trimmed) {
        alert('Por favor escribe tu reseña.');
        return;
      }
    } else {
      if (!trimmed) {
        return;
      }
    }

    try {
      setSubmittingReview(true);
      const chosenStars = isReseña ? userVote : null;

      if (chosenStars) {
        playStarAudio(chosenStars);
      }

      const res = await submitPublicationReview({
        publicationId: publication.id,
        userUid: effectiveUserId,
        stars: chosenStars,
        comment: trimmed || null,
        parentId: replyingTo?.id || null,
        replyToUserName: replyingTo?.userName || null,
        replyToUserUid: replyingTo?.userUid || null,
        publicationAuthorUid: publication.user_id,
        authorInfo: {
          displayName: user?.displayName || 'Usuario Starryz',
          avatarUrl: user?.photoURL || null,
        }
      });

      if (res.success) {
        if (res.newReview) {
          const revId = res.newReview.id || (res.newReview as any).uuid;
          setCommentsList((prev) => {
            const exists = prev.some((r) => (r.id || (r as any).uuid) === revId);
            if (exists) {
              return prev.map((r) => ((r.id || (r as any).uuid) === revId ? res.newReview! : r));
            }
            return [...prev, res.newReview!];
          });

          if (res.newReview.stars) {
            setUserRatingRecord(res.newReview);
            setUserVote(res.newReview.stars);
            setReviewStars(res.newReview.stars);
          }
        }
        if (typeof res.rating_avg === 'number') {
          setPublicationAvg(res.rating_avg.toFixed(2));
        }
        if (typeof res.total_votes === 'number') {
          setPublicationVotesCount(res.total_votes);
        }
        if (typeof res.comments_count === 'number') {
          setCommentsCount(res.comments_count);
        }
        setCommentText('');
        setReplyingTo(null);
        setFeedbackMsg(
          replyingTo
            ? `¡Respuesta a @${replyingTo.userName} enviada!`
            : isReseña
              ? '¡Reseña guardada con éxito!'
              : '¡Comentario publicado con éxito!'
        );
        setTimeout(() => setFeedbackMsg(null), 3000);
      } else if (res.error) {
        alert(res.error);
      }
    } catch (err: any) {
      console.error('Error al enviar comentario:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Iniciar respuesta inline a un comentario o respuesta
  const handleStartReply = (targetComment: PublicationReviewComment) => {
    // Si ya es una respuesta a un padre, ligar al padre para mantener el hilo
    const rootParentId = targetComment.parent_id || targetComment.id;
    setReplyingTo({
      id: rootParentId,
      userName: targetComment.user_display_name || 'Compañero',
      userUid: targetComment.user_uid,
    });
    setReplyInputText('');
    // Auto-expandir las respuestas de ese padre para ver el contexto
    setExpandedReplies((prev) => ({ ...prev, [rootParentId]: true }));
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 100);
  };

  // Enviar respuesta inline
  const handleSubmitInlineReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId) {
      alert('Debes iniciar sesión para responder.');
      return;
    }
    if (!replyingTo) return;
    const trimmed = replyInputText.trim();
    if (!trimmed) return;

    try {
      setSubmittingReply(true);
      const res = await submitPublicationReview({
        publicationId: publication.id,
        userUid: effectiveUserId,
        stars: null,
        comment: trimmed,
        parentId: replyingTo.id,
        replyToUserName: replyingTo.userName,
        replyToUserUid: replyingTo.userUid,
        publicationAuthorUid: publication.user_id,
        authorInfo: {
          displayName: user?.displayName || 'Usuario Starryz',
          avatarUrl: user?.photoURL || null,
        }
      });

      if (res.success && res.newReview) {
        setCommentsList((prev) => {
          // Agregar la nueva respuesta y además incrementar Answers en el comentario padre localmente
          const updated = prev.map((item) => {
            if (item.id === replyingTo.id) {
              const currentAns = Number(item.Answers ?? item.answers ?? 0);
              return { ...item, Answers: currentAns + 1, answers: currentAns + 1 };
            }
            return item;
          });
          return [...updated, res.newReview!];
        });

        if (typeof res.comments_count === 'number') {
          setCommentsCount(res.comments_count);
        }

        setReplyInputText('');
        setReplyingTo(null);
        setFeedbackMsg(`¡Respuesta a @${replyingTo.userName} enviada!`);
        setTimeout(() => setFeedbackMsg(null), 3000);
      } else if (res.error) {
        alert(res.error);
      }
    } catch (err: any) {
      console.error('Error al enviar respuesta:', err);
    } finally {
      setSubmittingReply(false);
    }
  };

  // Iniciar edición de un comentario o reseña
  const handleStartEdit = (rev: PublicationReviewComment) => {
    setEditingReviewId(rev.id);
    setEditingCommentText(rev.comment || '');
    setEditingStars(rev.stars || null);
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setEditingCommentText('');
    setEditingStars(null);
  };

  // Guardar edición
  const handleSaveEdit = async (reviewId: string) => {
    if (!effectiveUserId) return;
    try {
      setSavingEdit(true);
      if (editingStars) {
        playStarAudio(editingStars);
      }

      const res = await updatePublicationReviewComment({
        reviewId,
        publicationId: publication.id,
        userUid: effectiveUserId,
        comment: editingCommentText,
        stars: editingStars,
      });

      if (res.success && res.updatedReview) {
        setCommentsList((prev) => prev.map((r) => r.id === reviewId ? res.updatedReview! : r));
        if (res.updatedReview.stars !== null) {
          setUserRatingRecord(res.updatedReview);
          setUserVote(res.updatedReview.stars);
          setReviewStars(res.updatedReview.stars);
        }
        if (typeof res.rating_avg === 'number') {
          setPublicationAvg(res.rating_avg.toFixed(2));
        }
        if (typeof res.total_votes === 'number') {
          setPublicationVotesCount(res.total_votes);
        }
        if (typeof res.comments_count === 'number') {
          setCommentsCount(res.comments_count);
        }
        setEditingReviewId(null);
        setFeedbackMsg('¡Comentario / reseña actualizado!');
        setTimeout(() => setFeedbackMsg(null), 3000);
      } else if (res.error) {
        alert(res.error);
      }
    } catch (err: any) {
      console.error('Error al editar:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  // Eliminar comentario o reseña
  const handleDeleteComment = async (reviewId: string, hadStars: boolean, isReplyOfParentId?: string | null) => {
    if (!effectiveUserId) return;
    if (!window.confirm('¿Deseas eliminar este comentario / reseña?')) return;

    try {
      const res = await deletePublicationReviewComment(reviewId, publication.id, effectiveUserId);
      if (res.success) {
        setCommentsList((prev) => {
          // Si es una respuesta hija, removerla y decrementar Answers en el padre
          if (isReplyOfParentId) {
            return prev
              .filter((r) => r.id !== reviewId)
              .map((r) => {
                if (r.id === isReplyOfParentId) {
                  const currentAns = Number(r.Answers ?? r.answers ?? 0);
                  const nextAns = Math.max(0, currentAns - 1);
                  return { ...r, Answers: nextAns, answers: nextAns };
                }
                return r;
              });
          }
          // Si es un comentario raíz: eliminar el comentario principal Y TODAS SUS RESPUESTAS hijas (hilo completo)
          return prev.filter((r) => r.id !== reviewId && r.parent_id !== reviewId);
        });

        if (hadStars) {
          setUserRatingRecord(null);
          setUserVote(null);
          setReviewStars(null);
        }
        if (typeof res.rating_avg === 'number') {
          setPublicationAvg(res.rating_avg.toFixed(2));
        }
        if (typeof res.total_votes === 'number') {
          setPublicationVotesCount(res.total_votes);
        }
        if (typeof res.comments_count === 'number') {
          setCommentsCount(res.comments_count);
        }
        setFeedbackMsg('Comentario / reseña eliminado.');
        setTimeout(() => setFeedbackMsg(null), 3000);
      } else if (res.error) {
        alert(res.error);
      }
    } catch (err) {
      console.error('Error al eliminar:', err);
    }
  };

  // Alternar Guardado (Bookmark)
  const handleToggleBookmark = async () => {
    if (!effectiveUserId) {
      alert('Debes iniciar sesión para guardar publicaciones.');
      return;
    }

    if (savingBookmark) return;

    try {
      setSavingBookmark(true);
      const res = await toggleSavePublication(publication.id, effectiveUserId, savesCount);
      setSaved(res.isSaved);
      setSavesCount(res.saves_count);
    } catch (err) {
      console.error('Error al guardar publicación:', err);
    } finally {
      setSavingBookmark(false);
    }
  };

  // Abrir modal de compartir y actualizar Open Graph
  const handleOpenShare = () => {
    const shareUrl = `${window.location.origin}/perfil/${publication.user_id}?pub=${publication.id}`;
    const shareTitle = `${displayName} en Starryz 5: "${publication.description ? publication.description.substring(0, 60) : 'Publicación'}"`;
    const shareDesc = publication.description || 'Mira esta foto y reseña en la red social universitaria Starryz 5.';

    // Actualizar dinámicamente etiquetas Open Graph para previsualizaciones en redes sociales
    updateOpenGraphMeta({
      title: shareTitle,
      description: shareDesc,
      imageUrl: publication.image_url,
      url: shareUrl,
    });

    // Incrementar contador de compartidos
    incrementPublicationShare(publication.id).then((newShares) => {
      if (newShares > 0) setSharesCount(newShares);
      else setSharesCount((prev) => prev + 1);
    });

    setShowShareModal(true);
  };

  // Copiar link de compartir
  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/perfil/${publication.user_id}?pub=${publication.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Compartir nativo del navegador (móviles y navegadores modernos)
  const handleNativeShare = async () => {
    const shareUrl = `${window.location.origin}/perfil/${publication.user_id}?pub=${publication.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Publicación de ${displayName} en Starryz 5`,
          text: publication.description || 'Mira esta publicación en Starryz 5',
          url: shareUrl,
        });
      } catch { }
    } else {
      handleCopyLink();
    }
  };

  // Datos del autor
  const author = publication.author_data;
  const displayName = author?.display_name || publication.user_display_name || 'Estudiante';
  const avatarUrl = author?.photo_url || publication.user_avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

  const rawGender = (author?.gender || '').toLowerCase();
  const isMale = rawGender === 'male' || rawGender === 'hombre';
  const isFemale = rawGender === 'female' || rawGender === 'mujer';
  const countryCode = (author?.country_code || 'pe').toLowerCase();

  const profileScore = author?.score !== undefined && author?.score !== null
    ? Number(author.score).toFixed(1)
    : '5.0';

  const handleDelete = async () => {
    if (!onDelete) return;
    if (window.confirm('¿Estás seguro de que deseas eliminar esta publicación?')) {
      setIsDeleting(true);
      await onDelete(publication.id);
      setIsDeleting(false);
    }
  };

  // Cambiar estado de visibilidad / ocultar (todos, solo_yo, solo_seguidores, solo_fans)
  const handleChangeVisibility = async (newVisibility: string) => {
    if (!effectiveUserId) return;
    try {
      setUpdatingVisibility(true);
      setVisibility(newVisibility);
      setShowVisibilityMenu(false);
      await updatePublicationVisibility(publication.id, effectiveUserId, newVisibility);
      setFeedbackMsg(`Visibilidad cambiada: ${newVisibility === 'solo_yo' ? 'Solo yo (Oculto)' :
          newVisibility === 'solo_seguidores' ? 'Solo seguidores' :
            newVisibility === 'solo_fans' ? 'Solo fans' : 'Todos'
        }`);
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err) {
      console.warn('Error al actualizar visibilidad:', err);
    } finally {
      setUpdatingVisibility(false);
    }
  };

  // Manejar reporte (por el momento solo visual)
  const handleReportPublication = () => {
    setShowReportToast(true);
    setTimeout(() => setShowReportToast(false), 3500);
  };

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/perfil/${publication.user_id}?pub=${publication.id}`
    : '';

  return (
    <article className="bg-[#101116] border border-[#23242d] rounded-3xl p-4 sm:p-6 shadow-2xl transition-all duration-200 max-w-3xl mx-auto w-full space-y-4">
      {/* HEADER DE LA PUBLICACIÓN REDISEÑADO */}
      <div className="relative">
        {/* Botón de 3 puntos vertical posicionado arriba a la derecha */}
        <div className="absolute right-0 top-0 z-20">
          <button
            type="button"
            onClick={() => setShowOptionsMenu((prev) => !prev)}
            title="Más opciones"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Dropdown del menú de opciones (Visibilidad, Reportar, Eliminar) */}
          {showOptionsMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowOptionsMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-52 bg-[#12131a] border border-zinc-800 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                {/* Si es dueño: Opción de visibilidad / Modo vista */}
                {isOwner && (
                  <div className="border-b border-zinc-800/80 pb-1 mb-1">
                    <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                      Modo de vista
                    </div>

                    {/* 1. Todos */}
                    <button
                      type="button"
                      onClick={() => {
                        handleChangeVisibility('todos');
                        setShowOptionsMenu(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${visibility === 'todos' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Todos</span>
                      </span>
                      {visibility === 'todos' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>

                    {/* 2. Solo yo */}
                    <button
                      type="button"
                      onClick={() => {
                        handleChangeVisibility('solo_yo');
                        setShowOptionsMenu(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${visibility === 'solo_yo' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Solo yo (Ocultar)</span>
                      </span>
                      {visibility === 'solo_yo' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </button>

                    {/* 3. Solo seguidores */}
                    <button
                      type="button"
                      onClick={() => {
                        handleChangeVisibility('solo_seguidores');
                        setShowOptionsMenu(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${visibility === 'solo_seguidores' ? 'bg-blue-500/20 text-blue-300' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span>Solo seguidores</span>
                      </span>
                      {visibility === 'solo_seguidores' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>

                    {/* 4. Solo fans */}
                    <button
                      type="button"
                      onClick={() => {
                        handleChangeVisibility('solo_fans');
                        setShowOptionsMenu(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${visibility === 'solo_fans' ? 'bg-pink-500/20 text-pink-300' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <Heart className="w-3.5 h-3.5 text-pink-400" />
                        <span>Solo fans</span>
                      </span>
                      {visibility === 'solo_fans' && <Check className="w-3.5 h-3.5 text-pink-400" />}
                    </button>
                  </div>
                )}

                {/* Opción de Reportar */}
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    handleReportPublication();
                  }}
                  className="w-full px-2.5 py-2 rounded-xl text-left text-xs font-semibold text-zinc-300 hover:text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Flag className="w-4 h-4 text-zinc-400" />
                  <span>Reportar publicación</span>
                </button>

                {/* Si es dueño: Opción de Eliminar */}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      handleDelete();
                    }}
                    disabled={isDeleting}
                    className="w-full px-2.5 py-2 rounded-xl text-left text-xs font-semibold text-red-400 hover:bg-red-500/15 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <span>Eliminar publicación</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Contenedor de usuario: Avatar + Nombre Completo + Metadatos */}
        <div className="flex items-start gap-3 pr-7 sm:pr-9 min-w-0">
          {/* Avatar del usuario */}
          <div className="relative flex-shrink-0 mt-0.5">
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border border-[#3b3d4a] ring-2 ring-black shadow-md"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
              }}
            />
          </div>

          {/* Información del usuario con espacio completo para el nombre */}
          <div className="min-w-0 flex-1">
            {/* Nombre completo: si es muy largo, se muestra completo y salta de línea naturalmente */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-extrabold text-white text-sm sm:text-base tracking-tight leading-snug break-words">
                {displayName}
              </h4>

              {/* Sexo (gender) */}
              {(isMale || isFemale) && (
                <span
                  className={`text-xs font-black leading-none select-none flex-shrink-0 ${isMale ? 'text-blue-400' : 'text-pink-400'
                    }`}
                  title={isMale ? 'Hombre ♂' : 'Mujer ♀'}
                >
                  {isMale ? '♂' : '♀'}
                </span>
              )}

              {/* Bandera nacionalidad (country_code) */}
              {countryCode && (
                <img
                  src={getFlagUrl(countryCode, 'w40')}
                  alt={countryCode}
                  className="w-4 h-3 sm:w-4.5 sm:h-3.5 object-cover rounded-xs border border-zinc-700/60 shadow-xs flex-shrink-0"
                  loading="lazy"
                />
              )}
            </div>

            {/* Metadatos: Calificación de perfil + Tiempo directo */}
            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 font-medium flex-wrap">
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#252317] border border-[#524515] text-[10px] font-bold text-[#eab308]">
                <Star className="w-2.5 h-2.5 fill-[#eab308] text-[#eab308]" />
                <span>{profileScore}</span>
                <span className="text-[9px] text-zinc-400 font-medium">(Perfil)</span>
              </div>

              <span>•</span>
              <p className="text-zinc-400 font-medium">{formatTimeAgo(publication.created_at)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast informativo de reporte (visual) */}
      {showReportToast && (
        <div className="px-3 py-2 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
          <Flag className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span>Publicación reportada para moderación. Gracias por ayudar a la comunidad.</span>
        </div>
      )}

      {/* TEXTO DE DESCRIPCIÓN */}
      {publication.description && (
        <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-normal whitespace-pre-wrap break-words px-1">
          {publication.description}
        </p>
      )}

      {/* IMAGEN DE LA PUBLICACIÓN (Adaptable al tamaño natural para evitar imágenes cortadas) */}
      <div className="relative rounded-2xl overflow-hidden bg-[#070709] border border-[#23242d] shadow-inner flex items-center justify-center p-1 sm:p-2">
        <img
          src={publication.image_url}
          alt={publication.description ? publication.description.substring(0, 40) : 'Publicación'}
          className="w-auto max-w-full max-h-[85vh] sm:max-h-[750px] object-contain rounded-xl mx-auto shadow-md block"
          loading="lazy"
        />
      </div>

      {/* CONTENEDOR DE 5 ESTRELLAS CON SONIDO DE ESTRELLA (star1.mp3 a star5.mp3) */}
      <div className="border border-[#23242d] bg-[#0c0d12]/80 rounded-2xl py-2.5 px-4 flex flex-col items-center justify-center gap-1 shadow-sm">
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          {[1, 2, 3, 4, 5].map((star) => {
            const isSelected = userVote !== null && star <= userVote;
            return (
              <button
                key={star}
                type="button"
                onClick={() => handleDirectStarVote(star)}
                title={`Votar ${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
                className="p-1.5 text-zinc-500 hover:text-[#facc15] hover:scale-125 transition-all cursor-pointer active:scale-95 group"
              >
                <Star
                  className={`w-6 h-6 sm:w-7 sm:h-7 transition-all ${isSelected
                      ? 'fill-[#facc15] text-[#facc15] scale-110 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]'
                      : 'text-zinc-500 stroke-[1.5] group-hover:stroke-[#facc15]'
                    }`}
                />
              </button>
            );
          })}
        </div>

        {/* Calificación general de la imagen / publicación (debajo de las estrellas grandes) - Clickable para ver votantes */}
        <button
          type="button"
          onClick={() => setShowRatingsModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181922] hover:bg-[#20212e] border border-[#373948] hover:border-amber-500/50 text-[#facc15] text-xs font-extrabold tracking-wider shadow-sm select-none mt-1 cursor-pointer transition-all active:scale-95 group"
          title="Ver quiénes calificaron esta publicación"
        >
          <Star className="w-3.5 h-3.5 fill-[#facc15] text-[#facc15] group-hover:scale-110 transition-transform" />
          <span className="font-mono text-white text-xs">{publicationAvg}</span>
          <span className="text-[11px] text-zinc-400 group-hover:text-zinc-200 font-normal">({publicationVotesCount} {publicationVotesCount === 1 ? 'voto' : 'votos'})</span>
        </button>

        {ratingErrorMsg && (
          <div className="mt-1 px-3 py-1.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-300 text-[11px] font-semibold flex items-center gap-1.5 animate-in fade-in duration-200">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
            <span>{ratingErrorMsg}</span>
          </div>
        )}

        {feedbackMsg && (
          <p className="text-[11px] font-bold text-amber-400 animate-in fade-in duration-200">
            {feedbackMsg}
          </p>
        )}
      </div>

      {/* BOTONES INFERIORES DE ESTADÍSTICAS (COMENTARIOS, GUARDADOS, VISTAS, COMPARTIR) */}
      <div className="flex items-center justify-between pt-1 px-3 text-zinc-400 text-xs sm:text-sm font-semibold border-t border-zinc-800/40">
        {/* 1. Comentarios */}
        <button
          type="button"
          onClick={handleToggleComments}
          className={`flex items-center gap-2 transition-colors cursor-pointer py-1.5 px-2 rounded-xl group ${showComments ? 'bg-blue-500/10 text-blue-400' : 'hover:text-white hover:bg-zinc-900/60'
            }`}
          title="Ver o escribir comentarios"
        >
          <MessageSquare className={`w-4 h-4 transition-colors ${showComments ? 'text-blue-400' : 'text-zinc-400 group-hover:text-blue-400'}`} />
          <span className="font-mono text-xs text-zinc-300">{formatCount(commentsCount)}</span>
        </button>

        {/* 2. Guardados (user_guardados) */}
        <button
          type="button"
          onClick={handleToggleBookmark}
          disabled={savingBookmark}
          className={`flex items-center gap-2 transition-colors cursor-pointer py-1.5 px-2 rounded-xl group ${saved ? 'text-amber-400 bg-amber-500/10' : 'hover:text-white hover:bg-zinc-900/60'
            }`}
          title={saved ? 'Quitar de guardados' : 'Guardar en Mi Perfil > Guardados'}
        >
          <Bookmark className={`w-4 h-4 transition-colors ${saved ? 'fill-amber-400 text-amber-400' : 'text-zinc-400 group-hover:text-amber-400'
            }`} />
          <span className="font-mono text-xs text-zinc-300">
            {formatCount(savesCount)}
          </span>
        </button>

        {/* 3. Vistas */}
        <div
          className="flex items-center gap-2 text-zinc-400 py-1.5 px-2 select-none"
          title="Vistas de la publicación"
        >
          <Eye className="w-4 h-4 text-zinc-400" />
          <span className="font-mono text-xs text-zinc-300">
            {formatCount(viewsCount)}
          </span>
        </div>

        {/* 4. Compartir */}
        <button
          type="button"
          onClick={handleOpenShare}
          className="flex items-center gap-2 hover:text-white hover:bg-zinc-900/60 transition-colors cursor-pointer py-1.5 px-2 rounded-xl group"
          title="Compartir publicación con previsualización de imagen"
        >
          <Share2 className="w-4 h-4 text-zinc-400 group-hover:text-pink-400 transition-colors" />
          <span className="font-mono text-xs text-zinc-300">
            {formatCount(sharesCount)}
          </span>
        </button>
      </div>

      {/* SECCIÓN EXPANDIBLE DE RESEÑAS Y COMENTARIOS */}
      {showComments && (
        <div className="pt-3 border-t border-zinc-800/80 space-y-4 animate-in fade-in duration-200">
          {/* Formulario para escribir comentario / reseña con PESTAÑAS SEPARADAS */}
          <div className="bg-[#0c0d12] border border-zinc-800/80 rounded-2xl p-3 sm:p-4 space-y-3">
            {/* Selector de pestañas: Comentario vs Reseña */}
            <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2.5">
              <button
                type="button"
                onClick={() => setCommentMode('comentario')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${commentMode === 'comentario'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
                  }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Comentario</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCommentMode('reseña');
                  // Si no tiene estrellas de reseña seleccionadas pero ya votó en la barra grande, precargar
                  if (!reviewStars && userVote) {
                    setReviewStars(userVote);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${commentMode === 'reseña'
                    ? 'bg-[#eab308]/15 border border-[#eab308]/40 text-[#facc15] shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
                  }`}
              >
                <Star className="w-3.5 h-3.5" />
                <span>Reseña (1 por usuario)</span>
                {hasExistingReview && (
                  <span className="text-[10px] px-1 rounded bg-[#eab308]/20 text-[#facc15]">
                    Activa
                  </span>
                )}
              </button>
            </div>

            {/* Formulario según pestaña activa */}
            <form onSubmit={handleSubmitComment} className="space-y-3">
              {commentMode === 'reseña' ? (
                /* MODO RESEÑA: Las estrellas reflejan estrictamente la calificación superior y NO se modifican aquí */
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-[#facc15] fill-[#facc15]" />
                      <span>Calificación de tu reseña:</span>
                    </span>

                    {/* Estrellas fijas (de solo lectura) sincronizadas con las estrellas grandes de arriba */}
                    {userVote ? (
                      <div className="flex items-center gap-1 bg-[#1a1708] border border-[#524515] px-2 py-0.5 rounded-lg select-none" title="Calificación fija seleccionada en las estrellas de arriba">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${star <= userVote
                                ? 'fill-[#facc15] text-[#facc15] drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]'
                                : 'text-zinc-600'
                              }`}
                          />
                        ))}
                        <span className="text-xs font-black text-[#facc15] ml-1">
                          ({userVote}★)
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-amber-400 font-semibold">
                        Sin calificar arriba
                      </span>
                    )}
                  </div>

                  {!userVote ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                      <span>Para poder dejar tu reseña, <strong>primero califica la publicación</strong> en las estrellas grandes de arriba.</span>
                    </div>
                  ) : hasExistingReview ? (
                    <p className="text-[11px] text-zinc-400">
                      Ya tienes una reseña. Al enviar se actualizará tu comentario con tu calificación actual de {userVote} estrellas.
                    </p>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      disabled={!userVote}
                      placeholder={
                        userVote
                          ? `Escribe tu reseña con ${userVote} estrellas...`
                          : 'Primero califica con las estrellas de arriba...'
                      }
                      maxLength={400}
                      className="flex-1 bg-[#14151b] border border-zinc-700/80 focus:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={submittingReview || !commentText.trim() || !userVote}
                      className="px-4 py-2 rounded-xl bg-[#eab308] hover:bg-yellow-400 text-black font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex-shrink-0"
                    >
                      {submittingReview ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{hasExistingReview ? 'Actualizar' : 'Publicar Reseña'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* MODO COMENTARIO: Múltiples comentarios públicos de texto */
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Escribe un comentario público (puedes comentar varias veces)..."
                      maxLength={400}
                      className="flex-1 bg-[#14151b] border border-zinc-700/80 focus:border-blue-400 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={submittingReview || !commentText.trim()}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex-shrink-0"
                    >
                      {submittingReview ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Comentar</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* DIVISIÓN DE PESTAÑAS: TODO Y MI INTERACCIÓN */}
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2">
            <button
              type="button"
              onClick={() => setCommentsFilter('todo')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${commentsFilter === 'todo'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
                }`}
            >
              <span>Todo</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-900 border border-zinc-700/60 text-zinc-400">
                {(commentsList || []).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCommentsFilter('mi_interaccion')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${commentsFilter === 'mi_interaccion'
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60'
                }`}
            >
              <span>Mi interacción</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-900 border border-zinc-700/60 text-amber-400">
                {(commentsList || []).filter((c) => effectiveUserId && c?.user_uid === effectiveUserId).length}
              </span>
            </button>
          </div>

          {/* Lista de comentarios */}
          <div className="space-y-2.5 max-h-80 overflow-y-auto no-scrollbar pr-1">
            {loadingComments ? (
              <div className="py-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Cargando comentarios...</span>
              </div>
            ) : (() => {
              const safeList = Array.isArray(commentsList) ? commentsList : [];
              const myComments = safeList.filter((c) => effectiveUserId && c?.user_uid === effectiveUserId);
              const displayed = commentsFilter === 'todo' ? safeList : myComments;

              if (displayed.length === 0) {
                return (
                  <p className="text-center py-6 text-xs text-zinc-500 font-medium">
                    {commentsFilter === 'mi_interaccion'
                      ? 'Aún no has dejado ningún comentario o reseña en esta publicación.'
                      : 'No hay comentarios todavía. ¡Sé el primero en opinar!'}
                  </p>
                );
              }

              // Organizar en comentarios raíz y respuestas hijas
              const rootComments = displayed.filter((c) => !c.parent_id);
              const repliesByParent = new Map<string, PublicationReviewComment[]>();
              safeList.forEach((c) => {
                if (c.parent_id) {
                  const arr = repliesByParent.get(c.parent_id) || [];
                  arr.push(c);
                  repliesByParent.set(c.parent_id, arr);
                }
              });

              // Si en "mi_interacción" hay respuestas cuyo padre no es mío, mostrarlas también
              const orphanReplies = displayed.filter(
                (c) => c.parent_id && !rootComments.some((root) => (root.id || (root as any).uuid) === c.parent_id)
              );

              const allDisplayRoots = [...rootComments, ...orphanReplies];
              const visibleRoots = allDisplayRoots.slice(0, visibleCommentsLimit);
              const hasMoreComments = allDisplayRoots.length > visibleCommentsLimit;

              return (
                <>
                  {visibleRoots.map((rev) => {
                    const reviewKey = rev.id || (rev as any).uuid;
                    const isMyReview = Boolean(effectiveUserId && rev.user_uid === effectiveUserId);
                    const isEditingThis = editingReviewId === reviewKey;
                    const childReplies = repliesByParent.get(reviewKey) || [];

                    // Conteo de respuestas: se lee EXCLUSIVAMENTE de la columna Answers de la BD.
                    // La actualización optimista local refleja el cambio hasta que el usuario
                    // recargue los comentarios. Nunca contamos childReplies.length para el badge.
                    const totalRepliesCount = Number(rev.Answers ?? rev.answers ?? 0);

                    const isExpanded = Boolean(expandedReplies[reviewKey]);
                    const currentRepliesLimit = repliesLimit[reviewKey] || 5;
                    const visibleReplies = childReplies.slice(0, currentRepliesLimit);
                    const hasMoreReplies = childReplies.length > currentRepliesLimit;
                    const isReplyingThisThread = replyingTo?.id === reviewKey;

                    return (
                      <div key={reviewKey} className="space-y-2">
                        {/* Tarjeta del comentario raíz */}
                        <div className="bg-[#14151b] border border-zinc-800/60 rounded-xl p-3 space-y-2 shadow-sm transition-colors hover:border-zinc-700/60">
                          {/* Header del comentario: autor, estrellas, fecha, responder, editar/borrar */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {rev.user_avatar_url ? (
                                <img
                                  src={rev.user_avatar_url}
                                  alt="Usuario"
                                  className="w-6 h-6 rounded-full object-cover border border-zinc-700 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-black flex items-center justify-center uppercase flex-shrink-0">
                                  {(rev.user_display_name || 'U').charAt(0)}
                                </div>
                              )}
                              <span className="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[180px]">
                                {rev.user_display_name || 'Compañero'}
                              </span>
                              {rev.parent_id && rev.reply_to_user_name && (
                                <span className="text-[10px] text-amber-400 font-medium truncate max-w-[120px]">
                                  ↳ respondió a @{rev.reply_to_user_name}
                                </span>
                              )}
                              {isMyReview && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-bold">
                                  Tú
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                              {rev.stars && !isEditingThis && (
                                <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  <span>{rev.stars}</span>
                                </div>
                              )}
                              <span className="text-[10px] text-zinc-500">
                                {formatTimeAgo(rev.created_at)}
                              </span>

                              {/* Botón Responder */}
                              {!isEditingThis && (
                                <button
                                  type="button"
                                  onClick={() => handleStartReply(rev)}
                                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Responder a este comentario"
                                >
                                  <Reply className="w-2.5 h-2.5 text-blue-400" />
                                  <span>Responder</span>
                                </button>
                              )}

                              {/* Botones de Editar y Borrar para el autor */}
                              {isMyReview && !isEditingThis && (
                                <div className="flex items-center gap-1 ml-0.5 border-l border-zinc-800 pl-1.5">
                                  {!rev.stars && (
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(rev)}
                                      className="p-1 text-zinc-400 hover:text-amber-400 transition-colors rounded-md hover:bg-zinc-800 cursor-pointer"
                                      title="Editar comentario"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(reviewKey, Boolean(rev.stars))}
                                    className="p-1 text-zinc-400 hover:text-red-400 transition-colors rounded-md hover:bg-zinc-800 cursor-pointer"
                                    title={rev.stars ? "Eliminar reseña e hilo" : "Eliminar comentario e hilo"}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* MODO EDICIÓN */}
                          {isEditingThis ? (
                            <div className="space-y-2 pt-1 border-t border-zinc-800/60 animate-in fade-in duration-150">
                              {rev.stars ? (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                    <Star className="w-3 h-3 text-[#facc15] fill-[#facc15]" />
                                    <span>Calificación de tu reseña:</span>
                                  </span>
                                  <div className="flex items-center gap-1 bg-[#1a1708] border border-[#524515] px-2 py-0.5 rounded-lg select-none">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={`w-3.5 h-3.5 ${star <= (rev.stars || 0)
                                            ? 'fill-[#facc15] text-[#facc15]'
                                            : 'text-zinc-600'
                                          }`}
                                      />
                                    ))}
                                    <span className="text-[10px] font-bold text-[#facc15] ml-1">
                                      ({rev.stars}★)
                                    </span>
                                  </div>
                                </div>
                              ) : null}

                              <textarea
                                rows={2}
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                maxLength={400}
                                className="w-full bg-[#0d0e12] border border-zinc-700/80 focus:border-amber-400 rounded-lg p-2 text-xs text-white placeholder-zinc-500 outline-none resize-none leading-relaxed"
                              />

                              <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  disabled={savingEdit}
                                  className="px-2.5 py-1 rounded-lg text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(reviewKey)}
                                  disabled={savingEdit || (!editingCommentText.trim() && editingStars === null)}
                                  className="px-3 py-1 rounded-lg bg-[#eab308] hover:bg-yellow-400 text-black font-black text-[11px] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
                                >
                                  {savingEdit ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  <span>Guardar</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* TEXTO NORMAL DEL COMENTARIO */
                            rev.comment && (
                              <p className="text-xs text-zinc-300 leading-relaxed pl-8">
                                {rev.comment}
                              </p>
                            )
                          )}

                          {/* BOTÓN "VER RESPUESTAS (N)" exclusivo de comentarios principales */}
                          {!rev.parent_id && totalRepliesCount > 0 && (
                            <div className="pt-1 pl-8">
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedReplies((prev) => ({
                                    ...prev,
                                    [reviewKey]: !prev[reviewKey],
                                  }));
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline transition-all cursor-pointer"
                              >
                                <CornerDownRight className="w-3 h-3 text-amber-400" />
                                <span>
                                  {isExpanded
                                    ? `Ocultar respuestas (${totalRepliesCount})`
                                    : `Ver respuestas (${totalRepliesCount})`}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* CUADRO DE TEXTO PARA RESPONDER: aparece JUSTO DEBAJO del comentario o respuesta */}
                        {isReplyingThisThread && (
                          <div className="ml-5 sm:ml-7 pl-3 border-l-2 border-blue-500/50 animate-in fade-in zoom-in-95 duration-150">
                            <form
                              onSubmit={handleSubmitInlineReply}
                              className="bg-[#0e1017] border border-blue-500/40 rounded-xl p-2.5 space-y-2 shadow-lg"
                            >
                              <div className="flex items-center justify-between text-xs text-blue-300">
                                <div className="flex items-center gap-1.5">
                                  <Reply className="w-3 h-3 text-blue-400" />
                                  <span>
                                    Respondiendo a <strong className="text-white font-bold">@{replyingTo.userName}</strong>
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyInputText('');
                                  }}
                                  className="p-1 hover:bg-blue-500/20 rounded text-blue-400 hover:text-white transition-colors cursor-pointer"
                                  title="Cancelar respuesta"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  ref={commentInputRef}
                                  type="text"
                                  value={replyInputText}
                                  onChange={(e) => setReplyInputText(e.target.value)}
                                  placeholder={`Responde a @${replyingTo.userName}...`}
                                  maxLength={400}
                                  className="flex-1 bg-[#141620] border border-zinc-700/80 focus:border-blue-400 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none transition-colors"
                                />
                                <button
                                  type="submit"
                                  disabled={submittingReply || !replyInputText.trim()}
                                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex-shrink-0"
                                >
                                  {submittingReply ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Send className="w-3 h-3" />
                                  )}
                                  <span>Responder</span>
                                </button>
                              </div>
                            </form>
                          </div>
                        )}

                        {/* HILO DE RESPUESTAS AL COMENTARIO ("X respondió a X") con PAGINACIÓN DE 5 + VER MÁS */}
                        {isExpanded && childReplies.length > 0 && (
                          <div className="ml-5 sm:ml-7 border-l-2 border-zinc-800 pl-3 space-y-2 pt-1 animate-in fade-in duration-150">
                            {visibleReplies.map((reply) => {
                              const replyKey = reply.id || (reply as any).uuid;
                              const isMyReply = Boolean(effectiveUserId && reply.user_uid === effectiveUserId);
                              return (
                                <div
                                  key={replyKey}
                                  className="bg-[#101116] border border-zinc-800/50 rounded-xl p-2.5 space-y-1.5 shadow-sm transition-colors hover:border-zinc-700/60"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                      {reply.user_avatar_url ? (
                                        <img
                                          src={reply.user_avatar_url}
                                          alt="Usuario"
                                          className="w-5 h-5 rounded-full object-cover border border-zinc-700 flex-shrink-0"
                                        />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 text-[9px] font-black flex items-center justify-center uppercase flex-shrink-0">
                                          {(reply.user_display_name || 'U').charAt(0)}
                                        </div>
                                      )}
                                      <span className="text-[11px] font-bold text-white truncate max-w-[120px]">
                                        {reply.user_display_name || 'Compañero'}
                                      </span>
                                      <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                                        <CornerDownRight className="w-2.5 h-2.5 text-zinc-500" />
                                        <span>respondió a</span>
                                        <strong className="text-amber-400 font-bold">
                                          @{reply.reply_to_user_name || rev.user_display_name || 'Compañero'}
                                        </strong>
                                      </span>
                                      {isMyReply && (
                                        <span className="text-[8px] px-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-bold">
                                          Tú
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <span className="text-[9px] text-zinc-500">
                                        {formatTimeAgo(reply.created_at)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleStartReply(reply)}
                                        className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center gap-0.5 transition-colors cursor-pointer"
                                        title="Responder a esta persona"
                                      >
                                        <Reply className="w-2.5 h-2.5 text-blue-400" />
                                        <span>Responder</span>
                                      </button>
                                      {isMyReply && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteComment(replyKey, false, reviewKey)}
                                          className="p-1 text-zinc-400 hover:text-red-400 transition-colors rounded hover:bg-zinc-800 cursor-pointer"
                                          title="Eliminar respuesta"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <p className="text-xs text-zinc-300 leading-relaxed pl-6">
                                    {reply.comment}
                                  </p>
                                </div>
                              );
                            })}

                            {/* Botón "Ver más respuestas" si supera 5 */}
                            {hasMoreReplies && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRepliesLimit((prev) => ({
                                    ...prev,
                                    [reviewKey]: (prev[reviewKey] || 5) + 5,
                                  }));
                                }}
                                className="text-[11px] font-bold text-zinc-400 hover:text-white hover:underline transition-colors pl-2 py-1 cursor-pointer"
                              >
                                + Ver más respuestas ({childReplies.length - currentRepliesLimit} restantes)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Botón "Ver más comentarios" si supera 5 */}
                  {hasMoreComments && (
                    <div className="text-center pt-2 pb-1">
                      <button
                        type="button"
                        onClick={() => setVisibleCommentsLimit((prev) => prev + 5)}
                        className="px-4 py-1.5 rounded-xl bg-[#181922] hover:bg-[#20222f] border border-zinc-700/60 text-xs font-bold text-amber-400 hover:text-amber-300 transition-all cursor-pointer shadow-sm"
                      >
                        Ver más comentarios ({allDisplayRoots.length - visibleCommentsLimit} restantes)
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL PARA COMPARTIR CON IMAGEN Y PREVIEWS DE REDES SOCIALES */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-[#0e0f14] border border-zinc-800 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-5 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  Compartir Publicación
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Previsualización visual de lo que se compartirá (Open Graph Image Preview) */}
            <div className="bg-[#14151c] border border-zinc-700/60 rounded-2xl overflow-hidden shadow-lg space-y-2.5 p-3">
              <div className="relative rounded-xl overflow-hidden bg-black/50 max-h-48 flex items-center justify-center">
                <img
                  src={publication.image_url}
                  alt="Vista previa"
                  className="w-full h-44 object-cover rounded-xl"
                />
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/80 border border-amber-400/50 text-[10px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-1">
                  <span>Starryz 5</span>
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white truncate">
                  {displayName} en Starryz 5
                </h4>
                <p className="text-[11px] text-zinc-400 line-clamp-2">
                  {publication.description || 'Publicación compartida de la red social universitaria Starryz 5.'}
                </p>
              </div>
            </div>

            {/* Botones de Redes Sociales */}
            <div className="grid grid-cols-4 gap-2 pt-1 text-center">
              {/* WhatsApp */}
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`¡Mira esta publicación de ${displayName} en Starryz 5! ${shareUrl}`)}`}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group active:scale-95"
              >
                <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase">WhatsApp</span>
              </a>

              {/* Twitter / X */}
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Publicación de ${displayName} en Starryz 5 ✨`)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-2xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 text-white flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group active:scale-95"
              >
                <Twitter className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase">X / Twitter</span>
              </a>

              {/* Facebook */}
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-2xl bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border border-[#1877F2]/30 text-[#1877F2] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group active:scale-95"
              >
                <Facebook className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase">Facebook</span>
              </a>

              {/* Compartir Nativo */}
              <button
                type="button"
                onClick={handleNativeShare}
                className="p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group active:scale-95"
              >
                <ExternalLink className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase">Más Apps</span>
              </button>
            </div>

            {/* Input para copiar enlace */}
            <div className="flex items-center gap-2 bg-[#14151b] border border-zinc-800 rounded-xl p-1.5 pl-3">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="bg-transparent text-xs text-zinc-300 w-full outline-none font-mono truncate"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer flex-shrink-0 ${copiedLink
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-[#eab308] hover:bg-yellow-400 text-black shadow-sm'
                  }`}
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver quiénes calificaron la publicación */}
      <PublicationRatingsModal
        isOpen={showRatingsModal}
        onClose={() => setShowRatingsModal(false)}
        publicationId={publication.id}
        ratingAvg={publicationAvg}
        totalVotes={publicationVotesCount}
        onNavigateToUser={(userId) => {
          window.location.href = `/perfil/${userId}`;
        }}
      />
    </article>
  );
}
