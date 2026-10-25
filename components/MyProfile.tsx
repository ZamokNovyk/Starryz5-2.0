'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { checkUsernameAvailable, updateAuthUserProfile } from '@/src/lib/auth';
import { motion } from 'motion/react';
import { 
  User, 
  Mail, 
  Calendar, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Database,
  ArrowLeft,
  Sparkles,
  Trash2,
  ChevronRight,
  Heart,
  HeartCrack,
  Star,
  UserCheck,
  Bell,
  BellRing,
  BellOff,
  GraduationCap,
  Users,
  Settings2,
  TrendingUp,
  Activity,
  Globe,
  Camera,
  Eye,
  Maximize2,
  X,
  CreditCard,
  Lock,
  MessageSquare,
  Send
} from 'lucide-react';
import { 
  getUserProfessorSubscriptions, 
  removeProfessorNotificationSubscription, 
  UserProfessorSubscriptionItem 
} from '@/src/lib/professors';
import { 
  getUserStudentSubscriptions, 
  removeStudentNotificationSubscription, 
  UserStudentSubscriptionItem,
  Student,
  getStudentById,
  getStudentInteractionCounts,
  getStudentRatingBreakdown,
  getStudentReviewsList,
  StudentReviewItem,
  getStudentLoveMessages,
  StudentLoveMessage,
  createStudentLoveMessage,
  deleteStudentLoveMessage,
  toggleStudentLoveMessageHeart,
  submitStudentVote
} from '@/src/lib/students';
import { 
  getUserActitudCounts, 
  getUserActitudVotes, 
  toggleUserActitudVote,
  getUserGivenInteractions,
  removeUserGivenInteraction,
  UserInteractionViewItem
} from '@/src/lib/userActitud';
import { getUserCrushesCount, hasUserCrushed, toggleUserCrush } from '@/src/lib/userCrushes';
import { getAdminDashboardMetrics, AdminDashboardData } from '@/src/lib/admin';
import ProfessorNotificationModal from '@/components/Modals/ProfessorNotificationModal';
import StudentNotificationModal from '@/components/Modals/StudentNotificationModal';
import AvatarUploadModal from '@/components/Modals/AvatarUploadModal';
import GenderBadge from '@/components/GenderBadge';
import CountrySelector from '@/components/CountrySelector';
import { findCountry, getFlagUrl } from '@/src/data/countries';

interface SupabaseUser {
  id: string;
  firebase_uid?: string;
  email: string | null;
  display_name: string | null;
  nombres?: string | null;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  username?: string | null;
  gender?: string | null;
  country?: string | null;
  country_code?: string | null;
  role?: string | null;
  photo_url: string | null;
  created_at: string;
  is_anonymous: boolean;
  linked_google_at: string | null;
}

function parseFullName(fullName: string): { nombres: string; apellidoPaterno: string; apellidoMaterno: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { nombres: '', apellidoPaterno: '', apellidoMaterno: '' };
  }
  if (parts.length === 1) {
    return { nombres: parts[0], apellidoPaterno: '', apellidoMaterno: '' };
  }
  if (parts.length === 2) {
    return { nombres: parts[0], apellidoPaterno: parts[1], apellidoMaterno: '' };
  }
  if (parts.length === 3) {
    return { nombres: parts[0], apellidoPaterno: parts[1], apellidoMaterno: parts[2] };
  }
  const apellidoMaterno = parts[parts.length - 1];
  const apellidoPaterno = parts[parts.length - 2];
  const nombres = parts.slice(0, parts.length - 2).join(' ');
  return { nombres, apellidoPaterno, apellidoMaterno };
}

interface MyProfileProps {
  uid?: string;
  onBackToHome: () => void;
  onNavigate?: (path: string) => void;
}

export default function MyProfile({ uid, onBackToHome, onNavigate }: MyProfileProps) {
  const { user, linkWithGoogle } = useAuth();
  const [dbUser, setDbUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  
  // 3 campos oficiales: Nombres, Apellido Paterno, Apellido Materno
  const [nombresInput, setNombresInput] = useState('');
  const [apellidoPaternoInput, setApellidoPaternoInput] = useState('');
  const [apellidoMaternoInput, setApellidoMaternoInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [initialDisplayName, setInitialDisplayName] = useState('');
  const [dniInput, setDniInput] = useState('');
  const [isDniVerified, setIsDniVerified] = useState(false);
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | ''>('');
  const [initialGender, setInitialGender] = useState<'male' | 'female' | ''>('');
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('');
  const [selectedCountryName, setSelectedCountryName] = useState<string>('');
  const [initialCountryCode, setInitialCountryCode] = useState<string>('');
  const [usernameAvailability, setUsernameAvailability] = useState<{
    status: 'idle' | 'checking' | 'available' | 'taken' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<'info' | 'interactions' | 'subscriptions' | 'admin'>('info');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isViewPhotoModalOpen, setIsViewPhotoModalOpen] = useState(false);

  // Estados para el perfil transformado tras reclamar perfil con DNI
  const [claimedStudent, setClaimedStudent] = useState<Student | null>(null);
  const [claimedMainTab, setClaimedMainTab] = useState<'mis_datos' | 'reseñas' | 'crushes'>('mis_datos');
  const [claimedRatingBreakdown, setClaimedRatingBreakdown] = useState<{ [key: number]: number }>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [claimedReviews, setClaimedReviews] = useState<StudentReviewItem[]>([]);
  const [claimedLoveMessages, setClaimedLoveMessages] = useState<StudentLoveMessage[]>([]);
  const [loadingStudentData, setLoadingStudentData] = useState(false);
  const [profileVotingInProgress, setProfileVotingInProgress] = useState(false);
  const [profileVoteSuccessMsg, setProfileVoteSuccessMsg] = useState<string | null>(null);

  // Admin Dashboard Metrics State
  const [adminMetrics, setAdminMetrics] = useState<AdminDashboardData | null>(null);
  const [loadingAdminMetrics, setLoadingAdminMetrics] = useState(false);

  // Interacciones State (3 subtags: Yo te conozco, Fans, Calificaciones)
  const [interactions, setInteractions] = useState<UserInteractionViewItem[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [interactionFilter, setInteractionFilter] = useState<'knows' | 'fans' | 'ratings'>('knows');
  const [interactionsError, setInteractionsError] = useState('');

  // Suscripciones a Notificaciones State
  const [subscriptionsSubTab, setSubscriptionsSubTab] = useState<'professors' | 'students'>('professors');
  const [profSubscriptions, setProfSubscriptions] = useState<UserProfessorSubscriptionItem[]>([]);
  const [studentSubscriptions, setStudentSubscriptions] = useState<UserStudentSubscriptionItem[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [subscriptionsError, setSubscriptionsError] = useState('');
  const [editingProfSub, setEditingProfSub] = useState<UserProfessorSubscriptionItem | null>(null);
  const [editingStudentSub, setEditingStudentSub] = useState<UserStudentSubscriptionItem | null>(null);

  // Estados para envío de mensajes de amor anónimos
  const [loveMessageText, setLoveMessageText] = useState('');
  const [sendingLoveMessage, setSendingLoveMessage] = useState(false);
  const [loveMessageSuccess, setLoveMessageSuccess] = useState<string | null>(null);
  const [loveMessageError, setLoveMessageError] = useState<string | null>(null);

  // Estados para actitud y votos (Seguidores / Fans)
  const [knowCount, setKnowCount] = useState(0);
  const [fanCount, setFanCount] = useState(0);
  const [currentVote, setCurrentVote] = useState<'yo_te_conozco' | 'fans' | null>(null);

  const isOwnProfile = !uid || (user && user.uid === uid) || (typeof window !== 'undefined' && (window.location.pathname === '/miperfil' || window.location.pathname === '/miperfil/'));
  const isSelfProfile = isOwnProfile || Boolean(uid && user && (uid === user.uid || uid === dbUser?.id || uid === user.email));

  // Sincronizar automáticamente para que la URL siempre sea /miperfil/ cuando estás en tu propio perfil
  useEffect(() => {
    if (isSelfProfile && typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/perfil/')) {
        window.history.replaceState(null, '', '/miperfil/');
      }
    }
  }, [isSelfProfile]);

  useEffect(() => {
    const targetUid = uid || user?.uid;
    if (!targetUid && !dbUser?.id) return;

    async function loadActitud() {
      try {
        const candidateIds = [targetUid, dbUser?.id, (dbUser as any)?.claimed_student_id].filter(Boolean) as string[];
        const counts = await getUserActitudCounts(candidateIds[0], candidateIds);
        const realKnows = Math.max(counts.knowCount, (dbUser as any)?.knows_count || 0);
        const realFans = Math.max(counts.fanCount, (dbUser as any)?.fans_count || 0);
        setKnowCount(realKnows);
        setFanCount(realFans);

        if (user?.uid && targetUid !== user.uid) {
          const votes = await getUserActitudVotes(candidateIds[0], user.uid, candidateIds);
          setCurrentVote(votes.currentVote);
        } else {
          setCurrentVote(null);
        }
      } catch (err) {
        console.warn('Error al cargar actitud:', err);
      }
    }

    loadActitud();
  }, [uid, user?.uid, dbUser?.id, (dbUser as any)?.fans_count, (dbUser as any)?.knows_count]);

  // Votos de 'users_crushes'
  const [crushesCount, setCrushesCount] = useState(0);
  const [hasCrushedUser, setHasCrushedUser] = useState(false);

  useEffect(() => {
    const targetUid = uid || user?.uid;
    if (!targetUid && !dbUser?.id) return;

    async function loadCrushes() {
      try {
        const candidateIds = [targetUid, dbUser?.id, (dbUser as any)?.claimed_student_id].filter(Boolean) as string[];
        const count = await getUserCrushesCount(candidateIds[0], candidateIds);
        const realCrushes = Math.max(count, (dbUser as any)?.crushes_count || 0);
        setCrushesCount(realCrushes);

        if (user?.uid && targetUid !== user.uid) {
          const isCrushed = await hasUserCrushed(candidateIds[0], user.uid, candidateIds);
          setHasCrushedUser(isCrushed);
        } else {
          setHasCrushedUser(false);
        }
      } catch (err) {
        console.warn('Error al cargar crushes:', err);
      }
    }

    loadCrushes();
  }, [uid, user?.uid, dbUser?.id, (dbUser as any)?.crushes_count]);

  const handleToggleCrush = async () => {
    const targetUid = uid || user?.uid;
    if (!user?.uid || !targetUid || isSelfProfile) return;

    const nextState = !hasCrushedUser;
    setHasCrushedUser(nextState);
    setCrushesCount(prev => nextState ? prev + 1 : Math.max(0, prev - 1));

    try {
      const candidateIds = [targetUid, dbUser?.id, (dbUser as any)?.claimed_student_id].filter(Boolean) as string[];
      const res = await toggleUserCrush(candidateIds[0], user.uid);
      setHasCrushedUser(res.hasCrushed);
      setCrushesCount(res.newCount);
    } catch (err) {
      console.error('Error al votar crush:', err);
    }
  };

  const handleSendLoveMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSelfProfile) return;

    const trimmed = loveMessageText.trim();
    if (!trimmed) {
      setLoveMessageError('Por favor, escribe un mensaje de amor.');
      return;
    }

    if (trimmed.length > 500) {
      setLoveMessageError('El mensaje no debe superar los 500 caracteres.');
      return;
    }

    try {
      setSendingLoveMessage(true);
      setLoveMessageError(null);
      setLoveMessageSuccess(null);

      const targetCandidateIds = [
        dbUser?.id,
        uid,
        (dbUser as any)?.claimed_student_id,
        claimedStudent?.id
      ].filter(Boolean) as string[];
      const targetId = targetCandidateIds[0] || uid || '';

      const res = await createStudentLoveMessage(
        targetId,
        user.uid,
        '',
        null,
        trimmed,
        dbUser?.display_name || undefined
      );

      if (res.success && res.data) {
        setClaimedLoveMessages(prev => [res.data!, ...prev]);
        setLoveMessageText('');
        setLoveMessageSuccess('¡Tu mensaje de amor anónimo fue enviado con éxito! 💌');
        setTimeout(() => setLoveMessageSuccess(null), 4000);
      } else {
        setLoveMessageError(res.error || 'No se pudo enviar el mensaje.');
      }
    } catch (err: any) {
      console.error('Error al enviar mensaje de amor:', err);
      setLoveMessageError(err?.message || 'Error inesperado al enviar el mensaje.');
    } finally {
      setSendingLoveMessage(false);
    }
  };

  const handleToggleMessageReaction = async (msg: StudentLoveMessage) => {
    if (!user) return;
    const targetCandidateIds = [
      dbUser?.id,
      uid,
      (dbUser as any)?.claimed_student_id,
      claimedStudent?.id
    ].filter(Boolean) as string[];
    const targetId = targetCandidateIds[0] || uid || '';

    const wasHearted = !!msg.has_hearted;
    const nextHearted = !wasHearted;
    const newCount = nextHearted ? (msg.hearts_count || 0) + 1 : Math.max(0, (msg.hearts_count || 1) - 1);

    // Actualización optimista instantánea
    setClaimedLoveMessages(prev =>
      prev.map(m => m.id === msg.id ? { ...m, has_hearted: nextHearted, hearts_count: newCount } : m)
    );

    try {
      await toggleStudentLoveMessageHeart(msg.id, user.uid, targetId);
    } catch (err) {
      console.warn('Aviso al reaccionar a mensaje de amor:', err);
    }
  };

  const handleDeleteLoveMessage = async (messageId: number | string) => {
    if (!user) return;
    const targetCandidateIds = [
      dbUser?.id,
      uid,
      (dbUser as any)?.claimed_student_id,
      claimedStudent?.id
    ].filter(Boolean) as string[];
    const targetId = targetCandidateIds[0] || uid || '';

    setClaimedLoveMessages(prev => prev.filter(m => m.id !== messageId));

    try {
      await deleteStudentLoveMessage(messageId, user.uid, targetId);
    } catch (err) {
      console.warn('Aviso al eliminar mensaje de amor:', err);
    }
  };

  const handleVoteUserProfile = async (stars: number) => {
    if (!user) {
      setErrorMsg('Debes iniciar sesión para calificar a este usuario.');
      return;
    }
    const targetUserId = dbUser?.id || uid || claimedStudent?.id;
    if (!targetUserId) return;
    if (targetUserId === user.uid || targetUserId === dbUser?.id) {
      setErrorMsg('No puedes calificar tu propio perfil.');
      return;
    }
    try {
      setProfileVotingInProgress(true);
      const res = await submitStudentVote(targetUserId, user.uid, stars);
      if (res.success) {
        setProfileVoteSuccessMsg(`¡Has calificado con ${stars} ${stars === 1 ? 'estrella' : 'estrellas'} exitosamente!`);
        setTimeout(() => setProfileVoteSuccessMsg(null), 3500);
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    } catch (e: any) {
      console.warn('Error al votar estrellas:', e);
    } finally {
      setProfileVotingInProgress(false);
    }
  };

  const handleToggleActitud = async (type: 'yo_te_conozco' | 'fans') => {
    const targetUid = uid || user?.uid;
    
    // BLOQUEO DE AUTOVOTO: No se permite votar en tu propio perfil
    if (!user?.uid || !targetUid || targetUid === user.uid) {
      return;
    }

    // Cálculo optimista
    let nextVote: 'yo_te_conozco' | 'fans' | null = null;
    if (currentVote === type) {
      // Quitar voto
      nextVote = null;
      if (type === 'yo_te_conozco') setKnowCount(prev => Math.max(0, prev - 1));
      else setFanCount(prev => Math.max(0, prev - 1));
    } else if (currentVote) {
      // Cambiar voto (Ej: de 'fans' a 'yo_te_conozco')
      nextVote = type;
      if (type === 'yo_te_conozco') {
        setKnowCount(prev => prev + 1);
        setFanCount(prev => Math.max(0, prev - 1));
      } else {
        setFanCount(prev => prev + 1);
        setKnowCount(prev => Math.max(0, prev - 1));
      }
    } else {
      // Nuevo voto
      nextVote = type;
      if (type === 'yo_te_conozco') setKnowCount(prev => prev + 1);
      else setFanCount(prev => prev + 1);
    }

    setCurrentVote(nextVote);

    try {
      const res = await toggleUserActitudVote(targetUid, user.uid, type);
      setCurrentVote(res.activeVote);
      setKnowCount(res.newCounts.knowCount);
      setFanCount(res.newCounts.fanCount);
    } catch (err) {
      console.error('Error al votar actitud:', err);
    }
  };

  const handleLinkWithGoogleClick = async () => {
    if (!user) return;
    setLinkingGoogle(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await linkWithGoogle();
      
      // Consultar de nuevo los datos de Supabase para obtener el registro actualizado
      let fetchQuery = supabase.from('users').select('*');
      if (user.email) {
        fetchQuery = fetchQuery.eq('email', user.email);
      } else {
        fetchQuery = fetchQuery.eq('id', user.uid);
      }
      const { data, error } = await fetchQuery.maybeSingle();

      if (error) throw error;

      if (data) {
        setDbUser(data as SupabaseUser);
        const name = data.display_name || data.username || '';
        const parsed = parseFullName(name);
        setNombresInput(parsed.nombres);
        setApellidoPaternoInput(parsed.apellidoPaterno);
        setApellidoMaternoInput(parsed.apellidoMaterno);
        setDisplayNameInput(name);
        setInitialDisplayName(name);
        
        let loadedGender: 'male' | 'female' | '' = '';
        if (data.gender === 'male' || data.gender === 'hombre') loadedGender = 'male';
        else if (data.gender === 'female' || data.gender === 'mujer') loadedGender = 'female';
        else {
          const cachedGender = localStorage.getItem(`user_gender_${user.uid}`);
          if (cachedGender === 'male' || cachedGender === 'female') loadedGender = cachedGender;
        }
        setSelectedGender(loadedGender);
        setInitialGender(loadedGender);

        let loadedCountryCode = (data as any)?.country_code || '';
        let loadedCountryName = (data as any)?.country || (data as any)?.nationality || '';
        if (!loadedCountryCode && loadedCountryName) {
          const match = findCountry(loadedCountryName);
          if (match) loadedCountryCode = match.code;
        }
        if (!loadedCountryCode) {
          loadedCountryCode = localStorage.getItem(`user_country_code_${user.uid}`) || '';
          loadedCountryName = localStorage.getItem(`user_country_${user.uid}`) || '';
        }
        setSelectedCountryCode(loadedCountryCode);
        setSelectedCountryName(loadedCountryName);
        setInitialCountryCode(loadedCountryCode);

        setUsernameAvailability({ status: 'available', message: 'Nombre actual verificado' });
      }

      setSuccessMsg('¡Excelente! Tu cuenta ha sido vinculada con Google de forma segura. Se ha conservado tu nombre anterior.');
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request' || err?.isUserCancellation) {
        return;
      }
      console.error('Error al vincular con Google:', err);
      setErrorMsg(err?.message || 'Error al vincular tu cuenta con Google. Por favor, vuelve a intentarlo.');
    } finally {
      setLinkingGoogle(false);
    }
  };

  useEffect(() => {
    async function fetchUserData() {
      const targetUid = uid || user?.uid;
      if (!targetUid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMsg(null);

        // Consultar los datos de la base de datos por email o por ID (UUID)
        let query = supabase.from('users').select('*');
        if (targetUid.includes('@')) {
          query = query.eq('email', targetUid);
        } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUid)) {
          query = query.eq('id', targetUid);
        } else if (user?.email && (targetUid.startsWith('google_') || targetUid === user.uid)) {
          query = query.eq('email', user.email);
        } else {
          query = query.eq('id', targetUid);
        }

        const { data, error } = await query.maybeSingle();

        let finalUserData = data;

        // Si no se encontró en Supabase pero es el usuario en sesión activa, usar datos de sesión
        if (!finalUserData && user && (targetUid === user.uid || targetUid.startsWith('google_') || targetUid === user.email)) {
          finalUserData = {
            id: user.uid,
            email: user.email,
            display_name: user.displayName || 'Usuario',
            photo_url: user.photoURL,
            created_at: new Date().toISOString(),
            is_anonymous: user.isAnonymous,
            linked_google_at: null,
          } as SupabaseUser;
        }

        if (finalUserData) {
          const data = finalUserData;
          if (targetUid.startsWith('google_') && data.id && data.id !== targetUid) {
            try {
              window.history.replaceState(null, '', `/perfil/${data.id}`);
            } catch (e) {}
          }
          const isClaimedUser = Boolean(
            (data as any)?.profile_appeal ||
            (data as any)?.claimed_student_id ||
            (data as any)?.is_verified_student
          );

          // Si el usuario reclamó un perfil de estudiante, heredar siempre su nombre y apellidos oficiales
          try {
            const rawKey = `user_claimed_profile_${targetUid}`;
            const altKey = user?.uid ? `user_claimed_profile_${user.uid}` : null;
            const claimedRaw = localStorage.getItem(rawKey) || (altKey ? localStorage.getItem(altKey) : null);
            if (claimedRaw) {
              const claimedParsed = JSON.parse(claimedRaw);
              if (claimedParsed.studentName) {
                data.display_name = claimedParsed.studentName;
              }
              if (claimedParsed.nombres) {
                (data as any).nombres = claimedParsed.nombres;
              }
              if (claimedParsed.apellidoPaterno) {
                (data as any).apellido_paterno = claimedParsed.apellidoPaterno;
              }
              if (claimedParsed.apellidoMaterno) {
                (data as any).apellido_materno = claimedParsed.apellidoMaterno;
              }
            }
          } catch (e) {}

          const nombresVal = (data as any).nombres || (data as any).nombre || '';
          const patVal = (data as any).apellido_paterno || '';
          const matVal = (data as any).apellido_materno || '';
          const combinedOfficial = `${nombresVal} ${patVal} ${matVal}`.trim();
          const finalOfficialName = isClaimedUser
            ? ((data as any).nombre_completo || combinedOfficial || data.display_name || '')
            : (combinedOfficial || data.display_name || data.username || '');

          if (isClaimedUser) {
            data.display_name = finalOfficialName;
            data.institute_id = '9029cbec-ead6-48ae-aace-3c348b0dc325';
          }

          setDbUser(data as SupabaseUser);

          const dniVal = (data as any)?.dni || '';
          setDniInput(dniVal);
          setIsDniVerified(isClaimedUser);

          if (typeof (data as any)?.fans_count === 'number') {
            setFanCount(prev => Math.max(prev, (data as any).fans_count));
          }
          if (typeof (data as any)?.knows_count === 'number') {
            setKnowCount(prev => Math.max(prev, (data as any).knows_count));
          }
          if (typeof (data as any)?.crushes_count === 'number') {
            setCrushesCount(prev => Math.max(prev, (data as any).crushes_count));
          }
          
          if (nombresVal || patVal) {
            setNombresInput(nombresVal);
            setApellidoPaternoInput(patVal);
            setApellidoMaternoInput(matVal);
            setDisplayNameInput(finalOfficialName);
            setInitialDisplayName(finalOfficialName);
          } else {
            const parsed = parseFullName(finalOfficialName);
            setNombresInput(parsed.nombres);
            setApellidoPaternoInput(parsed.apellidoPaterno);
            setApellidoMaternoInput(parsed.apellidoMaterno);
            setDisplayNameInput(finalOfficialName);
            setInitialDisplayName(finalOfficialName);
          }

          let loadedGender: 'male' | 'female' | '' = '';
          if (data.gender === 'male' || data.gender === 'hombre') loadedGender = 'male';
          else if (data.gender === 'female' || data.gender === 'mujer') loadedGender = 'female';
          else {
            const cachedGender = localStorage.getItem(`user_gender_${targetUid}`);
            if (cachedGender === 'male' || cachedGender === 'female') loadedGender = cachedGender;
          }
          setSelectedGender(loadedGender);
          setInitialGender(loadedGender);

          let loadedCountryCode = (data as any)?.country_code || '';
          let loadedCountryName = (data as any)?.country || (data as any)?.nationality || '';
          if (!loadedCountryCode && loadedCountryName) {
            const match = findCountry(loadedCountryName);
            if (match) loadedCountryCode = match.code;
          }
          if (!loadedCountryCode) {
            loadedCountryCode = localStorage.getItem(`user_country_code_${targetUid}`) || '';
            loadedCountryName = localStorage.getItem(`user_country_${targetUid}`) || '';
          }
          setSelectedCountryCode(loadedCountryCode);
          setSelectedCountryName(loadedCountryName);
          setInitialCountryCode(loadedCountryCode);

          setUsernameAvailability({ status: 'available', message: 'Nombre actual asignado' });
        }
      } catch (err: any) {
        console.error('Error al obtener datos de Supabase:', err);
        setErrorMsg('No se pudieron obtener los datos de la base de datos de Supabase. El perfil podría no existir.');
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [user, uid]);

  // Carga y sincronización en tiempo real del perfil de estudiante reclamado
  useEffect(() => {
    async function loadClaimedStudent() {
      const targetUid = uid || user?.uid;
      if (!targetUid) return;

      let studentId: string | null = null;
      try {
        const local = localStorage.getItem(`user_claimed_profile_${targetUid}`) || (user?.uid ? localStorage.getItem(`user_claimed_profile_${user.uid}`) : null);
        if (local) {
          studentId = JSON.parse(local).studentId;
        }
      } catch (e) {}

      if (!studentId && (dbUser as any)?.claimed_student_id) {
        studentId = (dbUser as any).claimed_student_id;
      }

      if (!studentId && (dbUser as any)?.profile_appeal) {
        studentId = dbUser?.id || targetUid;
      }

      // Si el display_name es Daniel Gustavo Castillo Ramirez o similar, asociar al estudiante de prueba
      if (!studentId && (dbUser?.display_name?.includes('Daniel Gustavo') || user?.displayName?.includes('Daniel Gustavo'))) {
        studentId = 'daniel.gustavo.castillo.ramirez';
      }

      // Si es un perfil reclamado o verificado pero studentId aún no se resolvió, usar el UID
      if (!studentId && ((dbUser as any)?.is_verified_student || (dbUser as any)?.profile_appeal)) {
        studentId = targetUid;
      }

      if (studentId || targetUid) {
        try {
          setLoadingStudentData(true);
          let studentData = studentId ? await getStudentById(studentId) : null;
          if (!studentData) {
            studentData = {
              id: targetUid,
              nombre_completo: (dbUser as any)?.nombre_completo || dbUser?.display_name || user?.displayName || 'Estudiante',
              nombre: (dbUser as any)?.nombres || (dbUser as any)?.nombre || '',
              apellidos: `${(dbUser as any)?.apellido_paterno || ''} ${(dbUser as any)?.apellido_materno || ''}`.trim(),
              score: (dbUser as any)?.score || 0.0,
              total_ratings: (dbUser as any)?.total_ratings || 0,
              knows_count: (dbUser as any)?.knows_count || 0,
              fans_count: (dbUser as any)?.fans_count || 0,
              crushes_count: (dbUser as any)?.crushes_count || 0,
              is_claimed: true,
              claimed_by_uid: targetUid,
              institute_id: (dbUser as any)?.institute_id || '9029cbec-ead6-48ae-aace-3c348b0dc325',
            } as Student;
          }

          const candidateIds = Array.from(new Set([
            dbUser?.id,
            targetUid,
            user?.uid,
            (dbUser as any)?.claimed_student_id,
            studentId,
            studentData?.id
          ].filter(Boolean) as string[]));

          const [counts, breakdown, messages, reviewsList] = await Promise.all([
            getStudentInteractionCounts(studentData.id, dbUser?.id || targetUid),
            getStudentRatingBreakdown(studentData.id, candidateIds),
            getStudentLoveMessages(studentData.id, targetUid, candidateIds),
            getStudentReviewsList(studentData.id, candidateIds),
          ]);

          // Calcular promedio real y total desde los votos registrados en user_reseñas
          const totalVotesCount = Object.values(breakdown).reduce((a, b) => a + b, 0);
          const sumStars = Object.entries(breakdown).reduce((acc, [s, c]) => acc + (Number(s) * c), 0);
          const realScore = totalVotesCount > 0 ? Number((sumStars / totalVotesCount).toFixed(1)) : (studentData.score || 0.0);
          const realTotalRatings = Math.max(totalVotesCount, studentData.total_ratings || 0);

          studentData.score = realScore;
          studentData.total_ratings = realTotalRatings;
          if (dbUser) {
            (dbUser as any).score = realScore;
            (dbUser as any).total_ratings = realTotalRatings;
          }

          const realKnows = Math.max(counts.knows, (dbUser as any)?.knows_count || 0, studentData.knows_count || 0);
          const realFans = Math.max(counts.fan, (dbUser as any)?.fans_count || 0, studentData.fans_count || 0);
          const realCrushes = Math.max((dbUser as any)?.crushes_count || 0, studentData.crushes_count || 0);

          studentData.knows_count = realKnows;
          studentData.fans_count = realFans;
          studentData.crushes_count = realCrushes;
          setClaimedStudent(studentData);
          setClaimedRatingBreakdown(breakdown);
          setClaimedReviews(reviewsList);
          if (messages && messages.length > 0) {
            setClaimedLoveMessages(messages);
          }
          setFanCount(prev => Math.max(prev, realFans));
          setKnowCount(prev => Math.max(prev, realKnows));
          setCrushesCount(prev => Math.max(prev, realCrushes));
        } catch (err) {
          console.warn('Aviso al cargar datos del estudiante reclamado:', err);
        } finally {
          setLoadingStudentData(false);
        }
      }
    }

    loadClaimedStudent();

    // Suscripción Realtime a user_reseñas para que las estrellas y votos se actualicen en vivo
    const targetUid = uid || user?.uid;
    if (!targetUid) return;

    const channel = supabase
      .channel(`myprofile-reseñas-${targetUid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_reseñas'
        },
        () => {
          loadClaimedStudent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.uid, uid, dbUser?.display_name, dbUser?.id, (dbUser as any)?.claimed_student_id, (dbUser as any)?.profile_appeal]);

  // Carga independiente de mensajes de amor de la comunidad (para perfil normal y reclamado)
  useEffect(() => {
    async function loadAllProfileLoveMessages() {
      const targetCandidateIds = [
        dbUser?.id,
        (dbUser as any)?.claimed_student_id,
        claimedStudent?.id,
        uid,
        user?.uid
      ].filter(Boolean) as string[];

      if (targetCandidateIds.length === 0) return;

      try {
        const msgs = await getStudentLoveMessages(
          targetCandidateIds[0],
          user?.uid,
          targetCandidateIds
        );
        if (msgs && msgs.length > 0) {
          setClaimedLoveMessages(msgs);
        }
      } catch (e) {
        console.warn('Aviso cargando mensajes de amor en perfil:', e);
      }
    }

    if (dbUser?.id || uid || user?.uid) {
      loadAllProfileLoveMessages();
    }
  }, [dbUser?.id, (dbUser as any)?.claimed_student_id, claimedStudent?.id, uid, user?.uid]);

  // Sincronizar nombre completo resultante de los 3 campos
  useEffect(() => {
    const full = `${nombresInput} ${apellidoPaternoInput} ${apellidoMaternoInput}`.trim();
    setDisplayNameInput(full);
  }, [nombresInput, apellidoPaternoInput, apellidoMaternoInput]);

  // Validación con debounce (300ms) mediante RPC 'check_username_available'
  useEffect(() => {
    if (!isOwnProfile || loading) return;

    const cleanInput = displayNameInput.trim();

    // Si el nombre no ha cambiado respecto al actual del usuario
    if (cleanInput.toLowerCase() === initialDisplayName.trim().toLowerCase() && cleanInput !== '') {
      setUsernameAvailability({
        status: 'available',
        message: 'Nombre disponible (tu nombre actual)'
      });
      return;
    }

    if (!cleanInput) {
      setUsernameAvailability({
        status: 'idle',
        message: ''
      });
      return;
    }

    if (cleanInput.length < 2) {
      setUsernameAvailability({
        status: 'error',
        message: 'El nombre debe tener al menos 2 caracteres'
      });
      return;
    }

    if (cleanInput.length > 35) {
      setUsernameAvailability({
        status: 'error',
        message: 'El nombre no puede superar los 35 caracteres'
      });
      return;
    }

    setUsernameAvailability({
      status: 'checking',
      message: 'Verificando disponibilidad...'
    });

    const timer = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailable(
          cleanInput,
          dbUser?.id,
          user?.uid
        );

        setUsernameAvailability({
          status: result.available ? 'available' : 'taken',
          message: result.message
        });
      } catch (err) {
        console.error('Error al verificar disponibilidad:', err);
        setUsernameAvailability({
          status: 'available',
          message: 'Nombre disponible'
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [displayNameInput, initialDisplayName, isOwnProfile, loading, dbUser?.id, user?.uid]);



  // Cargar métricas del Admin Dashboard
  const loadAdminMetrics = async () => {
    try {
      setLoadingAdminMetrics(true);
      const data = await getAdminDashboardMetrics();
      setAdminMetrics(data);
    } catch (err) {
      console.error('Error al cargar métricas de administrador:', err);
    } finally {
      setLoadingAdminMetrics(false);
    }
  };

  useEffect(() => {
    if (profileTab === 'admin' || (dbUser?.role === 'admin' && !adminMetrics)) {
      loadAdminMetrics();
    }
  }, [profileTab, dbUser?.role]);

  // Cargar interacciones en la pestaña 'interactions' o al iniciar
  const loadInteractions = async () => {
    const targetUid = uid || user?.uid;
    if (!targetUid) return;

    try {
      setLoadingInteractions(true);
      setInteractionsError('');
      const candidateUids = Array.from(new Set([
        targetUid,
        dbUser?.id,
        user?.uid,
        dbUser?.firebase_uid,
      ].filter(Boolean) as string[]));
      const items = await getUserGivenInteractions(candidateUids);
      setInteractions(items);
    } catch (err: any) {
      console.error('Error al cargar interacciones:', err);
      setInteractionsError('No se pudieron cargar tus interacciones de Supabase.');
    } finally {
      setLoadingInteractions(false);
    }
  };

  useEffect(() => {
    if (profileTab === 'interactions') {
      loadInteractions();
    }
  }, [profileTab, uid, user?.uid, dbUser?.id]);

  const handleRemoveInteraction = async (item: UserInteractionViewItem) => {
    const targetUid = uid || user?.uid;
    if (!targetUid) return;

    // Actualización optimista inmediata
    setInteractions(prev => prev.filter(i => i.id !== item.id));

    try {
      const ok = await removeUserGivenInteraction(item);
      if (!ok) {
        // Recargar en caso de error
        loadInteractions();
      }
    } catch (err) {
      console.error('Error al retirar interacción:', err);
      loadInteractions();
    }
  };

  // Cargar suscripciones a notificaciones en la pestaña 'subscriptions' o inicial
  const loadSubscriptions = async () => {
    const targetUid = uid || user?.uid;
    if (!targetUid) return;

    try {
      setLoadingSubscriptions(true);
      setSubscriptionsError('');
      const [profs, studs] = await Promise.all([
        getUserProfessorSubscriptions(targetUid),
        getUserStudentSubscriptions(targetUid)
      ]);
      setProfSubscriptions(profs);
      setStudentSubscriptions(studs);
    } catch (err: any) {
      console.error('Error al cargar suscripciones a notificaciones:', err);
      setSubscriptionsError('No se pudieron sincronizar tus suscripciones.');
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  useEffect(() => {
    if (profileTab === 'subscriptions') {
      loadSubscriptions();
    }
  }, [profileTab, uid, user?.uid]);

  const handleRemoveProfSubscription = async (item: UserProfessorSubscriptionItem) => {
    const targetUid = uid || user?.uid;
    if (!targetUid) return;

    // Optimista
    setProfSubscriptions(prev => prev.filter(p => p.id !== item.id && p.professorId !== item.professorId));

    try {
      await removeProfessorNotificationSubscription(item.professorId, targetUid);
    } catch (err) {
      console.error('Error al retirar suscripción de profesor:', err);
      loadSubscriptions();
    }
  };

  const handleRemoveStudentSubscription = async (item: UserStudentSubscriptionItem) => {
    const targetUid = uid || user?.uid;
    if (!targetUid) return;

    // Optimista
    setStudentSubscriptions(prev => prev.filter(s => s.id !== item.id && s.studentId !== item.studentId));

    try {
      await removeStudentNotificationSubscription(item.studentId, targetUid);
    } catch (err) {
      console.error('Error al retirar suscripción de estudiante:', err);
      loadSubscriptions();
    }
  };

  const navigateTo = (url: string) => {
    window.history.pushState(null, '', url);
    window.dispatchEvent(new Event('popstate'));
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !dbUser || !isOwnProfile) return;

    const cleanNombres = nombresInput.trim();
    const cleanPaterno = apellidoPaternoInput.trim();
    const cleanMaterno = apellidoMaternoInput.trim();
    const cleanDni = dniInput.trim().replace(/\D/g, '');

    if (!cleanNombres) {
      setErrorMsg('Por favor, ingresa tus nombres.');
      return;
    }

    if (!cleanPaterno) {
      setErrorMsg('Por favor, ingresa tu apellido paterno.');
      return;
    }

    if (cleanDni && cleanDni.length !== 8) {
      setErrorMsg('El número de DNI debe contener exactamente 8 dígitos.');
      return;
    }

    const cleanFullName = `${cleanNombres} ${cleanPaterno} ${cleanMaterno}`.trim();
    const fixedInstituteId = '9029cbec-ead6-48ae-aace-3c348b0dc325';

    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      // Determinar si el usuario ya es un perfil verificado/reclamado
      const isClaimedUser = Boolean(
        (dbUser as any)?.profile_appeal || 
        (dbUser as any)?.claimed_student_id || 
        (dbUser as any)?.is_verified_student || 
        user.profile_appeal || 
        user.claimed_student_id
      );

      // 1. Actualizar en Supabase tabla 'users' (solo incluir institute_id si reclamó perfil)
      const updatePayload: any = { 
        display_name: cleanFullName,
        nombres: cleanNombres,
        apellido_paterno: cleanPaterno,
        apellido_materno: cleanMaterno || null,
      };

      if (isClaimedUser) {
        updatePayload.institute_id = fixedInstituteId;
        updatePayload.profile_appeal = true;
      }

      if (!isDniVerified) {
        updatePayload.dni = cleanDni || null;
      }

      try {
        let updateQuery = supabase.from('users').update(updatePayload);

        if (user.email) {
          updateQuery = updateQuery.eq('email', user.email);
        } else {
          updateQuery = updateQuery.eq('id', dbUser?.id || user.uid);
        }

        const { error: fullUpdateErr } = await updateQuery;

        if (fullUpdateErr) {
          // Fallback a display_name si columnas estructuradas fallasen
          let fallbackQuery = supabase.from('users').update({ 
            display_name: cleanFullName,
            ...(isClaimedUser ? { institute_id: fixedInstituteId, profile_appeal: true } : {}),
            ...(isDniVerified ? {} : { dni: cleanDni || null })
          });
          if (user.email) {
            fallbackQuery = fallbackQuery.eq('email', user.email);
          } else {
            fallbackQuery = fallbackQuery.eq('id', dbUser?.id || user.uid);
          }
          await fallbackQuery;
        }
      } catch (uErr) {
        let fallbackCatchQuery = supabase.from('users').update({ 
          display_name: cleanFullName,
          ...(isClaimedUser ? { institute_id: fixedInstituteId, profile_appeal: true } : {}),
          ...(isDniVerified ? {} : { dni: cleanDni || null })
        });
        if (user.email) {
          fallbackCatchQuery = fallbackCatchQuery.eq('email', user.email);
        } else {
          fallbackCatchQuery = fallbackCatchQuery.eq('id', dbUser?.id || user.uid);
        }
        await fallbackCatchQuery;
      }

      // Si tiene perfil oficial de estudiante vinculado, sincronizar su nombre oficial
      if ((dbUser as any)?.claimed_student_id) {
        try {
          await supabase
            .from('students')
            .update({
              nombre: cleanNombres,
              apellidos: `${cleanPaterno} ${cleanMaterno}`.trim(),
              nombre_completo: cleanFullName,
              institute_id: fixedInstituteId,
            })
            .eq('id', (dbUser as any).claimed_student_id);
        } catch (sErr) {
          console.warn('Aviso sincronizando tabla students:', sErr);
        }
      }

      // 2. Actualizar 'gender' en Supabase si la columna existe en la tabla
      try {
        let genderQuery = supabase.from('users').update({ gender: selectedGender || null });
        if (user.email) {
          genderQuery = genderQuery.eq('email', user.email);
        } else {
          genderQuery = genderQuery.eq('id', dbUser?.id || user.uid);
        }
        const { error: genderErr } = await genderQuery;

        if (genderErr) {
          console.warn('Nota sobre columna gender en tabla users:', genderErr.message);
        }
      } catch (gErr) {
        console.warn('Aviso guardando gender en Supabase:', gErr);
      }

      // 2.5. Actualizar 'country' y 'country_code' en Supabase si la columna existe en la tabla
      try {
        let countryQuery = supabase.from('users').update({ 
          country: selectedCountryName || null,
          country_code: selectedCountryCode || null,
        });
        if (user.email) {
          countryQuery = countryQuery.eq('email', user.email);
        } else {
          countryQuery = countryQuery.eq('id', dbUser?.id || user.uid);
        }
        const { error: countryErr } = await countryQuery;

        if (countryErr) {
          console.warn('Nota sobre columnas country en tabla users:', countryErr.message);
          try {
            let fallbackQuery = supabase.from('users').update({ country: selectedCountryName || null });
            if (user.email) fallbackQuery = fallbackQuery.eq('email', user.email);
            else fallbackQuery = fallbackQuery.eq('id', dbUser?.id || user.uid);
            await fallbackQuery;
          } catch (_) {}
        }
      } catch (cErr) {
        console.warn('Aviso guardando país en Supabase:', cErr);
      }

      if (selectedCountryCode) {
        localStorage.setItem(`user_country_code_${user.uid}`, selectedCountryCode);
        localStorage.setItem(`user_country_${user.uid}`, selectedCountryName);
      } else {
        localStorage.removeItem(`user_country_code_${user.uid}`);
        localStorage.removeItem(`user_country_${user.uid}`);
      }

      // Guardar siempre en localStorage de respaldo para el usuario
      if (selectedGender) {
        localStorage.setItem(`user_gender_${user.uid}`, selectedGender);
      } else {
        localStorage.removeItem(`user_gender_${user.uid}`);
      }

      try {
        localStorage.setItem(`user_names_${user.uid}`, JSON.stringify({
          nombres: cleanNombres,
          apellidoPaterno: cleanPaterno,
          apellidoMaterno: cleanMaterno,
          fullName: cleanFullName
        }));
      } catch (e) {}

      // 3. Actualizar en sesión local
      updateAuthUserProfile({
        displayName: cleanFullName,
        ...(isClaimedUser ? { institute_id: fixedInstituteId, profile_appeal: true } : {}),
        dni: cleanDni || (dbUser as any)?.dni,
      });

      setInitialDisplayName(cleanFullName);
      setDisplayNameInput(cleanFullName);
      setInitialGender(selectedGender);
      setInitialCountryCode(selectedCountryCode);
      setDbUser({
        ...dbUser,
        display_name: cleanFullName,
        gender: selectedGender || null,
        country: selectedCountryName || null,
        country_code: selectedCountryCode || null,
        dni: cleanDni || (dbUser as any)?.dni || null,
        institute_id: isClaimedUser ? fixedInstituteId : (dbUser?.institute_id || null),
        profile_appeal: isClaimedUser,
      });

      setSuccessMsg('¡Datos y DNI oficial guardados exitosamente en la base de datos!');
      
      // Auto-ocultar el mensaje de éxito después de 4 segundos
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);

    } catch (err: any) {
      console.error('Error al guardar datos en Supabase:', err);
      setErrorMsg(err?.message || 'Hubo un problema al guardar los cambios en la base de datos.');
    } finally {
      setSaving(false);
    }
  };

  if (!user && isOwnProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-6">
        <div className="inline-flex p-4 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-[#eab308]">
          <AlertCircle className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Acceso Restringido</h2>
        <p className="text-zinc-400 max-w-md mx-auto text-sm">
          Por favor inicia sesión con Google o como usuario Anónimo para poder consultar y editar tu perfil en la base de datos.
        </p>
        <button
          onClick={onBackToHome}
          className="px-6 py-2.5 rounded-lg bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs tracking-wider uppercase transition-colors cursor-pointer"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
      
      {/* Botón de retorno */}
      <button
        onClick={onBackToHome}
        className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-[#eab308] transition-colors cursor-pointer group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        VOLVER A LA PÁGINA PRINCIPAL
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* LADO IZQUIERDO: Tarjeta Resumen */}
        <div className="md:col-span-1 bg-[#0d0d0d] border border-[#ffffff10] rounded-2xl p-6 flex flex-col items-center text-center space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-[#eab3080c] to-transparent"></div>
          
          <div className="relative pt-4 group">
            {dbUser?.photo_url ? (
              <img
                src={dbUser.photo_url}
                alt={dbUser.display_name || 'Usuario'}
                onClick={() => setIsViewPhotoModalOpen(true)}
                className={`w-24 h-24 rounded-full object-cover ring-3 transition-all cursor-pointer hover:opacity-95 ${
                  dbUser?.role === 'admin'
                    ? 'ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.45)]'
                    : 'ring-[#eab308] shadow-[0_0_20px_rgba(234,179,8,0.2)]'
                }`}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div 
                onClick={() => isOwnProfile && setIsAvatarModalOpen(true)}
                className={`w-24 h-24 rounded-full bg-[#151515] border flex items-center justify-center text-3xl font-black ring-3 shadow-lg transition-all ${
                  isOwnProfile ? 'cursor-pointer hover:border-[#eab308]' : ''
                } ${
                  dbUser?.role === 'admin'
                    ? 'border-amber-400/80 text-amber-400 ring-amber-400/40 shadow-[0_0_25px_rgba(245,158,11,0.4)]'
                    : 'border-[#eab308]/40 text-[#eab308] ring-[#eab308]/20'
                }`}
              >
                {(dbUser?.display_name || 'U').charAt(0).toUpperCase()}
              </div>
            )}

            {/* Hover overlay para ver la foto en grande si ya existe foto */}
            {dbUser?.photo_url && (
              <button
                type="button"
                onClick={() => setIsViewPhotoModalOpen(true)}
                className="absolute inset-0 top-4 w-24 h-24 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 cursor-pointer z-10 backdrop-blur-xs"
                title="Ver foto en tamaño completo"
              >
                <Eye className="w-5 h-5 text-[#eab308]" />
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-300">Ver foto</span>
              </button>
            )}
            
            {/* Círculo Pequeño Arriba: Ícono del sexo del estudiante */}
            {(() => {
              const currentGender = dbUser?.gender || selectedGender;
              const isMale = currentGender === 'male' || currentGender === 'hombre';
              return (
                <div 
                  className={`absolute top-5 -right-3 w-7 h-7 rounded-full flex items-center justify-center font-black text-xs z-20 ring-2 ring-[#0d0d0d] shadow-md select-none ${
                    isMale 
                      ? 'bg-[#0b172a] border border-blue-500/60 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]' 
                      : 'bg-[#1e0d19] border border-pink-500/60 text-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.3)]'
                  }`}
                  title={isMale ? 'Hombre ♂' : 'Mujer ♀'}
                >
                  <span>{isMale ? '♂' : '♀'}</span>
                </div>
              );
            })()}

            {/* Círculo Pequeño Abajo: Calificación general */}
            <div 
              className="absolute bottom-1 -right-3.5 h-7 px-1.5 min-w-[28px] rounded-full bg-[#14120a] border border-amber-500/60 text-[#eab308] flex items-center justify-center gap-0.5 z-20 ring-2 ring-[#0d0d0d] shadow-[0_0_12px_rgba(245,158,11,0.3)] select-none"
              title={`Calificación general: ${Number(claimedStudent?.score ?? (dbUser as any)?.score ?? 5.0).toFixed(1)} / 5.0`}
            >
              <Star className="w-3 h-3 fill-[#eab308] text-[#eab308] shrink-0" />
              <span className="text-[10px] font-black tracking-tight leading-none">
                {Number(claimedStudent?.score ?? (dbUser as any)?.score ?? 5.0).toFixed(1)}
              </span>
            </div>
          </div>

          {/* Botón visible de cambiar foto para mayor facilidad de uso */}
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(true)}
              className="px-3 py-1 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/60 hover:border-[#eab308] text-[11px] font-bold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm group active:scale-95"
              title="Cambiar foto de perfil (Máx 5 MB, optimizada a 90-100 KB)"
            >
              <Camera className="w-3.5 h-3.5 text-[#eab308] group-hover:scale-110 transition-transform" />
              <span>Cambiar Foto</span>
            </button>
          )}

          <div className="space-y-1.5 w-full flex flex-col items-center">
            <div className="flex items-center justify-center gap-2 max-w-full">
              <h3 className="text-xl font-black text-white tracking-tight truncate">
                {dbUser?.display_name || 'Cargando...'}
              </h3>
              {(dbUser?.gender || selectedGender) && (
                <span 
                  className={`text-lg font-black shrink-0 select-none ${(dbUser?.gender || selectedGender) === 'male' || (dbUser?.gender || selectedGender) === 'hombre' ? 'text-blue-400' : 'text-pink-400'}`}
                  title={(dbUser?.gender || selectedGender) === 'male' || (dbUser?.gender || selectedGender) === 'hombre' ? 'Hombre ♂' : 'Mujer ♀'}
                >
                  {(dbUser?.gender || selectedGender) === 'male' || (dbUser?.gender || selectedGender) === 'hombre' ? '♂' : '♀'}
                </span>
              )}
            </div>

            {/* País de origen / Nacionalidad */}
            {(selectedCountryCode || (dbUser as any)?.country_code || dbUser?.country) && (
              <div className="flex items-center gap-1.5 pt-0.5 animate-in fade-in select-none">
                <img
                  src={getFlagUrl(selectedCountryCode || (dbUser as any)?.country_code || (findCountry(dbUser?.country || '')?.code || 'pe'), 'w40')}
                  srcSet={`${getFlagUrl(selectedCountryCode || (dbUser as any)?.country_code || (findCountry(dbUser?.country || '')?.code || 'pe'), 'w80')} 2x`}
                  alt={`Bandera de ${selectedCountryName || dbUser?.country || 'País'}`}
                  className="w-4 h-2.5 sm:w-5 sm:h-3.5 object-cover rounded-2xs border border-zinc-700/60 shadow-xs flex-shrink-0"
                  loading="lazy"
                />
                <span className="text-[11px] font-bold text-zinc-400 tracking-tight">
                  {selectedCountryName || dbUser?.country}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* LADO DERECHO: Formulario y Consulta Base de Datos */}
        <div className="md:col-span-2 bg-[#0d0d0d] border border-[#ffffff10] rounded-2xl p-6 sm:p-8 space-y-6">
          
          {/* Métricas Superiores de Reputación (Yo te conozco / Fans en la tabla 'users_actitud') */}
          <div className="grid grid-cols-2 gap-3 max-w-md bg-[#070707] border border-zinc-800/80 rounded-2xl p-3 sm:p-4 shadow-lg animate-in fade-in duration-300">
            {/* Seguir / Siguiendo */}
            <button
              type="button"
              disabled={isSelfProfile}
              onClick={() => handleToggleActitud('yo_te_conozco')}
              className={`bg-[#0f0f0f] border rounded-xl p-3 text-center space-y-1 transition select-none ${
                isSelfProfile
                  ? 'border-blue-500/20 opacity-90 cursor-default'
                  : currentVote === 'yo_te_conozco'
                    ? 'border-blue-500 bg-blue-500/15 shadow-[0_0_15px_rgba(59,130,246,0.25)] cursor-pointer active:scale-95'
                    : 'border-blue-500/20 hover:border-blue-500/40 hover:bg-[#121212] cursor-pointer active:scale-95'
              }`}
              title={isSelfProfile ? 'Tus seguidores acumulados de la comunidad' : currentVote === 'yo_te_conozco' ? 'Dejar de seguir' : 'Clic para seguir a este usuario'}
            >
              <div className="flex items-center justify-center gap-1.5 text-blue-400">
                <Users className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {isSelfProfile ? 'Seguidores' : currentVote === 'yo_te_conozco' ? 'Siguiendo' : 'Seguir'}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">
                {knowCount}
              </div>
            </button>

            {/* Fan */}
            <button
              type="button"
              disabled={isSelfProfile}
              onClick={() => handleToggleActitud('fans')}
              className={`bg-[#0f0f0f] border rounded-xl p-3 text-center space-y-1 transition select-none ${
                isSelfProfile
                  ? 'border-pink-500/20 opacity-90 cursor-default'
                  : currentVote === 'fans'
                    ? 'border-pink-500 bg-pink-500/15 shadow-[0_0_15px_rgba(236,72,153,0.25)] cursor-pointer active:scale-95'
                    : 'border-pink-500/20 hover:border-pink-500/40 hover:bg-[#121212] cursor-pointer active:scale-95'
              }`}
              title={isSelfProfile ? 'Tus fans acumulados en la comunidad' : 'Clic para hacerte fan de este usuario'}
            >
              <div className="flex items-center justify-center gap-1.5 text-pink-400">
                <Heart className={`w-4 h-4 ${currentVote === 'fans' ? 'fill-pink-500 text-pink-500' : 'fill-pink-500/30'}`} />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {currentVote === 'fans' ? '✓ Fans' : 'Fans'}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">
                {fanCount}
              </div>
            </button>
          </div>

          {/* Navegación Principal de Pestañas (Universal para todos los perfiles) */}
          <div className="space-y-3">
            {/* Barra de pestañas principales: Mis Datos, Reseñas, Crushes, Estadísticas */}
            <div className="flex items-center gap-1.5 bg-[#050505] p-1.5 rounded-xl border border-zinc-800/40 max-w-full overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setClaimedMainTab('mis_datos')}
                title={isOwnProfile ? 'Mis Datos' : 'Datos'}
                className={`py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 ${
                  claimedMainTab === 'mis_datos'
                    ? 'bg-[#eab308] text-black font-extrabold shadow-sm px-4'
                    : 'text-zinc-400 hover:text-white hover:bg-[#151515] px-3 sm:px-4'
                }`}
              >
                <User className="w-4 h-4 flex-shrink-0" />
                <span>{isOwnProfile ? 'Mis Datos' : 'Datos'}</span>
              </button>

              <button
                type="button"
                onClick={() => setClaimedMainTab('reseñas')}
                title="Reseñas"
                className={`py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 ${
                  claimedMainTab === 'reseñas'
                    ? 'bg-[#eab308] text-black font-extrabold shadow-sm px-4'
                    : 'text-zinc-400 hover:text-white hover:bg-[#151515] px-3 sm:px-4'
                }`}
              >
                <Star className="w-4 h-4 flex-shrink-0 text-current" />
                <span>Reseñas</span>
              </button>

              <button
                type="button"
                onClick={() => setClaimedMainTab('crushes')}
                title="Crushes"
                className={`py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 ${
                  claimedMainTab === 'crushes'
                    ? 'bg-[#eab308] text-black font-extrabold shadow-sm px-4'
                    : 'text-zinc-400 hover:text-white hover:bg-[#151515] px-3 sm:px-4'
                }`}
              >
                <Heart className="w-4 h-4 flex-shrink-0 text-current" />
                <span>Crushes</span>
                {((claimedStudent?.crushes_count || 0) > 0) && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-black ${
                    claimedMainTab === 'crushes' ? 'bg-black text-[#eab308]' : 'bg-pink-500/20 text-pink-300'
                  }`}>
                    {claimedStudent?.crushes_count}
                  </span>
                )}
              </button>

            </div>

            {/* Sub-pestañas dentro de "Mis Datos" */}
            {claimedMainTab === 'mis_datos' && (
              <div className="flex items-center gap-1.5 bg-[#090909] p-1 rounded-xl border border-zinc-800/30 max-w-full overflow-x-auto no-scrollbar animate-in fade-in duration-200">
                <button
                  type="button"
                  onClick={() => setProfileTab('info')}
                  className={`py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    profileTab === 'info'
                      ? 'bg-zinc-800 text-white font-extrabold'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  <span>Información</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProfileTab('interactions')}
                  className={`py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    profileTab === 'interactions'
                      ? 'bg-zinc-800 text-white font-extrabold'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  <span>Mis Interacciones</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProfileTab('subscriptions')}
                  className={`py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    profileTab === 'subscriptions'
                      ? 'bg-zinc-800 text-white font-extrabold'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  <div className="relative flex items-center justify-center">
                    <span>Suscripciones</span>
                    {(profSubscriptions.length > 0 || studentSubscriptions.length > 0) && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300">
                        {profSubscriptions.length + studentSubscriptions.length}
                      </span>
                    )}
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* RENDERIZADO CONDICIONAL DE CONTENIDO DE PESTAÑAS */}
          {claimedMainTab === 'reseñas' ? (
            /* TAB: RESEÑAS DEL USUARIO / ESTUDIANTE */
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-[#050505] border border-zinc-800/60 rounded-2xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                      <Star className="w-5 h-5 text-[#eab308] fill-[#eab308]" />
                      Resumen de Estrellas y Reputación
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Calificaciones de la comunidad en la red social Starryz.
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-[#eab308]/15 border border-[#eab308]/30 text-[#eab308] text-xs font-black tracking-wider uppercase">
                    ★ {(claimedStudent?.score || 0).toFixed(1)} / 5.0
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-8 pt-2">
                  <div className="bg-[#0f0f0f] border border-zinc-800/40 rounded-2xl p-6 text-center w-full md:w-52 space-y-3 shadow-lg">
                    <span className="block text-5xl font-black text-[#eab308] tracking-tighter">
                      {(claimedStudent?.score || 0).toFixed(1)}
                    </span>
                    <div className="flex items-center justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star} 
                          className={`w-5 h-5 ${
                            star <= Math.round(claimedStudent?.score || 0)
                              ? 'fill-[#eab308] text-[#eab308]' 
                              : 'text-zinc-700'
                          }`} 
                        />
                      ))}
                    </div>
                    <span className="block text-[10px] uppercase text-zinc-500 font-extrabold tracking-widest">
                      {claimedStudent?.total_ratings || 0} VOTOS TOTALES
                    </span>
                  </div>

                  <div className="flex-1 w-full space-y-2.5">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = claimedRatingBreakdown[stars] || 0;
                      const totalVotesCount = Object.values(claimedRatingBreakdown).reduce((a, b) => a + b, 0);
                      const percent = totalVotesCount > 0 ? `${((count / totalVotesCount) * 100).toFixed(0)}%` : '0%';

                      return (
                        <div key={stars} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-zinc-400 w-3 text-right">
                            {stars}
                          </span>
                          <div className="flex-1 h-2.5 bg-[#121212] rounded-full overflow-hidden border border-zinc-800/40">
                            <div 
                              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500" 
                              style={{ width: percent }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-zinc-400 w-8 text-right">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Formulario rápido para calificar cuando no es tu propio perfil */}
                {!isSelfProfile && (
                  <div className="pt-4 border-t border-zinc-800/40 space-y-3">
                    <p className="text-xs font-bold uppercase text-zinc-400 tracking-wider text-center">
                      ¿Conoces a {dbUser?.display_name || user?.displayName || 'este usuario'}? ¡Deja tu calificación de estrellas!
                    </p>

                    <div className="flex items-center justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          disabled={profileVotingInProgress}
                          onClick={() => handleVoteUserProfile(star)}
                          className="p-2.5 bg-[#121212] hover:bg-[#eab308]/15 border border-zinc-800 hover:border-[#eab308]/40 rounded-xl text-zinc-500 hover:text-[#eab308] transition-all cursor-pointer disabled:opacity-50 active:scale-95 group shadow-sm"
                          title={`Votar ${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
                        >
                          <Star className="w-6 h-6 group-hover:scale-110 transition-transform fill-current group-hover:fill-[#eab308]" />
                        </button>
                      ))}
                    </div>

                    {profileVoteSuccessMsg && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-xs text-emerald-400 font-bold animate-in fade-in">
                        {profileVoteSuccessMsg}
                      </div>
                    )}
                  </div>
                )}

                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#eab308]" />
                    Reputación en la Comunidad
                  </p>
                  <p>
                    {isSelfProfile
                      ? 'Cualquier miembro de la comunidad puede calificar tu perfil con estrellas para fortalecer tu reputación.'
                      : 'Tus estrellas otorgadas fortalecen la reputación de este usuario en la red social Starryz.'}
                  </p>
                </div>
              </div>
            </div>
          ) : claimedMainTab === 'crushes' ? (
            /* TAB: CRUSHES RECIBIDOS */
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-[#050505] border border-zinc-800/60 rounded-2xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                      <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
                      Flechazos y Mensajes de Amor
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {isSelfProfile 
                        ? 'Personas que te han marcado como su crush de forma anónima.' 
                        : 'Expresa tu admiración marcando a este usuario como tu crush.'}
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-400 text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
                    <span>💘 {crushesCount} Flechazos</span>
                  </div>
                </div>

                {/* Tarjeta interactiva de Flechazo / Crush */}
                <div className="p-6 rounded-2xl bg-gradient-to-b from-pink-950/20 to-[#0e0e0e] border border-pink-500/20 text-center space-y-4 shadow-md">
                  {/* El corazón en sí mismo es el botón para marcar/desmarcar Crush */}
                  <button
                    type="button"
                    onClick={handleToggleCrush}
                    disabled={isSelfProfile || !user}
                    className={`group relative w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 shadow-xl select-none ${
                      isSelfProfile
                        ? 'bg-pink-500/10 border-2 border-pink-500/20 text-pink-400 cursor-default'
                        : hasCrushedUser
                        ? 'bg-gradient-to-br from-pink-500 to-rose-600 border-2 border-pink-400 text-white shadow-[0_0_35px_rgba(236,72,153,0.6)] ring-4 ring-pink-500/30 scale-105 cursor-pointer active:scale-95'
                        : 'bg-zinc-900/90 hover:bg-pink-950/40 border-2 border-zinc-700 hover:border-pink-500/60 text-zinc-400 hover:text-pink-400 hover:shadow-[0_0_25px_rgba(236,72,153,0.3)] cursor-pointer active:scale-95'
                    }`}
                    title={
                      isSelfProfile
                        ? 'Tu propio perfil: No puedes flecharte a ti mismo'
                        : hasCrushedUser
                        ? '¡Es tu Crush! Toca para retirar flechazo'
                        : '¡Toca el corazón para marcar como tu Crush! 💘'
                    }
                  >
                    <Heart
                      className={`w-10 h-10 sm:w-12 sm:h-12 transition-transform duration-300 ${
                        isSelfProfile
                          ? 'fill-pink-500/30 text-pink-400'
                          : hasCrushedUser
                          ? 'fill-white text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] scale-110 animate-pulse'
                          : 'fill-transparent text-current group-hover:scale-110 group-hover:fill-pink-500/30'
                      }`}
                    />
                  </button>

                  {/* Conteo de Crushes */}
                  <div>
                    <div className={`text-4xl sm:text-5xl font-black tracking-tight ${hasCrushedUser ? 'text-pink-400' : 'text-white'}`}>
                      {crushesCount}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 uppercase font-bold tracking-wider">
                      {crushesCount === 1 ? 'Persona le tiene como crush' : 'Personas le tienen como crush'}
                    </p>
                  </div>

                  {/* Estado / Feedback interactivo (sin botón largo redundante) */}
                  <div className="pt-1">
                    {isSelfProfile ? (
                      <span className="text-[11px] text-zinc-500 font-medium">
                        Este es tu propio perfil. Tus admiradores te flecharán aquí.
                      </span>
                    ) : hasCrushedUser ? (
                      <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-xs font-black animate-in fade-in">
                        <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" />
                        <span>✓ Es tu Crush (Toca el corazón para retirar)</span>
                      </div>
                    ) : (
                      <span className="text-xs text-pink-400 font-bold tracking-wide">
                        👉 Toca el corazón arriba para marcarlo como tu Crush
                      </span>
                    )}
                  </div>
                </div>

                {/* FORMULARIO DE MENSAJE DE AMOR (HABILITADO AL MARCARLO COMO CRUSH) */}
                {!isSelfProfile && (
                  hasCrushedUser ? (
                    <div className="p-5 rounded-2xl bg-gradient-to-b from-pink-950/30 to-[#0e0e0e] border border-pink-500/30 space-y-4 shadow-lg animate-in fade-in duration-300">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pink-500/20 pb-3">
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Heart className="w-4 h-4 fill-pink-500 text-pink-500" />
                            <span>Dejar un Mensaje de Amor Anónimo</span>
                          </h4>
                          <p className="text-[11px] text-zinc-400">
                            Exprésale tus sentimientos o una confesión sincera de forma 100% anónima.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/60 border border-pink-500/30 rounded-lg text-[11px] font-mono text-pink-300 shrink-0 self-start sm:self-center">
                          <span>Firmarás como:</span>
                          <span className="font-bold">Anónimo-{user?.uid ? user.uid.substring(0, 8) : '00000000'}</span>
                          <GenderBadge gender={selectedGender || dbUser?.gender} size="sm" />
                        </div>
                      </div>

                      <form onSubmit={handleSendLoveMessage} className="space-y-3">
                        <div className="space-y-1">
                          <textarea
                            value={loveMessageText}
                            onChange={(e) => setLoveMessageText(e.target.value)}
                            maxLength={500}
                            rows={3}
                            placeholder="¿Qué es lo que más te gusta de esta persona? Escribe tu mensaje secreto o declaración..."
                            className="w-full rounded-xl bg-[#090909] border border-pink-500/30 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm text-white p-3.5 outline-none placeholder:text-zinc-600 resize-none transition-all"
                          />
                          <div className="flex justify-between items-center text-[10px] text-zinc-500 px-1">
                            <span>Máximo 500 caracteres</span>
                            <span className={loveMessageText.length >= 480 ? 'text-rose-400 font-bold' : ''}>
                              {loveMessageText.length}/500
                            </span>
                          </div>
                        </div>

                        {loveMessageError && (
                          <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                            <span>{loveMessageError}</span>
                          </div>
                        )}

                        {loveMessageSuccess && (
                          <div className="p-3 bg-pink-950/40 border border-pink-500/40 rounded-xl text-xs text-pink-300 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0" />
                            <span>{loveMessageSuccess}</span>
                          </div>
                        )}

                        <div className="flex justify-end pt-1">
                          <button
                            type="submit"
                            disabled={sendingLoveMessage || !loveMessageText.trim()}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                              sendingLoveMessage || !loveMessageText.trim()
                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                : 'bg-pink-500 hover:bg-pink-600 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)] active:scale-95'
                            }`}
                          >
                            {sendingLoveMessage ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span>Enviando...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                <span>Enviar Mensaje de Amor 💌</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#0f0f0f] border border-pink-500/20 text-center space-y-1 text-xs text-zinc-400">
                      <p className="font-bold text-pink-300">
                        💘 ¿Quieres dejarle un mensaje de amor o confesión?
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Primero márcalo como tu Crush tocando el corazón de arriba para habilitar la caja de mensajes.
                      </p>
                    </div>
                  )
                )}

                {/* LISTADO DE MENSAJES DE AMOR Y ADMIRACIÓN */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Mensajes de Amor y Admiración</span>
                    <span className="text-xs text-zinc-500 font-normal">({claimedLoveMessages.length})</span>
                  </h4>

                  {claimedLoveMessages.length === 0 ? (
                    <div className="p-8 rounded-xl bg-[#0f0f0f] border border-zinc-800/40 text-center space-y-2">
                      <p className="text-zinc-400 text-xs">Aún no se han publicado mensajes de amor.</p>
                      <p className="text-zinc-600 text-[11px]">
                        {isSelfProfile
                          ? 'Cuando alguien te marque como su crush y te deje un mensaje, aparecerá aquí.'
                          : '¡Sé el primero en flechar este perfil y escribirle algo bonito!'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {claimedLoveMessages.map((msg) => (
                        <div 
                          key={msg.id}
                          className="p-4 rounded-xl bg-[#0f0f0f] border border-zinc-800/60 space-y-2 shadow-sm"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-pink-400 flex items-center gap-1.5 font-mono">
                              <span>💌</span>
                              <span>
                                {msg.user_uid
                                  ? `Anónimo-${msg.user_uid.substring(0, 8)}`
                                  : (msg.author_name?.startsWith('Anónimo-') ? msg.author_name : 'Anónimo')}
                              </span>
                              <GenderBadge gender={msg.author_gender} size="sm" />
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {msg.created_at ? new Date(msg.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-300 italic whitespace-pre-wrap leading-relaxed">
                            "{msg.message}"
                          </p>

                          {/* Reacciones interactivas a cada mensaje en user_love_reactions */}
                          <div className="flex items-center justify-between pt-2 mt-2 border-t border-zinc-800/40">
                            <button
                              type="button"
                              onClick={() => handleToggleMessageReaction(msg)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                msg.has_hearted
                                  ? 'bg-pink-500/20 border border-pink-500/40 text-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.2)]'
                                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-pink-300 hover:border-pink-500/30'
                              }`}
                              title={msg.has_hearted ? 'Quitar reacción' : 'Reaccionar con un corazón'}
                            >
                              <Heart className={`w-3.5 h-3.5 ${msg.has_hearted ? 'fill-pink-500 text-pink-500' : 'fill-none'}`} />
                              <span>{msg.hearts_count || 0} {msg.hearts_count === 1 ? 'reacción' : 'reacciones'}</span>
                            </button>

                            {/* Opción de eliminar para el autor del mensaje */}
                            {user?.uid && msg.user_uid === user.uid && (
                              <button
                                type="button"
                                onClick={() => handleDeleteLoveMessage(msg.id)}
                                className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Eliminar mi mensaje"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Eliminar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

          ) : (
            /* TAB: MIS DATOS / PERFIL ESTÁNDAR */
            <>

          {profileTab === 'info' ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <User className="w-5 h-5 text-[#eab308]" /> 
                    {isOwnProfile ? 'Mis Datos Personales' : 'Información Personal'}
                  </h3>
                </div>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-[#eab308] animate-spin" />
                  <p className="text-xs text-zinc-400 font-mono">Cargando datos...</p>
                </div>
              ) : (
                <form onSubmit={handleSaveChanges} className="space-y-6">
                  
                  {/* Avisos */}
                  {successMsg && (
                    <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Grid Formulario */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* 3 CAMPOS DE IDENTIDAD REAL: Nombres, Apellido Paterno, Apellido Materno */}
                    <div className="sm:col-span-2 space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#eab308] flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> Identidad Oficial (Nombres y Apellidos)
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        {/* 1. NOMBRES */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Nombres <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={nombresInput}
                            onChange={(e) => setNombresInput(e.target.value)}
                            disabled={!isOwnProfile || saving}
                            placeholder="Ej. Daniel Gustavo"
                            className={`w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition-all ${
                              isOwnProfile 
                                ? 'bg-[#151515] border border-[#ffffff15] focus:border-[#eab308] focus:ring-1 focus:ring-[#eab308]' 
                                : 'bg-[#121212] border border-[#ffffff0a] text-zinc-300 cursor-not-allowed font-semibold'
                            }`}
                          />
                        </div>

                        {/* 2. APELLIDO PATERNO */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Apellido Paterno <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={apellidoPaternoInput}
                            onChange={(e) => setApellidoPaternoInput(e.target.value)}
                            disabled={!isOwnProfile || saving}
                            placeholder="Ej. Castillo"
                            className={`w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition-all ${
                              isOwnProfile 
                                ? 'bg-[#151515] border border-[#ffffff15] focus:border-[#eab308] focus:ring-1 focus:ring-[#eab308]' 
                                : 'bg-[#121212] border border-[#ffffff0a] text-zinc-300 cursor-not-allowed font-semibold'
                            }`}
                          />
                        </div>

                        {/* 3. APELLIDO MATERNO */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Apellido Materno
                          </label>
                          <input
                            type="text"
                            value={apellidoMaternoInput}
                            onChange={(e) => setApellidoMaternoInput(e.target.value)}
                            disabled={!isOwnProfile || saving}
                            placeholder="Ej. Ramirez"
                            className={`w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition-all ${
                              isOwnProfile 
                                ? 'bg-[#151515] border border-[#ffffff15] focus:border-[#eab308] focus:ring-1 focus:ring-[#eab308]' 
                                : 'bg-[#121212] border border-[#ffffff0a] text-zinc-300 cursor-not-allowed font-semibold'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* DNI Oficial para Reclamo de Perfil */}
                    <div className="sm:col-span-2 space-y-2 p-4 rounded-2xl bg-[#111111] border border-zinc-800/80">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#eab308] flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5" /> DNI Oficial (8 Dígitos)
                        </label>
                        {isDniVerified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" /> Verificado Oficial
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-mono">
                            8 dígitos numéricos
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          maxLength={8}
                          value={dniInput}
                          onChange={(e) => setDniInput(e.target.value.replace(/\D/g, ''))}
                          disabled={!isOwnProfile || isDniVerified || saving}
                          placeholder="Ej. 60036463"
                          className={`w-full rounded-xl px-4 py-3 text-sm font-mono tracking-widest outline-none transition-all ${
                            isDniVerified
                              ? 'bg-[#181818] border border-emerald-500/30 text-emerald-300 font-bold cursor-not-allowed'
                              : isOwnProfile
                                ? 'bg-[#151515] border border-[#ffffff15] text-white focus:border-[#eab308] focus:ring-1 focus:ring-[#eab308]'
                                : 'bg-[#121212] border border-[#ffffff0a] text-zinc-400 cursor-not-allowed'
                          }`}
                        />
                        {isDniVerified ? (
                          <Lock className="w-4 h-4 text-emerald-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        ) : (
                          <CreditCard className="w-4 h-4 text-zinc-600 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {isDniVerified
                          ? 'Tu DNI está certificado oficialmente con tu perfil de estudiante verificado y no puede ser modificado.'
                          : 'Ingresa tu DNI oficial para que el sistema pueda verificar automáticamente tu identidad al reclamar un perfil institucional.'}
                      </p>
                    </div>

                    {/* Email (Solo se muestra a uno mismo) */}
                    {isOwnProfile && (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" /> Correo Asociado
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            value={dbUser?.email || 'Sin correo (Anónimo)'}
                            disabled
                            className="w-full bg-[#121212] border border-[#ffffff0a] text-zinc-500 rounded-xl px-4 py-3 text-sm outline-none cursor-not-allowed font-medium"
                          />
                        </div>
                      </div>
                    )}

                    {/* País / Nacionalidad con banderas CDN de flagcdn.com */}
                    <div className="sm:col-span-2">
                      <CountrySelector
                        value={selectedCountryCode || selectedCountryName}
                        onChange={(c) => {
                          setSelectedCountryCode(c ? c.code : '');
                          setSelectedCountryName(c ? c.name : '');
                        }}
                        disabled={!isOwnProfile || saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Fecha de Registro
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={dbUser?.created_at ? new Date(dbUser.created_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          }) : 'Pendiente'}
                          disabled
                          className="w-full bg-[#121212] border border-[#ffffff0a] text-zinc-500 rounded-xl px-4 py-3 text-sm outline-none cursor-not-allowed font-medium"
                        />
                      </div>
                    </div>

                    {/* Sexo / Género */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#eab308] flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Sexo
                      </label>
                      {isOwnProfile ? (
                        <div className="grid grid-cols-2 gap-2 h-[46px]">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => setSelectedGender(prev => prev === 'male' ? '' : 'male')}
                            className={`px-3 py-2.5 rounded-xl border font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer select-none ${
                              selectedGender === 'male'
                                ? 'bg-blue-950/60 border-blue-500 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/50'
                                : 'bg-[#121212] border-[#ffffff0f] text-zinc-400 hover:text-white hover:border-blue-500/40'
                            }`}
                            title="Seleccionar Hombre ♂"
                          >
                            <span className="text-base font-black text-blue-400">♂</span>
                            <span>Hombre</span>
                          </button>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => setSelectedGender(prev => prev === 'female' ? '' : 'female')}
                            className={`px-3 py-2.5 rounded-xl border font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer select-none ${
                              selectedGender === 'female'
                                ? 'bg-pink-950/60 border-pink-500 text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.3)] ring-1 ring-pink-500/50'
                                : 'bg-[#121212] border-[#ffffff0f] text-zinc-400 hover:text-white hover:border-pink-500/40'
                            }`}
                            title="Seleccionar Mujer ♀"
                          >
                            <span className="text-base font-black text-pink-400">♀</span>
                            <span>Mujer</span>
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="text"
                            value={
                              dbUser?.gender === 'male' || dbUser?.gender === 'hombre'
                                ? '♂ Hombre'
                                : dbUser?.gender === 'female' || dbUser?.gender === 'mujer'
                                  ? '♀ Mujer'
                                  : 'No especificado'
                            }
                            disabled
                            className="w-full bg-[#121212] border border-[#ffffff0a] text-zinc-400 rounded-xl px-4 py-3 text-sm outline-none cursor-not-allowed font-medium"
                          />
                        </div>
                      )}
                    </div>

                    {/* Fecha de Vinculación con Google (Solo se muestra a uno mismo) */}
                    {isOwnProfile && dbUser?.linked_google_at && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#eab308] flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#eab308]" /> Vinculación con Google
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={new Date(dbUser.linked_google_at).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                            disabled
                            className="w-full bg-[#121212] border border-[#eab308]/20 text-[#eab308] rounded-xl px-4 py-3 text-sm outline-none cursor-not-allowed font-medium shadow-[0_0_10px_rgba(234,179,8,0.03)]"
                          />
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Opción de vinculación para usuarios anónimos (Solo para uno mismo) */}
                  {isOwnProfile && user?.isAnonymous && !dbUser?.linked_google_at && (
                    <div className="p-5 rounded-2xl bg-[#eab30805] border border-[#eab30820] space-y-4 animate-in fade-in duration-300">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-[#eab30810] text-[#eab308] flex-shrink-0">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-wider">¿Deseas asegurar tu cuenta?</h4>
                          <p className="text-xs text-zinc-400 mt-1">
                            Vincula tu perfil anónimo con una cuenta de Google para no perder tus datos (como tu nombre de usuario, votos y historial de campus) al limpiar el navegador o cambiar de dispositivo.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex justify-start">
                        <button
                          type="button"
                          disabled={linkingGoogle}
                          onClick={handleLinkWithGoogleClick}
                          className="px-5 py-3 rounded-xl border border-[#ffffff15] bg-[#141414] hover:bg-[#1a1a1a] hover:border-[#eab308]/60 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-3 transition-all cursor-pointer shadow-md disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.336 0 3.327 2.682 1.386 6.573L5.266 9.765z" />
                            <path fill="#4285F4" d="M16.04 15.345c-1.077.737-2.43 1.146-4.04 1.146a7.067 7.067 0 0 1-6.734-4.855L1.386 14.81C3.327 18.72 7.336 21.4 12 21.4c3.136 0 5.927-1.036 7.91-2.827l-3.87-3.228z" />
                            <path fill="#FBBC05" d="M5.266 12a7.1 7.1 0 0 1 0-2.235L1.386 6.573A11.967 11.967 0 0 0 0 12c0 1.927.455 3.745 1.264 5.373l4.002-3.138A7.01 7.01 0 0 1 5.266 12z" />
                            <path fill="#34A853" d="M23.49 12.273c0-.818-.082-1.609-.227-2.364H12v4.51h6.445a5.51 5.51 0 0 1-2.39 3.618l3.873 3.227c2.264-2.09 3.564-5.173 3.564-8.99z" />
                          </svg>
                          <span>{linkingGoogle ? 'VINCULANDO...' : 'VINCULAR CON GOOGLE'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Botones de acción (Solo si es tu propio perfil) */}
                  {isOwnProfile && (
                    <div className="pt-4 border-t border-[#ffffff10] flex items-center justify-between">
                      <div className="text-[11px] text-zinc-500">
                        {usernameAvailability.status === 'taken' && (
                          <span className="text-red-400 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Elige un nombre disponible para guardar
                          </span>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={
                          saving || 
                          !nombresInput.trim() || 
                          !apellidoPaternoInput.trim()
                        }
                        className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
                          saving || 
                          !nombresInput.trim() || 
                          !apellidoPaternoInput.trim()
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
                            : 'bg-[#eab308] hover:bg-[#d9a307] text-black cursor-pointer shadow-[0_4px_20px_rgba(234,179,8,0.25)] active:scale-98'
                        }`}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-current" />
                            <span>GUARDANDO...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 text-current" />
                            <span>GUARDAR CAMBIOS</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Botón de Acceso Exclusivo al Panel de Administración */}
                  {isOwnProfile && dbUser?.role === 'admin' && (
                    <div className="pt-6 border-t border-amber-500/20">
                      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col gap-4 shadow-[0_0_25px_rgba(245,158,11,0.08)]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-amber-400 stroke-[2.5]" />
                            <h4 className="text-xs font-black text-white uppercase tracking-wider">
                              Administración del Sistema
                            </h4>
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase">
                              ADMIN
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            Accede a las métricas dinámicas de usuarios, estados de autenticación y centros educativos en Supabase.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigate) {
                              onNavigate('/admin');
                            } else {
                              window.history.pushState(null, '', '/admin');
                              window.dispatchEvent(new PopStateEvent('popstate'));
                            }
                          }}
                          className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-[0_4px_20px_rgba(245,158,11,0.35)] hover:shadow-[0_4px_25px_rgba(245,158,11,0.5)] cursor-pointer active:scale-98 flex-shrink-0"
                        >
                          <ShieldCheck className="w-4 h-4 text-black stroke-[3]" />
                          <span>🛡️ PANEL DE CONTROL ADMIN</span>
                          <ChevronRight className="w-4 h-4 text-black stroke-[3]" />
                        </button>
                      </div>
                    </div>
                  )}

                </form>
              )}
            </div>

          ) : profileTab === 'interactions' ? (
            // PESTAÑA MIS INTERACCIONES
            <div className="space-y-4 animate-in fade-in duration-300">
              {interactionsError && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4" />
                  <span>{interactionsError}</span>
                </div>
              )}

              {/* 3 Subtags solicitadas: Seguidos, Fans y Calificaciones */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-1">
                <button
                  type="button"
                  onClick={() => setInteractionFilter('knows')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 ${
                    interactionFilter === 'knows'
                      ? 'bg-blue-600 text-white font-extrabold shadow-[0_0_15px_rgba(59,130,246,0.35)] ring-1 ring-blue-400'
                      : 'bg-[#121212] text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:bg-blue-950/20'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Seguidos</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                    interactionFilter === 'knows' ? 'bg-black text-blue-300' : 'bg-blue-500/20 text-blue-300'
                  }`}>
                    {interactions.filter(i => i.type === 'knows').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setInteractionFilter('fans')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 ${
                    interactionFilter === 'fans'
                      ? 'bg-pink-600 text-white font-extrabold shadow-[0_0_15px_rgba(236,72,153,0.35)] ring-1 ring-pink-400'
                      : 'bg-[#121212] text-pink-400 hover:text-pink-300 border border-pink-500/20 hover:bg-pink-950/20'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  <span>Fans</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                    interactionFilter === 'fans' ? 'bg-black text-pink-300' : 'bg-pink-500/20 text-pink-300'
                  }`}>
                    {interactions.filter(i => i.type === 'fans').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setInteractionFilter('ratings')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 ${
                    interactionFilter === 'ratings'
                      ? 'bg-[#eab308] text-black font-extrabold shadow-[0_0_15px_rgba(234,179,8,0.35)] ring-1 ring-amber-300'
                      : 'bg-[#121212] text-[#eab308] hover:text-amber-300 border border-[#eab308]/20 hover:bg-amber-950/20'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>Calificaciones</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                    interactionFilter === 'ratings' ? 'bg-black text-[#eab308]' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {interactions.filter(i => i.type === 'ratings').length}
                  </span>
                </button>
              </div>

              {loadingInteractions ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#eab308]" />
                  <p className="text-xs text-zinc-500 font-medium">Cargando tus interacciones de Supabase...</p>
                </div>
              ) : interactions.filter(i => i.type === interactionFilter).length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-zinc-800/80 text-center space-y-3 bg-[#080808]">
                  <div className="inline-flex p-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 mb-1">
                    {interactionFilter === 'knows' ? (
                      <UserCheck className="w-6 h-6 text-blue-400" />
                    ) : interactionFilter === 'fans' ? (
                      <Heart className="w-6 h-6 text-pink-400" />
                    ) : (
                      <Star className="w-6 h-6 text-[#eab308]" />
                    )}
                  </div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">
                    {interactionFilter === 'knows'
                      ? 'Sin estudiantes seguidos'
                      : interactionFilter === 'fans'
                      ? 'Sin votos de Fan registrados'
                      : 'Sin calificaciones registradas'}
                  </h4>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                    {interactionFilter === 'knows'
                      ? 'Aún no sigues a ningún estudiante. Explora los perfiles del campus y pulsa en "Seguir".'
                      : interactionFilter === 'fans'
                      ? 'Aún no te has hecho Fan de ningún estudiante en la comunidad de Starryz.'
                      : 'Aún no has calificado a ningún estudiante. ¡Visita perfiles del campus para otorgar estrellas de reputación!'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {interactions
                    .filter(item => item.type === interactionFilter)
                    .map((item) => {
                      const isKnows = item.type === 'knows';
                      const isFan = item.type === 'fans';
                      const isRating = item.type === 'ratings';

                      return (
                        <div
                          key={item.id}
                          className="group relative flex flex-col justify-between p-4 rounded-2xl border border-zinc-800/80 bg-[#0c0c0c] hover:bg-[#121212] hover:border-zinc-700 transition-all duration-200 shadow-md"
                        >
                          <div className="flex items-start gap-3.5">
                            {/* Avatar */}
                            <div 
                              onClick={() => navigateTo(`/perfil/${item.targetId}`)}
                              className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm uppercase flex-shrink-0 cursor-pointer overflow-hidden transition-all ${
                                isKnows 
                                    ? 'bg-blue-950/30 border border-blue-500/40 text-blue-400 group-hover:border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                                  : isFan
                                  ? 'bg-pink-950/30 border border-pink-500/40 text-pink-400 group-hover:border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.15)]'
                                  : 'bg-amber-950/30 border border-amber-500/40 text-amber-400 group-hover:border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                              }`}
                            >
                              {item.targetAvatar ? (
                                <img
                                  src={item.targetAvatar}
                                  alt={item.targetName}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                item.targetName.charAt(0).toUpperCase()
                              )}
                            </div>

                            {/* Nombre, Badge e Información */}
                            <div 
                              onClick={() => navigateTo(`/perfil/${item.targetId}`)}
                              className="min-w-0 flex-1 cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isKnows && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[9px] font-black uppercase tracking-wider">
                                    <UserCheck className="w-2.5 h-2.5 text-blue-400" />
                                    SIGUIENDO
                                  </span>
                                )}
                                {isFan && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-500/15 border border-pink-500/30 text-pink-400 text-[9px] font-black uppercase tracking-wider">
                                    <Heart className="w-2.5 h-2.5 fill-pink-500 text-pink-500" />
                                    FAN
                                  </span>
                                )}
                                {isRating && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[#eab308] text-[9px] font-black uppercase tracking-wider">
                                    <Star className="w-2.5 h-2.5 fill-[#eab308] text-[#eab308]" />
                                    CALIFICASTE: {item.starsGiven} {item.starsGiven === 1 ? 'ESTRELLA' : 'ESTRELLAS'}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 mt-1.5">
                                <h4 
                                  className="text-xs sm:text-sm font-black text-white truncate group-hover:text-[#eab308] transition-colors uppercase tracking-tight"
                                  title={item.targetName}
                                >
                                  {item.targetName}
                                </h4>
                                {item.targetGender && (
                                  <span className={`text-xs font-black ${item.targetGender === 'male' || item.targetGender === 'hombre' ? 'text-blue-400' : 'text-pink-400'}`}>
                                    {item.targetGender === 'male' || item.targetGender === 'hombre' ? '♂' : '♀'}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500 font-medium flex-wrap">
                                {item.targetCountryCode && (
                                  <img
                                    src={getFlagUrl(item.targetCountryCode, 'w20')}
                                    alt={item.targetCountry || 'País'}
                                    className="w-3.5 h-2.5 object-cover rounded-2xs inline-block"
                                    loading="lazy"
                                  />
                                )}
                                <span>{item.targetSubtitle}</span>
                                <span>•</span>
                                <span>{new Date(item.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              </div>
                            </div>
                          </div>

                          {/* Footer con Acciones */}
                          <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-800/60">
                            <button
                              type="button"
                              onClick={() => navigateTo(`/perfil/${item.targetId}`)}
                              className="inline-flex items-center gap-1 text-[11px] font-black text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            >
                              <span>Ver Perfil</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>

                            {isOwnProfile && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveInteraction(item);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer border bg-red-950/20 hover:bg-red-950/60 text-zinc-400 hover:text-red-300 border-red-900/30 hover:border-red-700/50"
                                title="Quitar interacción"
                              >
                                <Trash2 className="w-3 h-3 text-red-400" />
                                <span>Quitar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ) : (
            // PESTAÑA SUSCRIPCIONES A NOTIFICACIONES
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <BellRing className="w-5 h-5 text-[#eab308]" /> {isOwnProfile ? 'Mis Suscripciones a Notificaciones' : 'Suscripciones del Usuario'}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    {isOwnProfile 
                      ? 'Administra las alertas y avisos en tiempo real sobre los perfiles de profesores y estudiantes que sigues.'
                      : 'Perfiles educativos suscritos para notificaciones automáticas.'}
                  </p>
                </div>
              </div>

              {subscriptionsError && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4" />
                  <span>{subscriptionsError}</span>
                </div>
              )}

              {/* Subtags / Filtro entre Profesores y Estudiantes */}
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <button
                  type="button"
                  onClick={() => setSubscriptionsSubTab('professors')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                    subscriptionsSubTab === 'professors'
                      ? 'bg-[#eab308] text-black shadow-[0_0_15px_rgba(234,179,8,0.3)] font-extrabold'
                      : 'bg-[#121212] text-zinc-400 hover:text-white border border-zinc-800 hover:bg-[#181818]'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Profesores</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                    subscriptionsSubTab === 'professors' ? 'bg-black/20 text-black font-black' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {profSubscriptions.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubscriptionsSubTab('students')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                    subscriptionsSubTab === 'students'
                      ? 'bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.3)] font-extrabold'
                      : 'bg-[#121212] text-zinc-400 hover:text-white border border-zinc-800 hover:bg-[#181818]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Estudiantes</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                    subscriptionsSubTab === 'students' ? 'bg-black/20 text-white font-black' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {studentSubscriptions.length}
                  </span>
                </button>
              </div>

              {loadingSubscriptions ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-[#eab308] animate-spin" />
                  <p className="text-xs text-zinc-400 font-mono">Sincronizando suscripciones con la base de datos...</p>
                </div>
              ) : subscriptionsSubTab === 'professors' ? (
                // LISTA DE PROFESORES SUSCRITOS
                profSubscriptions.length === 0 ? (
                  <div className="text-center py-16 px-4 bg-[#0a0a0a] rounded-2xl border border-zinc-900 space-y-3">
                    <BellOff className="w-10 h-10 text-zinc-600 mx-auto stroke-1" />
                    <h4 className="text-sm font-black text-zinc-300 uppercase tracking-wide">
                      Sin suscripciones a profesores
                    </h4>
                    <p className="text-xs text-zinc-500 max-w-md mx-auto">
                      {isOwnProfile 
                        ? 'Aún no estás suscrito a ningún profesor. Entra al perfil de tu profesor preferido y haz clic en la campanita para activar notificaciones de flechazos, fans y calificaciones.'
                        : 'Este usuario no tiene suscripciones a profesores.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {profSubscriptions.map((item) => (
                      <div
                        key={item.id}
                        className="group relative flex flex-col justify-between p-4 rounded-2xl border border-zinc-800/80 bg-[#0c0c0c] hover:bg-[#121212] hover:border-amber-500/40 transition-all duration-200 shadow-md"
                      >
                        <div className="flex items-start gap-3.5">
                          {/* Avatar */}
                          <div 
                            onClick={() => navigateTo(`/profesores/${item.professorId}`)}
                            className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm uppercase flex-shrink-0 cursor-pointer overflow-hidden bg-amber-950/30 border border-amber-500/40 text-[#eab308] group-hover:border-[#eab308] shadow-[0_0_15px_rgba(234,179,8,0.15)]"
                          >
                            {item.professorAvatar ? (
                              <img
                                src={item.professorAvatar}
                                alt={item.professorName}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              item.professorName.charAt(0)
                            )}
                          </div>

                          {/* Info */}
                          <div 
                            onClick={() => navigateTo(`/profesores/${item.professorId}`)}
                            className="min-w-0 flex-1 cursor-pointer"
                          >
                            <h4 className="text-xs sm:text-sm font-black text-white truncate group-hover:text-[#eab308] transition-colors uppercase tracking-tight">
                              {item.professorName}
                            </h4>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                              {item.professorRole || 'Profesor'}
                            </p>

                            {/* Tags de Notificaciones Activas */}
                            <div className="flex items-center gap-1.5 flex-wrap mt-2">
                              {((item as any).notify_crush ?? item.preferences?.notify_crush) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-500/15 border border-pink-500/30 text-pink-400 text-[9px] font-black uppercase tracking-wider">
                                  <Heart className="w-2.5 h-2.5 fill-pink-500 text-pink-500" />
                                  Crush
                                </span>
                              )}
                              {((item as any).notify_review ?? item.preferences?.notify_review) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase tracking-wider">
                                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                  Reseñas
                                </span>
                              )}
                              {((item as any).notify_known ?? item.preferences?.notify_known) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[9px] font-black uppercase tracking-wider">
                                  <UserCheck className="w-2.5 h-2.5 text-blue-400" />
                                  Conocido
                                </span>
                              )}
                              {((item as any).notify_fan ?? item.preferences?.notify_fan) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                                  Fans
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Footer con Acciones */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-800/60">
                          <button
                            type="button"
                            onClick={() => navigateTo(`/profesores/${item.professorId}`)}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <span>Ver Perfil</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>

                          <div className="flex items-center gap-2">
                            {isOwnProfile && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProfSub(item);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-[#eab308] border border-zinc-800"
                                title="Configurar alertas"
                              >
                                <Settings2 className="w-3 h-3" />
                                <span>Ajustar</span>
                              </button>
                            )}

                            {isOwnProfile && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveProfSubscription(item);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer bg-red-950/20 hover:bg-red-950/60 text-zinc-400 hover:text-red-300 border border-red-900/30 hover:border-red-700/50"
                                title="Cancelar suscripción"
                              >
                                <Trash2 className="w-3 h-3 text-red-400" />
                                <span>Quitar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                // LISTA DE ESTUDIANTES SUSCRITOS
                studentSubscriptions.length === 0 ? (
                  <div className="text-center py-16 px-4 bg-[#0a0a0a] rounded-2xl border border-zinc-900 space-y-3">
                    <BellOff className="w-10 h-10 text-zinc-600 mx-auto stroke-1" />
                    <h4 className="text-sm font-black text-zinc-300 uppercase tracking-wide">
                      Sin suscripciones a estudiantes
                    </h4>
                    <p className="text-xs text-zinc-500 max-w-md mx-auto">
                      {isOwnProfile 
                        ? 'Aún no estás suscrito a ningún estudiante. Entra al perfil de un alumno y activa la campana para recibir alertas inmediatas de flechazos y mensajes.'
                        : 'Este usuario no tiene suscripciones a estudiantes.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {studentSubscriptions.map((item) => (
                      <div
                        key={item.id}
                        className="group relative flex flex-col justify-between p-4 rounded-2xl border border-zinc-800/80 bg-[#0c0c0c] hover:bg-[#121212] hover:border-pink-500/40 transition-all duration-200 shadow-md"
                      >
                        <div className="flex items-start gap-3.5">
                          {/* Avatar */}
                          <div 
                            onClick={() => navigateTo(`/estudiantes/${item.studentId}`)}
                            className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm uppercase flex-shrink-0 cursor-pointer overflow-hidden bg-pink-950/30 border border-pink-500/40 text-pink-400 group-hover:border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.15)]"
                          >
                            {item.studentAvatar ? (
                              <img
                                src={item.studentAvatar}
                                alt={item.studentName}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              item.studentName.charAt(0)
                            )}
                          </div>

                          {/* Info */}
                          <div 
                            onClick={() => navigateTo(`/estudiantes/${item.studentId}`)}
                            className="min-w-0 flex-1 cursor-pointer"
                          >
                            <h4 className="text-xs sm:text-sm font-black text-white truncate group-hover:text-pink-400 transition-colors uppercase tracking-tight">
                              {item.studentName}
                            </h4>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                              {(item as any).studentGrade || item.studentCareer || 'Estudiante'}
                            </p>

                            {/* Tags de Notificaciones Activas */}
                            <div className="flex items-center gap-1.5 flex-wrap mt-2">
                              {((item as any).notify_crush ?? item.preferences?.notify_crush) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-500/15 border border-pink-500/30 text-pink-400 text-[9px] font-black uppercase tracking-wider">
                                  <Heart className="w-2.5 h-2.5 fill-pink-500 text-pink-500" />
                                  Crush
                                </span>
                              )}
                              {((item as any).notify_love_message ?? item.preferences?.notify_love_message) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[9px] font-black uppercase tracking-wider">
                                  <Mail className="w-2.5 h-2.5 text-rose-400" />
                                  Mensajes
                                </span>
                              )}
                              {((item as any).notify_known ?? item.preferences?.notify_known) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[9px] font-black uppercase tracking-wider">
                                  <UserCheck className="w-2.5 h-2.5 text-blue-400" />
                                  Conocido
                                </span>
                              )}
                              {((item as any).notify_fan ?? item.preferences?.notify_fan) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase tracking-wider">
                                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                  Fans
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Footer con Acciones */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-800/60">
                          <button
                            type="button"
                            onClick={() => navigateTo(`/estudiantes/${item.studentId}`)}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <span>Ver Perfil</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>

                          <div className="flex items-center gap-2">
                            {isOwnProfile && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingStudentSub(item);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-pink-400 border border-zinc-800"
                                title="Configurar alertas"
                              >
                                <Settings2 className="w-3 h-3" />
                                <span>Ajustar</span>
                              </button>
                            )}

                            {isOwnProfile && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveStudentSubscription(item);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer bg-red-950/20 hover:bg-red-950/60 text-zinc-400 hover:text-red-300 border border-red-900/30 hover:border-red-700/50"
                                title="Cancelar suscripción"
                              >
                                <Trash2 className="w-3 h-3 text-red-400" />
                                <span>Quitar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}

        </div>

      </div>



      {/* Modal para configurar notificaciones de profesor desde el perfil */}
      {editingProfSub && user && (
        <ProfessorNotificationModal
          isOpen={true}
          onClose={() => setEditingProfSub(null)}
          professorId={editingProfSub.professorId}
          professorName={editingProfSub.professorName}
          professorAvatar={editingProfSub.professorAvatar || null}
          userUid={user.uid}
          onSubscriptionChange={() => {
            loadSubscriptions();
          }}
        />
      )}

      {/* Modal para configurar notificaciones de estudiante desde el perfil */}
      {editingStudentSub && user && (
        <StudentNotificationModal
          isOpen={true}
          onClose={() => setEditingStudentSub(null)}
          studentId={editingStudentSub.studentId}
          studentName={editingStudentSub.studentName}
          studentAvatar={editingStudentSub.studentAvatar || null}
          userUid={user.uid}
          onSubscriptionChange={() => {
            loadSubscriptions();
          }}
        />
      )}

      {/* Modal para cambiar foto de perfil con recorte y compresión */}
      {user && isAvatarModalOpen && (
        <AvatarUploadModal
          isOpen={isAvatarModalOpen}
          onClose={() => setIsAvatarModalOpen(false)}
          userId={user.uid}
          currentPhotoUrl={dbUser?.photo_url || null}
          onAvatarUpdated={(newPhotoUrl) => {
            setDbUser((prev) => (prev ? { ...prev, photo_url: newPhotoUrl } : null));
            setSuccessMsg('¡Foto de perfil actualizada con éxito!');
          }}
        />
      )}

      {/* Modal para ver la foto de perfil en tamaño completo */}
      {isViewPhotoModalOpen && dbUser?.photo_url && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsViewPhotoModalOpen(false)}
        >
          <div
            className="relative max-w-md w-full bg-[#0d0d0d] border border-zinc-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center space-y-4 animate-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado del visor */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white uppercase tracking-tight truncate max-w-[200px]">
                  {dbUser.display_name || 'Foto de Perfil'}
                </span>
                {dbUser.role === 'admin' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                    Admin
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsViewPhotoModalOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                title="Cerrar visor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Imagen ampliada */}
            <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl max-h-[60vh] w-full flex items-center justify-center bg-black/60 p-2">
              <img
                src={dbUser.photo_url}
                alt={dbUser.display_name || 'Foto de perfil'}
                className="max-h-[55vh] w-auto max-w-full object-contain rounded-xl shadow-lg ring-1 ring-white/10"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Acciones del visor */}
            <div className="w-full flex items-center justify-between pt-1">
              <a
                href={dbUser.photo_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-zinc-400 hover:text-amber-400 transition flex items-center gap-1.5 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-zinc-900"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Abrir en pestaña</span>
              </a>

              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => {
                    setIsViewPhotoModalOpen(false);
                    setIsAvatarModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 hover:border-[#eab308] text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                >
                  <Camera className="w-3.5 h-3.5 text-[#eab308]" />
                  <span>Cambiar foto</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
