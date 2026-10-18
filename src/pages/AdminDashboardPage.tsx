'use client';

import React, { useState, useEffect } from 'react';
import { applyUserQuery } from '../lib/supabaseHelper';
import { 
  ShieldCheck, 
  ArrowLeft, 
  RefreshCw, 
  Bell, 
  BellRing, 
  Users, 
  Building2, 
  TrendingUp, 
  Activity, 
  Globe, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Percent,
  UserCheck
} from 'lucide-react';
import { getAdminDashboardMetrics, AdminDashboardData } from '@/src/lib/admin';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';

interface AdminDashboardPageProps {
  onBack: () => void;
  onNavigate?: (path: string) => void;
}

export default function AdminDashboardPage({ onBack, onNavigate }: AdminDashboardPageProps) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  // Verificar si el usuario actual es admin
  useEffect(() => {
    async function checkRole() {
      if (!user) {
        setUserRole(null);
        setCheckingRole(false);
        return;
      }
      try {
        let query = supabase.from('users').select('role');
        query = applyUserQuery(query, user);
        const { data, error } = await query.maybeSingle();

        if (!error && data) {
          setUserRole(data.role);
        }
      } catch (e) {
        console.error('Error al verificar rol de admin:', e);
      } finally {
        setCheckingRole(false);
      }
    }
    checkRole();
  }, [user]);

  // Cargar métricas
  const loadMetrics = async () => {
    try {
      setLoading(true);
      const data = await getAdminDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Error al obtener métricas del dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  if (checkingRole) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-zinc-400 font-mono">Verificando credenciales de administrador...</p>
      </div>
    );
  }

  // Si no es admin
  if (userRole !== 'admin') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="inline-flex p-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Acceso Solo Administradores</h2>
        <p className="text-zinc-400 text-xs leading-relaxed">
          Esta sección contiene telemetría confidencial, adopción de notificaciones push y métricas de plataforma reservadas exclusivamente para la administración de Starryz.
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider transition-colors cursor-pointer"
        >
          Volver a la Página Principal
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-8 animate-in fade-in duration-300">
      
      {/* Barra superior de navegación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#ffffff10] pb-6">
        <div className="space-y-1">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer group mb-2"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            VOLVER AL CAMPUS
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-2.5">
              <ShieldCheck className="w-7 h-7 text-amber-400 stroke-[2.5]" />
              Panel de Control Admin
            </h1>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-400/15 border border-amber-400/30 text-amber-400 text-[10px] font-black uppercase tracking-wider">
              EN VIVO
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Seguimiento de adopción de Notificaciones Push FCM, Tasa de Rebote (Google Analytics 4) y estadísticas de usuarios.
          </p>
        </div>

        <button
          type="button"
          onClick={loadMetrics}
          disabled={loading}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          <span>{loading ? 'Actualizando...' : 'Refrescar'}</span>
        </button>
      </div>

      {/* SECCIÓN 1: SEGUIMIENTO DE NOTIFICACIONES PUSH (FCM) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <BellRing className="w-4 h-4 text-amber-400" />
            Adopción de Notificaciones Push (FCM)
          </h2>
          <span className="text-[11px] font-mono text-zinc-400">
            Fuente: <span className="text-zinc-200 font-bold">user_fcm_tokens</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Card 1: Usuarios con Notificaciones Activas */}
          <div className="p-5 rounded-2xl bg-[#0e0e0e] border border-amber-500/30 space-y-3 relative overflow-hidden shadow-[0_0_20px_rgba(245,158,11,0.08)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Notificaciones Activas</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <BellRing className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-white tracking-tight">
              {metrics?.notificationMetrics?.activePushUsers ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Usuarios que concedieron permiso de notificación en su navegador o móvil.
            </p>
          </div>

          {/* Card 2: Tasa de Adopción */}
          <div className="p-5 rounded-2xl bg-[#0e0e0e] border border-emerald-500/30 space-y-3 relative overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.08)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Tasa de Adopción</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-emerald-400 tracking-tight flex items-baseline gap-1">
              <span>{metrics?.notificationMetrics?.adoptionPercentage ?? 0}%</span>
              <span className="text-xs font-normal text-zinc-400">del total</span>
            </div>
            
            {/* Barra de progreso */}
            <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, metrics?.notificationMetrics?.adoptionPercentage ?? 0))}%` }}
              />
            </div>
          </div>

          {/* Card 3: Sin Notificaciones */}
          <div className="p-5 rounded-2xl bg-[#0e0e0e] border border-zinc-800 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Pendientes / Sin Activar</span>
              <div className="p-2 rounded-xl bg-zinc-800 text-zinc-400 border border-zinc-700">
                <Bell className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-zinc-300 tracking-tight">
              {metrics?.notificationMetrics?.unregisteredCount ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Se les solicitará activación al interactuar (dejar confesión, reaccionar, votar profe).
            </p>
          </div>

        </div>

        {/* Explicación de la estrategia */}
        <div className="p-4 rounded-2xl bg-[#141414] border border-[#ffffff0a] flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300 space-y-1">
            <p className="font-bold text-white uppercase tracking-tight">
              Estrategia Contextual Activa:
            </p>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              El aviso de activación de notificaciones ya no es intrusivo al entrar a la web. Ahora se activa automáticamente cuando el usuario realiza su <strong>primera acción relevante</strong> (publicar confesión, responder a un comentario o calificar a un profesor), garantizando mayor conversión.
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: GOOGLE ANALYTICS 4 & TASA DE REBOTE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-400" />
            Google Analytics 4 & Tasa de Rebote (Bounce Rate)
          </h2>
          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-mono font-bold">
            ID: G-0FL5ZVJG8C
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card GA4 Status */}
          <div className="p-5 rounded-2xl bg-[#0e0e0e] border border-blue-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-black text-white uppercase tracking-wider">GA4 Conectado y Activo</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">gtag.js</span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              El script oficial de Google Tag Manager con ID <code className="text-amber-400 font-mono font-bold">G-0FL5ZVJG8C</code> está insertado en el encabezado (<code className="text-zinc-400 font-mono">&lt;head&gt;</code>) de Starryz 5.
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
          <div className="p-5 rounded-2xl bg-[#0e0e0e] border border-zinc-800 space-y-3">
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
      </div>

      {/* SECCIÓN 3: MÉTRICAS GENERALES DE PLATAFORMA */}
      <div className="space-y-4">
        <h2 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" />
          Métricas de Usuarios & Centros
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-[#0e0e0e] border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-extrabold">Total Usuarios</span>
            <div className="text-2xl font-black text-white">{metrics?.userMetrics?.totalUsers ?? 0}</div>
          </div>

          <div className="p-4 rounded-xl bg-[#0e0e0e] border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-extrabold">Google OAuth</span>
            <div className="text-2xl font-black text-blue-400">{metrics?.userMetrics?.directGoogle ?? 0}</div>
          </div>

          <div className="p-4 rounded-xl bg-[#0e0e0e] border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-extrabold">Anónimos Activos</span>
            <div className="text-2xl font-black text-amber-400">{metrics?.userMetrics?.activeAnonymous ?? 0}</div>
          </div>

          <div className="p-4 rounded-xl bg-[#0e0e0e] border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-extrabold">Total Centros</span>
            <div className="text-2xl font-black text-emerald-400">{metrics?.centerMetrics?.totalCenters ?? 0}</div>
          </div>
        </div>
      </div>

    </div>
  );
}
