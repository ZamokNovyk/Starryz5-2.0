import React, { useState } from 'react';
import { 
  Star, 
  MessageSquare, 
  Bookmark, 
  Eye, 
  Share2, 
  Trash2
} from 'lucide-react';
import { UserPublication } from '@/src/lib/publications';
import { getFlagUrl } from '@/src/data/countries';

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
}: PublicationCardProps) {
  const [userVote, setUserVote] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);

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

  // Datos del usuario obtenidos de la consulta en users o fallback a publicación
  const author = publication.author_data;
  const displayName = author?.display_name || publication.user_display_name || 'Estudiante';
  const avatarUrl = author?.photo_url || publication.user_avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
  
  // Sexo (gender) de users
  const rawGender = (author?.gender || '').toLowerCase();
  const isMale = rawGender === 'male' || rawGender === 'hombre';
  const isFemale = rawGender === 'female' || rawGender === 'mujer';
  
  // Nacionalidad (country_code) de users
  const countryCode = (author?.country_code || 'pe').toLowerCase();

  // Calificación general (score) de users
  const profileScore = author?.score !== undefined && author?.score !== null 
    ? Number(author.score).toFixed(1) 
    : '5.0';

  // Calificación de la publicación (rating_avg de user-publications o fallback)
  const publicationAvg = publication.rating_avg && publication.rating_avg > 0
    ? publication.rating_avg.toFixed(2)
    : '4.86';
  const publicationVotesCount = (publication.star_1 || 0) + 
    (publication.star_2 || 0) + 
    (publication.star_3 || 0) + 
    (publication.star_4 || 0) + 
    (publication.star_5 || 0) || 142;

  const handleDelete = async () => {
    if (!onDelete) return;
    if (window.confirm('¿Estás seguro de que deseas eliminar esta publicación?')) {
      setIsDeleting(true);
      await onDelete(publication.id);
      setIsDeleting(false);
    }
  };

  return (
    <article className="bg-[#121318] border border-[#23242d] rounded-2xl p-4 sm:p-5 shadow-xl transition-all duration-200 max-w-2xl mx-auto w-full space-y-3.5">
      {/* HEADER DE LA PUBLICACIÓN */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar del usuario con borde fino */}
          <div className="relative flex-shrink-0">
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border border-[#3b3d4a] ring-1 ring-[#1b1c24]"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
              }}
            />
          </div>

          {/* Nombre, Sexo, Bandera, Badge de Calificación General y Fecha */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-extrabold text-white text-sm sm:text-base tracking-tight truncate max-w-[180px] sm:max-w-[260px]">
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
          <div className="px-3 py-1.5 rounded-full bg-[#1e1c14] border border-[#4d3f10] text-[#facc15] text-xs font-black tracking-wider flex items-center gap-1.5 shadow-sm">
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
        <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-normal whitespace-pre-wrap break-words">
          {publication.description}
        </p>
      )}

      {/* IMAGEN DE LA PUBLICACIÓN */}
      <div className="relative rounded-xl overflow-hidden bg-black/60 border border-[#23242d] shadow-inner group">
        <img
          src={publication.image_url}
          alt={publication.description ? publication.description.substring(0, 40) : 'Publicación'}
          className="w-full max-h-[540px] object-cover rounded-xl"
          loading="lazy"
        />
      </div>

      {/* CONTENEDOR DE 5 ESTRELLAS CON BORDE FINO COMO EN LA FOTO */}
      <div className="border border-[#23242d] bg-[#0c0d12]/70 rounded-xl py-2 px-3 flex items-center justify-center gap-3 sm:gap-4">
        {[1, 2, 3, 4, 5].map((star) => {
          const isSelected = userVote !== null && star <= userVote;
          return (
            <button
              key={star}
              type="button"
              onClick={() => setUserVote(star)}
              title={`Calificar con ${star} estrellas`}
              className="p-1 text-zinc-500 hover:text-[#facc15] hover:scale-125 transition-all cursor-pointer active:scale-95"
            >
              <Star
                className={`w-5 h-5 sm:w-6 sm:h-6 transition-colors ${
                  isSelected
                    ? 'fill-[#facc15] text-[#facc15] scale-110 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                    : 'text-zinc-500 stroke-[1.5]'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* BOTONES INFERIORES DE ESTADÍSTICAS (COMENTARIOS, GUARDADOS, VISTAS, COMPARTIR) */}
      <div className="flex items-center justify-between pt-1 px-2 text-zinc-400 text-xs sm:text-sm font-semibold">
        {/* 1. Comentarios */}
        <button
          type="button"
          className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer py-1 group"
          title="Comentarios"
        >
          <MessageSquare className="w-4 h-4 text-zinc-400 group-hover:text-blue-400 transition-colors" />
          <span className="font-mono text-xs text-zinc-300">{formatCount(publication.comments_count || 2)}</span>
        </button>

        {/* 2. Guardados */}
        <button
          type="button"
          onClick={() => setSaved(!saved)}
          className={`flex items-center gap-2 transition-colors cursor-pointer py-1 group ${
            saved ? 'text-amber-400' : 'hover:text-white'
          }`}
          title="Guardar publicación"
        >
          <Bookmark className={`w-4 h-4 transition-colors ${
            saved ? 'fill-amber-400 text-amber-400' : 'text-zinc-400 group-hover:text-amber-400'
          }`} />
          <span className="font-mono text-xs text-zinc-300">
            {formatCount((publication.saves_count || 142) + (saved ? 1 : 0))}
          </span>
        </button>

        {/* 3. Vistas */}
        <div
          className="flex items-center gap-2 text-zinc-400 py-1"
          title="Vistas"
        >
          <Eye className="w-4 h-4 text-zinc-400" />
          <span className="font-mono text-xs text-zinc-300">
            {publication.views_count ? formatCount(publication.views_count) : '2.4k'}
          </span>
        </div>

        {/* 4. Compartir */}
        <button
          type="button"
          onClick={() => {
            setShared(true);
            if (navigator.clipboard) {
              navigator.clipboard.writeText(window.location.href);
            }
            setTimeout(() => setShared(false), 2000);
          }}
          className={`flex items-center gap-2 transition-colors cursor-pointer py-1 group ${
            shared ? 'text-pink-400' : 'hover:text-white'
          }`}
          title={shared ? '¡Enlace copiado!' : 'Compartir'}
        >
          <Share2 className={`w-4 h-4 transition-colors ${
            shared ? 'text-pink-400' : 'text-zinc-400 group-hover:text-pink-400'
          }`} />
          <span className="font-mono text-xs text-zinc-300">
            {shared ? '¡Listo!' : formatCount(publication.shares_count || 38)}
          </span>
        </button>
      </div>
    </article>
  );
}
