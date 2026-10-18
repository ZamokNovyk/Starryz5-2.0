import React, { useState, useEffect } from 'react';
import { applyUserQuery } from '../lib/supabaseHelper';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { getAdminDashboardMetrics, AdminDashboardData } from '@/src/lib/admin';
import { EducationalCenter, getEducationalCenters, deleteEducationalCenter } from '@/src/lib/centers';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Building2,
  School,
  GraduationCap,
  Sparkles,
  Link2,
  UserX,
  UserCheck,
  ArrowLeft,
  RefreshCw,
  Calendar,
  Layers,
  Award,
  AlertCircle,
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle2,
  X,
  Bell,
  BellRing,
  Globe,
  Activity,
  ExternalLink,
  Percent
} from 'lucide-react';

interface AdminDashboardProps {
  onBack: () => void;
  onNavigate?: (path: string) => void;
}

export default function AdminDashboard({ onBack, onNavigate }: AdminDashboardProps) {
  const { user } = useAuth();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [metrics, setMetrics] = useState<AdminDashboardData | null>(null);

  // Centers Management State
  const [centers, setCenters] = useState<EducationalCenter[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [centerSearchQuery, setCenterSearchQuery] = useState('');
  const [centerToDelete, setCenterToDelete] = useState<EducationalCenter | null>(null);
  const [isDeletingCenter, setIsDeletingCenter] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 1. Verificación estricta de seguridad y rol
  useEffect(() => {
    async function verifyAdminRole() {
      if (!user) {
        setIsAdmin(false);
        setCheckingRole(false);
        setLoadingMetrics(false);
        return;
      }

      try {
        setCheckingRole(true);
        let query = supabase.from('users').select('role');
        query = applyUserQuery(query, user);
        const { data, error } = await query.maybeSingle();

        if (!error && data?.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error al verificar permisos de administrador:', err);
        setIsAdmin(false);
      } finally {
        setCheckingRole(false);
      }
    }

    verifyAdminRole();
  }, [user]);

  // 2. Cargar métricas y centros en tiempo real si es Admin
  const loadCenters = async () => {
    try {
      setLoadingCenters(true);
      const data = await getEducationalCenters();
      setCenters(data);
    } catch (err) {
      console.error('Error al cargar centros educativos:', err);
    } finally {
      setLoadingCenters(false);
    }
  };

  const loadMetrics = async () => {
    try {
      setLoadingMetrics(true);
      const data = await getAdminDashboardMetrics();
      setMetrics(data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error al cargar métricas:', err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadMetrics();
      loadCenters();
    }
  }, [isAdmin]);

  const confirmDeleteCenter = async () => {
    if (!centerToDelete) return;
    try {
      setIsDeletingCenter(true);
      await deleteEducationalCenter(centerToDelete.id);
      setCenters(prev => prev.filter(c => c.id !== centerToDelete.id));
      setToastMessage('Centro educativo y todo su contenido eliminado correctamente');
      setTimeout(() => setToastMessage(null), 4000);
      setCenterToDelete(null);
      loadMetrics();
    } catch (err: any) {
      console.error('Error al eliminar centro:', err);
      setToastMessage('Error al eliminar el centro: ' + (err.message || 'Error de red'));
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsDeletingCenter(false);
    }
  };

  const filteredCenters = (() => {
    if (!centerSearchQuery.trim()) return [];
    const q = centerSearchQuery.toLowerCase().trim();
    return centers.filter((center) => {
      const nameMatch = center.name.toLowerCase().includes(q);
      const typeMatch = center.type ? center.type.toLowerCase().includes(q) : false;
      return nameMatch || typeMatch;
    });
  })();

  // Pantalla de comprobación de permisos
  if (checkingRole) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-4">
        <div className="w-12 h-12 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-black uppercase tracking-widest text-amber-400 font-mono">
          Verificando credenciales de Administrador...
        </p>
      </div>
    );
  }

  // Pantalla de Acceso Denegado (Seguridad y Protección)
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
        <div className="inline-flex p-4 rounded-3xl bg-red-950/40 border border-red-500/30 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            Acceso Restringido (403)
          </h2>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Esta sección es exclusiva para administradores de Starryz 5 con el rol <span className="text-amber-400 font-mono font-bold">admin</span> verificado en la base de datos de Supabase.
          </p>
        </div>

        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Inicio</span>
        </button>
      </div>
    );
  }

  const userMetrics = metrics?.userMetrics || {
    totalUsers: 0,
    directGoogle: 0,
    activeAnonymous: 0,
    linkedAnonymous: 0,
    adminUsers: 0
  };

  const centerMetrics = metrics?.centerMetrics || {
    totalCenters: 0,
    colegios: 0,
    institutos: 0,
    universidades: 0
  };

  const notificationMetrics = metrics?.notificationMetrics || {
    activePushUsers: 0,
    adoptionPercentage: 0,
    unregisteredCount: 0
  };

  const totalUsers = userMetrics.totalUsers || 1;
  const directGooglePct = Math.round((userMetrics.directGoogle / totalUsers) * 100) || 0;
  const activeAnonPct = Math.round((userMetrics.activeAnonymous / totalUsers) * 100) || 0;
  const linkedAnonPct = Math.round((userMetrics.linkedAnonymous / totalUsers) * 100) || 0;

  const totalCenters = centerMetrics.totalCenters || 1;
  const colegiosPct = Math.round((centerMetrics.colegios / totalCenters) * 100) || 0;
  const institutosPct = Math.round((centerMetrics.institutos / totalCenters) * 100) || 0;
  const universidadesPct = Math.round((centerMetrics.universidades / totalCenters) * 100) || 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-8 animate-in fade-in duration-300">
      
      {/* 1. Header del Panel de Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div className="space-y-1.5">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer group mb-1"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>VOLVER AL PERFIL</span>
          </button>
          
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-2.5">
              <ShieldCheck className="w-7 h-7 text-amber-400 stroke-[2.5]" />
              <span>PANEL DE CONTROL ADMIN</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-black uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.25)]">
              ADMIN VERIFICADO
            </span>
            {metrics?.source === 'platform_stats' && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                ⚡ platform_stats
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400">
            Monitor de telemetría, adopción de notificaciones push, Google Analytics 4 y métricas de cuentas en Supabase.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadMetrics}
            disabled={loadingMetrics}
            className="px-4 py-2.5 rounded-xl bg-[#141414] hover:bg-[#1a1a1a] border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:border-amber-500/60 active:scale-95 disabled:opacity-50"
            title="Recargar métricas en vivo"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? 'animate-spin text-amber-400' : ''}`} />
            <span>{loadingMetrics ? 'ACTUALIZANDO...' : 'RECARGAR'}</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN 1.5: SEGUIMIENTO DE NOTIFICACIONES PUSH (FCM) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-white uppercase tracking-wider">
              Adopción de Notificaciones Push (FCM)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            Tabla: <span className="text-zinc-200 font-bold">user_fcm_tokens</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Card 1: Usuarios con Notificaciones Activas */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-amber-500/30 space-y-3 relative overflow-hidden shadow-[0_0_20px_rgba(245,158,11,0.08)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Notificaciones Activas</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <BellRing className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-white tracking-tight font-mono">
              {notificationMetrics.activePushUsers}
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Usuarios con token FCM registrado que reciben notificaciones internas y externas.
            </p>
          </div>

          {/* Card 2: Tasa de Adopción */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-emerald-500/30 space-y-3 relative overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.08)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Tasa de Adopción</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-emerald-400 tracking-tight flex items-baseline gap-1 font-mono">
              <span>{notificationMetrics.adoptionPercentage}%</span>
              <span className="text-xs font-normal text-zinc-400">del total</span>
            </div>
            
            {/* Barra de progreso */}
            <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, notificationMetrics.adoptionPercentage))}%` }}
              />
            </div>
          </div>

          {/* Card 3: Sin Notificaciones */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-zinc-800 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Pendientes / Sin Activar</span>
              <div className="p-2 rounded-xl bg-zinc-800 text-zinc-400 border border-zinc-700">
                <Bell className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-zinc-300 tracking-tight font-mono">
              {notificationMetrics.unregisteredCount}
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Aparecerá el aviso contextual tras su primera acción (reacción, confesión, reseña).
            </p>
          </div>

        </div>

        {/* Explicación de la estrategia */}
        <div className="p-4 rounded-2xl bg-[#141414] border border-[#ffffff0a] flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300 space-y-1">
            <p className="font-bold text-white uppercase tracking-tight">
              Estrategia Contextual Activa (Sin intrusión al inicio):
            </p>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              El modal explicativo no interrumpe al entrar a la web. Se muestra automáticamente cuando el usuario interactúa (publicar confesión, responder a comentarios o calificar a un profesor), garantizando mayor conversión voluntaria.
            </p>
          </div>
        </div>
      </section>

      {/* SECCIÓN 1.6: GOOGLE ANALYTICS 4 & TASA DE REBOTE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-white uppercase tracking-wider">
              Google Analytics 4 & Tasa de Rebote (Bounce Rate)
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-mono font-bold">
            ID: G-0FL5ZVJG8C
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card GA4 Status */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-blue-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-black text-white uppercase tracking-wider">GA4 Conectado y Activo</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">gtag.js</span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              El script oficial de Google Tag Manager con ID <code className="text-amber-400 font-mono font-bold">G-0FL5ZVJG8C</code> está insertado en el <code className="text-zinc-400 font-mono">&lt;head&gt;</code> de Starryz 5.
            </p>

            <a
              href="https://analytics.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              <span>Abrir Panel de Google Analytics</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Card Cómo interpretar la Tasa de Rebote en GA4 */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-zinc-800 space-y-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              ¿Cómo calcula GA4 la Tasa de Rebote?
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              En Google Analytics 4, la <strong className="text-zinc-200">Tasa de Rebote (Bounce Rate)</strong> es el porcentaje de sesiones que <em>NO</em> fueron de interacción:
            </p>
            <div className="p-3 rounded-xl bg-[#141414] border border-zinc-800 font-mono text-[11px] text-amber-300">
              Tasa de Rebote = 100% - Tasa de Interacción (Engagement Rate)
            </div>
            <p className="text-[10px] text-zinc-500 leading-normal">
              Una sesión cuenta como interacción si el usuario permanece más de 10 segundos, realiza 2 o más páginas vistas, o dispara un evento de conversión.
            </p>
          </div>

        </div>
      </section>

      {/* 2. MÓDULO DE USUARIOS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-white uppercase tracking-wider">
              Módulo de Usuarios y Proveedores Auth
            </h2>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">
            Última sincronización: {lastRefreshed.toLocaleTimeString('es-ES')}
          </span>
        </div>

        {/* Grid de 4 Cards de Usuarios */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Directo con Google */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-emerald-500/20 relative overflow-hidden shadow-lg group hover:border-emerald-500/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <UserCheck className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase">
                {directGooglePct}%
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-white tracking-tight font-mono">
                {userMetrics.directGoogle}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Directo con Google
              </div>
              <p className="text-[11px] text-zinc-500 leading-tight">
                Registrados directamente vía Google OAuth sin etapa anónima previa.
              </p>
            </div>
          </div>

          {/* Card 2: Anónimos Activos (Solo Anónimos) */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-amber-500/20 relative overflow-hidden shadow-lg group hover:border-amber-500/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <UserX className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase">
                {activeAnonPct}%
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-white tracking-tight font-mono">
                {userMetrics.activeAnonymous}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Anónimos Activos
              </div>
              <p className="text-[11px] text-zinc-500 leading-tight">
                Usuarios temporales que aún no han vinculado su cuenta a Google.
              </p>
            </div>
          </div>

          {/* Card 3: Anónimos Migrados a Google */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-blue-500/20 relative overflow-hidden shadow-lg group hover:border-blue-500/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Link2 className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase">
                {linkedAnonPct}%
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-white tracking-tight font-mono">
                {userMetrics.linkedAnonymous}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Anónimos Vinculados
              </div>
              <p className="text-[11px] text-zinc-500 leading-tight">
                Migraron de sesión anónima a Google conservando su historial y votos.
              </p>
            </div>
          </div>

          {/* Card 4: Total Global de Usuarios */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-amber-400/40 relative overflow-hidden shadow-[0_0_25px_rgba(245,158,11,0.1)] group hover:border-amber-400 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-amber-400/15 text-amber-300 border border-amber-400/30">
                <Users className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-400 text-black text-[10px] font-black uppercase">
                GLOBAL
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-amber-300 tracking-tight font-mono">
                {userMetrics.totalUsers}
              </div>
              <div className="text-xs font-bold text-white uppercase tracking-wider">
                Total de Usuarios
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                Total de registros sincronizados en la tabla <code className="text-amber-300">users</code> de Supabase.
              </p>
            </div>
          </div>

        </div>

        {/* Barra de Distribución Visual de Usuarios */}
        <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-zinc-300 uppercase tracking-wider">Distribución de Proveedores</span>
            <span className="text-zinc-500 font-mono">{userMetrics.totalUsers} cuentas totales</span>
          </div>

          <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden flex gap-1 p-0.5 border border-zinc-800">
            <div 
              style={{ width: `${directGooglePct}%` }} 
              className="bg-emerald-500 rounded-full transition-all duration-500" 
              title={`Directo con Google: ${userMetrics.directGoogle} (${directGooglePct}%)`}
            />
            <div 
              style={{ width: `${activeAnonPct}%` }} 
              className="bg-amber-500 rounded-full transition-all duration-500" 
              title={`Anónimos Activos: ${userMetrics.activeAnonymous} (${activeAnonPct}%)`}
            />
            <div 
              style={{ width: `${linkedAnonPct}%` }} 
              className="bg-blue-500 rounded-full transition-all duration-500" 
              title={`Anónimos Vinculados: ${userMetrics.linkedAnonymous} (${linkedAnonPct}%)`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-[11px]">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-zinc-400">Directo Google: <strong className="text-white font-mono">{userMetrics.directGoogle}</strong> ({directGooglePct}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-zinc-400">Anónimos Activos: <strong className="text-white font-mono">{userMetrics.activeAnonymous}</strong> ({activeAnonPct}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-zinc-400">Anónimos Vinculados: <strong className="text-white font-mono">{userMetrics.linkedAnonymous}</strong> ({linkedAnonPct}%)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. MÓDULO DE CENTROS EDUCATIVOS */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-black text-white uppercase tracking-wider">
            Módulo de Centros Educativos
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Total Centros */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-amber-400/40 shadow-md">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                <School className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase">
                CAMPUS
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-white tracking-tight font-mono">
                {centerMetrics.totalCenters}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Total de Centros
              </div>
              <p className="text-[11px] text-zinc-500">
                Instituciones registradas en la plataforma.
              </p>
            </div>
          </div>

          {/* Colegios */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-zinc-800/80 hover:border-zinc-700 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase">
                {colegiosPct}%
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-purple-400 tracking-tight font-mono">
                {centerMetrics.colegios}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Colegios
              </div>
              <p className="text-[11px] text-zinc-500">
                Educación primaria y secundaria.
              </p>
            </div>
          </div>

          {/* Institutos */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-zinc-800/80 hover:border-zinc-700 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase">
                {institutosPct}%
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-cyan-400 tracking-tight font-mono">
                {centerMetrics.institutos}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Institutos
              </div>
              <p className="text-[11px] text-zinc-500">
                Educación superior técnica y especializada.
              </p>
            </div>
          </div>

          {/* Universidades */}
          <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-zinc-800/80 hover:border-zinc-700 transition-all">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Award className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase">
                {universidadesPct}%
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-black text-amber-400 tracking-tight font-mono">
                {centerMetrics.universidades}
              </div>
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Universidades
              </div>
              <p className="text-[11px] text-zinc-500">
                Educación superior universitaria y postgrado.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 3.5. SECCIÓN: GESTIÓN DE CENTROS EDUCATIVOS (ELIMINACIÓN DE CENTROS) */}
      <section className="space-y-4 pt-6 border-t border-zinc-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-white uppercase tracking-wider">
              Gestión de Centros Educativos
            </h2>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            Mostrando {filteredCenters.length} de {centers.length} instituciones
          </span>
        </div>

        {/* Buscador Dedicado Únicamente para Centros Educativos */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={centerSearchQuery}
            onChange={(e) => setCenterSearchQuery(e.target.value)}
            placeholder="Buscar centro educativo por nombre o tipo (universidad, instituto, colegio)..."
            className="w-full bg-[#0d0d0d] border border-zinc-800 focus:border-amber-400/80 text-white placeholder-zinc-500 rounded-xl pl-10 pr-10 py-3 text-xs outline-none transition-all shadow-md"
          />
          {centerSearchQuery && (
            <button
              onClick={() => setCenterSearchQuery('')}
              className="absolute right-3 text-zinc-500 hover:text-white p-1"
              title="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Lista de Tarjetas de Centros Educativos */}
        {loadingCenters ? (
          <div className="py-12 text-center text-zinc-500 space-y-2 bg-[#0d0d0d] border border-zinc-800/80 rounded-2xl">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-mono">Cargando centros educativos...</p>
          </div>
        ) : !centerSearchQuery.trim() ? (
          <div className="py-12 text-center text-zinc-500 space-y-2 bg-[#0d0d0d]/40 border border-dashed border-zinc-800/80 rounded-2xl p-6">
            <Search className="w-8 h-8 text-zinc-600 mx-auto opacity-60 animate-pulse" />
            <p className="text-xs font-bold text-zinc-400">Buscador de Centros</p>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto leading-relaxed">
              Ingresa el nombre de la institución o el tipo (universidad, instituto, colegio) en el buscador superior para ver los resultados de gestión.
            </p>
          </div>
        ) : filteredCenters.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 space-y-2 bg-[#0d0d0d] border border-zinc-800/80 rounded-2xl p-6">
            <Building2 className="w-10 h-10 text-zinc-600 mx-auto opacity-50" />
            <p className="text-xs font-bold text-zinc-400">No se encontraron centros educativos con esta búsqueda.</p>
            <p className="text-[11px] text-zinc-600">Intenta buscar por universidad, instituto, colegio o nombre del centro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCenters.map((center) => {
              const typeLabel = center.type === 'universidad' ? 'Universidad' : center.type === 'instituto' ? 'Instituto' : 'Colegio';
              const typeBadgeStyle = center.type === 'universidad' 
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : center.type === 'instituto'
                ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                : 'bg-purple-500/15 text-purple-400 border-purple-500/30';

              return (
                <div 
                  key={center.id} 
                  className="bg-[#0d0d0d] border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all shadow-md group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#141414] border border-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {center.profile_photo_url ? (
                        <img 
                          src={center.profile_photo_url} 
                          alt={center.name} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-zinc-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${typeBadgeStyle}`}>
                          {typeLabel}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-white text-sm truncate" title={center.name}>
                        {center.name}
                      </h4>
                      <p className="text-[11px] text-zinc-500 font-mono truncate">
                        ID: {center.id.substring(0, 12)}...
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {center.created_at ? new Date(center.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Registrado'}
                    </span>

                    <button
                      onClick={() => setCenterToDelete(center)}
                      className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-600 border border-red-500/30 hover:border-red-500 text-red-400 hover:text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                      title="Eliminar centro educativo de la plataforma"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar Centro</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. TABLA DE USUARIOS RECIENTES */}
      {metrics?.recentUsers && metrics.recentUsers.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Cuentas Registradas Recientemente
              </h2>
            </div>
            <span className="text-xs text-zinc-500 font-mono">
              Mostrando los últimos {metrics.recentUsers.length} usuarios
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-[#0d0d0d]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121212] border-b border-zinc-800 text-[10px] uppercase font-black tracking-wider text-zinc-400">
                <tr>
                  <th className="px-4 py-3.5">Usuario</th>
                  <th className="px-4 py-3.5">Estado / Proveedor</th>
                  <th className="px-4 py-3.5">Rol</th>
                  <th className="px-4 py-3.5">Fecha de Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                {metrics.recentUsers.map((u) => {
                  const isDirectGoogle = !u.is_anonymous && !u.linked_google_at;
                  const isLinkedGoogle = Boolean(u.linked_google_at);
                  const isAnon = u.is_anonymous && !u.linked_google_at;
                  const isUserAdmin = u.role === 'admin';

                  return (
                    <tr key={u.id} className="hover:bg-[#141414] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">
                          {u.display_name || u.username || 'Sin apodo'}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono truncate max-w-[200px]">
                          {u.email || (isAnon ? 'Sesión anónima temporal' : 'Sin correo')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isDirectGoogle ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase">
                            <UserCheck className="w-3 h-3" /> Directo Google
                          </span>
                        ) : isLinkedGoogle ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase">
                            <Link2 className="w-3 h-3" /> Anónimo Vinculado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase">
                            <UserX className="w-3 h-3" /> Anónimo Activo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isUserAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-black text-[10px] font-black uppercase shadow-sm">
                            <ShieldCheck className="w-3 h-3 stroke-[3]" /> ADMIN
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-500 font-mono uppercase">
                            Estudiante
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 font-mono text-[11px]">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        }) : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Toast Notification Flotante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#121212] border border-amber-400/80 text-white px-5 py-3.5 rounded-2xl shadow-[0_0_30px_rgba(234,179,8,0.25)] flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 max-w-md">
          <CheckCircle2 className="w-5 h-5 text-[#eab308] flex-shrink-0" />
          <span className="text-xs font-bold leading-tight">{toastMessage}</span>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación Permanente */}
      {centerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-red-500/40 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-[0_0_50px_rgba(239,68,68,0.25)] animate-in zoom-in-95 duration-200 relative">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex-shrink-0">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  Confirmar Eliminación Permanente
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed bg-red-950/20 border border-red-500/20 p-3.5 rounded-xl">
                  ⚠️ ¿Estás seguro de eliminar <strong className="text-white font-black">{centerToDelete.name}</strong>? Esta acción borrará permanentemente la institución, sus profesores registrados, confesiones, comentarios y estadísticas asociadas. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setCenterToDelete(null)}
                disabled={isDeletingCenter}
                className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteCenter}
                disabled={isDeletingCenter}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center gap-2 disabled:opacity-50 active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingCenter ? 'ELIMINANDO...' : 'SÍ, ELIMINAR CENTRO'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
