'use client';

import React, { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { 
  UserPublication, 
  PublicationReviewComment,
  getPublicationReviews,
  getUserPublicationReview,
  submitPublicationReview,
  isPublicationSavedByUser,
  toggleSavePublication,
  incrementPublicationView,
  incrementPublicationShare,
  updateOpenGraphMeta
} from '@/src/lib/publications';
import { getFlagUrl } from '@/src/data/countries';
import { useAuth } from '@/src/context/AuthContext';

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
  const effectiveUserId = propUserId || user?.uid || null;

  // Estados de interacción
  const [userVote, setUserVote] = useState<number | null>(null);
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

  // Estados de comentarios y modal/sección de comentarios
  const [showComments, setShowComments] = useState(false);
  const [commentsList, setCommentsList] = useState<PublicationReviewComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [modalSelectedStars, setModalSelectedStars] = useState<number | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [commentsCount, setCommentsCount] = useState<number>(publication.comments_count || 0);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Estado del modal de compartir
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Reproducción de sonidos al calificar con estrellas (star1.mp3 a star5.mp3)
  const playStarAudio = (stars: number) => {
    try {
      const audio = new Audio(`/sonidos/star${stars}.mp3`);
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch {}
  };

  // Formateo de fecha relativa amigable (ej: "Hace 2 horas")
  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSecs < 60) return 'Hace un momento';
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `Hace ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} días`;
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
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

  // 1. Cargar estado de guardado e interacción previa del usuario
  useEffect(() => {
    if (!effectiveUserId || !publication.id) return;

    let isMounted = true;

    async function loadUserState() {
      try {
        const [isSaved, prevReview] = await Promise.all([
          isPublicationSavedByUser(publication.id, effectiveUserId),
          getUserPublicationReview(publication.id, effectiveUserId)
        ]);

        if (isMounted) {
          setSaved(isSaved);
          if (prevReview && prevReview.stars) {
            setUserVote(prevReview.stars);
          }
        }
      } catch (e) {}
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

    if (nextState && commentsList.length === 0) {
      try {
        setLoadingComments(true);
        const reviews = await getPublicationReviews(publication.id);
        setCommentsList(reviews);
      } catch (err) {
        console.warn('Error al cargar comentarios:', err);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  // Votar directamente con puras estrellas en la barra de 5 estrellas
  const handleDirectStarVote = async (stars: number) => {
    if (!effectiveUserId) {
      alert('Debes iniciar sesión para calificar esta publicación.');
      return;
    }

    playStarAudio(stars);
    setUserVote(stars);
    setModalSelectedStars(stars);

    try {
      const res = await submitPublicationReview({
        publicationId: publication.id,
        userUid: effectiveUserId,
        stars: stars,
        comment: null,
        authorInfo: {
          displayName: user?.displayName || 'Usuario Starryz',
          avatarUrl: user?.photoURL || null,
        }
      });

      if (res.success) {
        if (typeof res.rating_avg === 'number') {
          setPublicationAvg(res.rating_avg.toFixed(2));
        }
        if (typeof res.total_votes === 'number') {
          setPublicationVotesCount(res.total_votes);
        }
        setFeedbackMsg(`¡Calificado con ${stars} ${stars === 1 ? 'estrella' : 'estrellas'}!`);
        setTimeout(() => setFeedbackMsg(null), 3000);
      }
    } catch (e) {
      console.warn('Error al votar estrellas:', e);
    }
  };

  // Enviar comentario (con o sin estrellas)
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId) {
      alert('Debes iniciar sesión para comentar.');
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed && modalSelectedStars === null) {
      return;
    }

    try {
      setSubmittingReview(true);
      if (modalSelectedStars) {
        playStarAudio(modalSelectedStars);
      }

      const res = await submitPublicationReview({
        publicationId: publication.id,
        userUid: effectiveUserId,
        stars: modalSelectedStars,
        comment: trimmed || null,
        authorInfo: {
          displayName: user?.displayName || 'Usuario Starryz',
          avatarUrl: user?.photoURL || null,
        }
      });

      if (res.success) {
        if (res.newReview) {
          setCommentsList((prev) => [res.newReview!, ...prev]);
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
        if (modalSelectedStars) {
          setUserVote(modalSelectedStars);
        }
        setCommentText('');
        setModalSelectedStars(null);
        setFeedbackMsg('¡Comentario publicado con éxito!');
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
      } catch {}
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

  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/perfil/${publication.user_id}?pub=${publication.id}` 
    : '';

  return (
    <article className="bg-[#101116] border border-[#23242d] rounded-3xl p-4 sm:p-6 shadow-2xl transition-all duration-200 max-w-3xl mx-auto w-full space-y-4">
      {/* HEADER DE LA PUBLICACIÓN */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar del usuario con borde fino */}
          <div className="relative flex-shrink-0">
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover border border-[#3b3d4a] ring-2 ring-black shadow-md"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
              }}
            />
          </div>

          {/* Nombre, Sexo, Bandera, Badge de Calificación General y Fecha */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-extrabold text-white text-sm sm:text-base tracking-tight truncate max-w-[180px] sm:max-w-[320px]">
                {displayName}
              </h4>

              {/* Sexo (gender) */}
              {(isMale || isFemale) && (
                <span
                  className={`text-sm font-black leading-none select-none ${
                    isMale ? 'text-blue-400' : 'text-pink-400'
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

              {/* Badge de Calificación General en users: ★ 5.0 (Perfil) */}
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#252317] border border-[#524515] text-[11px] font-bold text-[#eab308]">
                <Star className="w-3 h-3 fill-[#eab308] text-[#eab308]" />
                <span>{profileScore}</span>
                <span className="text-[10px] text-zinc-400 font-medium">(Perfil)</span>
              </div>
            </div>

            <p className="text-xs text-zinc-400 font-medium truncate mt-0.5">
              {formatTimeAgo(publication.created_at)}
            </p>
          </div>
        </div>

        {/* Lado derecho: Pill de Calificación de la publicación + Botón de eliminar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div 
            className="px-3 py-1.5 rounded-full bg-[#1e1c14] border border-[#4d3f10] text-[#facc15] text-xs font-black tracking-wider flex items-center gap-1.5 shadow-sm select-none"
            title="Promedio de estrellas de la publicación y total de votos"
          >
            <Star className="w-3.5 h-3.5 fill-[#facc15] text-[#facc15]" />
            <span className="font-mono font-bold text-white text-xs">{publicationAvg}</span>
            <span className="text-[11px] text-zinc-400 font-normal">({publicationVotesCount})</span>
          </div>

          {/* Botón de eliminar (visible para el dueño) */}
          {isOwner && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              title="Eliminar publicación"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

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
                  className={`w-6 h-6 sm:w-7 sm:h-7 transition-all ${
                    isSelected
                      ? 'fill-[#facc15] text-[#facc15] scale-110 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]'
                      : 'text-zinc-500 stroke-[1.5] group-hover:stroke-[#facc15]'
                  }`}
                />
              </button>
            );
          })}
        </div>

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
          className={`flex items-center gap-2 transition-colors cursor-pointer py-1.5 px-2 rounded-xl group ${
            showComments ? 'bg-blue-500/10 text-blue-400' : 'hover:text-white hover:bg-zinc-900/60'
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
          className={`flex items-center gap-2 transition-colors cursor-pointer py-1.5 px-2 rounded-xl group ${
            saved ? 'text-amber-400 bg-amber-500/10' : 'hover:text-white hover:bg-zinc-900/60'
          }`}
          title={saved ? 'Quitar de guardados' : 'Guardar en Mi Perfil > Guardados'}
        >
          <Bookmark className={`w-4 h-4 transition-colors ${
            saved ? 'fill-amber-400 text-amber-400' : 'text-zinc-400 group-hover:text-amber-400'
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
          {/* Formulario para escribir comentario / reseña */}
          <form onSubmit={handleSubmitComment} className="space-y-3 bg-[#0c0d12] border border-zinc-800/80 rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
              <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                Deja tu comentario o reseña:
              </span>

              {/* Selector de estrellas opcional para el comentario */}
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      playStarAudio(star);
                      setModalSelectedStars(modalSelectedStars === star ? null : star);
                    }}
                    title={`${star} estrellas`}
                    className="p-1 hover:scale-110 transition-transform cursor-pointer"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        modalSelectedStars !== null && star <= modalSelectedStars
                          ? 'fill-[#facc15] text-[#facc15]'
                          : 'text-zinc-600'
                      }`}
                    />
                  </button>
                ))}
                {modalSelectedStars && (
                  <button
                    type="button"
                    onClick={() => setModalSelectedStars(null)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 ml-1 underline cursor-pointer"
                  >
                    Quitar estrellas
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={
                  modalSelectedStars
                    ? `Escribe tu reseña con ${modalSelectedStars} estrellas...`
                    : 'Escribe un comentario público...'
                }
                maxLength={400}
                className="flex-1 bg-[#14151b] border border-zinc-700/80 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={submittingReview || (!commentText.trim() && modalSelectedStars === null)}
                className="px-4 py-2 rounded-xl bg-[#eab308] hover:bg-yellow-400 text-black font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
              >
                {submittingReview ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Enviar</span>
              </button>
            </div>
          </form>

          {/* Lista de comentarios */}
          <div className="space-y-2.5 max-h-72 overflow-y-auto no-scrollbar pr-1">
            {loadingComments ? (
              <div className="py-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Cargando comentarios...</span>
              </div>
            ) : commentsList.length === 0 ? (
              <p className="text-center py-4 text-xs text-zinc-500 font-medium">
                No hay comentarios todavía. ¡Sé el primero en opinar!
              </p>
            ) : (
              commentsList.map((rev) => (
                <div
                  key={rev.id}
                  className="bg-[#14151b] border border-zinc-800/60 rounded-xl p-3 space-y-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {rev.user_avatar_url ? (
                        <img
                          src={rev.user_avatar_url}
                          alt="Usuario"
                          className="w-6 h-6 rounded-full object-cover border border-zinc-700"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-black flex items-center justify-center uppercase">
                          {(rev.user_display_name || 'U').charAt(0)}
                        </div>
                      )}
                      <span className="text-xs font-bold text-white">
                        {rev.user_display_name || 'Compañero'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {rev.stars && (
                        <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{rev.stars}</span>
                        </div>
                      )}
                      <span className="text-[10px] text-zinc-500">
                        {formatTimeAgo(rev.created_at)}
                      </span>
                    </div>
                  </div>

                  {rev.comment && (
                    <p className="text-xs text-zinc-300 leading-relaxed pl-8">
                      {rev.comment}
                    </p>
                  )}
                </div>
              ))
            )}
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                  copiedLink
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
    </article>
  );
}
