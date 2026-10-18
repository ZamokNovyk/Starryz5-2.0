import { supabase } from './supabase';

export interface AdminUserMetric {
  totalUsers: number;
  directGoogle: number;
  activeAnonymous: number;
  linkedAnonymous: number;
  adminUsers: number;
}

export interface AdminCentersMetric {
  totalCenters: number;
  colegios: number;
  institutos: number;
  universidades: number;
}

export interface AdminNotificationMetric {
  activePushUsers: number;
  adoptionPercentage: number;
  unregisteredCount: number;
}

export interface AdminDashboardData {
  userMetrics: AdminUserMetric;
  centerMetrics: AdminCentersMetric;
  notificationMetrics: AdminNotificationMetric;
  recentUsers: Array<{
    id: string;
    firebase_uid: string;
    email: string | null;
    display_name: string | null;
    username: string | null;
    role: string | null;
    is_anonymous: boolean;
    linked_google_at: string | null;
    created_at: string;
  }>;
  source: 'platform_stats' | 'live_count';
}

/**
 * Consulta de alto rendimiento: Lee los datos precálculados desde la tabla de resumen 'platform_stats' (id = 1)
 */
export async function getAdminDashboardMetrics(): Promise<AdminDashboardData> {
  try {
    // 1. SELECT simple a la tabla de resumen 'platform_stats' (id = 1)
    const { data: statsData, error: statsError } = await supabase
      .from('platform_stats')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (!statsError && statsData) {
      const googleDirect = Number(statsData.google_direct ?? 0);
      const anonActive = Number(statsData.anonymous_active ?? 0);
      const anonLinked = Number(statsData.anonymous_linked_google ?? 0);
      const totalUsers = googleDirect + anonActive + anonLinked;

      const colegios = Number(statsData.colegios ?? 0);
      const institutos = Number(statsData.institutos ?? 0);
      const universidades = Number(statsData.universidades ?? 0);
      const totalCenters = Number(statsData.total_centers ?? (colegios + institutos + universidades));

      const userMetrics: AdminUserMetric = {
        totalUsers,
        directGoogle: googleDirect,
        activeAnonymous: anonActive,
        linkedAnonymous: anonLinked,
        adminUsers: Number(statsData.admin_users ?? 0)
      };

      const centerMetrics: AdminCentersMetric = {
        totalCenters,
        colegios,
        institutos,
        universidades
      };

      // Conteo de usuarios con notificaciones push activas (FCM)
      let activePushUsers = 0;
      try {
        const { count: fcmCount } = await supabase
          .from('user_fcm_tokens')
          .select('*', { count: 'exact', head: true });
        activePushUsers = Number(fcmCount ?? 0);
      } catch (fcmErr) {
        console.warn('Aviso al contar user_fcm_tokens:', fcmErr);
      }

      const adoptionPercentage = totalUsers > 0 
        ? Math.min(100, Math.round((activePushUsers / totalUsers) * 100)) 
        : 0;

      const notificationMetrics: AdminNotificationMetric = {
        activePushUsers,
        adoptionPercentage,
        unregisteredCount: Math.max(0, totalUsers - activePushUsers)
      };

      // Traer una muestra ligera de usuarios recientes (solo 10 para vista previa)
      const { data: recent } = await supabase
        .from('users')
        .select('id, firebase_uid, email, display_name, username, role, is_anonymous, linked_google_at, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      return {
        userMetrics,
        centerMetrics,
        notificationMetrics,
        recentUsers: recent || [],
        source: 'platform_stats'
      };
    }

    // 2. Fallback de respaldo en caso de que la tabla aún no haya sido creada en Supabase
    console.warn('Aviso: platform_stats no encontrada o inaccesible. Ejecutando conteo dinámico de respaldo.');
    
    const { data: usersData } = await supabase.from('users').select('*');
    const users: any[] = usersData || [];

    const directGoogle = users.filter(u => {
      const isAnon = u.is_anonymous === true;
      const hasLinkedGoogle = Boolean(u.linked_google_at);
      const hasEmail = Boolean(u.email);
      return (hasEmail || !isAnon) && !hasLinkedGoogle;
    }).length;

    const activeAnonymous = users.filter(u => {
      const isAnon = u.is_anonymous === true;
      const hasLinkedGoogle = Boolean(u.linked_google_at);
      return isAnon && !hasLinkedGoogle;
    }).length;

    const linkedAnonymous = users.filter(u => Boolean(u.linked_google_at)).length;
    const adminUsers = users.filter(u => (u.role || '').toLowerCase() === 'admin').length;
    const totalUsersFallback = directGoogle + activeAnonymous + linkedAnonymous;

    // Conteo de usuarios con FCM activo
    let activePushUsersFallback = 0;
    try {
      const { count: fcmCount } = await supabase
        .from('user_fcm_tokens')
        .select('*', { count: 'exact', head: true });
      activePushUsersFallback = Number(fcmCount ?? 0);
    } catch {}

    const adoptionPercentageFallback = totalUsersFallback > 0
      ? Math.min(100, Math.round((activePushUsersFallback / totalUsersFallback) * 100))
      : 0;

    const { data: centersData } = await supabase.from('educational_centers').select('*');
    const centers: any[] = centersData || [];

    let colegios = 0;
    let institutos = 0;
    let universidades = 0;

    centers.forEach(c => {
      const type = (c.type || '').toLowerCase().trim();
      if (type === 'colegio') colegios++;
      else if (type === 'instituto') institutos++;
      else universidades++;
    });

    return {
      userMetrics: {
        totalUsers: totalUsersFallback,
        directGoogle,
        activeAnonymous,
        linkedAnonymous,
        adminUsers
      },
      centerMetrics: {
        totalCenters: centers.length,
        colegios,
        institutos,
        universidades
      },
      notificationMetrics: {
        activePushUsers: activePushUsersFallback,
        adoptionPercentage: adoptionPercentageFallback,
        unregisteredCount: Math.max(0, totalUsersFallback - activePushUsersFallback)
      },
      recentUsers: users.slice(0, 10),
      source: 'live_count'
    };
  } catch (err) {
    console.error('Error general al obtener métricas de platform_stats:', err);
    return {
      userMetrics: {
        totalUsers: 0,
        directGoogle: 0,
        activeAnonymous: 0,
        linkedAnonymous: 0,
        adminUsers: 0
      },
      centerMetrics: {
        totalCenters: 0,
        colegios: 0,
        institutos: 0,
        universidades: 0
      },
      notificationMetrics: {
        activePushUsers: 0,
        adoptionPercentage: 0,
        unregisteredCount: 0
      },
      recentUsers: [],
      source: 'live_count'
    };
  }
}
