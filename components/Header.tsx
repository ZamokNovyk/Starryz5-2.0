'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  UserPlus, 
  Star, 
  Menu, 
  X, 
  LogOut, 
  GraduationCap, 
  UserCheck, 
  Building2, 
  BookOpen,
  Settings,
  Sun,
  Moon,
  Palette,
  Bell,
  BellRing,
  Smartphone,
  Download,
  Heart,
  MessageSquare,
  MoreVertical,
  ExternalLink,
  Share2,
  Trash,
  ShieldCheck,
  CornerDownRight,
  Send,
  ChevronDown,
  ChevronUp,
  Film,
  Sparkles
} from 'lucide-react';
import CommunityGuidelinesModal from './Modals/CommunityGuidelinesModal';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useFCMNotifications } from '@/hooks/useFCMNotifications';
import AutocompleteSearchBar from './AutocompleteSearchBar';
import { SearchSuggestion } from '@/src/lib/search';
import { supabase } from '@/src/lib/supabase';
import { createConfessionComment, getDisplayAuthorName, getMyConfessionIds } from '@/src/lib/confessions';
import { promptNotificationOnAction } from '@/src/lib/notificationHelper';
import { usePwaTabs } from '@/src/context/PwaTabsContext';
import { useThemeCustomizer } from '@/src/context/ThemeCustomizerContext';
import { usePageTransition, TRANSITIONS_LIST } from '@/src/context/PageTransitionContext';

interface NotificationItem {
  id: string;
  user_uid: string;
  title: string;
  body: string;
  link_url?: string;
  is_read: boolean;
  created_at: string;
}

interface HeaderProps {
  searchQuery?: string;
  onSearch?: (query: string) => void;
  onNavigate?: (url: string) => void;
  onOpenInstallModal: () => void;
  onOpenJoinModal: () => void;
  onGoToProfile?: () => void;
  onGoToHome?: () => void;
  onOpenCreateCenterModal?: () => void;
}

export default function Header({ 
  searchQuery = '',
  onSearch,
  onNavigate,
  onOpenInstallModal, 
  onOpenJoinModal, 
  onGoToProfile,
  onGoToHome,
  onOpenCreateCenterModal
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guidelinesModalOpen, setGuidelinesModalOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { theme, toggleTheme, setTheme } = useTheme();
  const { openThemeStudio } = useThemeCustomizer();
  const { activeTransition, setIsSettingsModalOpen } = usePageTransition();
  const activeTransitionDef = TRANSITIONS_LIST.find(t => t.id === activeTransition) || TRANSITIONS_LIST[0];
  const { permission, requestPermission } = useFCMNotifications();

  // Lógica de PWA (deferredPrompt y comprobación de instalabilidad)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPwaInstallable, setIsPwaInstallable] = useState(false);
  const { 
    isPwa: isPwaMode, 
    tabs: pwaTabs, 
    openTabsSwitcher,
    setIsTabsSwitcherOpen, 
    togglePwaSimulation 
  } = usePwaTabs();

  // Lógica de Notificaciones In-App
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNotificationsOpen, setMobileNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const mobileNotificationsRef = useRef<HTMLDivElement>(null);

  // States for Notification Detail Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalConfession, setModalConfession] = useState<any>(null);
  const [modalCenterInfo, setModalCenterInfo] = useState<{ id?: string; name?: string; type?: string } | null>(null);
  const [modalComments, setModalComments] = useState<any[]>([]);
  const [targetCommentId, setTargetCommentId] = useState<string | null>(null);
  const [modalReactionsCount, setModalReactionsCount] = useState<number>(0);

  // States for 2-level reply conversation inside modal
  const [modalReplyText, setModalReplyText] = useState('');
  const [modalReplyingTo, setModalReplyingTo] = useState<{ root_id: string; author_name: string } | null>(null);
  const [modalExpandedReplies, setModalExpandedReplies] = useState<Record<string, boolean>>({});
  const [submittingModalReply, setSubmittingModalReply] = useState(false);
  const [modalReplyError, setModalReplyError] = useState<string | null>(null);
  const modalReplyInputRef = useRef<HTMLTextAreaElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_uid', user.uid)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error al obtener notificaciones:', err);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    fetchNotifications();

    // 1. Manejo en tiempo real vía Firebase Cloud Messaging (onMessage) - 0 Supabase Realtime
    const handleFCMNotification = (e: any) => {
      const detail = e.detail;
      if (!detail) return;

      const newNotif: NotificationItem = {
        id: detail.id || `fcm_${Date.now()}`,
        user_uid: user.uid,
        title: detail.title || 'Starryz 5',
        content: detail.body || 'Tienes una nueva interacción',
        type: detail.data?.type || 'interaction',
        reference_id: detail.data?.reference_id || null,
        is_read: false,
        created_at: detail.created_at || new Date().toISOString()
      };

      setNotifications((prev) => {
        if (prev.some(n => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });

      // Sincronizar con Supabase silenciosamente
      setTimeout(() => {
        fetchNotifications();
      }, 1000);
    };

    window.addEventListener('starryz_fcm_notification', handleFCMNotification);

    return () => {
      window.removeEventListener('starryz_fcm_notification', handleFCMNotification);
    };
  }, [user?.uid]);

  // Cerrar notificaciones al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (mobileNotificationsRef.current && !mobileNotificationsRef.current.contains(event.target as Node)) {
        setMobileNotificationsOpen(false);
      }
    }
    if (notificationsOpen || mobileNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationsOpen, mobileNotificationsOpen]);

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_uid', user.uid)
        .eq('is_read', false);
      if (!error) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error('Error al marcar notificaciones como leídas:', err);
    }
  };

  const formatFullDateWithRelative = (dateStr?: string) => {
    if (!dateStr) return { fullDate: '', relative: '' };
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const fullDate = `${day}/${month}/${year}, ${hours}:${minutes}`;

      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHrs / 24);

      let relative = 'Ahora';
      if (diffMins < 1) relative = 'Ahora';
      else if (diffMins < 60) relative = `Hace ${diffMins} min`;
      else if (diffHrs < 24) relative = `Hace ${diffHrs} ${diffHrs === 1 ? 'hora' : 'horas'}`;
      else relative = `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;

      return { fullDate, relative };
    } catch {
      return { fullDate: '', relative: '' };
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'crush':
        return { label: 'CRUSH', icon: '💛', colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'professors':
        return { label: 'PROFESORES', icon: '👨‍🏫', colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
      case 'exams':
        return { label: 'EXÁMENES', icon: '📝', colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'anecdotes':
        return { label: 'ANÉCDOTAS', icon: '🔥', colorClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30' };
      default:
        return { label: 'MURO', icon: '✨', colorClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' };
    }
  };

  const loadConfessionDetails = async (confessionId: string, commentId: string | null = null) => {
    setShowDetailModal(true);
    setModalLoading(true);
    setModalConfession(null);
    setModalCenterInfo(null);
    setModalComments([]);
    setTargetCommentId(commentId);
    setModalReactionsCount(0);
    setModalReplyText('');
    setModalReplyingTo(null);
    setModalReplyError(null);
    setModalExpandedReplies({});
    
    try {
      // 1. Obtener la confesión
      const { data: confession } = await supabase
        .from('center_confessions')
        .select('*')
        .eq('id', confessionId)
        .single();

      if (confession) {
        setModalConfession(confession);

        // 2. Obtener datos del centro educativo
        if (confession.center_id) {
          const { data: center } = await supabase
            .from('educational_centers')
            .select('id, name, type')
            .eq('id', confession.center_id)
            .maybeSingle();
          if (center) {
            setModalCenterInfo(center);
          }
        }

        // 3. Obtener TODAS las respuestas de la confesión para mostrar la conversación fluida (2 niveles)
        const { data: comments } = await supabase
          .from('confession_comments')
          .select('*')
          .eq('confession_id', confessionId)
          .order('created_at', { ascending: true });

        if (comments) {
          setModalComments(comments);
          // Si la notificación apuntaba a un comentario específico, expandir su hilo
          if (commentId) {
            const target = comments.find(c => c.id === commentId);
            if (target && target.parent_id) {
              setModalExpandedReplies({ [target.parent_id]: true });
            } else if (target) {
              setModalExpandedReplies({ [target.id]: true });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error al cargar detalles de la confesión para la notificación:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSendModalReply = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalReplyError(null);

    const trimmed = modalReplyText.trim();
    if (!trimmed) {
      setModalReplyError('Por favor escribe tu respuesta.');
      return;
    }
    if (!modalConfession) return;

    const authorName = user ? (user.displayName || user.email?.split('@')[0] || 'Anónimo') : 'Anónimo';

    try {
      setSubmittingModalReply(true);
      const newComment = await createConfessionComment({
        confession_id: modalConfession.id,
        firebase_uid: user?.uid || null,
        author_name: authorName,
        content: trimmed,
        is_anonymous: true,
        parent_id: modalReplyingTo?.root_id || null,
        reply_to_author: modalReplyingTo?.author_name || null,
      });

      setModalComments((prev) => [...prev, newComment]);
      if (modalReplyingTo?.root_id) {
        setModalExpandedReplies(prev => ({ ...prev, [modalReplyingTo.root_id]: true }));
      }
      if (modalConfession) {
        setModalConfession((prev: any) => prev ? { ...prev, comments_count: (prev.comments_count || 0) + 1 } : prev);
      }
      setModalReplyText('');
      setModalReplyingTo(null);
      promptNotificationOnAction('comment');
    } catch (err: any) {
      console.error('Error al enviar respuesta:', err);
      setModalReplyError('Error al guardar tu respuesta en la base de datos.');
    } finally {
      setSubmittingModalReply(false);
    }
  };

  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  const handleDeleteModalCommentClick = (commentId: string) => {
    setCommentToDelete(commentId);
  };

  const confirmDeleteModalComment = async () => {
    if (!commentToDelete) return;
    const commentId = commentToDelete;
    setCommentToDelete(null);
    
    // Guardar copia para rollback
    const previousComments = [...modalComments];
    const previousConfession = modalConfession ? { ...modalConfession } : null;
    
    // Actualizar estado local inmediatamente
    setModalComments((prev: any[]) => prev.filter((c) => c.id !== commentId));
    if (modalConfession) {
      setModalConfession({
        ...modalConfession,
        comments_count: Math.max(0, (modalConfession.comments_count || 0) - 1)
      });
    }

    try {
      const { error: deleteErr } = await supabase
        .from('confession_comments')
        .delete()
        .eq('id', commentId);

      if (deleteErr) {
        // Rollback
        setModalComments(previousComments);
        if (previousConfession) setModalConfession(previousConfession);
        alert(deleteErr.message || 'No se pudo eliminar el comentario. Revisa las políticas RLS en Supabase.');
        return;
      }

      // Decrementar el contador en la confesión en Supabase si es necesario
      if (previousConfession) {
        const newCount = Math.max(0, (previousConfession.comments_count || 0) - 1);
        await supabase
          .from('center_confessions')
          .update({ comments_count: newCount })
          .eq('id', previousConfession.id);
      }
    } catch (err) {
      console.error('Error al eliminar comentario:', err);
      // Rollback
      setModalComments(previousComments);
      if (previousConfession) setModalConfession(previousConfession);
      alert('Error de conexión al intentar borrar el comentario.');
    }
  };

  // Detectar automáticamente si la URL contiene show_confession o confession_id
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const confessionId = urlParams.get('show_confession') || urlParams.get('confession_id');
    const commentId = urlParams.get('comment_id');

    if (confessionId) {
      loadConfessionDetails(confessionId, commentId);
    }
  }, []);

  const handleNotificationClick = async (notif: NotificationItem) => {
    setNotificationsOpen(false);
    setMobileNotificationsOpen(false);
    
    if (!notif.is_read && user) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notif.id);
        if (!error) {
          setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        }
      } catch (err) {
        console.error('Error al marcar notificación como leída:', err);
      }
    }

    let confessionId: string | null = null;
    let commentId: string | null = null;
    if (notif.link_url) {
      if (notif.link_url.includes('show_confession=')) {
        confessionId = notif.link_url.split('show_confession=')[1]?.split('&')[0] || null;
      } else if (notif.link_url.includes('confession_id=')) {
        confessionId = notif.link_url.split('confession_id=')[1]?.split('&')[0] || null;
      }
      if (notif.link_url.includes('comment_id=')) {
        commentId = notif.link_url.split('comment_id=')[1]?.split('&')[0] || null;
      }
    }

    if (confessionId) {
      // Llevar al usuario a la página principal y abrir la ventana de la notificación
      if (onGoToHome) {
        onGoToHome();
      } else if (onNavigate) {
        onNavigate('/');
      }
      loadConfessionDetails(confessionId, commentId);
    } else {
      if (notif.link_url && onNavigate) {
        onNavigate(notif.link_url);
      }
    }
  };

  const renderNotificationBody = (body: string) => {
    if (body.startsWith('[') && body.includes(']')) {
      const closingIndex = body.indexOf(']');
      const username = body.substring(1, closingIndex);
      const rest = body.substring(closingIndex + 1);
      return (
        <span className="leading-snug">
          <span className="text-amber-400 font-bold">{username}</span>
          <span className="text-zinc-300">{rest}</span>
        </span>
      );
    }
    return <span className="text-zinc-300">{body}</span>;
  };

  const formatNotifDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);
      if (diffMins < 1) return 'Ahora';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHrs < 24) return `Hace ${diffHrs} h`;
      return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
      setIsPwaInstallable(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e;
      setIsPwaInstallable(true);
    };

    const handlePwaCustomEvent = () => {
      if (typeof window !== 'undefined' && (window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
        setIsPwaInstallable(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-installable', handlePwaCustomEvent);

    const handleAppInstalled = () => {
      setIsPwaInstallable(false);
      setDeferredPrompt(null);
      if (typeof window !== 'undefined') {
        (window as any).deferredPrompt = null;
      }
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-installable', handlePwaCustomEvent);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handlePwaInstallClick = async () => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPrompt : null);
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          if (typeof window !== 'undefined') {
            (window as any).deferredPrompt = null;
          }
          setIsPwaInstallable(false);
        }
      } catch (err) {
        console.error('Error al iniciar instalación PWA nativa:', err);
      }
    } else {
      // Si no hay evento de instalación nativa (como en iOS o previews en iframe), abrimos el modal detallado
      onOpenInstallModal();
    }
  };

  // Cerrar menú de configuración al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [settingsOpen]);

  const handleSearchSubmit = (queryText: string) => {
    if (onSearch) {
      onSearch(queryText);
    }
    setMobileSearchOpen(false);
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setMobileSearchOpen(false);
    if (onNavigate && suggestion.url) {
      onNavigate(suggestion.url);
    } else if (onSearch) {
      onSearch(suggestion.title);
    }
  };

  const handleQuickCategorySearch = (cat: string) => {
    if (onSearch) {
      onSearch(cat);
    }
    setMobileSearchOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#0d0d0d] border-b border-[#ffffff10] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6">
          
          {/* 1. LOGO (IZQUIERDA) */}
          <div 
            onClick={onGoToHome}
            className="flex items-center gap-2 cursor-pointer group select-none flex-shrink-0"
          >
            <div className="flex items-center justify-center transition-transform group-hover:scale-110">
              <img 
                src="/Logo/logo.jpg" 
                alt="Logo Starryz 5" 
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-[#eab308]/30 shadow-md"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-lg sm:text-xl font-black tracking-tighter text-white font-sans">
                  STARRYZ
                </span>
                <span className="text-lg sm:text-xl font-black text-[#eab308]">
                  5
                </span>
              </div>
            </div>
          </div>

          {/* 2. BUSCADOR CON AUTOCOMPLETADO Y TOLERANCIA A ERRORES (DESKTOP & TABLETS - CENTRO) */}
          <div className="hidden sm:flex flex-1 max-w-lg mx-2 lg:mx-6">
            <AutocompleteSearchBar
              value={searchQuery}
              placeholder="Buscar usuarios por nombre..."
              onSearch={handleSearchSubmit}
              onSelectSuggestion={handleSuggestionSelect}
            />
          </div>

          {/* 3. ACCIONES DE LA DERECHA */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            
            {/* LUPA EN MÓVILES (ABRE LA VENTANA MODAL DE BÚSQUEDA) */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="sm:hidden p-2 rounded-xl bg-[#141414] border border-[#ffffff15] text-[#eab308] hover:bg-[#1a1a1a] transition-all active:scale-95 cursor-pointer"
              title="Buscar"
              aria-label="Abrir buscador"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* BOTÓN DE DESCARGA PWA EN MÓVILES (OCULTO EN MODO PWA) */}
            {!isPwaMode && (
              <button
                onClick={handlePwaInstallClick}
                className="sm:hidden p-2 rounded-xl bg-[#141414] border border-[#ffffff15] text-[#eab308] hover:text-white hover:border-[#eab308]/40 hover:bg-[#1a1a1a] transition-all active:scale-95 cursor-pointer"
                title="Descargar Aplicación (PWA)"
              >
                <Download className="w-5 h-5" />
              </button>
            )}

            {/* NOTIFICACIONES EN MÓVILES CON VENTANA CENTRADA */}
            <div className="sm:hidden" ref={mobileNotificationsRef}>
              <button
                onClick={() => setMobileNotificationsOpen(!mobileNotificationsOpen)}
                className="p-2 rounded-xl bg-[#141414] border border-[#ffffff15] text-[#eab308] hover:bg-[#1a1a1a] transition-all active:scale-95 cursor-pointer relative"
                title="Notificaciones"
              >
                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'fill-amber-500/20' : ''}`} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-amber-500 text-black font-extrabold text-[10px] leading-none rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(234,179,8,0.6)]">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {mobileNotificationsOpen && (
                <>
                  {/* Backdrop para cerrar tocando fuera en móviles */}
                  <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 sm:hidden"
                    onClick={() => setMobileNotificationsOpen(false)}
                  />

                  {/* Ventana de notificaciones centrada horizontalmente */}
                  <div 
                    id="mobile-notifs-dropdown"
                    className="fixed left-3 right-3 top-[68px] max-w-sm mx-auto z-50 bg-[#101114]/98 border border-[#eab308]/40 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden animate-fade-in flex flex-col max-h-[75vh]"
                  >
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800/80 bg-[#14151a] shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                        <span className="text-xs font-black text-white uppercase tracking-wider">Notificaciones</span>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5">
                        {unreadCount > 0 && (
                          <button 
                            onClick={markAllAsRead}
                            className="text-[11px] text-[#eab308] hover:text-[#ca9a07] font-bold transition-colors cursor-pointer"
                          >
                            Marcar leídas
                          </button>
                        )}
                        <button
                          onClick={() => setMobileNotificationsOpen(false)}
                          className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title="Cerrar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="overflow-y-auto divide-y divide-zinc-800/60 flex-1">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500 text-xs">
                          No tienes notificaciones nuevas
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id}
                            onClick={() => {
                              handleNotificationClick(notif);
                              setMobileNotificationsOpen(false);
                            }}
                            className={`p-3.5 text-left transition-all hover:bg-zinc-800/40 cursor-pointer ${
                              !notif.is_read ? 'bg-amber-500/10 border-l-2 border-l-amber-500' : 'border-l-2 border-l-transparent'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-xs text-amber-400 font-bold">
                                {notif.title || 'Wikibot'}
                              </span>
                              <span className="text-[10px] text-zinc-500 shrink-0">
                                {formatNotifDate(notif.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 mt-1 leading-snug">
                              {renderNotificationBody(notif.body)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* BOTÓN DE PESTAÑAS PWA EN MÓVILES (AL LADO DERECHO DE LA CAMPANA - SOLO EN PWA) */}
            {isPwaMode && (
              <button
                onClick={openTabsSwitcher}
                className="sm:hidden p-2 min-w-[38px] h-[38px] rounded-xl bg-[#141414] border border-[#eab308]/40 text-[#eab308] hover:bg-[#1a1a1a] hover:border-[#eab308] transition-all active:scale-95 cursor-pointer flex items-center justify-center font-black relative shadow-[0_0_12px_rgba(234,179,8,0.15)]"
                title={`Pestañas abiertas (${pwaTabs.length})`}
                aria-label="Abrir gestor de pestañas"
              >
                <div className="w-5 h-5 rounded-md border-2 border-[#eab308] flex items-center justify-center text-[10px] font-black leading-none text-[#eab308]">
                  {pwaTabs.length}
                </div>
              </button>
            )}

            {/* BOTONES DE USUARIO Y CONFIGURACIÓN (DESKTOP) */}
            <div className="hidden md:flex items-center gap-3">
              {/* BOTÓN DE DESCARGA PWA EN ESCRITORIO (OCULTO EN MODO PWA) */}
              {!isPwaMode && (
                <button
                  onClick={handlePwaInstallClick}
                  className="p-2.5 rounded-xl bg-[#141414] border border-[#ffffff10] text-[#eab308] hover:text-white hover:border-[#eab308]/40 hover:bg-[#1a1a1a] transition-all cursor-pointer"
                  title="Descargar Aplicación (PWA)"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}

              {/* NOTIFICACIONES EN ESCRITORIO CON DROPDOWN REAL */}
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2.5 rounded-xl bg-[#141414] border border-[#ffffff10] text-[#eab308] hover:text-white hover:border-[#eab308]/40 hover:bg-[#1a1a1a] transition-all cursor-pointer relative"
                  title="Notificaciones"
                >
                  <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'fill-amber-500/20' : ''}`} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-amber-500 text-black font-extrabold text-[10px] leading-none rounded-full flex items-center justify-center shadow-[0_2px_8px_rgba(234,179,8,0.6)]">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div 
                    id="desktop-notifs-dropdown"
                    className="absolute right-0 mt-2 z-50 w-88 bg-[#101114]/95 border border-[#eab308]/40 backdrop-blur-md rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.85)] overflow-hidden animate-fade-in"
                  >
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800/80 bg-[#14151a]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                        <span className="text-xs font-black text-white uppercase tracking-wider">Notificaciones</span>
                      </div>
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllAsRead}
                          className="text-[11px] text-[#eab308] hover:text-[#ca9a07] font-bold transition-colors cursor-pointer"
                        >
                          Marcar todas como leídas
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/60">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500 text-xs">
                          No tienes notificaciones nuevas
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3.5 text-left transition-all hover:bg-zinc-800/40 cursor-pointer ${
                              !notif.is_read ? 'bg-amber-500/10 border-l-2 border-l-amber-500' : 'border-l-2 border-l-transparent'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-xs text-amber-400 font-bold">
                                {notif.title || 'Wikibot'}
                              </span>
                              <span className="text-[10px] text-zinc-500 shrink-0">
                                {formatNotifDate(notif.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 mt-1 leading-snug">
                              {renderNotificationBody(notif.body)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* BOTÓN DE PESTAÑAS EN ESCRITORIO (SOLO EN PWA) */}
              {isPwaMode && (
                <button
                  onClick={openTabsSwitcher}
                  className="p-2.5 rounded-xl bg-[#141414] border border-[#eab308]/30 text-[#eab308] hover:border-[#eab308] hover:bg-[#1a1a1a] transition-all cursor-pointer flex items-center gap-2 shadow-[0_0_12px_rgba(234,179,8,0.1)]"
                  title={`Pestañas abiertas (${pwaTabs.length})`}
                >
                  <div className="w-4 h-4 rounded border-2 border-[#eab308] flex items-center justify-center text-[9px] font-black leading-none">
                    {pwaTabs.length}
                  </div>
                  <span className="text-xs font-bold text-zinc-300 hidden lg:inline">Pestañas</span>
                </button>
              )}

              {user ? (
                <div className="flex items-center gap-2.5 relative" ref={settingsRef}>
                  <button
                    onClick={onGoToProfile}
                    className="flex items-center gap-2 bg-[#141414] border border-[#ffffff10] hover:border-[#eab308]/50 pl-2 pr-3 py-1.5 rounded-full hover:bg-[#1a1a1a] transition-all cursor-pointer text-left"
                    title="Ver mi perfil"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'Usuario'}
                        className="w-6 h-6 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#eab308] text-black flex items-center justify-center text-[10px] font-black">
                        {user.displayName ? user.displayName.substring(0, 2).toUpperCase() : 'UA'}
                      </div>
                    )}
                    <span className="text-xs font-bold text-white max-w-[110px] truncate">
                      {user.displayName}
                    </span>
                  </button>
                  
                  {/* BOTÓN TIPO CONFIGURACIÓN CON MENÚ DESPLEGABLE */}
                  <div className="relative">
                    <button
                      onClick={() => setSettingsOpen(!settingsOpen)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        settingsOpen
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                          : 'bg-[#141414] border-[#ffffff15] text-zinc-400 hover:text-white hover:border-[#eab308]/40'
                      }`}
                      title="Configuración de la cuenta"
                      aria-label="Abrir menú de configuración"
                    >
                      <Settings className={`w-4 h-4 transition-transform duration-300 ${settingsOpen ? 'rotate-90 text-amber-400' : ''}`} />
                    </button>

                    {/* POPUP / DROPDOWN DE CONFIGURACIÓN */}
                    {settingsOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-[#111111] border border-zinc-800 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-white/5 space-y-1">
                        
                        {/* Cabecera del Menú */}
                        <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Ajustes
                          </div>
                          <div className="text-xs font-bold text-white truncate">
                            {user.displayName || 'Mi Cuenta'}
                          </div>
                        </div>

                         {/* SELECCIÓN DE TEMA (3 OPCIONES) */}
                         <div className="px-3 py-2 border-b border-zinc-800/80 mb-1 space-y-2">
                           <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                             <Palette className="w-3.5 h-3.5 text-zinc-400" />
                             <span>Tema</span>
                           </div>
                           <div className="grid grid-cols-3 gap-1">
                             <button
                               onClick={() => setTheme('day')}
                               className={`px-1 py-1.5 rounded-lg text-[9px] font-extrabold transition-all cursor-pointer text-center border ${
                                 theme === 'day'
                                   ? 'bg-amber-500/20 border-amber-500/40 text-amber-500'
                                   : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                               }`}
                             >
                               ☀️ Día
                             </button>
                             <button
                               onClick={() => setTheme('night')}
                               className={`px-1 py-1.5 rounded-lg text-[9px] font-extrabold transition-all cursor-pointer text-center border ${
                                 theme === 'night'
                                   ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                                   : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                               }`}
                             >
                               🌙 Noche
                             </button>
                             <button
                               onClick={() => setTheme('iesppu')}
                               className={`px-1 py-1.5 rounded-lg text-[9px] font-extrabold transition-all cursor-pointer text-center border ${
                                 theme === 'iesppu'
                                   ? 'bg-sky-500/20 border-sky-500/40 text-sky-400'
                                   : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                               }`}
                             >
                               💙 IESPPU
                             </button>
                           </div>
                         </div>

                         {/* OPCIÓN: ESTUDIO / PERSONALIZADOR DE COLORES */}
                         <div className="px-1 py-1 border-b border-zinc-800/80 mb-1">
                           <button
                             type="button"
                             onClick={() => {
                               setSettingsOpen(false);
                               openThemeStudio();
                             }}
                             className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-amber-400 hover:bg-zinc-800/60 transition-all cursor-pointer text-left group"
                             title="Personalizar fondos, botones, textos y elementos de la interfaz a tu gusto"
                           >
                             <div className="flex items-center gap-2.5">
                               <Palette className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                               <span>Personalizar Colores</span>
                             </div>
                             <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-400 border border-amber-400/30 uppercase tracking-wider">
                               Estudio
                             </span>
                           </button>
                         </div>

                         {/* OPCIÓN: ESTUDIO DE TRANSICIONES */}
                         <div className="px-1 py-1 border-b border-zinc-800/80 mb-1">
                           <button
                             type="button"
                             onClick={() => {
                               setSettingsOpen(false);
                               setIsSettingsModalOpen(true);
                             }}
                             className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-amber-400 hover:bg-zinc-800/60 transition-all cursor-pointer text-left group"
                             title="Estudio de Transiciones (Avión, Vidrio, Cortinas, Papel Arrugado, Libro, Cubo 3D, Ave)"
                           >
                             <div className="flex items-center gap-2.5">
                               <Sparkles className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                               <span>Transición de Página</span>
                             </div>
                             <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-zinc-800 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                               <span>{activeTransitionDef.emoji}</span>
                               <span className="hidden sm:inline">{activeTransitionDef.name.split(' ')[0]}</span>
                             </span>
                           </button>
                         </div>

                         {/* OPCIÓN: NORMAS DE LA COMUNIDAD */}
                         <div className="px-1 py-1 border-b border-zinc-800/80 mb-1">
                           <button
                             type="button"
                             onClick={() => {
                               setSettingsOpen(false);
                               setGuidelinesModalOpen(true);
                             }}
                             className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-amber-400 hover:bg-zinc-800/60 transition-all cursor-pointer text-left group"
                           >
                             <ShieldCheck className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                             <span>Normas de la Comunidad</span>
                           </button>
                         </div>

                         {/* OPCIÓN: MODO PWA / PESTAÑAS */}
                         <div className="px-1 py-1 border-b border-zinc-800/80 mb-1">
                           <button
                             type="button"
                             onClick={() => {
                               togglePwaSimulation();
                             }}
                             className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-amber-400 hover:bg-zinc-800/60 transition-all cursor-pointer text-left group"
                             title="Activar o desactivar visualización de modo PWA y pestañas"
                           >
                             <div className="flex items-center gap-2.5">
                               <Smartphone className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                               <span>Modo PWA (Pestañas)</span>
                             </div>
                             <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                               isPwaMode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-500'
                             }`}>
                               {isPwaMode ? 'Activo' : 'Inactivo'}
                             </span>
                           </button>
                         </div>

                         {/* OPCIÓN: ACTIVAR NOTIFICACIONES */}
                         {permission !== 'granted' && permission !== 'unsupported' && (
                           <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                             <button
                               onClick={async () => {
                                 setSettingsOpen(false);
                                 await requestPermission();
                               }}
                               className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-black text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 hover:border-amber-500/40 transition-all cursor-pointer text-left shadow-[0_0_10px_rgba(234,179,8,0.05)] animate-pulse"
                             >
                               <BellRing className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                               <span>Activar Notificaciones</span>
                             </button>
                           </div>
                         )}

                        {/* OPCIÓN 2: CERRAR SESIÓN */}
                        {!user.isAnonymous && (
                          <button
                            onClick={() => {
                              setSettingsOpen(false);
                              logout();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-all cursor-pointer group text-left border-t border-zinc-800/60 mt-1"
                          >
                            <LogOut className="w-4 h-4 text-red-400 group-hover:-translate-x-0.5 transition-transform" />
                            <span>Cerrar Sesión</span>
                          </button>
                        )}

                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={onOpenJoinModal}
                  className="px-5 py-2 bg-[#eab308] text-black rounded-xl font-black text-xs tracking-widest hover:bg-[#d9a307] transition-all active:scale-95 cursor-pointer shadow-sm uppercase"
                >
                  UNIRSE
                </button>
              )}
            </div>

            {/* MENÚ MÓVIL TOGGLE */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl bg-[#141414] border border-[#ffffff15] text-zinc-300 hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                aria-label="Abrir Menú"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>

        {/* 4. MENÚ DESPLEGABLE MÓVIL */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0d0d0d] border-b border-[#ffffff10] px-6 py-5 space-y-4 animate-in slide-in-from-top-4 duration-200">
            {user && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onGoToProfile) onGoToProfile();
                }}
                className="w-full text-left flex items-center gap-3 bg-[#141414] border border-[#ffffff10] hover:border-[#eab308]/50 p-3 rounded-xl hover:bg-[#1a1a1a] transition-all cursor-pointer"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Usuario'}
                    className="w-10 h-10 rounded-full object-cover animate-in fade-in"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#eab308] text-black flex items-center justify-center text-xs font-black">
                    {user.displayName ? user.displayName.substring(0, 2).toUpperCase() : 'UA'}
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-white">{user.displayName}</div>
                  <div className="text-[10px] text-zinc-500 font-medium truncate max-w-[200px]">
                    {user.email || 'Acceso Anónimo'}
                  </div>
                </div>
              </button>
            )}

            {/* SELECCIÓN DE TEMA EN MÓVIL (LOS 3 TEMAS) */}
            <div className="p-3.5 rounded-2xl border border-zinc-800/80 bg-[#141414] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#eab308]" />
                  <span>Cambiar Tema</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-medium">3 Opciones</span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setTheme('day')}
                  className={`py-2 px-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border ${
                    theme === 'day'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-sm'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-sm">☀️</span>
                  <span className="text-[10px]">Modo Día</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('night')}
                  className={`py-2 px-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border ${
                    theme === 'night'
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400 shadow-sm'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-sm">🌙</span>
                  <span className="text-[10px]">Modo Noche</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('iesppu')}
                  className={`py-2 px-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border ${
                    theme === 'iesppu'
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-400 shadow-sm'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-sm">💙</span>
                  <span className="text-[10px]">IESPPU</span>
                </button>
              </div>
            </div>

            {/* PERSONALIZAR COLORES EN MÓVIL */}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openThemeStudio();
              }}
              className="w-full py-3 px-4 rounded-xl border border-amber-500/30 text-zinc-100 font-bold text-xs tracking-wider bg-[#141414] hover:bg-zinc-800/80 flex items-center justify-between transition-all cursor-pointer shadow-[0_0_12px_rgba(234,179,8,0.08)]"
            >
              <div className="flex items-center gap-2.5">
                <Palette className="w-4 h-4 text-amber-400" />
                <span>Personalizar Colores</span>
              </div>
              <span className="text-[10px] text-amber-400 font-black bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20 uppercase tracking-wider">
                Estudio
              </span>
            </button>

            {/* TRANSICIONES ENTRE PÁGINAS EN MÓVIL */}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setIsSettingsModalOpen(true);
              }}
              className="w-full py-3 px-4 rounded-xl border border-zinc-800 hover:border-amber-500/40 text-zinc-100 font-bold text-xs tracking-wider bg-[#141414] hover:bg-zinc-800/80 flex items-center justify-between transition-all cursor-pointer shadow-[0_0_12px_rgba(234,179,8,0.06)]"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>Transición de Página</span>
              </div>
              <span className="text-[10px] text-blue-300 font-black bg-zinc-800 px-2 py-0.5 rounded-md border border-blue-500/30 flex items-center gap-1">
                <span>{activeTransitionDef.emoji}</span>
                <span>{activeTransitionDef.name}</span>
              </span>
            </button>

            {/* NORMAS DE LA COMUNIDAD EN MÓVIL */}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setGuidelinesModalOpen(true);
              }}
              className="w-full py-3 px-4 rounded-xl border border-zinc-800 text-zinc-200 font-bold text-xs tracking-wider bg-[#141414] hover:bg-zinc-800/80 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Normas de la Comunidad</span>
            </button>

            {/* GESTOR DE PESTAÑAS EN MÓVIL (SI ES PWA) */}
            {isPwaMode && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openTabsSwitcher();
                }}
                className="w-full py-3 px-4 rounded-xl border border-amber-500/40 text-[#eab308] font-bold text-xs tracking-wider bg-amber-500/10 hover:bg-amber-500/15 flex items-center justify-between transition-all cursor-pointer shadow-[0_0_12px_rgba(234,179,8,0.1)]"
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>Pestañas de la App</span>
                </div>
                <span className="w-6 h-6 rounded-lg border-2 border-amber-400 flex items-center justify-center text-[10px] font-black text-amber-400">
                  {pwaTabs.length}
                </span>
              </button>
            )}

            {/* ACTIVAR NOTIFICACIONES EN MÓVIL */}
            {permission !== 'granted' && permission !== 'unsupported' && (
              <button
                type="button"
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await requestPermission();
                }}
                className="w-full py-3 px-4 rounded-xl border border-amber-500/30 text-amber-400 font-extrabold text-xs tracking-wider uppercase bg-amber-500/10 hover:bg-amber-500/15 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(234,179,8,0.05)] animate-pulse"
              >
                <BellRing className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>Activar Notificaciones</span>
              </button>
            )}

            {user ? (
              !user.isAnonymous && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-red-500/30 text-red-400 font-semibold text-xs tracking-widest uppercase bg-red-950/20 hover:bg-red-950/40 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>CERRAR SESIÓN</span>
                </button>
              )
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenJoinModal();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#eab308] text-black font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 shadow-sm"
              >
                <UserPlus className="w-4 h-4 text-black" />
                <span>UNIRSE</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* 5. VENTANA MODAL FLOTANTE DE BÚSQUEDA EN CELULARES (CON AUTOCOMPLETADO Y TOLERANCIA) */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col p-4 sm:hidden animate-in fade-in duration-200">
          
          <div className="bg-[#0d0d0d] border border-zinc-800 rounded-3xl p-5 shadow-[0_15px_50px_rgba(0,0,0,0.9)] space-y-4 max-w-md w-full mx-auto my-auto animate-in zoom-in-95 duration-200">
            
            {/* Header del modal */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-2 text-white font-black text-sm uppercase tracking-wider">
                <Search className="w-4 h-4 text-[#eab308]" />
                <span>Buscar en Starryz 5</span>
              </div>
              <button
                onClick={() => setMobileSearchOpen(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-[#141414] border border-zinc-800 cursor-pointer"
                aria-label="Cerrar buscador"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Buscador Autocompletado Móvil */}
            <div className="w-full">
              <AutocompleteSearchBar
                value={searchQuery}
                placeholder="Escribe profesores, centros..."
                autoFocus={true}
                onSearch={handleSearchSubmit}
                onSelectSuggestion={handleSuggestionSelect}
                onClose={() => setMobileSearchOpen(false)}
                inputClassName="py-3 text-base border-2 border-[#eab308]/70"
              />
            </div>

            {/* Accesos rápidos sugeridos */}
            <div className="pt-2">
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2.5">
                Búsquedas sugeridas:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickCategorySearch('Universidad')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
                >
                  <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                  <span>Universidades</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickCategorySearch('Profesor')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#eab308]" />
                  <span>Profesores</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickCategorySearch('Instituto')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Institutos</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickCategorySearch('Colegio')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Colegios</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* MODAL DE DETALLE DE NOTIFICACIÓN PROFESIONAL */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl bg-[#0d0e12] border border-zinc-800/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header del Modal */}
            <div className="px-5 py-4 border-b border-zinc-800/80 bg-[#111217] shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse" />
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                    Detalle de Confesión
                  </h3>
                </div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setShowDetailModal(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Subtítulo: Centro Educativo */}
              <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  {modalCenterInfo?.name || 'Centro Educativo'}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400 font-normal">
                  {modalCenterInfo?.type 
                    ? (modalCenterInfo.type.charAt(0).toUpperCase() + modalCenterInfo.type.slice(1)) 
                    : 'Campus Principal'}
                </span>
              </div>
            </div>

            {/* Contenido del Modal (Scrollable) */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {modalLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-9 h-9 border-3 border-[#eab308] border-t-transparent rounded-full animate-spin" />
                  <span className="text-zinc-400 text-xs tracking-wider font-medium">Cargando confesión y respuestas...</span>
                </div>
              ) : modalConfession ? (
                <div className="space-y-6">
                  
                  {/* Confesión Original Card */}
                  {(() => {
                    const myConfessionIds = getMyConfessionIds();
                    const isMyConf = !!(((user?.uid && modalConfession.firebase_uid === user.uid) || myConfessionIds.includes(modalConfession.id)));
                    const confAuthor = getDisplayAuthorName(modalConfession.author_name, modalConfession.firebase_uid, modalConfession.is_anonymous);

                    return (
                      <div className={`p-5 sm:p-6 rounded-2xl shadow-lg space-y-4 relative transition-all ${
                        isMyConf
                          ? 'bg-[#141209] border-2 border-[#eab308] shadow-[0_0_25px_rgba(234,179,8,0.18)] ring-1 ring-[#eab308]/40'
                          : 'bg-[#14151a] border border-zinc-800/90'
                      }`}>
                        
                        {/* Header de la confesión */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className="relative shrink-0">
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shadow-md ${
                                isMyConf
                                  ? 'bg-[#eab308] text-black'
                                  : 'bg-[#eab308] text-black'
                              }`}>
                                {confAuthor.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#14151a]" />
                            </div>

                            {/* Autor y Fecha */}
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className={`text-sm font-bold ${isMyConf ? 'text-[#eab308]' : 'text-white'}`}>
                                  {confAuthor}
                                </h4>
                                {isMyConf && (
                                  <span className="bg-[#eab308] text-black text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm">
                                    Tu Confesión
                                  </span>
                                )}
                                <span className="bg-zinc-800 text-zinc-400 border border-zinc-700/60 text-[10px] px-2 py-0.5 rounded font-medium">
                                  Autor
                                </span>
                              </div>
                              <span className="text-xs text-zinc-400">
                                {formatFullDateWithRelative(modalConfession.created_at).fullDate}
                                {formatFullDateWithRelative(modalConfession.created_at).relative && (
                                  <> • {formatFullDateWithRelative(modalConfession.created_at).relative}</>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Badge de Categoría */}
                          {(() => {
                            const badge = getCategoryBadge(modalConfession.category);
                            return (
                              <div className={`text-[11px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-lg border flex items-center gap-1.5 shrink-0 ${badge.colorClass}`}>
                                <span>{badge.icon}</span>
                                <span>{badge.label}</span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Contenido del texto de la confesión */}
                        <p className="text-zinc-100 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-normal py-1">
                          {modalConfession.content}
                        </p>

                        {/* Stats Footer */}
                        <div className="flex items-center gap-5 pt-3 border-t border-zinc-800/80 text-xs text-zinc-400">
                          <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                            <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{modalConfession.comments_count || modalComments.length || 1} {modalConfession.comments_count === 1 ? 'respuesta' : 'respuestas'}</span>
                          </div>
                        </div>

                      </div>
                    );
                  })()}

                  {/* Respuestas y Conversación (2 Niveles) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-[#eab308] uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-[#eab308]" />
                        <span>Conversación & Respuestas</span>
                        <span className="text-[10px] bg-[#eab308]/20 text-[#eab308] border border-[#eab308]/30 px-2 py-0.5 rounded-full font-bold">
                          {modalComments.length}
                        </span>
                      </h4>
                    </div>

                    {modalComments.length === 0 ? (
                      <div className="p-6 rounded-xl bg-[#121317] border border-zinc-800/60 text-center">
                        <p className="text-zinc-500 text-xs italic">Aún no hay respuestas. Sé el primero en iniciar la conversación.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                        {(() => {
                          const commentIds = new Set(modalComments.map((c: any) => c.id));
                          const level1Comments = modalComments.filter((c: any) => !c.parent_id || !commentIds.has(c.parent_id));
                          const getReplies = (parentId: string) => modalComments.filter((c: any) => c.parent_id === parentId);

                          return level1Comments.map((comment: any) => {
                            const dateInfo = formatFullDateWithRelative(comment.created_at);
                            const isTarget = targetCommentId && comment.id === targetCommentId;
                            const replies = getReplies(comment.id);
                            const hasReplies = replies.length > 0;
                            const isExpanded = !!modalExpandedReplies[comment.id];
                            const isMyComment = !!(user && comment.firebase_uid === user.uid);
                            const commentAuthor = getDisplayAuthorName(comment.author_name, comment.firebase_uid, comment.is_anonymous);

                            return (
                              <div 
                                key={comment.id}
                                className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                                  isTarget 
                                    ? 'bg-[#1c1a14] border-amber-500/70 shadow-lg ring-1 ring-amber-500/30' 
                                    : isMyComment
                                      ? 'bg-[#16140b] border-2 border-[#eab308]/80 shadow-[0_0_20px_rgba(234,179,8,0.12)] ring-1 ring-[#eab308]/30'
                                      : 'bg-[#16171e] border-zinc-800/90 hover:border-zinc-700'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  {/* Avatar */}
                                  <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[11px] shrink-0 shadow-sm mt-0.5 bg-zinc-800/90 text-amber-400 border border-amber-500/20">
                                    {commentAuthor.substring(0, 2).toUpperCase()}
                                  </div>

                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-[#eab308]">
                                          {commentAuthor}
                                        </span>

                                        {isMyComment && (
                                          <span className="bg-[#eab308] text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm">
                                            Tú
                                          </span>
                                        )}

                                        {isTarget && (
                                          <span className="bg-amber-500 text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm">
                                            Notificada
                                          </span>
                                        )}

                                        <span className="text-[10px] text-zinc-400">
                                          {dateInfo.fullDate}
                                          {dateInfo.relative && <> • {dateInfo.relative}</>}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        {/* Botón Responder Nivel 1 */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setModalReplyingTo({ root_id: comment.id, author_name: commentAuthor });
                                            setModalExpandedReplies(prev => ({ ...prev, [comment.id]: true }));
                                            setTimeout(() => modalReplyInputRef.current?.focus(), 50);
                                          }}
                                          className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 px-2 py-0.5 rounded-md transition-all cursor-pointer"
                                          title={`Responder a ${commentAuthor}`}
                                        >
                                          <CornerDownRight className="w-3 h-3" />
                                          <span>Responder</span>
                                        </button>

                                        {isMyComment && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteModalCommentClick(comment.id)}
                                            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                                            title="Eliminar mi respuesta"
                                          >
                                            <Trash className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <p className="text-xs sm:text-[13px] text-zinc-100 font-medium leading-relaxed whitespace-pre-wrap pt-0.5">
                                      {comment.content}
                                    </p>
                                  </div>
                                </div>

                                {/* Botón Ver Respuestas / Ocultar Respuestas (Nivel 2) */}
                                {hasReplies && (
                                  <div className="pt-1 border-t border-zinc-800/60">
                                    <button
                                      type="button"
                                      onClick={() => setModalExpandedReplies(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                                      className="flex items-center gap-1.5 text-xs font-bold text-[#eab308] hover:text-[#facc15] py-0.5 cursor-pointer transition-colors"
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
                                  <div className="space-y-2 pl-3 sm:pl-4 border-l-2 border-amber-500/30 pt-1">
                                    {replies.map((subComment: any) => {
                                      const subDateInfo = formatFullDateWithRelative(subComment.created_at);
                                      const isSubTarget = targetCommentId && subComment.id === targetCommentId;
                                      const isMySubComment = !!(user && subComment.firebase_uid === user.uid);
                                      const subCommentAuthor = getDisplayAuthorName(subComment.author_name, subComment.firebase_uid, subComment.is_anonymous);
                                      const repliedToDisplayName = getDisplayAuthorName(subComment.reply_to_author || comment.author_name, null, false);

                                      return (
                                        <div
                                          key={subComment.id}
                                          className={`p-2.5 rounded-xl border transition-all ${
                                            isSubTarget
                                              ? 'bg-[#1e1c14] border-amber-500/70 ring-1 ring-amber-500/30'
                                              : isMySubComment
                                                ? 'bg-[#15130b] border-2 border-[#eab308]/70 shadow-sm ring-1 ring-[#eab308]/20'
                                                : 'bg-[#0f1015] border-zinc-800/80 hover:border-zinc-700'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-extrabold text-xs text-white">
                                                {subCommentAuthor}
                                              </span>

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

                                              {isSubTarget && (
                                                <span className="bg-amber-500 text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm">
                                                  Notificada
                                                </span>
                                              )}

                                              <span className="text-[10px] text-zinc-400">
                                                {subDateInfo.fullDate}
                                                {subDateInfo.relative && <> • {subDateInfo.relative}</>}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-1">
                                              {/* Botón Responder Nivel 2 */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setModalReplyingTo({ root_id: comment.id, author_name: subCommentAuthor });
                                                  setModalExpandedReplies(prev => ({ ...prev, [comment.id]: true }));
                                                  setTimeout(() => modalReplyInputRef.current?.focus(), 50);
                                                }}
                                                className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 px-1.5 py-0.5 rounded transition-all cursor-pointer"
                                                title={`Responder a ${subCommentAuthor}`}
                                              >
                                                <CornerDownRight className="w-2.5 h-2.5" />
                                                <span>Responder</span>
                                              </button>

                                              {isMySubComment && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteModalCommentClick(subComment.id)}
                                                  className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                  title="Eliminar mi respuesta"
                                                >
                                                  <Trash className="w-3 h-3" />
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          <p className="text-xs text-zinc-200 leading-relaxed font-medium whitespace-pre-wrap pt-1">
                                            {subComment.content}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}

                    {/* Formulario para Responder / Conversar */}
                    <form onSubmit={handleSendModalReply} className="pt-3 border-t border-zinc-800/80 space-y-2">
                      {modalReplyingTo && (
                        <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs">
                          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                            <CornerDownRight className="w-3.5 h-3.5" />
                            <span>En respuesta a <strong className="text-white">@{modalReplyingTo.author_name}</strong></span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setModalReplyingTo(null)}
                            className="text-zinc-400 hover:text-white p-0.5 rounded cursor-pointer"
                            title="Cancelar respuesta directa"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {modalReplyError && (
                        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 p-2 rounded-xl">
                          {modalReplyError}
                        </p>
                      )}

                      <div className="flex items-end gap-2">
                        <textarea
                          ref={modalReplyInputRef}
                          value={modalReplyText}
                          onChange={(e) => setModalReplyText(e.target.value.slice(0, 500))}
                          maxLength={500}
                          rows={2}
                          placeholder={modalReplyingTo ? `Escribe tu respuesta para @${modalReplyingTo.author_name}...` : "Escribe tu respuesta a esta confesión..."}
                          className="flex-1 bg-[#121318] border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#eab308] transition-colors resize-none leading-relaxed"
                        />
                        <button
                          type="submit"
                          disabled={submittingModalReply || !modalReplyText.trim()}
                          className="px-4 py-3 bg-[#eab308] hover:bg-[#d9a307] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {submittingModalReply ? (
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5 fill-current" />
                              <span className="hidden sm:inline">Enviar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>

                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  No se pudo cargar la confesión original o ha sido eliminada por su creador.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-5 py-4 bg-[#111217] border-t border-zinc-800/80 shrink-0">
              <button 
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2.5 bg-[#eab308] hover:bg-[#d9a307] text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Entendido
              </button>
            </div>

            {/* Subventana de confirmación para borrar comentario */}
            {commentToDelete && (
              <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 rounded-3xl">
                <div className="bg-[#111217] border border-zinc-800 p-6 rounded-2xl w-full max-w-[290px] text-center space-y-4 shadow-2xl animate-scaleUp">
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
                      onClick={confirmDeleteModalComment}
                      className="flex-1 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      Sí, eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
      {/* MODAL DE NORMAS DE LA COMUNIDAD */}
      <CommunityGuidelinesModal
        isOpen={guidelinesModalOpen}
        onClose={() => setGuidelinesModalOpen(false)}
      />
    </>
  );
}
