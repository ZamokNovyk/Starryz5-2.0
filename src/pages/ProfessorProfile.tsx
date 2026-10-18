'use client';

import React, { useState, useEffect } from 'react';
import { applyUserQuery } from '../lib/supabaseHelper';
import { 
  ArrowLeft, 
  Share2, 
  BookOpen, 
  Award, 
  Heart, 
  Users, 
  Sparkles, 
  MessageSquare, 
  BarChart3, 
  Star, 
  ThumbsUp, 
  Plus, 
  CheckCircle2,
  Calendar,
  Loader2,
  Bell,
  BellRing,
  Eye
} from 'lucide-react';
import { 
  getProfessorById, 
  Professor, 
  getUserProfessorInteraction, 
  getProfessorInteractionCounts, 
  toggleProfessorInteraction,
  getTodayProfessorVotes,
  getProfessorRatingBreakdown,
  submitProfessorVote,
  updateProfessorWiki,
  getProfessorCrushStatus,
  toggleProfessorCrush,
  getProfessorNotificationPreferences,
  notifyProfessorSubscribers,
  incrementProfessorViews
} from '@/src/lib/professors';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import BookmarkButton from '@/components/BookmarkButton';
import ProfessorNotificationModal from '@/components/Modals/ProfessorNotificationModal';
import { promptNotificationOnAction } from '@/src/lib/notificationHelper';
import { shareContent } from '@/src/lib/share';
import { getActiveProfileReport, ProfileReport, extractReportFromBiography, embedReportIntoBiography, stripBiographyMetadata } from '@/src/lib/profileReports';
import CommunityVoteBanner from '@/components/CommunityVoteBanner';
import ReportProfileModal from '@/components/Modals/ReportProfileModal';

interface ProfessorProfileProps {
  slug: string;
  onBack: () => void;
  onRequireAuth?: () => void;
}

type TabType = 'Reseñas' | 'Crushes' | 'Estadística';

export default function ProfessorProfile({
  slug,
  onBack,
  onRequireAuth,
}: ProfessorProfileProps) {
  const { user } = useAuth();
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('Reseñas');
  const [copied, setCopied] = useState(false);

  // Verificación de Administrador (acceso exclusivo a pestañas restringidas)
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return user?.email?.toLowerCase() === 'wikistars12@gmail.com' || (user as any)?.role === 'admin';
  });

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    if (user.email?.toLowerCase() === 'wikistars12@gmail.com' || (user as any)?.role === 'admin') {
      setIsAdmin(true);
      return;
    }
    let query = supabase.from('users').select('role');
    query = applyUserQuery(query, user);
    query
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data?.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      })
      .catch(() => {
        setIsAdmin(false);
      });
  }, [user]);

  // Si no es admin y la pestaña activa era Crushes, redirigir a Reseñas
  useEffect(() => {
    if (!isAdmin && activeTab === 'Crushes') {
      setActiveTab('Reseñas');
    }
  }, [isAdmin, activeTab]);

  // Notification subscription state
  const [isSubscribedToNotifications, setIsSubscribedToNotifications] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);

  // Interaction counts state
  const [knowCount, setKnowCount] = useState(0);
  const [fanCount, setFanCount] = useState(0);
  const [hasVotedKnow, setHasVotedKnow] = useState(false);
  const [hasVotedFan, setHasVotedFan] = useState(false);
  const [loadingInteraction, setLoadingInteraction] = useState(false);

  // Star Rating States
  const [professorScore, setProfessorScore] = useState(0);
  const [professorTotalRatings, setProfessorTotalRatings] = useState(0);
  const [todayVotes, setTodayVotes] = useState<number[]>([]);
  const [ratingBreakdown, setRatingBreakdown] = useState<{ [key: number]: number }>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [votingInProgress, setVotingInProgress] = useState(false);

  // Crush States
  const [crushCount, setCrushCount] = useState(0);
  const [hasCrushed, setHasCrushed] = useState(false);
  const [loadingCrush, setLoadingCrush] = useState(false);

  // Views Count State
  const [viewsCount, setViewsCount] = useState(0);

  // Moderation / Community Report States
  const [activeReport, setActiveReport] = useState<ProfileReport | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Wiki Editing States
  const [isEditingWiki, setIsEditingWiki] = useState(false);
  const [wikiAvatarUrl, setWikiAvatarUrl] = useState('');
  const [wikiHeightCm, setWikiHeightCm] = useState<string>('');
  const [wikiMaritalStatus, setWikiMaritalStatus] = useState('No especificado');
  const [wikiGender, setWikiGender] = useState('No especificado');
  const [wikiBirthYear, setWikiBirthYear] = useState('');
  const [wikiBirthMonth, setWikiBirthMonth] = useState('');
  const [wikiBirthDay, setWikiBirthDay] = useState('');
  const [wikiInstagram, setWikiInstagram] = useState('');
  const [wikiYoutube, setWikiYoutube] = useState('');
  const [wikiFacebook, setWikiFacebook] = useState('');
  const [wikiTwitter, setWikiTwitter] = useState('');
  const [wikiBiography, setWikiBiography] = useState('');
  const [savingWiki, setSavingWiki] = useState(false);
  const [socialErrors, setSocialErrors] = useState<{
    instagram?: string;
    youtube?: string;
    facebook?: string;
    twitter?: string;
  }>({});

  useEffect(() => {
    async function loadProfessorAndInteractions() {
      try {
        setLoading(true);
        const data = await getProfessorById(slug);
        if (data) {
          setProfessor(data);
          setProfessorScore(data.score || 0.0);
          setProfessorTotalRatings(data.total_ratings || 0);
          setViewsCount(typeof data.views_count === 'number' ? data.views_count : 0);
          
          // Cargar conteos totales de interacción de la BD
          const counts = await getProfessorInteractionCounts(data.id || slug);
          setKnowCount(counts.knows);
          setFanCount(counts.fan);

          // Incrementar y sincronizar visualización con la BD
          try {
            const vCount = await incrementProfessorViews(data.id || slug);
            if (typeof vCount === 'number' && vCount > 0) {
              setViewsCount(prev => Math.max(prev, vCount));
            }
          } catch (vErr) {
            console.debug('Error registrando visualización:', vErr);
          }

          // Cargar distribución (breakdown) de calificaciones
          const breakdown = await getProfessorRatingBreakdown(data.id || slug);
          setRatingBreakdown(breakdown);

          // Cargar estado inicial de crushes
          const crushStatus = await getProfessorCrushStatus(data.id || slug, user?.uid);
          setCrushCount(crushStatus.count);
          setHasCrushed(crushStatus.hasCrushed);

          // Cargar reporte activo de moderación si existe
          try {
            const rep = await getActiveProfileReport(data.id || slug, 'professor');
            setActiveReport(rep);
          } catch (rErr) {
            console.debug('Error consultando reporte activo de profesor:', rErr);
          }

          // Cargar interacciones, votos y suscripción del usuario si está logueado
          if (user) {
            const todayV = await getTodayProfessorVotes(data.id || slug, user.uid);
            setTodayVotes(todayV);

            const userInteraction = await getUserProfessorInteraction(data.id || slug, user.uid);
            if (userInteraction) {
              setHasVotedKnow(userInteraction.interaction_type === 'knows');
              setHasVotedFan(userInteraction.interaction_type === 'fan');
            } else {
              setHasVotedKnow(false);
              setHasVotedFan(false);
            }

            // Consultar si está suscrito a notificaciones
            const subPrefs = await getProfessorNotificationPreferences(data.id || slug, user.uid);
            if (subPrefs && Object.values(subPrefs).some(Boolean)) {
              setIsSubscribedToNotifications(true);
            } else {
              setIsSubscribedToNotifications(false);
            }
          } else {
            setTodayVotes([]);
            setHasVotedKnow(false);
            setHasVotedFan(false);
            setIsSubscribedToNotifications(false);
          }
        } else {
          setProfessor(null);
        }
      } catch (err) {
        console.error('Error al cargar datos del profesor e interacciones:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfessorAndInteractions();
  }, [slug, user]);

  // Suscribirse a Supabase Realtime para cambios en los votos, interacciones y crushes del profesor
  useEffect(() => {
    if (!professor) return;

    const profId = professor.id || slug;

    // Función para refrescar todos los datos de calificación y votación
    const refreshVotesData = async () => {
      try {
        // 1. Refrescar promedio flotante y total de votos
        const updatedProf = await getProfessorById(slug);
        if (updatedProf) {
          setProfessorScore(updatedProf.score || 0.0);
          setProfessorTotalRatings(updatedProf.total_ratings || 0);
        }

        // 2. Refrescar desglose de estrellas (1 a 5)
        const breakdown = await getProfessorRatingBreakdown(profId);
        setRatingBreakdown(breakdown);

        // 3. Refrescar oportunidades/votos del día del usuario si está autenticado
        if (user) {
          const todayV = await getTodayProfessorVotes(profId, user.uid);
          setTodayVotes(todayV);
        }
      } catch (err) {
        console.error('Error al refrescar votos en tiempo real:', err);
      }
    };

    const channel = supabase
      .channel(`professor-profile-realtime-${profId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Escuchar todo evento (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'professor_votes'
        },
        (payload) => {
          // Si es un DELETE, refrescamos incondicionalmente. Si es INSERT/UPDATE, verificamos que sea para este profesor.
          if (payload.eventType === 'DELETE' || (payload.new && (payload.new as any).professor_id === profId)) {
            refreshVotesData();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'professor_interactions'
        },
        async (payload) => {
          if (payload.eventType === 'DELETE' || (payload.new && (payload.new as any).professor_id === profId)) {
            try {
              // Refrescar conteos totales de interacción de la BD
              const counts = await getProfessorInteractionCounts(profId);
              setKnowCount(counts.knows);
              setFanCount(counts.fan);

              // Refrescar si el propio usuario cambió su interacción
              if (user) {
                const userInteraction = await getUserProfessorInteraction(profId, user.uid);
                if (userInteraction) {
                  setHasVotedKnow(userInteraction.interaction_type === 'knows');
                  setHasVotedFan(userInteraction.interaction_type === 'fan');
                } else {
                  setHasVotedKnow(false);
                  setHasVotedFan(false);
                }
              }
            } catch (err) {
              console.error('Error al refrescar interacciones en tiempo real:', err);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'professor_crushes'
        },
        async (payload) => {
          if (payload.eventType === 'DELETE' || (payload.new && (payload.new as any).professor_id === profId)) {
            try {
              // Refrescar crushes de la BD en tiempo real
              const crushStatus = await getProfessorCrushStatus(profId, user?.uid);
              setCrushCount(crushStatus.count);
              setHasCrushed(crushStatus.hasCrushed);
            } catch (err) {
              console.error('Error al refrescar crushes en tiempo real:', err);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'professors',
        },
        async (payload) => {
          if (payload.eventType === 'DELETE' && payload.old && (payload.old as any).id === profId) {
            onBack();
          } else if (payload.new && (payload.new as any).id === profId) {
            const bio = (payload.new as any).biography || '';
            const fullName = (payload.new as any).nombre_completo || '';
            if (bio.includes('__EXPELLED_BY_COMMUNITY__') || fullName.includes('[EXPULSADO')) {
              onBack();
              return;
            }
            try {
              const rep = await getActiveProfileReport(profId, 'professor');
              setActiveReport(rep);
              const updatedData = payload.new as any;
              setProfessor(prev => prev ? { ...prev, ...updatedData } : prev);
            } catch (err) {
              console.error('Error actualizando reporte de profesor en tiempo real:', err);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profile_reports',
        },
        async (payload) => {
          const repTargetId = (payload.new as any)?.target_id || (payload.old as any)?.target_id;
          if (repTargetId === profId) {
            try {
              const rep = await getActiveProfileReport(profId, 'professor');
              setActiveReport(rep);
            } catch (err) {
              console.error('Error refrescando profile_reports para profesor:', err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [professor?.id, slug, user?.uid]);

  const handleToggleCrush = async () => {
    if (!user) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    if (!professor) return;

    const profId = professor.id || slug;
    const previousHasCrushed = hasCrushed;
    const previousCount = crushCount;

    // Actualización optimista en la UI (sumar/restar 1 al instante)
    const nextHasCrushed = !previousHasCrushed;
    const nextCount = nextHasCrushed ? previousCount + 1 : Math.max(0, previousCount - 1);

    setHasCrushed(nextHasCrushed);
    setCrushCount(nextCount);
    setLoadingCrush(true);

    try {
      const result = await toggleProfessorCrush(profId, user.uid);
      setHasCrushed(result.hasCrushed);

      const profFullName = professor.nombre_completo || `${professor.nombre} ${professor.apellidos}`;
      if (result.hasCrushed) {
        notifyProfessorSubscribers({
          professorId: profId,
          professorName: profFullName,
          eventType: 'crush_added',
          actorUid: user.uid,
          totalCount: nextCount
        });
        promptNotificationOnAction('reaction');
      } else {
        notifyProfessorSubscribers({
          professorId: profId,
          professorName: profFullName,
          eventType: 'crush_removed',
          actorUid: user.uid,
          totalCount: nextCount
        });
      }
    } catch (err) {
      console.error('Error al alternar voto de crush:', err);
      // Revertir optimismo en caso de fallo
      setHasCrushed(previousHasCrushed);
      setCrushCount(previousCount);
    } finally {
      setLoadingCrush(false);
    }
  };

  const handleShare = async () => {
    const profName = professor?.nombre_completo || `${professor?.nombre || ''} ${professor?.apellidos || ''}`.trim() || 'Profesor';
    const result = await shareContent({
      title: `${profName} | Wikistars`,
      text: `Conoce y califica el perfil de ${profName} en Wikistars 🎓`,
      url: typeof window !== 'undefined' ? window.location.href : '',
    });
    if (result.copied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="w-10 h-10 border-2 border-[#eab308] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Cargando perfil...</p>
      </div>
    );
  }

  if (!professor) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <h3 className="text-xl font-black text-white uppercase">Perfil no encontrado</h3>
        <p className="text-xs text-zinc-400">El miembro solicitado no se encuentra registrado en nuestra base de datos.</p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl bg-[#eab308] text-black font-extrabold text-xs uppercase"
        >
          Volver
        </button>
      </div>
    );
  }

  const handleInteractionToggle = async (type: 'knows' | 'fan') => {
    if (!user) {
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

    if (!professor) return;
    const profId = professor.id || slug;

    // Respaldar estados previos para posible rollback si falla la BD
    const prevVotedKnow = hasVotedKnow;
    const prevVotedFan = hasVotedFan;
    const prevKnowCount = knowCount;
    const prevFanCount = fanCount;

    try {
      setLoadingInteraction(true);

      // Actualización optimista de UI según las reglas de negocio
      if (type === 'knows') {
        if (hasVotedKnow) {
          setHasVotedKnow(false);
          setKnowCount(prev => Math.max(0, prev - 1));
        } else {
          setHasVotedKnow(true);
          setKnowCount(prev => prev + 1);
          if (hasVotedFan) {
            setHasVotedFan(false);
            setFanCount(prev => Math.max(0, prev - 1));
          }
        }
      } else if (type === 'fan') {
        if (hasVotedFan) {
          setHasVotedFan(false);
          setFanCount(prev => Math.max(0, prev - 1));
        } else {
          setHasVotedFan(true);
          setFanCount(prev => prev + 1);
          if (hasVotedKnow) {
            setHasVotedKnow(false);
            setKnowCount(prev => Math.max(0, prev - 1));
          }
        }
      }

      // Invocar RPC en Supabase
      const result = await toggleProfessorInteraction(profId, user.uid, type);
      if (result && result.success) {
        // Sincronizar conteos reales del servidor
        const counts = await getProfessorInteractionCounts(profId);
        setKnowCount(counts.knows);
        setFanCount(counts.fan);

        const profFullName = professor.nombre_completo || `${professor.nombre} ${professor.apellidos}`;
        if (type === 'knows' && !prevVotedKnow) {
          notifyProfessorSubscribers({
            professorId: profId,
            professorName: profFullName,
            eventType: 'known_added',
            actorUid: user.uid,
            totalCount: counts.knows
          });
        } else if (type === 'fan') {
          if (!prevVotedFan) {
            notifyProfessorSubscribers({
              professorId: profId,
              professorName: profFullName,
              eventType: 'fan_added',
              actorUid: user.uid,
              totalCount: counts.fan
            });
          } else {
            notifyProfessorSubscribers({
              professorId: profId,
              professorName: profFullName,
              eventType: 'fan_removed',
              actorUid: user.uid,
              totalCount: counts.fan
            });
          }
        }
      }
    } catch (err) {
      console.error('Error al guardar la interacción:', err);
      // Rollback del estado en caso de error
      setHasVotedKnow(prevVotedKnow);
      setHasVotedFan(prevVotedFan);
      setKnowCount(prevKnowCount);
      setFanCount(prevFanCount);
    } finally {
      setLoadingInteraction(false);
    }
  };

  const opportunitiesLeft = Math.max(0, 6 - todayVotes.length);

  const handleStarVote = async (stars: number) => {
    // Play corresponding star sound (1-5) immediately on click
    try {
      const audioUrl = `/sonidos/star${stars}.mp3`;
      const audio = new Audio(audioUrl);
      audio.volume = 0.55;
      audio.play().catch(e => console.warn('Audio play prevented:', e));
    } catch (e) {
      console.warn('Audio playback error:', e);
    }

    if (!user) {
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

    if (!professor) return;
    if (opportunitiesLeft <= 0) return;
    if (votingInProgress) return;

    try {
      setVotingInProgress(true);
      const profId = professor.id || slug;

      const result = await submitProfessorVote(profId, user.uid, stars);
      if (result && result.success) {
        // Actualizar promedio general y total ratings de forma reactiva
        setProfessorScore(result.new_score);
        setProfessorTotalRatings(result.new_total);

        // Registrar el nuevo voto en la lista de hoy
        setTodayVotes(prev => [...prev, stars]);

        // Actualizar la distribución (Rating breakdown) de estrellas en tiempo real
        setRatingBreakdown(prev => ({
          ...prev,
          [stars]: (prev[stars] || 0) + 1
        }));

        const profFullName = professor.nombre_completo || `${professor.nombre} ${professor.apellidos}`;
        notifyProfessorSubscribers({
          professorId: profId,
          professorName: profFullName,
          eventType: 'review_added',
          actorUid: user.uid,
          ratingScore: stars
        });

        promptNotificationOnAction('rating');
      }
    } catch (err) {
      console.error('Error al registrar calificación:', err);
    } finally {
      setVotingInProgress(false);
    }
  };

  const validateSocialUrl = (url: string, platform: 'Instagram' | 'YouTube' | 'Facebook' | 'Twitter') => {
    if (!url.trim()) return '';
    const lowerUrl = url.toLowerCase();
    if (platform === 'Instagram' && !lowerUrl.includes('instagram.com')) {
      return 'El enlace ingresado no corresponde a Instagram';
    }
    if (platform === 'YouTube' && !lowerUrl.includes('youtube.com') && !lowerUrl.includes('youtu.be')) {
      return 'El enlace ingresado no corresponde a YouTube';
    }
    if (platform === 'Facebook' && !lowerUrl.includes('facebook.com') && !lowerUrl.includes('web.facebook.com')) {
      return 'El enlace ingresado no corresponde a Facebook';
    }
    if (platform === 'Twitter' && !lowerUrl.includes('twitter.com') && !lowerUrl.includes('x.com')) {
      return 'El enlace ingresado no corresponde a Twitter / X';
    }
    return '';
  };

  const enterEditWikiMode = () => {
    if (!user) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    if (!professor) return;
    setWikiAvatarUrl(professor.avatar_url || '');
    setWikiHeightCm(professor.height_cm ? professor.height_cm.toString() : '');
    setWikiMaritalStatus(professor.marital_status || 'No especificado');
    setWikiGender(professor.gender || 'No especificado');
    
    if (professor.birth_date) {
      const parts = professor.birth_date.split('-');
      setWikiBirthYear(parts[0] || '');
      setWikiBirthMonth(parts[1] || '');
      setWikiBirthDay(parts[2] || '');
    } else {
      setWikiBirthYear('');
      setWikiBirthMonth('');
      setWikiBirthDay('');
    }
    
    setWikiInstagram(professor.instagram_url || '');
    setWikiYoutube(professor.youtube_url || '');
    setWikiFacebook(professor.facebook_url || '');
    setWikiTwitter(professor.twitter_url || '');
    setWikiBiography(extractReportFromBiography(professor.biography).cleanBio);
    setSocialErrors({});
    setIsEditingWiki(true);
  };

  const handleSaveWiki = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!professor) return;

    // Validaciones de redes sociales
    const instagramError = validateSocialUrl(wikiInstagram, 'Instagram');
    const youtubeError = validateSocialUrl(wikiYoutube, 'YouTube');
    const facebookError = validateSocialUrl(wikiFacebook, 'Facebook');
    const twitterError = validateSocialUrl(wikiTwitter, 'Twitter');

    if (instagramError || youtubeError || facebookError || twitterError) {
      setSocialErrors({
        instagram: instagramError,
        youtube: youtubeError,
        facebook: facebookError,
        twitter: twitterError
      });
      return;
    }

    try {
      setSavingWiki(true);
      const formattedBirthDate = (wikiBirthYear && wikiBirthMonth && wikiBirthDay)
        ? `${wikiBirthYear}-${wikiBirthMonth}-${wikiBirthDay}`
        : null;

      const cleanUserBio = stripBiographyMetadata(wikiBiography);
      const bioToSave = activeReport 
        ? embedReportIntoBiography(cleanUserBio, activeReport) 
        : cleanUserBio;

      await updateProfessorWiki(professor.id, {
        avatar_url: wikiAvatarUrl,
        height_cm: wikiHeightCm ? parseInt(wikiHeightCm) : null,
        marital_status: wikiMaritalStatus,
        gender: wikiGender,
        birth_date: formattedBirthDate,
        instagram_url: wikiInstagram,
        youtube_url: wikiYoutube,
        facebook_url: wikiFacebook,
        twitter_url: wikiTwitter,
        biography: bioToSave
      });

      // Actualizar estado reactivo local
      setProfessor(prev => prev ? {
        ...prev,
        avatar_url: wikiAvatarUrl || undefined,
        height_cm: wikiHeightCm ? parseInt(wikiHeightCm) : undefined,
        marital_status: wikiMaritalStatus,
        gender: wikiGender,
        birth_date: formattedBirthDate || undefined,
        instagram_url: wikiInstagram || undefined,
        youtube_url: wikiYoutube || undefined,
        facebook_url: wikiFacebook || undefined,
        twitter_url: wikiTwitter || undefined,
        biography: bioToSave || undefined
      } : null);

      setIsEditingWiki(false);
    } catch (err) {
      console.error('Error al guardar la wiki:', err);
    } finally {
      setSavingWiki(false);
    }
  };

  // Check if profile avatar is specified
  const hasCustomAvatar = slug === 'belinda.aguirre.ponte';
  const avatarUrl = hasCustomAvatar 
    ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop'
    : 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* Volver y Compartir */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          aria-label="Volver al Centro"
          title="Volver al Centro"
          className="p-3 rounded-full bg-[#151515] hover:bg-[#202020] border border-zinc-800 text-zinc-400 hover:text-[#eab308] transition-all cursor-pointer shadow-md flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          {/* Badge de Visualizaciones */}
          <div 
            title="Visualizaciones totales del perfil"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#12131a] border border-zinc-800 text-zinc-300 shadow-md select-none"
          >
            <Eye className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-black tracking-tight text-white">
              {viewsCount.toLocaleString()}
            </span>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider hidden sm:inline">
              vistas
            </span>
          </div>

          {/* Botón de Suscripción a Notificaciones */}
          {professor && (
            <button
              onClick={() => {
                if (!user) {
                  if (onRequireAuth) onRequireAuth();
                  return;
                }
                setNotificationModalOpen(true);
              }}
              className={`p-3 rounded-full border transition-all cursor-pointer shadow-md flex items-center justify-center ${
                isSubscribedToNotifications
                  ? 'bg-amber-500/15 border-amber-500/50 text-[#eab308] shadow-[0_0_15px_rgba(234,179,8,0.25)] hover:bg-amber-500/25'
                  : 'bg-[#151515] hover:bg-[#202020] border-zinc-800 text-zinc-400 hover:text-[#eab308]'
              }`}
              title={
                isSubscribedToNotifications
                  ? 'Notificaciones activadas (clic para gestionar)'
                  : 'Suscribirse a alertas y notificaciones de este profesor'
              }
            >
              {isSubscribedToNotifications ? (
                <BellRing className="w-4 h-4 text-[#eab308]" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </button>
          )}

          {professor && (
            <BookmarkButton
              itemId={professor.id || slug}
              itemType="professor"
              itemName={professor.nombre_completo || `${professor.nombre} ${professor.apellidos}`}
              itemImage={professor.avatar_url || null}
              itemSubtitle={professor.role}
              onRequireAuth={onRequireAuth}
            />
          )}

          <button
            onClick={handleShare}
            className="p-3 rounded-full bg-[#151515] hover:bg-[#202020] border border-zinc-800 text-zinc-400 hover:text-[#eab308] transition-all cursor-pointer shadow-md"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {copied && (
        <p className="text-right text-xs text-[#eab308] font-bold tracking-wide animate-pulse">
          ✓ ¡Enlace copiado al portapapeles!
        </p>
      )}

      {/* BANNER DE VOTACIÓN DE MODERACIÓN ACTIVA (Arriba de la foto de perfil) */}
      {activeReport && professor && (
        <CommunityVoteBanner
          report={activeReport}
          targetName={professor.nombre_completo || `${professor.nombre} ${professor.apellidos}`}
          targetId={professor.id || slug}
          targetType="professor"
          currentUserId={user?.uid || null}
          onRequireAuth={onRequireAuth}
          onVoteUpdated={(updatedRep) => {
            if (updatedRep.status === 'dismissed') {
              setActiveReport(null);
            } else {
              setActiveReport(updatedRep);
            }
          }}
          onProfileExpelled={() => {
            onBack();
          }}
        />
      )}

      {/* SECCIÓN DEL AVATAR CON EL RATING RING (Diseño idéntico a imagen 2) */}
      <div className="flex flex-col items-center text-center space-y-4 py-4">
        <div className="relative">
          {/* Avatar circular */}
          <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-zinc-800 bg-[#181818] shadow-2xl">
            {professor.avatar_url || hasCustomAvatar ? (
              <img
                src={professor.avatar_url || avatarUrl}
                alt={professor.nombre_completo}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-black text-4xl uppercase">
                {professor.nombre.charAt(0)}
              </div>
            )}
          </div>
          {/* Rating badge en la parte inferior derecha del avatar */}
          <div className="absolute -bottom-1 right-2 bg-[#eab308] text-black font-black text-xs px-2 py-1 rounded-full shadow-lg border border-black flex items-center gap-0.5">
            <span>{professorScore.toFixed(1)}</span>
          </div>
        </div>

        {/* Nombre completo */}
        <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight uppercase tracking-tight">
          {professor.nombre_completo || `${professor.nombre} ${professor.apellidos}`}
        </h1>
        <p className="px-3 py-1 rounded-full bg-[#181818] border border-zinc-800 text-zinc-400 text-[10px] uppercase font-bold tracking-widest">
          {professor.role}
        </p>
      </div>

      {/* METRIC CARDS (Yo te conozco / Fan - Diseñados en grilla de 2 columnas) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Yo te conozco */}
        <div 
          onClick={() => handleInteractionToggle('knows')}
          className={`bg-[#0d0d0d] border rounded-2xl p-6 text-center transition-all cursor-pointer select-none active:scale-[0.98] duration-200 ${
            hasVotedKnow 
              ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
              : 'border-zinc-800/80 hover:border-blue-500/40 hover:bg-[#121212]'
          }`}
        >
          <div className="flex justify-center mb-1">
            <Users className={`w-6 h-6 transition-transform text-blue-400 ${hasVotedKnow ? 'scale-110 text-blue-400' : 'text-blue-400/80'}`} />
          </div>
          <span className="block text-2xl font-black text-white tracking-tight">
            {knowCount}
          </span>
          <span className={`block text-[10px] uppercase font-extrabold tracking-widest mt-1 transition-colors ${hasVotedKnow ? 'text-blue-400' : 'text-zinc-400'}`}>
            {hasVotedKnow ? '✓ Yo te conozco' : 'Yo te conozco'}
          </span>
        </div>

        {/* Fan */}
        <div 
          onClick={() => handleInteractionToggle('fan')}
          className={`bg-[#0d0d0d] border rounded-2xl p-6 text-center transition-all cursor-pointer select-none active:scale-[0.98] duration-200 ${
            hasVotedFan 
              ? 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
              : 'border-zinc-800/80 hover:border-red-500/40 hover:bg-[#121212]'
          }`}
        >
          <div className="flex justify-center mb-1">
            <Heart className={`w-6 h-6 transition-transform text-red-500 ${hasVotedFan ? 'fill-red-500 scale-110' : 'fill-red-500/20'}`} />
          </div>
          <span className="block text-2xl font-black text-white tracking-tight">
            {fanCount}
          </span>
          <span className={`block text-[10px] uppercase font-extrabold tracking-widest mt-1 transition-colors ${hasVotedFan ? 'text-red-500' : 'text-zinc-400'}`}>
            {hasVotedFan ? '✓ Fan' : 'Fan'}
          </span>
        </div>
      </div>

      {/* PESTAÑAS (Wiki, Reseñas, Crushes, Ship, Estadística - idéntico a imagen 2) */}
      <div className="bg-[#0d0d0d] border border-zinc-800/80 rounded-xl p-1 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 min-w-max">
          {[
            { id: 'Reseñas' as TabType, label: 'Reseñas', icon: Star, color: '#eab308' },
            ...(isAdmin ? [{ id: 'Crushes' as TabType, label: 'Crushes', icon: Heart, color: '#f43f5e' }] : [])
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isCrushes = tab.id === 'Crushes';

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`relative py-3.5 px-4 sm:px-5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 select-none ${
                  isActive
                    ? 'bg-[#14151d] text-white border border-zinc-800/60 font-black shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-[#151515] border border-transparent'
                }`}
              >
                <Icon 
                  className={`w-4 h-4 flex-shrink-0 transition-transform hover:scale-110`} 
                  style={{ color: tab.color }}
                  fill={isCrushes && hasCrushed ? tab.color : 'none'}
                />
                <span className={isActive ? 'inline' : 'hidden sm:inline'}>{tab.label}</span>

                {/* Línea inferior brillante cuando el elemento está activo */}
                {isActive && (
                  <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#eab308] rounded-full shadow-[0_0_8px_#eab308]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* RENDERIZADO DE CONTENIDOS SEGÚN LA PESTAÑA SELECCIONADA */}

      {/* 1. PESTAÑA RESEÑAS */}
      {activeTab === 'Reseñas' && (() => {
        const totalVotesCount = Object.values(ratingBreakdown).reduce((a, b) => a + b, 0);

        return (
          <div className="space-y-6">
            <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white uppercase tracking-wide">
                  Resumen de Estrellas
                </h2>
                {/* Badge superior de oportunidades restantes */}
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                  opportunitiesLeft === 0
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20'
                }`}>
                  OPORTUNIDADES: {opportunitiesLeft}/6
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Bloque Izquierdo con el puntaje general promedio */}
                <div className="bg-[#050505] border border-zinc-800/20 rounded-2xl p-6 text-center w-full md:w-48 space-y-3">
                  <span className="block text-5xl font-black text-[#eab308] tracking-tighter">
                    {professorScore.toFixed(1)}
                  </span>
                  
                  {/* Estrellas visuales */}
                  <div className="flex items-center justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={`w-5 h-5 ${
                          star <= Math.round(professorScore)
                            ? 'fill-[#eab308] text-[#eab308]' 
                            : 'text-zinc-700'
                        }`} 
                      />
                    ))}
                  </div>

                  <span className="block text-[10px] uppercase text-zinc-500 font-extrabold tracking-widest">
                    {professorTotalRatings} VOTOS TOTALES
                  </span>
                </div>

                {/* Distribución de Estrellas (Progress Bars) */}
                <div className="flex-1 w-full space-y-2.5">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = ratingBreakdown[stars] || 0;
                    const percent = totalVotesCount > 0 ? `${((count / totalVotesCount) * 100).toFixed(0)}%` : '0%';

                    return (
                      <div key={stars} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-zinc-400 w-3 text-right">
                          {stars}
                        </span>
                        <div className="flex-1 h-2 bg-[#121212] rounded-full overflow-hidden border border-zinc-800/40">
                          <div 
                            className="h-full bg-[#eab308] transition-all duration-500" 
                            style={{ width: percent }}
                          />
                        </div>
                        <span className="text-xs font-bold text-zinc-500 w-4 text-right">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Formulario rápido para dejar reseña */}
              <div className="pt-4 border-t border-zinc-800/40 space-y-3">
                <p className="text-xs font-bold uppercase text-zinc-400 tracking-wider text-center">
                  ¿Conoces a {professor.nombre}? ¡Deja tu calificación de estrellas!
                </p>

                {opportunitiesLeft === 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 opacity-30 select-none">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div
                          key={star}
                          className="p-2 bg-[#121212] border border-zinc-800 rounded-lg text-zinc-700"
                        >
                          <Star className="w-6 h-6" />
                        </div>
                      ))}
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-center">
                      <p className="text-rose-400 text-xs font-black uppercase tracking-wider">
                        ¡VUELVE MAÑANA PARA MÁS VOTOS!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        disabled={votingInProgress}
                        onClick={() => handleStarVote(star)}
                        className="p-2 bg-[#121212] hover:bg-[#eab308]/10 border border-zinc-800 rounded-lg text-zinc-500 hover:text-[#eab308] transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Star className="w-6 h-6 hover:scale-110 active:scale-95 transition-transform" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sección "TUS VOTOS DE HOY" */}
              {todayVotes.length > 0 && (
                <div className="pt-4 border-t border-zinc-800/40 space-y-2">
                  <span className="block text-xs font-bold uppercase text-zinc-500 tracking-wider text-center">
                    Tus votos de hoy para este profesor:
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {todayVotes.map((v, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center gap-1.5 bg-[#121212] border border-zinc-800/60 rounded-full px-3 py-1.5 text-xs text-zinc-300 font-extrabold shadow-sm animate-in fade-in zoom-in duration-300"
                      >
                        <Star className="w-3.5 h-3.5 fill-[#eab308] text-[#eab308]" />
                        <span>{v} {v === 1 ? 'Estrella' : 'Estrellas'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 2. WIKI TAB */}
      {activeTab === 'Wiki' && (() => {
        const getMaxDays = (yearStr: string, monthStr: string) => {
          const year = parseInt(yearStr) || 2000;
          const month = parseInt(monthStr) || 1;
          return new Date(year, month, 0).getDate();
        };

        return (
          <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-2xl p-6 space-y-6">
            {!isEditingWiki ? (
              // VIEW WIKI MODE
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-800/40 pb-4">
                  <h2 className="text-xl font-black text-white uppercase tracking-wide flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#eab308]" />
                    <span>Biografía y Trayectoria</span>
                  </h2>
                  <button
                    onClick={enterEditWikiMode}
                    className="px-4.5 py-2 bg-[#eab308] text-black text-xs font-black uppercase tracking-wider rounded-lg hover:bg-[#eab308]/90 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Editar Wiki</span>
                  </button>
                </div>

                {/* Biography content */}
                {(() => {
                  const displayBio = stripBiographyMetadata(professor.biography);
                  if (!displayBio) return null;
                  return (
                    <div className="space-y-3">
                      <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {displayBio}
                      </p>
                    </div>
                  );
                })()}

                {/* Personal Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-800/40">
                  <div className="bg-[#050505] p-4 rounded-xl border border-zinc-800/20 space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Altura</span>
                    <span className="text-sm font-bold text-white block">
                      {professor.height_cm ? `${professor.height_cm} cm` : 'No especificada'}
                    </span>
                  </div>

                  <div className="bg-[#050505] p-4 rounded-xl border border-zinc-800/20 space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Estado Civil</span>
                    <span className="text-sm font-bold text-white block">
                      {professor.marital_status || 'No especificado'}
                    </span>
                  </div>

                  <div className="bg-[#050505] p-4 rounded-xl border border-zinc-800/20 space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Sexo</span>
                    <span className="text-sm font-bold text-white block">
                      {professor.gender || 'No especificado'}
                    </span>
                  </div>

                  <div className="bg-[#050505] p-4 rounded-xl border border-zinc-800/20 space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Fecha de Nacimiento</span>
                    <span className="text-sm font-bold text-white block">
                      {professor.birth_date ? (() => {
                        const dateObj = new Date(professor.birth_date + 'T00:00:00');
                        return dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
                      })() : 'No especificada'}
                    </span>
                  </div>

                  {professor.birth_date && (
                    <div className="bg-[#050505] p-4 rounded-xl border border-zinc-800/20 space-y-1">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Edad</span>
                      <span className="text-sm font-bold text-white block">
                        {(() => {
                          const birthDate = new Date(professor.birth_date + 'T00:00:00');
                          const today = new Date();
                          let age = today.getFullYear() - birthDate.getFullYear();
                          const m = today.getMonth() - birthDate.getMonth();
                          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                            age--;
                          }
                          return `${age} años`;
                        })()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Social Media Links if present */}
                {(professor.instagram_url || professor.youtube_url || professor.facebook_url || professor.twitter_url) && (
                  <div className="pt-4 border-t border-zinc-800/40 space-y-3">
                    <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Redes Sociales Oficiales</h3>
                    <div className="flex flex-wrap gap-3">
                      {professor.instagram_url && (
                        <a
                          href={professor.instagram_url.startsWith('http') ? professor.instagram_url : `https://${professor.instagram_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-[#121212] border border-zinc-800 hover:border-pink-500/50 hover:text-pink-500 px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 transition-all cursor-pointer"
                        >
                          <Heart className="w-4 h-4 fill-current text-pink-500" />
                          <span>Instagram</span>
                        </a>
                      )}
                      {professor.youtube_url && (
                        <a
                          href={professor.youtube_url.startsWith('http') ? professor.youtube_url : `https://${professor.youtube_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-[#121212] border border-zinc-800 hover:border-red-500/50 hover:text-red-500 px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 transition-all cursor-pointer"
                        >
                          <Award className="w-4 h-4 text-red-500" />
                          <span>YouTube</span>
                        </a>
                      )}
                      {professor.facebook_url && (
                        <a
                          href={professor.facebook_url.startsWith('http') ? professor.facebook_url : `https://${professor.facebook_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-[#121212] border border-zinc-800 hover:border-blue-500/50 hover:text-blue-500 px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 transition-all cursor-pointer"
                        >
                          <Users className="w-4 h-4 text-blue-500" />
                          <span>Facebook</span>
                        </a>
                      )}
                      {professor.twitter_url && (
                        <a
                          href={professor.twitter_url.startsWith('http') ? professor.twitter_url : `https://${professor.twitter_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-[#121212] border border-zinc-800 hover:border-[#1da1f2]/50 hover:text-[#1da1f2] px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 transition-all cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-[#1da1f2]" />
                          <span>Twitter / X</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Created At footer info */}
                <div className="p-4 bg-[#050505] rounded-xl border border-zinc-800/20 text-xs text-zinc-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#eab308]" />
                  <span>
                    Miembro registrado el{' '}
                    {new Date(professor.created_at || '').toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            ) : (
              // EDIT WIKI MODE
              <form onSubmit={handleSaveWiki} className="space-y-6">
                <div className="border-b border-zinc-800/40 pb-4">
                  <h2 className="text-xl font-black text-white uppercase tracking-wide">
                    Editar Perfil Wiki
                  </h2>
                </div>

                {/* Foto de perfil input */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Foto de Perfil (URL Directa)
                  </label>
                  <input
                    type="text"
                    placeholder="https://ejemplo.com/imagen.jpg"
                    value={wikiAvatarUrl}
                    onChange={(e) => setWikiAvatarUrl(e.target.value)}
                    className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white font-medium outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>

                {/* Altura, Estado Civil, Sexo Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Altura */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Altura
                    </label>
                    <select
                      value={wikiHeightCm}
                      onChange={(e) => setWikiHeightCm(e.target.value)}
                      className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all cursor-pointer"
                    >
                      <option value="">Selecciona una altura</option>
                      {Array.from({ length: 61 }, (_, i) => 140 + i).map((h) => (
                        <option key={h} value={h.toString()}>
                          {h} cm
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Estado Civil */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Estado Civil
                    </label>
                    <select
                      value={wikiMaritalStatus}
                      onChange={(e) => setWikiMaritalStatus(e.target.value)}
                      className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all cursor-pointer"
                    >
                      <option value="No especificado">No especificado</option>
                      <option value="Soltero/a">Soltero/a</option>
                      <option value="Con novio/a">Con novio/a</option>
                      <option value="Casado/a">Casado/a</option>
                    </select>
                  </div>

                  {/* Sexo */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Sexo
                    </label>
                    <select
                      value={wikiGender}
                      onChange={(e) => setWikiGender(e.target.value)}
                      className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all cursor-pointer"
                    >
                      <option value="No especificado">No especificado</option>
                      <option value="HOMBRE">HOMBRE</option>
                      <option value="MUJER">MUJER</option>
                    </select>
                  </div>
                </div>

                {/* Fecha de Nacimiento (Año -> Mes -> Día) */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Fecha de Nacimiento
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Año */}
                    <select
                      value={wikiBirthYear}
                      onChange={(e) => {
                        setWikiBirthYear(e.target.value);
                        // Reset day to prevent exceeding limits
                        setWikiBirthDay('');
                      }}
                      className="bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-3 py-3 text-sm text-white outline-none transition-all cursor-pointer"
                    >
                      <option value="">Año</option>
                      {Array.from({ length: 2026 - 1950 + 1 }, (_, i) => 2026 - i).map((y) => (
                        <option key={y} value={y.toString()}>
                          {y}
                        </option>
                      ))}
                    </select>

                    {/* Mes */}
                    <select
                      value={wikiBirthMonth}
                      onChange={(e) => {
                        setWikiBirthMonth(e.target.value);
                        // Reset day to prevent exceeding limits
                        setWikiBirthDay('');
                      }}
                      className="bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-3 py-3 text-sm text-white outline-none transition-all cursor-pointer"
                    >
                      <option value="">Mes</option>
                      {[
                        { value: '01', label: 'Enero' },
                        { value: '02', label: 'Febrero' },
                        { value: '03', label: 'Marzo' },
                        { value: '04', label: 'Abril' },
                        { value: '05', label: 'Mayo' },
                        { value: '06', label: 'Junio' },
                        { value: '07', label: 'Julio' },
                        { value: '08', label: 'Agosto' },
                        { value: '09', label: 'Septiembre' },
                        { value: '10', label: 'Octubre' },
                        { value: '11', label: 'Noviembre' },
                        { value: '12', label: 'Diciembre' }
                      ].map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>

                    {/* Día */}
                    <select
                      value={wikiBirthDay}
                      onChange={(e) => setWikiBirthDay(e.target.value)}
                      className="bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-3 py-3 text-sm text-white outline-none transition-all cursor-pointer"
                    >
                      <option value="">Día</option>
                      {wikiBirthYear && wikiBirthMonth ? (
                        Array.from({ length: getMaxDays(wikiBirthYear, wikiBirthMonth) }, (_, i) => {
                          const dNum = i + 1;
                          const dStr = dNum < 10 ? `0${dNum}` : dNum.toString();
                          return (
                            <option key={dStr} value={dStr}>
                              {dNum}
                            </option>
                          );
                        })
                      ) : (
                        Array.from({ length: 31 }, (_, i) => {
                          const dNum = i + 1;
                          const dStr = dNum < 10 ? `0${dNum}` : dNum.toString();
                          return (
                            <option key={dStr} value={dStr}>
                              {dNum}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>
                </div>

                {/* Redes Sociales Fields */}
                <div className="space-y-4 pt-4 border-t border-zinc-800/40">
                  <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Redes Sociales</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Instagram */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        Instagram
                      </label>
                      <input
                        type="text"
                        placeholder="https://instagram.com/nombre"
                        value={wikiInstagram}
                        onChange={(e) => {
                          setWikiInstagram(e.target.value);
                          setSocialErrors(prev => ({ ...prev, instagram: '' }));
                        }}
                        className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600"
                      />
                      {socialErrors.instagram && (
                        <p className="text-rose-500 text-[11px] font-bold tracking-wide mt-1">
                          {socialErrors.instagram}
                        </p>
                      )}
                    </div>

                    {/* YouTube */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        YouTube
                      </label>
                      <input
                        type="text"
                        placeholder="https://youtube.com/nombre"
                        value={wikiYoutube}
                        onChange={(e) => {
                          setWikiYoutube(e.target.value);
                          setSocialErrors(prev => ({ ...prev, youtube: '' }));
                        }}
                        className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600"
                      />
                      {socialErrors.youtube && (
                        <p className="text-rose-500 text-[11px] font-bold tracking-wide mt-1">
                          {socialErrors.youtube}
                        </p>
                      )}
                    </div>

                    {/* Facebook */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        Facebook
                      </label>
                      <input
                        type="text"
                        placeholder="https://facebook.com/nombre"
                        value={wikiFacebook}
                        onChange={(e) => {
                          setWikiFacebook(e.target.value);
                          setSocialErrors(prev => ({ ...prev, facebook: '' }));
                        }}
                        className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600"
                      />
                      {socialErrors.facebook && (
                        <p className="text-rose-500 text-[11px] font-bold tracking-wide mt-1">
                          {socialErrors.facebook}
                        </p>
                      )}
                    </div>

                    {/* Twitter / X */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        Twitter / X
                      </label>
                      <input
                        type="text"
                        placeholder="https://twitter.com/nombre"
                        value={wikiTwitter}
                        onChange={(e) => {
                          setWikiTwitter(e.target.value);
                          setSocialErrors(prev => ({ ...prev, twitter: '' }));
                        }}
                        className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600"
                      />
                      {socialErrors.twitter && (
                        <p className="text-rose-500 text-[11px] font-bold tracking-wide mt-1">
                          {socialErrors.twitter}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Save / Cancel actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-zinc-800/40">
                  <button
                    type="button"
                    disabled={savingWiki}
                    onClick={() => setIsEditingWiki(false)}
                    className="flex-1 py-3 bg-[#121212] hover:bg-[#181818] border border-zinc-800 rounded-xl text-xs font-black uppercase tracking-wider text-zinc-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingWiki}
                    className="flex-1 py-3 bg-[#eab308] hover:bg-[#eab308]/90 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingWiki ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <span>Guardar Cambios</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        );
      })()}

      {/* 3. CRUSHES TAB (Visible únicamente para Administradores) */}
      {isAdmin && activeTab === 'Crushes' && (
        <div className="bg-[#0d0d0d] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-300">
          <div className="text-center max-w-md mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-[10px] font-black uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              <span>Flechazos del Campus</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              ¿Es tu Crush en el Campus?
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Los flechazos son 100% confidenciales y anónimos. Nadie sabrá tu identidad, pero sumarás popularidad al perfil.
            </p>
          </div>

          {/* Botón Destacado de Flechazo / Crush */}
          <div className="flex flex-col items-center justify-center py-4 space-y-4">
            <button
              type="button"
              onClick={handleToggleCrush}
              disabled={loadingCrush}
              className={`group relative p-6 sm:p-8 rounded-full border-2 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center shadow-2xl active:scale-95 ${
                hasCrushed
                  ? 'bg-gradient-to-b from-pink-500/20 to-rose-600/30 border-pink-500 text-pink-400 shadow-[0_0_40px_rgba(236,72,153,0.45)] ring-4 ring-pink-500/20 scale-105'
                  : 'bg-[#141414] hover:bg-[#1c1c1c] border-zinc-800 hover:border-pink-500/50 text-zinc-400 hover:text-pink-400 hover:shadow-[0_0_25px_rgba(236,72,153,0.2)]'
              }`}
              title={hasCrushed ? 'Retirar flechazo' : 'Dar flechazo'}
            >
              {loadingCrush ? (
                <Loader2 className="w-16 h-16 sm:w-20 sm:h-20 animate-spin text-pink-500" />
              ) : (
                <Heart
                  className={`w-16 h-16 sm:w-20 sm:h-20 transition-transform duration-300 group-hover:scale-110 ${
                    hasCrushed ? 'fill-pink-500 text-pink-500 animate-pulse' : 'stroke-[1.5]'
                  }`}
                />
              )}
            </button>

            {/* Contador de Flechazos */}
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className={`text-4xl sm:text-5xl font-black tracking-tight ${hasCrushed ? 'text-pink-400' : 'text-white'}`}>
                  {crushCount}
                </span>
              </div>
              <span className="block text-xs font-black uppercase tracking-widest text-zinc-500">
                {crushCount === 1 ? 'Flechazo Recibido' : 'Flechazos Recibidos'}
              </span>
            </div>

            {/* Estado o Feedback */}
            <div className="text-center max-w-xs">
              {hasCrushed ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-950/40 border border-pink-800/40 text-pink-300 text-xs font-bold animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" />
                  <span>¡Ya diste tu flechazo anónimo!</span>
                </div>
              ) : (
                <span className="text-[11px] text-zinc-500 font-medium">
                  Toca el corazón para enviar tu flechazo anónimo
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. ESTADÍSTICA TAB */}
      {activeTab === 'Estadística' && (
        <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-black text-white uppercase tracking-wide">
            Estadísticas Generales
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-[#050505] p-4 rounded-xl border border-zinc-800/20">
              <span className="block text-xs text-zinc-500 font-bold uppercase tracking-wider">Votos</span>
              <span className="text-xl font-black text-white mt-1 block">{knowCount}</span>
            </div>
            <div className="bg-[#050505] p-4 rounded-xl border border-zinc-800/20">
              <span className="block text-xs text-zinc-500 font-bold uppercase tracking-wider">Fans</span>
              <span className="text-xl font-black text-[#eab308] mt-1 block">{fanCount}</span>
            </div>
            <div className="bg-[#050505] p-4 rounded-xl border border-zinc-800/20">
              <span className="block text-xs text-zinc-500 font-bold uppercase tracking-wider">Puntaje</span>
              <span className="text-xl font-black text-emerald-400 mt-1 block">
                {professorScore.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Suscripción a Notificaciones del Profesor */}
      {professor && user && (
        <ProfessorNotificationModal
          isOpen={notificationModalOpen}
          onClose={() => setNotificationModalOpen(false)}
          professorId={professor.id || slug}
          professorName={professor.nombre_completo || `${professor.nombre} ${professor.apellidos}`}
          professorAvatar={professor.avatar_url || null}
          userUid={user.uid}
          onSubscriptionChange={(subscribed) => setIsSubscribedToNotifications(subscribed)}
        />
      )}

      {/* Modal de Reporte / Moderación Comunitaria */}
      {professor && (
        <ReportProfileModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          targetId={professor.id || slug}
          targetType="professor"
          targetName={professor.nombre_completo || `${professor.nombre} ${professor.apellidos}`}
          instituteId={professor.institute_id || ''}
          currentUserId={user?.uid || ''}
          currentUserName={user?.displayName || 'Miembro del campus'}
          onReportCreated={(rep) => {
            setActiveReport(rep);
          }}
        />
      )}

    </div>
  );
}
