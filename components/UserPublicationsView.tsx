import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Image as ImageIcon, 
  UploadCloud, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Layers,
  Sparkles,
  Zap,
  Lock,
  Unlock,
  Users,
  Heart,
  Globe,
  ChevronDown,
  Check
} from 'lucide-react';
import { 
  UserPublication, 
  getUserPublications, 
  createPublication, 
  deletePublication 
} from '@/src/lib/publications';
import { validatePublicationFile, compressPublicationImage, CompressionResult } from '@/src/lib/imageCompressor';
import PublicationCard from './PublicationCard';

interface UserPublicationsViewProps {
  userId: string;
  isOwnProfile: boolean;
  currentUserDisplayName?: string | null;
  currentUserUsername?: string | null;
  currentUserAvatarUrl?: string | null;
  currentUserBadge?: string | null;
}

export default function UserPublicationsView({
  userId,
  isOwnProfile,
  currentUserDisplayName,
  currentUserUsername,
  currentUserAvatarUrl,
  currentUserBadge = '👑 ELITE 4.5+',
}: UserPublicationsViewProps) {
  const [publications, setPublications] = useState<UserPublication[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estados para creación de nueva publicación
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<number>(0);
  const [compressionStatusText, setCompressionStatusText] = useState<string>('');
  const [compressionStats, setCompressionStats] = useState<{
    originalMb: string;
    compressedKb: string;
    savings: number;
    format: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Estado de visibilidad para la nueva publicación (todos, solo_yo, solo_seguidores, solo_fans)
  const [visibilityState, setVisibilityState] = useState<'todos' | 'solo_yo' | 'solo_seguidores' | 'solo_fans'>('todos');
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar publicaciones del usuario
  const loadPublications = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const pubs = await getUserPublications(userId);
      setPublications(pubs);
    } catch (err) {
      console.warn('Error al cargar publicaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublications();
  }, [userId]);

  // Manejar selección y compresión inmediata de la imagen
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmitError(null);
    const validation = validatePublicationFile(file);
    if (!validation.valid) {
      setSubmitError(validation.error || 'Archivo inválido');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    setCompressing(true);
    setCompressionProgress(10);
    setCompressionStatusText('Iniciando compresión...');
    setCompressionStats(null);

    try {
      // Compresión inteligente: máx 5MB original -> 90KB - 100KB WebP
      const result: CompressionResult = await compressPublicationImage(file, (percent, msg) => {
        setCompressionProgress(percent);
        if (msg) setCompressionStatusText(msg);
      });
      setPreviewUrl(result.base64);
      setCompressionProgress(100);
      setCompressionStatusText('Compresión completada (100%)');
      setCompressionStats({
        originalMb: (result.originalSize / (1024 * 1024)).toFixed(2),
        compressedKb: (result.compressedSize / 1024).toFixed(1),
        savings: result.savingsPercent,
        format: result.format.includes('webp') ? 'WebP HD' : 'JPEG',
      });
    } catch (err: any) {
      setSubmitError(err.message || 'Error al comprimir la imagen.');
      setSelectedFile(null);
      setPreviewUrl(null);
      setCompressionProgress(0);
      setCompressionStatusText('');
    } finally {
      setCompressing(false);
    }
  };

  // Enviar publicación a Supabase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setSubmitError('Por favor selecciona una imagen para tu publicación.');
      return;
    }

    if (description.length > 500) {
      setSubmitError('La descripción no puede exceder los 500 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const newPub = await createPublication({
        userId,
        file: selectedFile,
        description,
        estado_de_vista: visibilityState,
        authorInfo: {
          displayName: currentUserDisplayName || 'Estudiante',
          username: currentUserUsername || null,
          avatarUrl: currentUserAvatarUrl || null,
          badge: currentUserBadge,
        },
      });

      // Añadir al inicio de la lista
      setPublications((prev) => [newPub, ...prev]);
      setSubmitSuccess('¡Publicación creada exitosamente!');
      
      setTimeout(() => {
        setIsModalOpen(false);
        resetForm();
      }, 1200);
    } catch (err: any) {
      setSubmitError(err.message || 'Error al guardar la publicación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setDescription('');
    setVisibilityState('todos');
    setShowVisibilityMenu(false);
    setCompressing(false);
    setCompressionProgress(0);
    setCompressionStatusText('');
    setCompressionStats(null);
    setSubmitError(null);
    setSubmitSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeletePublication = async (pubId: string) => {
    const ok = await deletePublication(pubId, userId);
    if (ok) {
      setPublications((prev) => prev.filter((p) => p.id !== pubId));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* CAJA DE CREACIÓN DE PUBLICACIÓN (ALINEADA EXACTAMENTE CON LAS PUBLICACIONES) */}
      {isOwnProfile && (
        <section className="bg-[#121318] border border-[#23242d] rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 max-w-3xl mx-auto w-full">
          {/* Mensajes de feedback */}
          {submitError && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
          {submitSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          {/* Fila superior: Avatar + Input de texto estilo caja redondeada */}
          <div className="flex items-start gap-3">
            <img
              src={currentUserAvatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={currentUserDisplayName || 'Usuario'}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border border-[#3b3d4a] ring-1 ring-[#1b1c24] flex-shrink-0 mt-0.5"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
              }}
            />

            <div className="flex-1 min-w-0">
              <div className="border border-[#282a36] bg-[#0c0d12]/80 focus-within:border-[#4b4e63] rounded-2xl px-4 py-3 transition-colors">
                <textarea
                  rows={2}
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={`¿Qué quieres publicar hoy${currentUserDisplayName ? `, ${currentUserDisplayName.split(' ')[0]}` : ''}? Comparte fotos, eventos o pensamientos...`}
                  className="w-full bg-transparent text-white text-xs sm:text-sm placeholder:text-zinc-500 outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Vista previa de imagen seleccionada si existe */}
          {previewUrl && (
            <div className="relative rounded-xl overflow-hidden border border-[#282a36] bg-black/60 max-h-72 flex items-center justify-center group ml-13">
              <img
                src={previewUrl}
                alt="Vista previa"
                className="max-h-72 w-full object-contain rounded-xl"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setCompressing(false);
                  setCompressionProgress(0);
                  setCompressionStatusText('');
                  setCompressionStats(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-red-600 text-white transition-colors cursor-pointer"
                title="Quitar foto"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Tag de compresión */}
              {compressionStats && (
                <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-black/80 backdrop-blur-md border border-zinc-700/60 rounded-lg text-[10px] text-emerald-400 font-mono">
                  {compressionStats.compressedKb} KB ({compressionStats.format})
                </div>
              )}
            </div>
          )}

          {/* Barra de progreso de compresión (0% a 100%) */}
          {(compressing || compressionProgress > 0) && (
            <div className="p-3.5 rounded-2xl bg-[#0c0d12] border border-[#282a36] space-y-2 ml-13">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                  {compressing && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#facc15]" />}
                  {compressionStatusText || 'Optimizando imagen...'}
                </span>
                <span className="font-mono text-[#facc15] font-bold">
                  {compressionProgress}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden relative">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, compressionProgress))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                <span>Máx original: 5 MB</span>
                <span className="text-emerald-400 font-bold">Regla: 90 - 100 KB</span>
              </div>
            </div>
          )}

          {/* Input de archivo oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Fila inferior de botones: [Agregar Foto] y [Visibilidad] a la izquierda | [Publicar] a la derecha */}
          <div className="flex items-center justify-between pt-1 gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting || compressing}
                className="px-3.5 py-2 rounded-xl bg-[#171821] hover:bg-[#1f212d] border border-[#2d2f3d] text-zinc-300 hover:text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <span>{selectedFile ? 'Cambiar Foto' : 'Agregar Foto'}</span>
              </button>

              {/* Selector de Candado / Visibilidad antes de publicar */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowVisibilityMenu((prev) => !prev)}
                  disabled={isSubmitting || compressing}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    visibilityState === 'solo_yo'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : visibilityState === 'solo_seguidores'
                      ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                      : visibilityState === 'solo_fans'
                      ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                      : 'bg-[#171821] hover:bg-[#1f212d] border-[#2d2f3d] text-zinc-300 hover:text-white'
                  }`}
                  title="Quién puede ver esta publicación"
                >
                  {visibilityState === 'solo_yo' ? (
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  ) : visibilityState === 'solo_seguidores' ? (
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                  ) : visibilityState === 'solo_fans' ? (
                    <Heart className="w-3.5 h-3.5 text-pink-400" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>
                    {visibilityState === 'solo_yo' ? 'Solo yo' :
                     visibilityState === 'solo_seguidores' ? 'Solo seguidores' :
                     visibilityState === 'solo_fans' ? 'Solo fans' : 'Todos'}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                </button>

                {showVisibilityMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowVisibilityMenu(false)} 
                    />
                    <div className="absolute left-0 bottom-full mb-1.5 w-48 bg-[#12131a] border border-zinc-800 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                      <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b border-zinc-800/80">
                        Visibilidad de publicación
                      </div>

                      {/* 1. Todos */}
                      <button
                        type="button"
                        onClick={() => {
                          setVisibilityState('todos');
                          setShowVisibilityMenu(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          visibilityState === 'todos' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Todos</span>
                        </span>
                        {visibilityState === 'todos' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>

                      {/* 2. Solo yo */}
                      <button
                        type="button"
                        onClick={() => {
                          setVisibilityState('solo_yo');
                          setShowVisibilityMenu(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          visibilityState === 'solo_yo' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Solo yo (Ocultar)</span>
                        </span>
                        {visibilityState === 'solo_yo' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </button>

                      {/* 3. Solo seguidores */}
                      <button
                        type="button"
                        onClick={() => {
                          setVisibilityState('solo_seguidores');
                          setShowVisibilityMenu(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          visibilityState === 'solo_seguidores' ? 'bg-blue-500/20 text-blue-300' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-blue-400" />
                          <span>Solo seguidores</span>
                        </span>
                        {visibilityState === 'solo_seguidores' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </button>

                      {/* 4. Solo fans */}
                      <button
                        type="button"
                        onClick={() => {
                          setVisibilityState('solo_fans');
                          setShowVisibilityMenu(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          visibilityState === 'solo_fans' ? 'bg-pink-500/20 text-pink-300' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Heart className="w-3.5 h-3.5 text-pink-400" />
                          <span>Solo fans</span>
                        </span>
                        {visibilityState === 'solo_fans' && <Check className="w-3.5 h-3.5 text-pink-400" />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || compressing || !selectedFile}
              className="px-5 py-2 rounded-xl bg-[#facc15] hover:bg-yellow-400 active:scale-95 text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ml-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publicando...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-black" />
                  <span>Publicar</span>
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* FEED DE PUBLICACIONES */}
      {(() => {
        // Filtrar publicaciones: si no es el dueño, no puede ver publicaciones en 'solo_yo'
        const visiblePublications = isOwnProfile 
          ? publications 
          : publications.filter((p) => p.estado_de_vista !== 'solo_yo');

        if (loading) {
          return (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#eab308] animate-spin" />
              <p className="text-xs text-zinc-400 font-mono">Cargando publicaciones...</p>
            </div>
          );
        }

        if (visiblePublications.length === 0) {
          return (
            <div className="p-10 rounded-2xl bg-[#121318] border border-[#23242d] text-center space-y-4 max-w-3xl mx-auto w-full">
              <div className="w-14 h-14 mx-auto rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                <ImageIcon className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Sin publicaciones todavía</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  {isOwnProfile
                    ? 'Aún no has compartido ninguna publicación. ¡Sube tu primera foto y compártela con tus compañeros!'
                    : 'Este estudiante aún no ha realizado ninguna publicación visible.'}
                </p>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            {visiblePublications.map((pub) => (
              <PublicationCard
                key={pub.id}
                publication={pub}
                currentUserId={userId}
                isOwner={isOwnProfile}
                onDelete={handleDeletePublication}
              />
            ))}
          </div>
        );
      })()}
    </div>
  );
}
