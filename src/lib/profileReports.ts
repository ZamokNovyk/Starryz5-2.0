import { supabase } from './supabase';

export interface ProfileReport {
  id: string;
  target_id: string;
  target_type: 'student' | 'professor';
  target_name: string;
  institute_id: string;
  reported_by: string;
  reporter_name: string;
  reason: string;
  status: 'active' | 'expelled' | 'dismissed';
  votes_keep: number;
  votes_expel: number;
  threshold: number;
  voters?: Record<string, ReportVoteType>; // user_id -> 'keep' | 'expel'
  created_at?: string;
  updated_at?: string;
}

export type ReportVoteType = 'keep' | 'expel';

const REPORT_MARKER_START = '<!--__COMMUNITY_REPORT__:';
const REPORT_MARKER_END = '-->';

/**
 * Limpia cualquier metadato técnico o comentario HTML de la biografía para que nunca sea visible al usuario
 */
export function stripBiographyMetadata(biography: string | null | undefined): string {
  if (!biography) return '';
  return biography
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

/**
 * Extrae la metadata del reporte incrustada en la biografía del perfil
 */
export function extractReportFromBiography(biography: string | null | undefined): {
  cleanBio: string;
  report: ProfileReport | null;
} {
  if (!biography) {
    return { cleanBio: '', report: null };
  }

  const startIdx = biography.indexOf(REPORT_MARKER_START);
  if (startIdx === -1) {
    return { cleanBio: stripBiographyMetadata(biography), report: null };
  }

  const endIdx = biography.indexOf(REPORT_MARKER_END, startIdx);
  if (endIdx === -1) {
    return { cleanBio: stripBiographyMetadata(biography), report: null };
  }

  const jsonStr = biography.substring(startIdx + REPORT_MARKER_START.length, endIdx);
  const cleanBio = stripBiographyMetadata(
    biography.substring(0, startIdx) + biography.substring(endIdx + REPORT_MARKER_END.length)
  );

  try {
    const parsed = JSON.parse(jsonStr) as ProfileReport;
    return { cleanBio, report: parsed };
  } catch (err) {
    console.error('Error parseando reporte de biografía:', err);
    return { cleanBio: stripBiographyMetadata(biography), report: null };
  }
}

/**
 * Inserta o actualiza la metadata del reporte en la biografía
 */
export function embedReportIntoBiography(
  currentBio: string | null | undefined,
  report: ProfileReport | null
): string {
  const { cleanBio } = extractReportFromBiography(currentBio);
  if (!report) {
    return cleanBio;
  }
  const marker = `${REPORT_MARKER_START}${JSON.stringify(report)}${REPORT_MARKER_END}`;
  return cleanBio ? `${marker}\n${cleanBio}` : marker;
}

/**
 * Obtiene el reporte activo directamente desde la base de datos (Backend Supabase)
 * para que sea 100% visible para cualquier visitante o miembro del campus en tiempo real.
 */
export async function getActiveProfileReport(
  targetId: string,
  targetType: 'student' | 'professor'
): Promise<ProfileReport | null> {
  try {
    // 1. Intentar primero consultar la tabla dedicada profile_reports si existiese
    const { data, error } = await supabase
      .from('profile_reports')
      .select('*')
      .eq('target_id', targetId)
      .eq('target_type', targetType)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as ProfileReport;
    }
  } catch {
    // Continuar a la persistencia en el registro del perfil
  }

  // 2. Persistencia en la tabla 'students' o 'professors' de Supabase
  try {
    const table = targetType === 'student' ? 'students' : 'professors';
    const { data: record, error } = await supabase
      .from(table)
      .select('id, biography')
      .eq('id', targetId)
      .maybeSingle();

    if (!error && record && record.biography) {
      const { report } = extractReportFromBiography(record.biography);
      if (report && report.status === 'active') {
        return report;
      }
    }
  } catch (err) {
    console.error('Error obteniendo reporte de perfil desde Supabase:', err);
  }

  return null;
}

/**
 * Crea e inicia un reporte de moderación comunitaria en el Backend de Supabase.
 * Se almacena en la base de datos global de Supabase para que cualquier otro usuario lo vea.
 */
export async function createProfileReport(params: {
  targetId: string;
  targetType: 'student' | 'professor';
  targetName: string;
  instituteId: string;
  reportedBy: string;
  reporterName: string;
  reason: string;
  threshold?: number;
}): Promise<ProfileReport> {
  const threshold = params.threshold || 5;

  const reportObj: ProfileReport = {
    id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    target_id: params.targetId,
    target_type: params.targetType,
    target_name: params.targetName,
    institute_id: params.instituteId,
    reported_by: params.reportedBy,
    reporter_name: params.reporterName,
    reason: params.reason,
    status: 'active',
    votes_keep: 0,
    votes_expel: 1, // El usuario que reporta emite el primer voto de expulsión
    threshold,
    voters: {
      [params.reportedBy]: 'expel',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 1. Si existe la tabla profile_reports, insertar allí
  try {
    await supabase.from('profile_reports').insert([reportObj]);
    await supabase.from('profile_report_votes').insert([
      {
        report_id: reportObj.id,
        user_id: params.reportedBy,
        vote_type: 'expel',
      },
    ]);
  } catch {
    // Ignorar si la tabla relacional no está creada en el schema
  }

  // 2. Guardar en Supabase actualizando el registro en la tabla students o professors
  try {
    const table = params.targetType === 'student' ? 'students' : 'professors';
    const { data: currentRecord } = await supabase
      .from(table)
      .select('biography')
      .eq('id', params.targetId)
      .maybeSingle();

    const currentBio = currentRecord?.biography || '';
    const newBioWithReport = embedReportIntoBiography(currentBio, reportObj);

    const { error: updateError } = await supabase
      .from(table)
      .update({ biography: newBioWithReport })
      .eq('id', params.targetId);

    if (updateError) {
      console.error('Error al persistir reporte en Supabase:', updateError);
      throw new Error(updateError.message || 'No se pudo guardar el reporte en la base de datos.');
    }
  } catch (err: any) {
    console.error('Fallo crítico guardando reporte en Supabase:', err);
    throw err;
  }

  return reportObj;
}

/**
 * Obtiene el voto emitido por el usuario en el reporte
 */
export async function getUserVoteOnReport(
  reportId: string,
  userId: string,
  targetId?: string,
  targetType?: 'student' | 'professor'
): Promise<ReportVoteType | null> {
  // 1. Intentar desde tabla profile_report_votes
  try {
    const { data, error } = await supabase
      .from('profile_report_votes')
      .select('vote_type')
      .eq('report_id', reportId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      return data.vote_type as ReportVoteType;
    }
  } catch {
    // Fallback a voters de metadata
  }

  // 2. Verificar desde la metadata del perfil
  if (targetId && targetType) {
    try {
      const rep = await getActiveProfileReport(targetId, targetType);
      if (rep && rep.voters && rep.voters[userId]) {
        return rep.voters[userId];
      }
    } catch {
      // Ignorar
    }
  }

  return null;
}

/**
 * Emite un voto ("Sí, pertenece" o "No, expulsar") en el backend de Supabase.
 */
export async function submitReportVote(params: {
  reportId: string;
  userId: string;
  voteType: ReportVoteType;
  targetId: string;
  targetType: 'student' | 'professor';
}): Promise<{ report: ProfileReport; outcome: 'voted' | 'expelled' | 'dismissed' }> {
  const { reportId, userId, voteType, targetId, targetType } = params;

  // 1. Recuperar el reporte activo actual desde Supabase
  let currentReport = await getActiveProfileReport(targetId, targetType);

  if (!currentReport || currentReport.id !== reportId) {
    throw new Error('El reporte especificado no se encuentra activo.');
  }

  if (currentReport.status !== 'active') {
    return { report: currentReport, outcome: currentReport.status };
  }

  const voters = { ...(currentReport.voters || {}) };
  const previousVote = voters[userId] || null;

  if (previousVote === voteType) {
    return { report: currentReport, outcome: 'voted' };
  }

  let updatedVotesKeep = Number(currentReport.votes_keep) || 0;
  let updatedVotesExpel = Number(currentReport.votes_expel) || 0;

  // Revertir voto anterior si existía
  if (previousVote === 'keep') updatedVotesKeep = Math.max(0, updatedVotesKeep - 1);
  if (previousVote === 'expel') updatedVotesExpel = Math.max(0, updatedVotesExpel - 1);

  // Agregar nuevo voto
  if (voteType === 'keep') updatedVotesKeep += 1;
  if (voteType === 'expel') updatedVotesExpel += 1;

  voters[userId] = voteType;

  // Evaluar umbral (default 5)
  const threshold = currentReport.threshold || 5;
  let newStatus: 'active' | 'expelled' | 'dismissed' = 'active';
  let outcome: 'voted' | 'expelled' | 'dismissed' = 'voted';

  if (updatedVotesExpel >= threshold) {
    newStatus = 'expelled';
    outcome = 'expelled';
  } else if (updatedVotesKeep >= threshold) {
    newStatus = 'dismissed';
    outcome = 'dismissed';
  }

  const updatedReport: ProfileReport = {
    ...currentReport,
    votes_keep: updatedVotesKeep,
    votes_expel: updatedVotesExpel,
    status: newStatus,
    voters,
    updated_at: new Date().toISOString(),
  };

  // 2. Persistir en la base de datos de Supabase
  const table = targetType === 'student' ? 'students' : 'professors';
  try {
    if (outcome === 'expelled') {
      // Marcar de inmediato como expulsado para que desaparezca de consultas y vistas
      await supabase
        .from(table)
        .update({
          biography: '<!--__EXPELLED_BY_COMMUNITY__-->',
          nombre_completo: '[EXPULSADO POR LA COMUNIDAD]',
        })
        .or(`id.eq.${targetId},id.eq.${targetId.toLowerCase().trim()}`);
    } else {
      const { data: record } = await supabase
        .from(table)
        .select('biography')
        .eq('id', targetId)
        .maybeSingle();

      const currentBio = record?.biography || '';
      // Si fue desestimado, limpiamos el reporte de la biografía
      const bioToSave = newStatus === 'active' 
        ? embedReportIntoBiography(currentBio, updatedReport)
        : embedReportIntoBiography(currentBio, null);

      await supabase
        .from(table)
        .update({ biography: bioToSave })
        .eq('id', targetId);
    }
  } catch (upErr) {
    console.error('Error guardando voto en Supabase:', upErr);
  }

  // 3. Guardar en profile_reports si la tabla existe
  try {
    await supabase.from('profile_report_votes').upsert(
      { report_id: reportId, user_id: userId, vote_type: voteType },
      { onConflict: 'report_id,user_id' }
    );
    await supabase.from('profile_reports').update({
      votes_keep: updatedVotesKeep,
      votes_expel: updatedVotesExpel,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', reportId);
  } catch {
    // Ignorar si no existe la tabla
  }

  // 4. Si la decisión fue EXPULSAR, ejecutar la eliminación completa del perfil
  if (outcome === 'expelled') {
    if (targetType === 'student') {
      await deleteStudentProfile(targetId);
    } else {
      await deleteProfessorProfile(targetId);
    }
  }

  return { report: updatedReport, outcome };
}

/**
 * Elimina completamente a un estudiante y todos sus registros asociados en Supabase
 */
export async function deleteStudentProfile(studentId: string): Promise<boolean> {
  const cleanedId = studentId.toLowerCase().trim();
  try {
    // 1. Intentar primero con la función RPC 'expel_profile' (SECURITY DEFINER)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('expel_profile', {
        p_target_id: studentId,
        p_target_type: 'student',
      });

      if (!rpcError && rpcData?.success) {
        console.log('Perfil de estudiante expulsado exitosamente vía RPC:', rpcData);
        return true;
      }
      if (rpcError) {
        console.warn('RPC expel_profile no disponible o retornó error:', rpcError.message);
      }
    } catch (rpcEx) {
      console.warn('Excepción llamando RPC expel_profile:', rpcEx);
    }

    // 2. Eliminación directa en orden para respetar claves foráneas
    // A. Corazones y reacciones de mensajes de amor
    try {
      const { data: messages } = await supabase
        .from('user_love_messages')
        .select('id')
        .or(`target_user_id.eq.${studentId},target_user_id.eq.${cleanedId},student_id.eq.${studentId},student_id.eq.${cleanedId}`);
      if (messages && messages.length > 0) {
        const msgIds = messages.map(m => String(m.id));
        await Promise.allSettled([
          supabase.from('user_love_reactions').delete().in('message_id', msgIds),
          supabase.from('users_love_message_hearts').delete().in('message_id', msgIds),
        ]);
      }
    } catch {}

    // B. Tablas hijas del estudiante (Tablas unificadas)
    await Promise.allSettled([
      supabase.from('users_actitud').delete().or(`target_user_id.eq.${studentId},target_user_id.eq.${cleanedId}`),
      supabase.from('users_crushes').delete().or(`target_user_id.eq.${studentId},target_user_id.eq.${cleanedId}`),
      supabase.from('user_reseñas').delete().or(`target_user_id.eq.${studentId},target_user_id.eq.${cleanedId}`),
      supabase.from('user_love_messages').delete().or(`target_user_id.eq.${studentId},target_user_id.eq.${cleanedId}`),
      supabase.from('users_love_messages').delete().or(`target_user_id.eq.${studentId},target_user_id.eq.${cleanedId}`),
      supabase.from('student_daily_stats').delete().or(`student_id.eq.${studentId},student_id.eq.${cleanedId}`),
      supabase.from('student_notification_subscriptions').delete().or(`student_id.eq.${studentId},student_id.eq.${cleanedId}`),
      supabase.from('collection_items').delete().or(`item_id.eq.${studentId},item_id.eq.${cleanedId}`),
    ]);

    // C. Eliminar reportes asociados si existen
    try {
      await supabase.from('profile_reports').delete().or(`target_id.eq.${studentId},target_id.eq.${cleanedId}`);
    } catch {}

    // D. Eliminar el registro principal en 'students'
    const { error: delError } = await supabase.from('students').delete().or(`id.eq.${studentId},id.eq.${cleanedId}`);
    if (delError) {
      console.warn('Error eliminando en tabla students, asegurando marca de expulsado:', delError.message);
      await supabase.from('students').update({
        biography: '<!--__EXPELLED_BY_COMMUNITY__-->',
        nombre_completo: '[EXPULSADO POR LA COMUNIDAD]',
      }).or(`id.eq.${studentId},id.eq.${cleanedId}`);
    }

    // E. Si el estudiante fue registrado en 'professors' (ej. role = 'Alumno')
    await supabase.from('professors').delete().or(`id.eq.${studentId},id.eq.${cleanedId}`);

    // Limpieza de caches locales
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`student_love_messages_${studentId}`);
        localStorage.removeItem(`active_report_student_${studentId}`);
        localStorage.removeItem(`report_votes_${studentId}`);
      } catch {}
    }

    return true;
  } catch (err) {
    console.error('Error al ejecutar eliminación completa de estudiante:', err);
    return false;
  }
}

/**
 * Elimina completamente a un profesor y todos sus registros asociados en Supabase
 */
export async function deleteProfessorProfile(professorId: string): Promise<boolean> {
  const cleanedId = professorId.toLowerCase().trim();
  try {
    // 1. Intentar primero con la función RPC 'expel_profile' (SECURITY DEFINER)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('expel_profile', {
        p_target_id: professorId,
        p_target_type: 'professor',
      });

      if (!rpcError && rpcData?.success) {
        console.log('Perfil de profesor expulsado exitosamente vía RPC:', rpcData);
        return true;
      }
      if (rpcError) {
        console.warn('RPC expel_profile no disponible o retornó error:', rpcError.message);
      }
    } catch (rpcEx) {
      console.warn('Excepción llamando RPC expel_profile:', rpcEx);
    }

    // 2. Tablas hijas del profesor
    await Promise.allSettled([
      supabase.from('professor_votes').delete().or(`professor_id.eq.${professorId},professor_id.eq.${cleanedId}`),
      supabase.from('professor_interactions').delete().or(`professor_id.eq.${professorId},professor_id.eq.${cleanedId}`),
      supabase.from('professor_crushes').delete().or(`professor_id.eq.${professorId},professor_id.eq.${cleanedId}`),
      supabase.from('professor_notification_subscriptions').delete().or(`professor_id.eq.${professorId},professor_id.eq.${cleanedId}`),
      supabase.from('collection_items').delete().or(`item_id.eq.${professorId},item_id.eq.${cleanedId}`),
    ]);

    // Reportes asociados
    try {
      await supabase.from('profile_reports').delete().or(`target_id.eq.${professorId},target_id.eq.${cleanedId}`);
    } catch {}

    // Eliminar el registro principal en 'professors'
    const { error: delError } = await supabase.from('professors').delete().or(`id.eq.${professorId},id.eq.${cleanedId}`);
    if (delError) {
      console.warn('Error eliminando en tabla professors, asegurando marca de expulsado:', delError.message);
      await supabase.from('professors').update({
        biography: '<!--__EXPELLED_BY_COMMUNITY__-->',
        nombre_completo: '[EXPULSADO POR LA COMUNIDAD]',
      }).or(`id.eq.${professorId},id.eq.${cleanedId}`);
    }

    // Limpieza de caches locales
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`active_report_professor_${professorId}`);
        localStorage.removeItem(`report_votes_${professorId}`);
      } catch {}
    }

    return true;
  } catch (err) {
    console.error('Error al ejecutar eliminación completa de profesor:', err);
    return false;
  }
}
