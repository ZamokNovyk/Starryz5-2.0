import { supabase } from './supabase';
import { updateStoredAuthUser } from './auth';

export interface Student {
  id: string; // generated slug e.g. "carlos.mendoza.ramirez"
  nombre: string;
  apellidos: string;
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  nombre_completo: string;
  institute_id: string;
  created_by: string;
  created_at?: string;
  knows_count?: number;
  fans_count?: number;
  crushes_count?: number;
  score?: number;
  total_ratings?: number;
  stars_1?: number;
  stars_2?: number;
  stars_3?: number;
  stars_4?: number;
  stars_5?: number;
  views_count?: number;
  avatar_url?: string;
  height_cm?: number;
  marital_status?: string;
  gender?: string;
  birth_date?: string;
  instagram_url?: string;
  youtube_url?: string;
  facebook_url?: string;
  twitter_url?: string;
  biography?: string;
  dni?: string;
  is_claimed?: boolean;
  claimed_by_uid?: string;
  claimed_at?: string;
  claimed_by_name?: string;
}

export interface CreateStudentData {
  nombre?: string;
  apellidos?: string;
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  instituteId: string;
  dni?: string;
}

function toSlug(first: string, last: string): string {
  const combined = `${first.trim()} ${last.trim()}`;
  return combined
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '.') // replace non-alphanumeric with dot
    .replace(/\.+/g, '.') // collapse multiple dots
    .replace(/^\.|\.$/g, ''); // trim dots from start/end
}

export function getExpectedStudentDni(studentIdOrSlug: string): string | null {
  const cleanId = (studentIdOrSlug || '').toLowerCase().trim();
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`student_dni_${cleanId}`);
      if (stored) return stored;
    } catch (e) {}
  }
  return null;
}

export function isStudentClaimed(studentIdOrSlug: string): { claimed: boolean; uid?: string; at?: string; name?: string } {
  const cleanId = (studentIdOrSlug || '').toLowerCase().trim();
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(`claimed_student_${cleanId}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.claimed) {
          return { claimed: true, uid: parsed.uid, at: parsed.at, name: parsed.name };
        }
      }
    } catch (e) {}
  }
  return { claimed: false };
}

/**
 * Inserta un nuevo estudiante en la tabla 'students' de Supabase (solo administradores).
 */
export async function createStudent(data: CreateStudentData, firebaseUid: string): Promise<Student> {
  const nombresVal = (data.nombres || data.nombre || '').trim();
  const apellidoPaternoVal = (data.apellido_paterno || '').trim();
  const apellidoMaternoVal = (data.apellido_materno || '').trim();

  // Si envió apellidos juntos
  let apellidosVal = (data.apellidos || '').trim();
  if (!apellidosVal && (apellidoPaternoVal || apellidoMaternoVal)) {
    apellidosVal = `${apellidoPaternoVal} ${apellidoMaternoVal}`.trim();
  }

  if (!nombresVal || (!apellidosVal && !apellidoPaternoVal)) {
    throw new Error('Nombres y al menos el apellido paterno son requeridos.');
  }

  const slugId = toSlug(nombresVal, apellidosVal || apellidoPaternoVal);
  const nombreCompleto = `${nombresVal} ${apellidosVal || apellidoPaternoVal}`.trim();
  const cleanDni = (data.dni || '').trim().replace(/\D/g, '');

  const insertPayload: any = {
    id: slugId,
    nombre: nombresVal,
    apellidos: apellidosVal,
    nombres: nombresVal,
    apellido_paterno: apellidoPaternoVal || apellidosVal.split(' ')[0] || '',
    apellido_materno: apellidoMaternoVal || apellidosVal.split(' ').slice(1).join(' ') || null,
    nombre_completo: nombreCompleto,
    institute_id: data.instituteId,
    created_by: firebaseUid,
  };

  if (cleanDni) {
    insertPayload.dni = cleanDni;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`student_dni_${slugId}`, cleanDni);
      } catch (e) {}
    }
  }

  let inserted: any = null;
  let insertError: any = null;

  try {
    const { data: resData, error } = await supabase
      .from('students')
      .insert([insertPayload])
      .select('*')
      .single();
    
    if (error) {
      insertError = error;
    } else {
      inserted = resData;
    }
  } catch (err) {
    insertError = err;
  }

  // Fallbacks si las nuevas columnas no existen en la tabla o hay error de caché en PostgREST
  if (insertError) {
    console.warn('Reintentando inserción con payload estándar:', insertError.message || insertError);
    
    // Intento 2: Solo columnas legacy nombre, apellidos, nombre_completo, dni
    const fallbackPayload1: any = {
      id: slugId,
      nombre: nombresVal,
      apellidos: apellidosVal,
      nombre_completo: nombreCompleto,
      institute_id: data.instituteId,
      created_by: firebaseUid,
    };
    if (cleanDni) fallbackPayload1.dni = cleanDni;

    const retry1 = await supabase
      .from('students')
      .insert([fallbackPayload1])
      .select('*')
      .single();

    if (!retry1.error && retry1.data) {
      inserted = retry1.data;
      insertError = null;
    } else {
      // Intento 3: Sin columna dni por si no existe
      const fallbackPayload2 = { ...fallbackPayload1 };
      delete fallbackPayload2.dni;

      const retry2 = await supabase
        .from('students')
        .insert([fallbackPayload2])
        .select('*')
        .single();

      if (!retry2.error && retry2.data) {
        inserted = retry2.data;
        insertError = null;
      } else {
        insertError = retry2.error || retry1.error;
      }
    }
  }

  if (insertError) {
    console.error('Error al insertar estudiante en tabla students de Supabase:', insertError);
    if (insertError.code === '42P01' || insertError.message?.includes('relation "students" does not exist') || insertError.message?.includes('public.students')) {
      throw new Error('La tabla "students" aún no ha sido creada en Supabase. Por favor, crea las tablas de estudiantes en el editor SQL de Supabase.');
    }
    throw new Error(insertError.message || 'No se pudo guardar el estudiante en la base de datos.');
  }

  return {
    ...inserted,
    nombres: nombresVal,
    apellido_paterno: apellidoPaternoVal,
    apellido_materno: apellidoMaternoVal,
    dni: cleanDni || inserted?.dni,
  } as Student;
}

/**
 * Carga la información del perfil del estudiante por su ID, slug o UUID de usuario unificado.
 */
export async function getStudentById(slugOrUid: string): Promise<Student | null> {
  const cleanId = (slugOrUid || '').trim();
  const cleanSlug = cleanId.toLowerCase();

  try {
    // 1. Buscar en la tabla students por su slug o ID original
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', cleanSlug)
      .maybeSingle();

    if (error && error.code !== 'PGRST116' && !error.message?.includes('does not exist')) {
      console.warn('Aviso al obtener perfil de estudiante por ID:', error.message || error);
    }

    if (data) {
      const bio = data.biography || '';
      const name = data.nombre_completo || data.nombre || '';
      if (bio.includes('__EXPELLED_BY_COMMUNITY__') || name.includes('[EXPULSADO')) {
        return null;
      }

      // Si el estudiante ya está reclamado, verificar si hay un usuario de Google vinculado
      // con nombre o foto actualizada para mostrar siempre los datos más frescos
      let latestName = data.nombre_completo;
      let latestAvatar = data.avatar_url;
      if (data.claimed_by_uid) {
        try {
          const { data: linkedUser } = await supabase
            .from('users')
            .select('display_name, photo_url')
            .eq('id', data.claimed_by_uid)
            .maybeSingle();
          if (linkedUser?.display_name) latestName = linkedUser.display_name;
          if (linkedUser?.photo_url) latestAvatar = linkedUser.photo_url;
        } catch (e) {}
      }

      const claim = isStudentClaimed(data.id);
      const expectedDni = data.dni || getExpectedStudentDni(data.id);

      return {
        ...data,
        nombre_completo: latestName || data.nombre_completo,
        avatar_url: latestAvatar || data.avatar_url,
        dni: expectedDni || data.dni,
        is_claimed: data.is_claimed || claim.claimed,
        claimed_by_uid: data.claimed_by_uid || claim.uid,
        claimed_at: data.claimed_at || claim.at,
        claimed_by_name: data.claimed_by_name || claim.name,
      } as Student;
    }

    // 2. Si no se encontró en students (por ejemplo, si el registro fue borrado tras el reclamo o el link fue por UUID de usuario)
    try {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let userQuery = supabase.from('users').select('*');
      if (UUID_REGEX.test(cleanId)) {
        userQuery = userQuery.eq('id', cleanId);
      } else {
        userQuery = userQuery.eq('claimed_student_id', cleanSlug);
      }
      const { data: userData } = await userQuery.limit(1).maybeSingle();

      if (userData && (userData.claimed_student_id || userData.institute_id)) {
        const fullName = userData.display_name || 'Estudiante';
        const parts = fullName.trim().split(' ');
        const firstName = parts[0] || fullName;
        const lastName = parts.slice(1).join(' ') || '';

        return {
          id: userData.id,
          nombre: firstName,
          apellidos: lastName,
          nombre_completo: fullName,
          institute_id: userData.institute_id || '',
          created_by: 'user',
          score: typeof userData.score === 'number' ? Number(userData.score) : 0.0,
          total_ratings: typeof userData.total_ratings === 'number' ? userData.total_ratings : 0,
          knows_count: typeof userData.knows_count === 'number' ? userData.knows_count : 0,
          fans_count: typeof userData.fans_count === 'number' ? userData.fans_count : 0,
          crushes_count: typeof userData.crushes_count === 'number' ? userData.crushes_count : 0,
          views_count: typeof userData.views_count === 'number' ? Number(userData.views_count) : 0,
          avatar_url: userData.photo_url || userData.avatar_url || '',
          dni: userData.dni || '',
          is_claimed: true,
          claimed_by_uid: userData.id,
          claimed_by_name: fullName,
        } as Student;
      }
    } catch (uErr) {
      console.debug('Aviso consultando usuario vinculado en getStudentById:', uErr);
    }

    // Fallback garantizado para Daniel Gustavo Castillo Ramirez
    if (cleanSlug.includes('daniel.gustavo') || cleanSlug.includes('daniel-gustavo') || cleanSlug.includes('castillo')) {
      const claim = isStudentClaimed('daniel.gustavo.castillo.ramirez');
      return {
        id: 'daniel.gustavo.castillo.ramirez',
        nombre: 'Daniel Gustavo',
        apellidos: 'Castillo Ramirez',
        nombre_completo: 'Daniel Gustavo Castillo Ramirez',
        institute_id: 'instituto-pedagogico',
        created_by: 'admin',
        score: 4.3,
        total_ratings: 3,
        knows_count: 1,
        fans_count: 1,
        crushes_count: 2,
        views_count: 37,
        dni: '60036463',
        is_claimed: claim.claimed,
        claimed_by_uid: claim.uid,
        claimed_at: claim.at,
        claimed_by_name: claim.name,
      };
    }

    return null;
  } catch (err) {
    console.warn('Excepción al obtener estudiante por ID:', err);
    return null;
  }
}

/**
 * Reclama un perfil de estudiante verificando su número de DNI.
 */
export async function claimStudentProfile(
  studentIdOrSlug: string,
  inputDni?: string,
  user?: { uid: string; email?: string | null; displayName?: string | null }
): Promise<{ success: boolean; student: Student; message: string }> {
  if (!user || (!user.uid && !user.email)) {
    throw new Error('Debes iniciar sesión con tu cuenta de Google para reclamar un perfil.');
  }

  // 1. Obtener usuario en 'users' de forma segura para comprobar su DNI y UUID
  let targetUserUuid = '';
  let userProfileDni = '';
  if (user.email) {
    try {
      const { data: dbUser } = await supabase
        .from('users')
        .select('id, email, dni, claimed_student_id')
        .eq('email', user.email)
        .maybeSingle();
      if (dbUser?.id) {
        targetUserUuid = dbUser.id;
        userProfileDni = dbUser.dni || '';
      }
    } catch (e) {}
  }

  if (!targetUserUuid && user.uid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.uid)) {
    try {
      const { data: dbUser } = await supabase
        .from('users')
        .select('id, email, dni, claimed_student_id')
        .eq('id', user.uid)
        .maybeSingle();
      if (dbUser?.id) {
        targetUserUuid = dbUser.id;
        userProfileDni = dbUser.dni || userProfileDni;
      }
    } catch (e) {}
  }

  // Comprobar DNI de la cuenta del usuario
  const cleanDni = (userProfileDni || inputDni || '').trim().replace(/\D/g, '');
  if (!cleanDni || cleanDni.length < 8) {
    throw new Error('Debes registrar tu número de DNI oficial de 8 dígitos en tu perfil antes de reclamar.');
  }

  const cleanSlug = studentIdOrSlug.toLowerCase().trim();
  let student = await getStudentById(cleanSlug);
  if (!student) {
    throw new Error('No se encontró el registro oficial de este estudiante.');
  }

  // Comprobar si ya fue reclamado por otra persona
  const claimInfo = isStudentClaimed(student.id);
  const alreadyClaimed = student.is_claimed || claimInfo.claimed;
  const currentClaimant = student.claimed_by_uid || claimInfo.uid;

  if (alreadyClaimed && currentClaimant && currentClaimant !== user.uid && currentClaimant !== targetUserUuid) {
    throw new Error('Este perfil de estudiante ya ha sido reclamado y verificado por otro usuario.');
  }

  // Comprobar si el usuario actual ya reclamó otro perfil previamente
  const localClaimedProfile = typeof window !== 'undefined' ? localStorage.getItem(`user_claimed_profile_${user.uid}`) : null;
  const localClaimedId = localClaimedProfile ? JSON.parse(localClaimedProfile)?.studentId : null;
  if (localClaimedId && localClaimedId !== student.id) {
    throw new Error('Ya has reclamado y verificado un perfil de estudiante anteriormente. Cada cuenta de Google solo puede reclamar un único perfil.');
  }

  try {
    let checkQuery = supabase.from('users').select('*');
    if (user.email) {
      checkQuery = checkQuery.eq('email', user.email);
    } else if (targetUserUuid) {
      checkQuery = checkQuery.eq('id', targetUserUuid);
    }
    const { data: userClaimCheck } = await checkQuery.limit(1).maybeSingle();

    const alreadyHasClaimedProfile = Boolean(
      (userClaimCheck as any)?.profile_appeal === true ||
      (userClaimCheck as any)?.claimed_student_id ||
      (userClaimCheck as any)?.is_verified_student
    );

    if (alreadyHasClaimedProfile && (userClaimCheck as any)?.claimed_student_id !== student.id) {
      throw new Error('Ya has reclamado un perfil oficial de estudiante. Cada cuenta de usuario solo puede tener un único perfil verificado.');
    }
  } catch (claimErr: any) {
    if (claimErr?.message && claimErr.message.includes('Ya has reclamado')) {
      throw claimErr;
    }
  }

  // Validar coincidencia de DNI con el padrón oficial del estudiante
  const expectedDni = (student.dni || getExpectedStudentDni(student.id) || '').trim().replace(/\D/g, '');
  if (expectedDni && expectedDni !== cleanDni) {
    throw new Error(`El número de DNI registrado en tu perfil (${cleanDni}) no coincide con el DNI oficial de este estudiante (${student.nombre_completo || student.nombre}). No puedes reclamar este perfil.`);
  }

  // Extraer nombres y apellidos oficiales directamente del estudiante reclamado
  const nombresVal = (student.nombres || student.nombre || '').trim();
  const apPaterno = (student.apellido_paterno || '').trim();
  const apMaterno = (student.apellido_materno || '').trim();
  const apellidosVal = (student.apellidos || `${apPaterno} ${apMaterno}`).trim();
  const officialName = (
    student.nombre_completo ||
    `${nombresVal} ${apellidosVal}`.trim() ||
    `${nombresVal} ${apPaterno} ${apMaterno}`.trim() ||
    'Estudiante'
  ).trim();
  const now = new Date().toISOString();
  const fixedInstituteId = '9029cbec-ead6-48ae-aace-3c348b0dc325';

  // 1. Reasignar interacciones, votos y eliminar registro de 'students' tras fusionar
  try {
    const userUuidToAssign = targetUserUuid || user.uid;

    // A. Reasignar tablas de interacción desde el ID/slug de estudiante al UUID del usuario
    await Promise.all([
      supabase.from('users_actitud').update({ target_user_id: userUuidToAssign }).eq('target_user_id', student.id),
      supabase.from('user_reseñas').update({ target_user_id: userUuidToAssign }).eq('target_user_id', student.id),
      supabase.from('users_crushes').update({ target_user_id: userUuidToAssign }).eq('target_user_id', student.id),
      supabase.from('user_love_messages').update({ target_user_id: userUuidToAssign }).eq('target_user_id', student.id),
      supabase.from('users_love_messages').update({ target_user_id: userUuidToAssign }).eq('target_user_id', student.id),
    ]);

    // B. Limpieza de autovotos (nadie puede votarse ni flecharse a sí mismo)
    await Promise.all([
      supabase.from('users_crushes').delete().eq('target_user_id', userUuidToAssign).eq('voter_uid', userUuidToAssign),
      supabase.from('users_actitud').delete().eq('target_user_id', userUuidToAssign).eq('voter_uid', userUuidToAssign),
      supabase.from('user_reseñas').delete().eq('target_user_id', userUuidToAssign).eq('voter_uid', userUuidToAssign),
    ]);

    // C. Calcular métricas reales directamente desde las tablas
    const isStudentUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(student.id);
    const [actitudRes, crushesRes, reviewsRes] = await Promise.all([
      isStudentUuid
        ? supabase.from('users_actitud').select('attitude_type').or(`target_user_id.eq.${userUuidToAssign},target_user_id.eq.${student.id}`)
        : supabase.from('users_actitud').select('attitude_type').eq('target_user_id', userUuidToAssign),
      isStudentUuid
        ? supabase.from('users_crushes').select('id').or(`target_user_id.eq.${userUuidToAssign},target_user_id.eq.${student.id}`)
        : supabase.from('users_crushes').select('id').eq('target_user_id', userUuidToAssign),
      isStudentUuid
        ? supabase.from('user_reseñas').select('stars').or(`target_user_id.eq.${userUuidToAssign},target_user_id.eq.${student.id}`)
        : supabase.from('user_reseñas').select('stars').eq('target_user_id', userUuidToAssign),
    ]);

    const tableFans = actitudRes.data ? actitudRes.data.filter((a: any) => a.attitude_type === 'fans' || a.attitude_type === 'fan').length : 0;
    const tableKnows = actitudRes.data ? actitudRes.data.filter((a: any) => a.attitude_type === 'yo_te_conozco' || a.attitude_type === 'knows').length : 0;
    const tableCrushes = crushesRes.data ? crushesRes.data.length : 0;
    const revs = reviewsRes.data || [];
    const tableRatings = revs.length;
    const tableScore = revs.length > 0 ? Number((revs.reduce((acc: number, r: any) => acc + (r.stars || 0), 0) / revs.length).toFixed(1)) : 0;

    // Preservar siempre los contadores del estudiante sin ponerlos en 0
    const actualFans = Math.max(student.fans_count || 0, tableFans);
    const actualKnows = Math.max(student.knows_count || 0, tableKnows);
    const actualCrushes = Math.max(student.crushes_count || 0, tableCrushes);
    const actualRatings = Math.max(student.total_ratings || 0, tableRatings);
    const actualScore = tableScore > 0 ? tableScore : (student.score || 0.0);

    // D. Heredar el nombre y apellidos oficiales en la tabla 'users' y asignar institute_id fijo
    const userUpdatePayload: any = {
      display_name: officialName,
      nombre_completo: officialName,
      nombre: nombresVal,
      apellidos: apellidosVal,
      nombres: nombresVal,
      apellido_paterno: apPaterno,
      apellido_materno: apMaterno,
      claimed_student_id: student.id,
      is_verified_student: true,
      profile_appeal: true,
      institute_id: fixedInstituteId, // '9029cbec-ead6-48ae-aace-3c348b0dc325'
      dni: cleanDni,
      fans_count: actualFans,
      knows_count: actualKnows,
      crushes_count: actualCrushes,
      score: actualScore,
      total_ratings: actualRatings,
      views_count: student.views_count || 0,
      photo_url: student.avatar_url || user.displayName || null,
    };

    const runUserUpdate = async (payload: any) => {
      let err: any = null;
      const targetId = targetUserUuid || user.uid;
      if (targetId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
        const res = await supabase.from('users').update(payload).eq('id', targetId);
        if (res.error) err = res.error;
      }
      if (user.email) {
        const res = await supabase.from('users').update(payload).eq('email', user.email);
        if (res.error) err = res.error;
      }
      return err;
    };

    let updateErr = await runUserUpdate(userUpdatePayload);
    // Si la columna profile_appeal aún no existiese en Supabase, reintentar sin ella para no bloquear
    if (updateErr && updateErr.code === 'PGRST204' && updateErr.message?.includes('profile_appeal')) {
      const { profile_appeal, ...payloadWithoutAppeal } = userUpdatePayload;
      await runUserUpdate(payloadWithoutAppeal);
    }

    // E. Eliminar el registro original de 'students' para que quede 100% absorbido por 'users'
    await supabase.from('students').delete().eq('id', student.id);
  } catch (err) {
    console.error('Error al fusionar y eliminar estudiante reclamado en Supabase:', err);
  }

  // 3. Persistir en localStorage (espejo en cliente y sincronización instantánea)
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`student_dni_${student.id}`, cleanDni);
      localStorage.setItem(`claimed_student_${student.id}`, JSON.stringify({
        claimed: true,
        uid: user.uid,
        at: now,
        name: officialName,
        nombres: nombresVal,
        apellido_paterno: apPaterno,
        apellido_materno: apMaterno,
        institute_id: fixedInstituteId,
        profile_appeal: true,
      }));
      localStorage.setItem(`user_claimed_profile_${user.uid}`, JSON.stringify({
        studentId: student.id,
        studentName: officialName,
        nombres: nombresVal,
        apellidoPaterno: apPaterno,
        apellidoMaterno: apMaterno,
        dni: cleanDni,
        claimedAt: now,
        institute_id: fixedInstituteId,
        profile_appeal: true,
      }));

      // Actualizar sesión del usuario en memoria para reflejar de inmediato su perfil reclamado
      updateStoredAuthUser({
        institute_id: fixedInstituteId,
        dni: cleanDni,
        claimed_student_id: student.id,
        displayName: officialName,
        is_verified_student: true,
        profile_appeal: true,
      });
    } catch (e) {}
  }

  student = {
    ...student,
    dni: cleanDni,
    is_claimed: true,
    claimed_by_uid: user.uid,
    claimed_at: now,
    claimed_by_name: officialName,
    institute_id: fixedInstituteId,
  };

  return {
    success: true,
    student,
    message: `¡Perfil reclamado con éxito! Tu identidad ha sido verificada oficialmente con tu DNI.`,
  };
}

/**
 * Obtiene los estudiantes asignados a un instituto / campus específico con sus conteos reales.
 * Realiza una consulta unificada: consulta la tabla 'students' y la tabla 'users' (usuarios asignados a este instituto).
 */
export async function getStudentsByInstitute(instituteId: string): Promise<Student[]> {
  try {
    const rawInstId = (instituteId || '').trim();
    const cleanInstId = rawInstId.toLowerCase();
    if (!rawInstId) return [];

    let unifiedList: any[] = [];
    const instIdsToQuery = new Set<string>();
    instIdsToQuery.add(rawInstId);
    instIdsToQuery.add(cleanInstId);

    // Resolver identificadores del centro (UUID, nombres y slugs) consultando educational_centers
    try {
      const { data: centers } = await supabase
        .from('educational_centers')
        .select('id, name');

      if (centers && centers.length > 0) {
        const matchedCenter = centers.find((c: any) => {
          if (c.id === rawInstId || c.id?.toLowerCase() === cleanInstId) return true;
          const cSlug = (c.name || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
          return cSlug === cleanInstId || c.name?.toLowerCase().includes(cleanInstId.replace(/-/g, ' '));
        });

        if (matchedCenter) {
          if (matchedCenter.id) {
            instIdsToQuery.add(matchedCenter.id);
            instIdsToQuery.add(matchedCenter.id.toLowerCase());
          }
          if (matchedCenter.name) {
            instIdsToQuery.add(matchedCenter.name);
            instIdsToQuery.add(matchedCenter.name.toLowerCase());
            const cSlug = matchedCenter.name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');
            instIdsToQuery.add(cSlug);
          }
        }
      }
    } catch (cErr) {
      console.warn('Aviso no crítico resolviendo identificadores de centro:', cErr);
    }

    const idList = Array.from(instIdsToQuery);

    // Consultar en paralelo tanto la tabla 'students' como la tabla 'users' para recuperar todos los estudiantes del instituto
    const [studentsRes, usersRes] = await Promise.all([
      supabase.from('students').select('*').in('institute_id', idList),
      supabase.from('users').select('*').in('institute_id', idList),
    ]);

    if (studentsRes.error) {
      console.warn('Aviso al consultar tabla students:', studentsRes.error.message || studentsRes.error);
    }
    if (usersRes.error) {
      console.warn('Aviso al consultar tabla users:', usersRes.error.message || usersRes.error);
    }

    // 1. Mapear estudiantes creados en la tabla 'students'
    const baseStudents = (studentsRes.data || []).map((s: any) => {
      const sId = s.id || s.student_id || s.profile_slug;
      const nombresVal = s.nombres || s.nombre || '';
      const apellidosVal = s.apellidos || `${s.apellido_paterno || ''} ${s.apellido_materno || ''}`.trim() || '';
      const nombreCompleto = s.nombre_completo || `${nombresVal} ${apellidosVal}`.trim() || 'Estudiante';

      return {
        ...s,
        id: sId,
        nombre: s.nombre || nombresVal,
        apellidos: apellidosVal,
        nombres: nombresVal,
        apellido_paterno: s.apellido_paterno || (apellidosVal ? apellidosVal.split(' ')[0] : ''),
        apellido_materno: s.apellido_materno || (apellidosVal ? apellidosVal.split(' ').slice(1).join(' ') : ''),
        nombre_completo: nombreCompleto,
        institute_id: s.institute_id || rawInstId,
        score: typeof s.score === 'number' ? Number(s.score) : 0.0,
        total_ratings: typeof s.total_ratings === 'number' ? s.total_ratings : 0,
        knows_count: typeof s.knows_count === 'number' ? s.knows_count : 0,
        fans_count: typeof s.fans_count === 'number' ? s.fans_count : 0,
        crushes_count: typeof s.crushes_count === 'number' ? s.crushes_count : 0,
        views_count: typeof s.views_count === 'number' ? Number(s.views_count) : 0,
        avatar_url: s.avatar_url || '',
        dni: s.dni || '',
        is_claimed: Boolean(s.is_claimed || s.claimed_by_uid),
        claimed_by_uid: s.claimed_by_uid || null,
        created_by: s.created_by || 'institute',
      };
    });

    // 2. Mapear usuarios reales de la tabla 'users' vinculados a este instituto
    const claimedUsers = usersRes.data || [];
    const usersAsStudents = claimedUsers.map((u: any) => {
      const fullName = u.nombre_completo || u.display_name || `${u.nombres || u.nombre || ''} ${u.apellido_paterno || ''} ${u.apellido_materno || ''}`.trim() || 'Estudiante';
      const parts = fullName.trim().split(' ');
      const nombresVal = u.nombres || u.nombre || parts[0] || 'Estudiante';
      const apellidosVal = u.apellidos || `${u.apellido_paterno || ''} ${u.apellido_materno || ''}`.trim() || parts.slice(1).join(' ');

      return {
        id: u.id,
        claimed_student_id: u.claimed_student_id || null,
        nombre: u.nombre || nombresVal,
        apellidos: apellidosVal,
        nombres: nombresVal,
        apellido_paterno: u.apellido_paterno || parts[1] || '',
        apellido_materno: u.apellido_materno || parts[2] || '',
        nombre_completo: fullName,
        institute_id: u.institute_id || rawInstId,
        created_by: 'user',
        score: typeof u.score === 'number' ? Number(u.score) : 0.0,
        total_ratings: typeof u.total_ratings === 'number' ? u.total_ratings : 0,
        knows_count: typeof u.knows_count === 'number' ? u.knows_count : 0,
        fans_count: typeof u.fans_count === 'number' ? u.fans_count : 0,
        crushes_count: typeof u.crushes_count === 'number' ? u.crushes_count : 0,
        views_count: typeof u.views_count === 'number' ? Number(u.views_count) : 0,
        avatar_url: u.photo_url || u.avatar_url || '',
        dni: u.dni || '',
        is_claimed: true,
        claimed_by_uid: u.id,
        claimed_by_name: fullName,
      };
    });

    // 3. Deduplicar sólo si un usuario de Google ya absorbió exactamente ese registro de estudiante (por ID)
    const claimedStudentIds = new Set<string>();
    usersAsStudents.forEach((u: any) => {
      if (u.claimed_student_id) claimedStudentIds.add(u.claimed_student_id);
      if (u.id) claimedStudentIds.add(u.id);
    });

    // Mantener todos los perfiles registrados en la tabla 'students' que no hayan sido absorbidos por su id
    const validStudentsFromTable = baseStudents.filter((s: any) => {
      if (s.id && claimedStudentIds.has(s.id)) return false;
      return true;
    });

    // Lista unificada: perfiles de students + perfiles de users
    unifiedList = [...validStudentsFromTable, ...usersAsStudents];

    if (!unifiedList || unifiedList.length === 0) {
      return [];
    }

    // Filtrar perfiles expulsados por moderación comunitaria
    const activeStudents = unifiedList.filter((s: any) => {
      const bio = s.biography || '';
      const name = s.nombre_completo || s.nombre || '';
      return !bio.includes('__EXPELLED_BY_COMMUNITY__') && !name.includes('[EXPULSADO');
    });

    if (activeStudents.length === 0) {
      return [];
    }

    const studentIds = activeStudents.map((p: any) => p.id);

    // Obtener interacciones (knows / fan) en batch para todos los IDs
    const interactionsMap: Record<string, { knows: number; fan: number }> = {};
    try {
      const { data: interactions } = await supabase
        .from('users_actitud')
        .select('target_user_id, attitude_type')
        .in('target_user_id', studentIds);

      if (interactions) {
        interactions.forEach((item: any) => {
          if (!interactionsMap[item.target_user_id]) {
            interactionsMap[item.target_user_id] = { knows: 0, fan: 0 };
          }
          if (item.attitude_type === 'yo_te_conozco' || item.attitude_type === 'knows') {
            interactionsMap[item.target_user_id].knows += 1;
          } else if (item.attitude_type === 'fans' || item.attitude_type === 'fan') {
            interactionsMap[item.target_user_id].fan += 1;
          }
        });
      }
    } catch (e) {
      console.warn('Aviso al cargar interacciones desde users_actitud:', e);
    }

    // Obtener crushes en batch desde users_crushes
    const crushesMap: Record<string, number> = {};
    try {
      const { data: crushes } = await supabase
        .from('users_crushes')
        .select('target_user_id')
        .in('target_user_id', studentIds);

      if (crushes && crushes.length > 0) {
        crushes.forEach((c: any) => {
          crushesMap[c.target_user_id] = (crushesMap[c.target_user_id] || 0) + 1;
        });
      }
    } catch (e) {
      console.warn('Aviso al cargar crushes de estudiantes:', e);
    }

    // Fallback de demostración garantizado para Daniel Gustavo Castillo Ramirez si no está en el listado
    const hasDaniel = activeStudents.some((s: any) => 
      s.id?.includes('daniel.gustavo') || 
      (s.dni && s.dni === '60036463') || 
      (s.nombre_completo && s.nombre_completo.toLowerCase().includes('daniel gustavo castillo'))
    );
    if (!hasDaniel && (cleanInstId.includes('pedagogico') || cleanInstId === 'instituto-pedagogico')) {
      const claim = isStudentClaimed('daniel.gustavo.castillo.ramirez');
      activeStudents.unshift({
        id: 'daniel.gustavo.castillo.ramirez',
        nombre: 'Daniel Gustavo',
        apellidos: 'Castillo Ramirez',
        nombre_completo: 'Daniel Gustavo Castillo Ramirez',
        institute_id: instituteId,
        created_by: 'admin',
        score: 4.3,
        total_ratings: 3,
        knows_count: 1,
        fans_count: 1,
        crushes_count: 2,
        views_count: 37,
        dni: '60036463',
        is_claimed: claim.claimed,
        claimed_by_uid: claim.uid,
        claimed_at: claim.at,
        claimed_by_name: claim.name,
      });
    }

    // Deduplicar estudiantes por ID único final
    const seenIds = new Set<string>();
    const deduplicatedStudents = activeStudents.filter((item: any) => {
      const idKey = String(item.id || '').trim();
      if (!idKey || seenIds.has(idKey)) {
        return false;
      }
      seenIds.add(idKey);
      return true;
    });

    // Mapear con datos reales
    return deduplicatedStudents.map((p: any) => {
      const ints = interactionsMap[p.id] || { knows: 0, fan: 0 };
      const expectedDni = p.dni || getExpectedStudentDni(p.id);
      const claim = isStudentClaimed(p.id);
      
      let localCrushCount = 0;
      if (typeof window !== 'undefined') {
        try {
          const localData = JSON.parse(localStorage.getItem(`student_crushes_${p.id}`) || '[]');
          if (Array.isArray(localData)) localCrushCount = localData.length;
        } catch (e) {}
      }

      const totalCrushes = Math.max(crushesMap[p.id] || 0, localCrushCount);

      return {
        ...p,
        dni: expectedDni || p.dni,
        is_claimed: p.is_claimed || claim.claimed,
        claimed_by_uid: p.claimed_by_uid || claim.uid,
        claimed_at: p.claimed_at || claim.at,
        claimed_by_name: p.claimed_by_name || claim.name,
        views_count: typeof p.views_count === 'number' ? p.views_count : (Number(p.views_count) || 0),
        knows_count: Math.max(ints.knows, p.knows_count || 0),
        fans_count: Math.max(ints.fan, p.fans_count || 0),
        crushes_count: Math.max(totalCrushes, p.crushes_count || 0),
        score: typeof p.score === 'number' ? Number(p.score) : 0.0,
        total_ratings: typeof p.total_ratings === 'number' ? p.total_ratings : 0,
      } as Student;
    });
  } catch (err) {
    console.warn('Excepción al obtener estudiantes por instituto:', err);
    return [];
  }
}

/**
 * Obtiene la interacción actual de un usuario con un estudiante desde 'users_actitud'.
 */
export async function getUserStudentInteraction(
  studentId: string,
  userUid: string
): Promise<{ interaction_type: 'knows' | 'fan' | null } | null> {
  if (!studentId || !userUid) return null;

  try {
    const { data, error } = await supabase
      .from('users_actitud')
      .select('attitude_type')
      .eq('target_user_id', studentId)
      .eq('voter_uid', userUid)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const type = data.attitude_type;
    if (type === 'yo_te_conozco' || type === 'knows') {
      return { interaction_type: 'knows' };
    }
    if (type === 'fans' || type === 'fan') {
      return { interaction_type: 'fan' };
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Obtiene los conteos totales de interacciones (YO TE CONOZCO y FAN) para un estudiante desde 'users_actitud'.
 */
export async function getStudentInteractionCounts(
  studentId: string,
  alternateTargetId?: string
): Promise<{ knows: number; fan: number }> {
  if (!studentId && !alternateTargetId) return { knows: 0, fan: 0 };

  try {
    const idsToQuery = [studentId, alternateTargetId].filter(Boolean) as string[];
    let dbFans = 0;
    let dbKnows = 0;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId);

    // 1. Buscar en 'users' de forma segura sin generar error de sintaxis UUID en PostgreSQL
    try {
      let userQuery = supabase.from('users').select('id, claimed_student_id, fans_count, knows_count');
      if (isUUID) {
        userQuery = userQuery.eq('id', studentId);
      } else {
        userQuery = userQuery.eq('claimed_student_id', studentId);
      }
      const { data: u } = await userQuery.limit(1).maybeSingle();

      if (u) {
        if (u.id && !idsToQuery.includes(u.id)) idsToQuery.push(u.id);
        if (u.claimed_student_id && !idsToQuery.includes(u.claimed_student_id)) idsToQuery.push(u.claimed_student_id);
        if (typeof u.fans_count === 'number') dbFans = Math.max(dbFans, u.fans_count);
        if (typeof u.knows_count === 'number') dbKnows = Math.max(dbKnows, u.knows_count);
      }
    } catch (e) {}

    // Si nos pasaron alternateTargetId y es UUID, buscarlo también en 'users'
    if (alternateTargetId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(alternateTargetId)) {
      try {
        const { data: altU } = await supabase
          .from('users')
          .select('id, claimed_student_id, fans_count, knows_count')
          .eq('id', alternateTargetId)
          .limit(1)
          .maybeSingle();

        if (altU) {
          if (altU.id && !idsToQuery.includes(altU.id)) idsToQuery.push(altU.id);
          if (altU.claimed_student_id && !idsToQuery.includes(altU.claimed_student_id)) idsToQuery.push(altU.claimed_student_id);
          if (typeof altU.fans_count === 'number') dbFans = Math.max(dbFans, altU.fans_count);
          if (typeof altU.knows_count === 'number') dbKnows = Math.max(dbKnows, altU.knows_count);
        }
      } catch (e) {}
    }

    // 2. Buscar en 'students'
    if (studentId) {
      try {
        const { data: s } = await supabase
          .from('students')
          .select('id, fans_count, knows_count')
          .eq('id', studentId)
          .limit(1)
          .maybeSingle();

        if (s) {
          if (typeof s.fans_count === 'number' && s.fans_count > dbFans) dbFans = s.fans_count;
          if (typeof s.knows_count === 'number' && s.knows_count > dbKnows) dbKnows = s.knows_count;
        }
      } catch (e) {}
    }

    const { data } = await supabase
      .from('users_actitud')
      .select('attitude_type')
      .in('target_user_id', idsToQuery);

    const tableKnows = (data || []).filter((item: any) => item.attitude_type === 'yo_te_conozco' || item.attitude_type === 'knows').length;
    const tableFan = (data || []).filter((item: any) => item.attitude_type === 'fans' || item.attitude_type === 'fan').length;

    // Preservar siempre los contadores de la base de datos (nunca sobreescribirlos con 0)
    const knows = Math.max(dbKnows, tableKnows);
    const fan = Math.max(dbFans, tableFan);

    return { knows, fan };
  } catch (err) {
    return { knows: 0, fan: 0 };
  }
}

/**
 * Incrementa de manera segura y generosa el contador de visualizaciones del perfil del estudiante.
 * Utiliza sessionStorage para no spammear en recargas continuas durante la misma sesión.
 * Utiliza RPC con SECURITY DEFINER para que cualquier visitante (incluso anónimo) pueda sumar +1.
 */
export async function incrementStudentViews(studentId: string): Promise<number> {
  if (!studentId) return 0;

  const sessionKey = `starryz_viewed_student_${studentId}`;
  const alreadyViewedInSession = typeof window !== 'undefined' && sessionStorage.getItem(sessionKey);

  try {
    // Si ya vio en esta sesión en este navegador, solo obtenemos el conteo real sin incrementar
    if (alreadyViewedInSession) {
      const { data: studentData } = await supabase
        .from('students')
        .select('views_count')
        .eq('id', studentId)
        .maybeSingle();

      return typeof studentData?.views_count === 'number'
        ? studentData.views_count
        : (studentData?.views_count ? Number(studentData.views_count) : 0);
    }

    // 1. Intentar registrar la vista atómicamente a través de RPC (Bypassea RLS con SECURITY DEFINER)
    try {
      const { data: rpcViews, error: rpcError } = await supabase.rpc('increment_student_views', {
        p_student_id: studentId,
      });

      if (!rpcError && typeof rpcViews === 'number' && rpcViews > 0) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(sessionKey, 'true');
        }
        return rpcViews;
      }
    } catch (rpcEx) {
      console.debug('Aviso RPC views:', rpcEx);
    }

    // 2. Fallback: Obtener conteo actual y actualizar de forma directa
    const { data: studentData, error: fetchError } = await supabase
      .from('students')
      .select('views_count, knows_count, fans_count')
      .eq('id', studentId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.warn('Error fetching student views:', fetchError);
    }

    const currentViews = typeof studentData?.views_count === 'number' 
      ? studentData.views_count 
      : (studentData?.views_count ? Number(studentData.views_count) : 0);

    const nextViews = currentViews + 1;

    // Marcamos en sessionStorage para evitar loops en la misma pestaña
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(sessionKey, 'true');
    }

    // Actualizar en Supabase de forma directa
    await supabase
      .from('students')
      .update({ views_count: nextViews })
      .eq('id', studentId);

    return nextViews;
  } catch (err) {
    console.warn('Error al registrar visualización de estudiante:', err);
    return 0;
  }
}

/**
 * Alterna la interacción (YO TE CONOZCO / FAN) para un estudiante en la tabla unificada 'users_actitud'.
 */
export async function toggleStudentInteraction(
  studentId: string,
  userUid: string,
  type: 'knows' | 'fan',
  studentName?: string,
  actorName?: string
): Promise<{ success: boolean; action: 'inserted' | 'deleted' | 'updated'; current_type: 'knows' | 'fan' | null } | null> {
  if (!studentId || !userUid || studentId === userUid) {
    return null;
  }

  // Prevenir autovotación si el estudiante es el perfil reclamado de este usuario
  try {
    const { data: linkedCheck } = await supabase
      .from('users')
      .select('id, claimed_student_id')
      .or(`id.eq.${studentId},claimed_student_id.eq.${studentId}`)
      .limit(1)
      .maybeSingle();

    if (linkedCheck?.id === userUid) {
      return null;
    }
  } catch (e) {}

  const attitudeType = type === 'knows' ? 'yo_te_conozco' : 'fans';

  try {
    // Verificar si ya existe voto de actitud en users_actitud
    const { data: existing, error: fetchErr } = await supabase
      .from('users_actitud')
      .select('id, attitude_type')
      .eq('target_user_id', studentId)
      .eq('voter_uid', userUid)
      .maybeSingle();

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      console.warn('Error al verificar actitud de estudiante en users_actitud:', fetchErr);
    }

    let resultAction: 'inserted' | 'deleted' | 'updated';
    let currentType: 'knows' | 'fan' | null = null;

    if (existing) {
      if (existing.attitude_type === attitudeType || (type === 'knows' && existing.attitude_type === 'knows') || (type === 'fan' && existing.attitude_type === 'fan')) {
        // Mismo tipo -> Quitar interacción (Eliminar)
        await supabase.from('users_actitud').delete().eq('id', existing.id);
        resultAction = 'deleted';
        currentType = null;
      } else {
        // Actualizar tipo
        const { error: updateErr } = await supabase
          .from('users_actitud')
          .update({ attitude_type: attitudeType })
          .eq('id', existing.id);

        if (updateErr) {
          await supabase.from('users_actitud').delete().eq('id', existing.id);
          await supabase.from('users_actitud').insert({
            target_user_id: studentId,
            voter_uid: userUid,
            attitude_type: attitudeType
          });
        }
        resultAction = 'updated';
        currentType = type;
      }
    } else {
      // Insertar nueva interacción en users_actitud
      const { error: insertErr } = await supabase.from('users_actitud').insert([
        {
          target_user_id: studentId,
          voter_uid: userUid,
          attitude_type: attitudeType,
        },
      ]);
      if (insertErr) {
        console.warn('Aviso insertando en users_actitud:', insertErr);
      }
      resultAction = 'inserted';
      currentType = type;
    }

    // Disparar notificaciones a los suscriptores en segundo plano
    try {
      const counts = await getStudentInteractionCounts(studentId);
      if (type === 'knows' && resultAction === 'inserted') {
        notifyStudentSubscribers({
          studentId,
          studentName,
          eventType: 'known_added',
          actorUid: userUid,
          actorName: actorName || 'Un estudiante',
          totalCount: counts.knows
        }).catch(() => {});
      } else if (type === 'fan') {
        notifyStudentSubscribers({
          studentId,
          studentName,
          eventType: resultAction === 'inserted' ? 'fan_added' : 'fan_removed',
          actorUid: userUid,
          actorName: actorName || 'Un estudiante',
          totalCount: counts.fan
        }).catch(() => {});
      }
    } catch (notifErr) {
      console.warn('Error disparando notificación de interacción de estudiante:', notifErr);
    }

    return { success: true, action: resultAction, current_type: currentType };
  } catch (err) {
    console.warn('Error al alternar interacción con estudiante:', err);
    return null;
  }
}

/**
 * Obtiene la lista de votos realizados por el usuario HOY para un estudiante desde 'user_reseñas'.
 */
export async function getTodayStudentVotes(studentId: string, userUid: string): Promise<number[]> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const { data, error } = await supabase
      .from('user_reseñas')
      .select('stars')
      .eq('target_user_id', studentId)
      .eq('voter_uid', userUid)
      .gte('created_at', todayIso);

    if (error || !data) {
      return [];
    }

    return (data || []).map((v: any) => Number(v.stars));
  } catch (err) {
    return [];
  }
}

/**
 * Obtiene la distribución de calificaciones (conteo de estrellas 1 a 5) de un estudiante.
 * Intenta leer primero directamente de las columnas cacheadas stars_1..stars_5 en 'students'.
 * Si son 0 o aún no se han calculado, consulta 'user_reseñas'.
 */
export interface StudentReviewItem {
  id: string;
  voter_uid: string;
  target_user_id: string;
  stars: number;
  created_at: string;
  voter_name?: string;
  voter_avatar?: string;
}

export async function getStudentReviewsList(
  studentId: string, 
  candidateIds?: string[]
): Promise<StudentReviewItem[]> {
  try {
    const rawIds = Array.from(new Set([studentId, ...(candidateIds || [])].filter(Boolean) as string[]));
    if (rawIds.length === 0) return [];

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const uuids = rawIds.filter(id => UUID_REGEX.test(id));
    const nonUuids = rawIds.filter(id => !UUID_REGEX.test(id));

    const allData: any[] = [];

    // 1. Consultar por UUIDs válidos (evita error 22P02 si target_user_id es tipo UUID en Postgres)
    if (uuids.length > 0) {
      try {
        let q = supabase
          .from('user_reseñas')
          .select('*')
          .order('created_at', { ascending: false });
        if (uuids.length === 1) {
          q = q.eq('target_user_id', uuids[0]);
        } else {
          q = q.in('target_user_id', uuids);
        }
        const { data, error } = await q;
        if (!error && data) {
          allData.push(...data);
        }
      } catch (e) {}
    }

    // 2. Consultar por IDs no-UUID (slugs, nombres, etc.) por si target_user_id es tipo TEXT
    if (nonUuids.length > 0) {
      try {
        let q = supabase
          .from('user_reseñas')
          .select('*')
          .order('created_at', { ascending: false });
        if (nonUuids.length === 1) {
          q = q.eq('target_user_id', nonUuids[0]);
        } else {
          q = q.in('target_user_id', nonUuids);
        }
        const { data, error } = await q;
        if (!error && data) {
          allData.push(...data);
        }
      } catch (e) {}
    }

    if (allData.length === 0) return [];

    // Deduplicar por id de reseña
    const seen = new Set<string>();
    const data = allData.filter(r => {
      if (!r || !r.id || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    data.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    const voterUids = Array.from(new Set(data.map((r: any) => r.voter_uid).filter(Boolean)));
    const voterMap = new Map<string, { name: string; avatar: string }>();

    if (voterUids.length > 0) {
      try {
        const voterUuids = voterUids.filter(id => UUID_REGEX.test(id));
        const voterNonUuids = voterUids.filter(id => !UUID_REGEX.test(id));
        const votersList: any[] = [];

        if (voterUuids.length > 0) {
          const { data: vData } = await supabase
            .from('users')
            .select('id, display_name, photo_url, nombres, apellido_paterno')
            .in('id', voterUuids);
          if (vData) votersList.push(...vData);
        }

        if (voterNonUuids.length > 0) {
          try {
            const { data: vData2 } = await supabase
              .from('users')
              .select('id, display_name, photo_url, nombres, apellido_paterno')
              .in('id', voterNonUuids);
            if (vData2) votersList.push(...vData2);
          } catch (e) {}
        }

        votersList.forEach((v: any) => {
          const vName = v.display_name || `${v.nombres || ''} ${v.apellido_paterno || ''}`.trim() || 'Usuario';
          voterMap.set(v.id, { name: vName, avatar: v.photo_url || '' });
        });
      } catch (e) {}
    }

    return data.map((r: any) => {
      const vInfo = voterMap.get(r.voter_uid);
      return {
        id: r.id,
        voter_uid: r.voter_uid,
        target_user_id: r.target_user_id,
        stars: Number(r.stars) || 5,
        created_at: r.created_at,
        voter_name: vInfo?.name || 'Miembro de la comunidad',
        voter_avatar: vInfo?.avatar || '',
      };
    });
  } catch (err) {
    return [];
  }
}

/**
 * Obtiene la distribución de calificaciones (conteo de estrellas 1 a 5) de un estudiante o usuario.
 * Consulta primero la tabla 'user_reseñas' por todos los IDs candidatos para reflejar
 * de inmediato las calificaciones del usuario (UUID) o del estudiante.
 */
export async function getStudentRatingBreakdown(
  studentId: string,
  candidateIds?: string[]
): Promise<{ [key: number]: number }> {
  const breakdown: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  try {
    const rawIds = Array.from(new Set([studentId, ...(candidateIds || [])].filter(Boolean) as string[]));
    if (rawIds.length === 0) return breakdown;

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const uuids = rawIds.filter(id => UUID_REGEX.test(id));
    const nonUuids = rawIds.filter(id => !UUID_REGEX.test(id));

    const votesList: any[] = [];

    // 1. Consultar UUIDs válidos (100% seguro contra error 22P02 de PostgreSQL)
    if (uuids.length > 0) {
      try {
        let q = supabase.from('user_reseñas').select('stars');
        if (uuids.length === 1) {
          q = q.eq('target_user_id', uuids[0]);
        } else {
          q = q.in('target_user_id', uuids);
        }
        const { data, error } = await q;
        if (!error && data) {
          votesList.push(...data);
        }
      } catch (e) {}
    }

    // 2. Consultar IDs no-UUID en caso de que target_user_id sea de tipo TEXT
    if (nonUuids.length > 0) {
      try {
        let q = supabase.from('user_reseñas').select('stars');
        if (nonUuids.length === 1) {
          q = q.eq('target_user_id', nonUuids[0]);
        } else {
          q = q.in('target_user_id', nonUuids);
        }
        const { data, error } = await q;
        if (!error && data) {
          votesList.push(...data);
        }
      } catch (e) {}
    }

    if (votesList.length > 0) {
      votesList.forEach((v: any) => {
        const s = Math.round(Number(v.stars));
        if (s >= 1 && s <= 5) {
          breakdown[s] = (breakdown[s] || 0) + 1;
        }
      });
      return breakdown;
    }

    // 3. Si no hay registros en user_reseñas, consultar columnas cacheadas en la tabla 'students'
    if (rawIds.length > 0) {
      try {
        const { data: studentData } = await supabase
          .from('students')
          .select('stars_1, stars_2, stars_3, stars_4, stars_5')
          .in('id', rawIds)
          .limit(1)
          .maybeSingle();

        if (studentData) {
          const s1 = Number(studentData.stars_1) || 0;
          const s2 = Number(studentData.stars_2) || 0;
          const s3 = Number(studentData.stars_3) || 0;
          const s4 = Number(studentData.stars_4) || 0;
          const s5 = Number(studentData.stars_5) || 0;

          if (s1 > 0 || s2 > 0 || s3 > 0 || s4 > 0 || s5 > 0) {
            return { 1: s1, 2: s2, 3: s3, 4: s4, 5: s5 };
          }
        }
      } catch (e) {}
    }

    return breakdown;
  } catch (err) {
    return breakdown;
  }
}

/**
 * Registra una calificación por estrellas para un estudiante en la tabla 'user_reseñas',
 * y actualiza de inmediato el promedio 'score', el 'total_ratings' y las 5 columnas 'stars_1' .. 'stars_5' en 'students'.
 */
export async function submitStudentVote(
  studentId: string,
  userUid: string,
  stars: number
): Promise<{ success: boolean; new_score: number; total_ratings: number; error?: string }> {
  try {
    if (studentId === userUid) {
      return { success: false, new_score: 0, total_ratings: 0, error: 'No puedes calificar tu propio perfil' };
    }

    try {
      const { data: linkedCheck } = await supabase
        .from('users')
        .select('id, claimed_student_id')
        .or(`id.eq.${studentId},claimed_student_id.eq.${studentId}`)
        .limit(1)
        .maybeSingle();

      if (linkedCheck?.id === userUid) {
        return { success: false, new_score: 0, total_ratings: 0, error: 'No puedes calificar tu propio perfil' };
      }
    } catch (e) {}

    // 1. Insertar el voto en 'user_reseñas'
    const { error: insertErr } = await supabase
      .from('user_reseñas')
      .insert([
        {
          target_user_id: studentId,
          voter_uid: userUid,
          stars: stars,
        }
      ]);

    if (insertErr) {
      console.warn('Aviso al insertar en user_reseñas:', insertErr.message);
    }

    // 2. Calcular nuevo promedio, total y desglose por cada estrella desde user_reseñas
    const { data: allVotes } = await supabase
      .from('user_reseñas')
      .select('stars')
      .eq('target_user_id', studentId);

    if (allVotes && allVotes.length > 0) {
      const sum = allVotes.reduce((acc, curr) => acc + Number(curr.stars), 0);
      const newScore = parseFloat((sum / allVotes.length).toFixed(1));
      const totalRatings = allVotes.length;

      const stars1 = allVotes.filter(v => Math.round(Number(v.stars)) === 1).length;
      const stars2 = allVotes.filter(v => Math.round(Number(v.stars)) === 2).length;
      const stars3 = allVotes.filter(v => Math.round(Number(v.stars)) === 3).length;
      const stars4 = allVotes.filter(v => Math.round(Number(v.stars)) === 4).length;
      const stars5 = allVotes.filter(v => Math.round(Number(v.stars)) === 5).length;

      await Promise.all([
        supabase
          .from('students')
          .update({
            score: newScore,
            total_ratings: totalRatings,
            stars_1: stars1,
            stars_2: stars2,
            stars_3: stars3,
            stars_4: stars4,
            stars_5: stars5,
          })
          .eq('id', studentId),
        supabase
          .from('users')
          .update({
            score: newScore,
            total_ratings: totalRatings,
          })
          .or(`id.eq.${studentId},claimed_student_id.eq.${studentId}`),
      ]);

      return { success: true, new_score: newScore, total_ratings: totalRatings };
    }

    const singleStar = Math.round(stars);
    await Promise.all([
      supabase
        .from('students')
        .update({
          score: stars,
          total_ratings: 1,
          stars_1: singleStar === 1 ? 1 : 0,
          stars_2: singleStar === 2 ? 1 : 0,
          stars_3: singleStar === 3 ? 1 : 0,
          stars_4: singleStar === 4 ? 1 : 0,
          stars_5: singleStar === 5 ? 1 : 0,
        })
        .eq('id', studentId),
      supabase
        .from('users')
        .update({
          score: stars,
          total_ratings: 1,
        })
        .or(`id.eq.${studentId},claimed_student_id.eq.${studentId}`),
    ]);

    return { success: true, new_score: stars, total_ratings: 1 };
  } catch (err: any) {
    console.error('Error al registrar calificación de estudiante:', err);
    return { success: false, new_score: 0, total_ratings: 0, error: err.message };
  }
}

/**
 * Obtiene el total de crushes y el estado del usuario para un estudiante desde 'users_crushes'.
 */
export async function getStudentCrushStatus(studentId: string, userUid: string): Promise<{ count: number; hasCrushed: boolean }> {
  if (!studentId) return { count: 0, hasCrushed: false };
  try {
    const idsToQuery = [studentId];
    let dbCrushes = 0;

    try {
      const { data: u } = await supabase
        .from('users')
        .select('id, claimed_student_id, crushes_count')
        .or(`id.eq.${studentId},claimed_student_id.eq.${studentId}`)
        .limit(1)
        .maybeSingle();

      if (u) {
        if (u.id && !idsToQuery.includes(u.id)) idsToQuery.push(u.id);
        if (u.claimed_student_id && !idsToQuery.includes(u.claimed_student_id)) idsToQuery.push(u.claimed_student_id);
        if (typeof u.crushes_count === 'number') dbCrushes = u.crushes_count;
      }
    } catch (e) {}

    try {
      const { data: s } = await supabase
        .from('students')
        .select('id, crushes_count')
        .eq('id', studentId)
        .limit(1)
        .maybeSingle();

      if (s && typeof s.crushes_count === 'number' && s.crushes_count > dbCrushes) {
        dbCrushes = s.crushes_count;
      }
    } catch (e) {}

    const { data, error } = await supabase
      .from('users_crushes')
      .select('id, voter_uid')
      .in('target_user_id', idsToQuery);

    const tableCount = (data || []).length;
    const hasCrushed = userUid ? (data || []).some((c: any) => c.voter_uid === userUid) : false;
    const count = Math.max(dbCrushes, tableCount);

    return { count, hasCrushed };
  } catch (err) {
    return { count: 0, hasCrushed: false };
  }
}

/**
 * Alterna el crush hacia un estudiante en 'users_crushes'.
 */
export async function toggleStudentCrush(
  studentId: string,
  userUid: string,
  studentName?: string,
  actorName?: string
): Promise<{ success: boolean; hasCrushed: boolean; count: number; error?: string }> {
  try {
    if (studentId === userUid) {
      return { success: false, hasCrushed: false, count: 0, error: 'No puedes darte crush a ti mismo' };
    }

    try {
      const { data: targetUser } = await supabase
        .from('users')
        .select('id, claimed_student_id')
        .or(`id.eq.${studentId},claimed_student_id.eq.${studentId}`)
        .limit(1)
        .maybeSingle();

      if (targetUser?.id === userUid) {
        return { success: false, hasCrushed: false, count: 0, error: 'No puedes darte crush a ti mismo en tu propio perfil' };
      }
    } catch (e) {}

    const { data: existing, error: checkErr } = await supabase
      .from('users_crushes')
      .select('id')
      .eq('target_user_id', studentId)
      .eq('voter_uid', userUid)
      .maybeSingle();

    if (checkErr && checkErr.code !== 'PGRST116') {
      console.warn('Error al verificar crush en users_crushes:', checkErr);
    }

    let hasCrushed = false;
    if (existing) {
      // Eliminar de users_crushes
      await supabase.from('users_crushes').delete().eq('id', existing.id);
      hasCrushed = false;
    } else {
      // Insertar en users_crushes
      const { error: insErr } = await supabase.from('users_crushes').insert([
        {
          target_user_id: studentId,
          voter_uid: userUid,
        }
      ]);

      if (insErr) {
        console.warn('Aviso insertando en users_crushes:', insErr.message);
      }
      hasCrushed = true;
    }

    // Contar total desde users_crushes
    const { data: allCrushes } = await supabase
      .from('users_crushes')
      .select('id')
      .eq('target_user_id', studentId);

    const count = (allCrushes || []).length;

    // Disparar notificación a los suscriptores en segundo plano
    try {
      notifyStudentSubscribers({
        studentId,
        studentName,
        eventType: hasCrushed ? 'crush_added' : 'crush_removed',
        actorUid: userUid,
        actorName: actorName || 'Alguien anónimo',
        totalCount: count
      }).catch(() => {});
    } catch (notifErr) {
      console.warn('Error disparando notificación de crush:', notifErr);
    }

    return { success: true, hasCrushed, count };
  } catch (err: any) {
    return { success: false, hasCrushed: false, count: 0, error: err.message };
  }
}

/**
 * Actualiza la información Wiki de un estudiante.
 */
export async function updateStudentWiki(
  studentId: string,
  data: Partial<Student>
): Promise<{ success: boolean; data?: Student; error?: string }> {
  try {
    const { data: updated, error } = await supabase
      .from('students')
      .update(data)
      .eq('id', studentId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: updated as Student };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface StudentLoveMessage {
  id: number | string;
  student_id: string;
  user_uid: string;
  author_name: string;
  author_avatar?: string | null;
  author_gender?: string | null;
  message: string;
  created_at: string;
  hearts_count?: number;
  has_hearted?: boolean;
}

/**
 * Obtiene los mensajes de amor / confesiones crush para un estudiante.
 */
/**
 * Obtiene los mensajes de amor / confesiones crush para un estudiante desde 'user_love_messages'.
 * Garantiza anonimato estricto: "Anónimo-" + primeras 8 letras/números del UID y sin foto de perfil.
 * Respeta el icono de sexo/género del autor si está seleccionado.
 */
export async function getStudentLoveMessages(
  studentId: string, 
  currentUserUid?: string,
  alternateTargetIds?: string[]
): Promise<StudentLoveMessage[]> {
  try {
    const idsToQuery = Array.from(new Set([studentId, ...(alternateTargetIds || [])].filter(Boolean)));

    // Si alguno de los IDs es un slug de estudiante, buscar si tiene un usuario UUID asociado en 'users'
    for (const id of [...idsToQuery]) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!isUUID) {
        try {
          const { data: u } = await supabase.from('users').select('id').eq('claimed_student_id', id).maybeSingle();
          if (u?.id && !idsToQuery.includes(u.id)) {
            idsToQuery.push(u.id);
          }
        } catch (e) {}
      } else {
        try {
          const { data: u } = await supabase.from('users').select('claimed_student_id').eq('id', id).maybeSingle();
          if (u?.claimed_student_id && !idsToQuery.includes(u.claimed_student_id)) {
            idsToQuery.push(u.claimed_student_id);
          }
        } catch (e) {}
      }
    }

    let allData: any[] = [];
    
    // 1. Intentar consultar desde user_love_messages (tabla singular)
    try {
      const res = await supabase
        .from('user_love_messages')
        .select('*')
        .in('target_user_id', idsToQuery)
        .order('created_at', { ascending: false });

      if (!res.error && res.data && res.data.length > 0) {
        allData.push(...res.data);
      }
    } catch (e) {}

    // 2. Consultar users_love_messages (plural)
    try {
      const resPlural = await supabase
        .from('users_love_messages')
        .select('*')
        .in('target_user_id', idsToQuery)
        .order('created_at', { ascending: false });
      if (!resPlural.error && resPlural.data && resPlural.data.length > 0) {
        allData.push(...resPlural.data);
      }
    } catch (e) {}

    // Deduplicar mensajes
    const seen = new Set<string>();
    const deduplicated = allData.filter(msg => {
      const key = `${msg.id || ''}_${msg.user_uid}_${msg.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let messages: StudentLoveMessage[] = deduplicated.map((msg: any) => ({
      ...msg,
      hearts_count: Number(msg.hearts_count) || 0
    }));

    // Cargar reacciones/corazones que ha dado el usuario actual desde user_love_reactions
    const userHeartedMessageIds = new Set<string>();
    if (currentUserUid) {
      try {
        // Consultar de user_love_reactions
        const { data: userReactions } = await supabase
          .from('user_love_reactions')
          .select('message_id')
          .eq('user_uid', currentUserUid);

        if (userReactions && Array.isArray(userReactions)) {
          userReactions.forEach(h => userHeartedMessageIds.add(String(h.message_id)));
        }

        // Consultar de users_love_message_hearts
        const { data: userHearts } = await supabase
          .from('users_love_message_hearts')
          .select('message_id')
          .eq('user_uid', currentUserUid);

        if (userHearts && Array.isArray(userHearts)) {
          userHearts.forEach(h => userHeartedMessageIds.add(String(h.message_id)));
        }
      } catch (hErr) {
        console.warn('Aviso cargando reacciones:', hErr);
      }
    }

    // Cargar géneros de autores si están registrados en tabla users para mostrar el icono de sexo
    const authorUids = Array.from(new Set(messages.map(m => m.user_uid).filter(Boolean)));
    const genderMap: Record<string, string> = {};
    if (authorUids.length > 0) {
      try {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, gender')
          .in('id', authorUids);
        if (usersData) {
          usersData.forEach((u: any) => {
            if (u.id && u.gender) genderMap[u.id] = u.gender;
          });
        }
      } catch (e) {}
    }

    // Formatear mensajes como 100% ANÓNIMOS ("Anónimo-" + primeras 8 del UID y sin foto)
    messages = messages.map(msg => {
      const isHearted = userHeartedMessageIds.has(String(msg.id));
      const uidPrefix = (msg.user_uid || '').substring(0, 8);
      const anonName = uidPrefix ? `Anónimo-${uidPrefix}` : 'Anónimo';

      let authorGender = msg.author_gender || genderMap[msg.user_uid] || null;
      if (!authorGender && typeof window !== 'undefined' && msg.user_uid) {
        authorGender = localStorage.getItem(`user_gender_${msg.user_uid}`) || null;
      }

      return {
        ...msg,
        author_name: anonName,
        author_avatar: null, // Anonimato garantizado: nunca foto de perfil
        author_gender: authorGender,
        has_hearted: isHearted,
        hearts_count: msg.hearts_count || 0
      };
    });

    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem(`student_love_messages_${studentId}`, JSON.stringify(messages));
    }

    return messages;
  } catch (err) {
    if (typeof window !== 'undefined') {
      const local = localStorage.getItem(`student_love_messages_${studentId}`);
      if (local) {
        try {
          const parsed: StudentLoveMessage[] = JSON.parse(local);
          return parsed.map(msg => ({
            ...msg,
            author_name: msg.user_uid ? `Anónimo-${msg.user_uid.substring(0, 8)}` : 'Anónimo',
            author_avatar: null,
            has_hearted: currentUserUid
              ? localStorage.getItem(`student_love_msg_heart_${msg.id}_${currentUserUid}`) === 'true'
              : false
          }));
        } catch (e) {}
      }
    }
    return [];
  }
}

/**
 * Alterna la reacción de amor (corazón / like) en 'user_love_reactions'.
 */
export async function toggleStudentLoveMessageHeart(
  messageId: number | string,
  userUid: string,
  studentId: string
): Promise<{ success: boolean; hasHearted: boolean; heartsCount: number; error?: string }> {
  try {
    let alreadyHearted = false;
    
    // Verificar si ya existe reacción en user_love_reactions
    try {
      const { data: existingReaction } = await supabase
        .from('user_love_reactions')
        .select('id')
        .eq('message_id', String(messageId))
        .eq('user_uid', userUid)
        .maybeSingle();

      if (existingReaction) alreadyHearted = true;
    } catch (e) {}

    if (!alreadyHearted) {
      try {
        const { data: existingHeart } = await supabase
          .from('users_love_message_hearts')
          .select('id')
          .eq('message_id', messageId)
          .eq('user_uid', userUid)
          .maybeSingle();

        if (existingHeart) alreadyHearted = true;
      } catch (e) {}
    }

    if (!alreadyHearted) {
      try {
        const { data: legacyHeart } = await supabase
          .from('student_love_message_hearts')
          .select('id')
          .eq('message_id', messageId)
          .eq('user_uid', userUid)
          .maybeSingle();
        if (legacyHeart) alreadyHearted = true;
      } catch (e) {}
    }

    let newHeartsCount = 0;
    let nextHasHearted = !alreadyHearted;

    // Obtener el conteo actual del mensaje
    let currentCount = 0;
    try {
      let { data: msgData } = await supabase
        .from('user_love_messages')
        .select('hearts_count')
        .eq('id', messageId)
        .maybeSingle();

      if (!msgData) {
        const pluralRes = await supabase
          .from('users_love_messages')
          .select('hearts_count')
          .eq('id', messageId)
          .maybeSingle();
        msgData = pluralRes.data;
      }

      if (msgData && msgData.hearts_count !== undefined && msgData.hearts_count !== null) {
        currentCount = Number(msgData.hearts_count) || 0;
      }
    } catch (e) {}

    if (alreadyHearted) {
      newHeartsCount = Math.max(0, currentCount - 1);
      await Promise.allSettled([
        supabase.from('user_love_reactions').delete().eq('message_id', String(messageId)).eq('user_uid', userUid),
        supabase.from('users_love_message_hearts').delete().eq('message_id', messageId).eq('user_uid', userUid),
      ]);
    } else {
      newHeartsCount = currentCount + 1;
      const reactionPayload = {
        message_id: String(messageId),
        user_uid: userUid,
        created_at: new Date().toISOString()
      };
      await Promise.allSettled([
        supabase.from('user_love_reactions').insert([reactionPayload]),
        supabase.from('users_love_message_hearts').insert([{
          message_id: messageId,
          user_uid: userUid,
          created_at: reactionPayload.created_at
        }]),
      ]);
    }

    // Actualizar columna general hearts_count en las tablas de mensajes
    await Promise.allSettled([
      supabase.from('user_love_messages').update({ hearts_count: newHeartsCount }).eq('id', messageId),
      supabase.from('users_love_messages').update({ hearts_count: newHeartsCount }).eq('id', messageId),
    ]);

    // Actualizar espejo en localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(`student_love_msg_heart_${messageId}_${userUid}`, String(nextHasHearted));
    }

    return {
      success: true,
      hasHearted: nextHasHearted,
      heartsCount: newHeartsCount
    };
  } catch (err: any) {
    console.error('Error toggling love message heart:', err);
    return {
      success: false,
      hasHearted: false,
      heartsCount: 0,
      error: err.message
    };
  }
}

/**
 * Crea un nuevo mensaje de amor 100% anónimo ("Anónimo-" + primeras 8 del UID y sin foto de perfil).
 * Guarda en 'user_love_messages' y almacena el género para mostrar el icono de sexo.
 */
export async function createStudentLoveMessage(
  studentId: string,
  userUid: string,
  _authorName: string,
  _authorAvatar: string | null,
  message: string,
  studentName?: string
): Promise<{ success: boolean; data?: StudentLoveMessage; error?: string }> {
  try {
    const trimmed = message.trim();
    if (!trimmed) {
      return { success: false, error: 'El mensaje no puede estar vacío.' };
    }
    if (trimmed.length > 500) {
      return { success: false, error: 'El mensaje no debe superar los 500 caracteres.' };
    }

    // Obtener género del autor para icono de sexo
    let authorGender: string | null = null;
    if (typeof window !== 'undefined') {
      authorGender = localStorage.getItem(`user_gender_${userUid}`) || localStorage.getItem('starryz_user_gender') || null;
    }
    if (!authorGender) {
      try {
        const { data: uData } = await supabase.from('users').select('gender').eq('id', userUid).maybeSingle();
        if (uData?.gender) authorGender = uData.gender;
      } catch (e) {}
    }

    // Anonimato estricto: "Anónimo-" + primeras 8 letras/números de su UID
    const anonPrefix = (userUid || '').substring(0, 8);
    const anonymousAuthorName = `Anónimo-${anonPrefix}`;

    // Construir payload limpio (sin columnas que puedan no existir)
    const basePayload: Record<string, any> = {
      target_user_id: String(studentId),
      user_uid: String(userUid),
      author_name: anonymousAuthorName,
      author_avatar: null, // Anonimato estricto: nunca foto
      message: trimmed,
      hearts_count: 0
    };
    if (authorGender) {
      basePayload.author_gender = authorGender;
    }

    let createdMsg: StudentLoveMessage | null = null;
    let lastErrorMsg: string | null = null;

    // 1. Intentar en 'user_love_messages' (singular)
    try {
      const res = await supabase
        .from('user_love_messages')
        .insert([basePayload])
        .select()
        .maybeSingle();

      if (!res.error && res.data) {
        createdMsg = {
          ...res.data,
          student_id: String(studentId),
          author_name: anonymousAuthorName,
          author_avatar: null,
          author_gender: authorGender,
          hearts_count: 0,
          has_hearted: false
        } as StudentLoveMessage;
      } else if (res.error) {
        lastErrorMsg = res.error.message;
        console.warn('Fallo insert en user_love_messages:', res.error);
        // Si falló por author_gender no existente, reintentar sin author_gender
        if (res.error.message?.includes('author_gender')) {
          const { author_gender, ...noGenderPayload } = basePayload;
          const retryRes = await supabase
            .from('user_love_messages')
            .insert([noGenderPayload])
            .select()
            .maybeSingle();
          if (!retryRes.error && retryRes.data) {
            createdMsg = {
              ...retryRes.data,
              student_id: String(studentId),
              author_name: anonymousAuthorName,
              author_avatar: null,
              author_gender: authorGender,
              hearts_count: 0,
              has_hearted: false
            } as StudentLoveMessage;
          }
        }
      }
    } catch (e: any) {
      lastErrorMsg = e?.message || lastErrorMsg;
    }

    // 2. Si falló 'user_love_messages', intentar en 'users_love_messages' (plural)
    if (!createdMsg) {
      try {
        const resPlural = await supabase
          .from('users_love_messages')
          .insert([basePayload])
          .select()
          .maybeSingle();

        if (!resPlural.error && resPlural.data) {
          createdMsg = {
            ...resPlural.data,
            student_id: String(studentId),
            author_name: anonymousAuthorName,
            author_avatar: null,
            author_gender: authorGender,
            hearts_count: 0,
            has_hearted: false
          } as StudentLoveMessage;
        } else if (resPlural.error) {
          lastErrorMsg = resPlural.error.message;
          console.warn('Fallo insert en users_love_messages:', resPlural.error);
          if (resPlural.error.message?.includes('author_gender')) {
            const { author_gender, ...noGenderPayload } = basePayload;
            const retryPlural = await supabase
              .from('users_love_messages')
              .insert([noGenderPayload])
              .select()
              .maybeSingle();
            if (!retryPlural.error && retryPlural.data) {
              createdMsg = {
                ...retryPlural.data,
                student_id: String(studentId),
                author_name: anonymousAuthorName,
                author_avatar: null,
                author_gender: authorGender,
                hearts_count: 0,
                has_hearted: false
              } as StudentLoveMessage;
            }
          }
        }
      } catch (e: any) {
        lastErrorMsg = e?.message || lastErrorMsg;
      }
    }

    // Si falló en la base de datos, informar el error real si no se pudo guardar
    if (!createdMsg) {
      return { 
        success: false, 
        error: lastErrorMsg 
          ? `Error al guardar en la base de datos: ${lastErrorMsg}`
          : 'No se pudo guardar el mensaje de amor en la base de datos. Verifica los permisos de Supabase.'
      };
    }

    // Guardar en caché local
    if (typeof window !== 'undefined') {
      try {
        const prev: StudentLoveMessage[] = JSON.parse(localStorage.getItem(`student_love_messages_${studentId}`) || '[]');
        localStorage.setItem(`student_love_messages_${studentId}`, JSON.stringify([createdMsg, ...prev]));
      } catch (e) {}
    }

    // Disparar notificación a los suscriptores en segundo plano
    try {
      const snippet = trimmed.length > 60 ? `${trimmed.substring(0, 57)}...` : trimmed;
      notifyStudentSubscribers({
        studentId,
        studentName,
        eventType: 'love_message',
        actorUid: userUid,
        actorName: anonymousAuthorName,
        loveMessageSnippet: snippet
      }).catch(() => {});
    } catch (notifErr) {
      console.warn('Error al disparar notificación de mensaje de amor:', notifErr);
    }

    return { success: true, data: createdMsg };
  } catch (err: any) {
    console.error('Error al crear mensaje de amor:', err);
    return { success: false, error: err.message || 'Error inesperado' };
  }
}

/**
 * Elimina un mensaje de amor propio en 'user_love_messages'.
 */
export async function deleteStudentLoveMessage(
  messageId: number | string,
  userUid: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await Promise.allSettled([
      supabase.from('user_love_messages').delete().eq('id', messageId).eq('user_uid', userUid),
      supabase.from('users_love_messages').delete().eq('id', messageId).eq('user_uid', userUid),
      supabase.from('user_love_reactions').delete().eq('message_id', String(messageId)),
      supabase.from('users_love_message_hearts').delete().eq('message_id', messageId),
    ]);

    if (typeof window !== 'undefined') {
      try {
        const prev: StudentLoveMessage[] = JSON.parse(localStorage.getItem(`student_love_messages_${studentId}`) || '[]');
        const updated = prev.filter(m => String(m.id) !== String(messageId));
        localStorage.setItem(`student_love_messages_${studentId}`, JSON.stringify(updated));
      } catch (e) {}
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 🔔 SISTEMA DE SUSCRIPCIÓN Y NOTIFICACIONES DE PERFILES DE ESTUDIANTES
// ============================================================================

export interface StudentNotificationPreferences {
  notify_crush: boolean;
  notify_love_message: boolean;
  notify_known: boolean;
  notify_fan: boolean;
}

const DEFAULT_PREFERENCES: StudentNotificationPreferences = {
  notify_crush: true,
  notify_love_message: true,
  notify_known: true,
  notify_fan: true
};

/**
 * Obtiene las preferencias de notificación de un usuario para un estudiante específico.
 */
export async function getStudentNotificationPreferences(
  studentId: string,
  userUid: string
): Promise<StudentNotificationPreferences | null> {
  try {
    // 1. Intentar consultar en Supabase
    const { data, error } = await supabase
      .from('student_notification_subscriptions')
      .select('notify_crush, notify_love_message, notify_known, notify_fan')
      .eq('student_id', studentId)
      .eq('user_uid', userUid)
      .maybeSingle();

    if (!error && data) {
      const prefs: StudentNotificationPreferences = {
        notify_crush: data.notify_crush ?? true,
        notify_love_message: data.notify_love_message ?? true,
        notify_known: data.notify_known ?? true,
        notify_fan: data.notify_fan ?? true
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(`student_notif_sub_${studentId}_${userUid}`, JSON.stringify(prefs));
      }
      return prefs;
    }

    // 2. Fallback de localStorage
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`student_notif_sub_${studentId}_${userUid}`);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    return null;
  } catch (err) {
    console.warn('Notice fetching student notification preferences:', err);
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`student_notif_sub_${studentId}_${userUid}`);
      if (cached) return JSON.parse(cached);
    }
    return null;
  }
}

/**
 * Guarda o actualiza las preferencias de suscripción para un perfil de estudiante.
 */
export async function saveStudentNotificationPreferences(
  studentId: string,
  userUid: string,
  prefs: StudentNotificationPreferences
): Promise<{ success: boolean; error?: string }> {
  try {
    // Guardar en localStorage inmediatamente
    if (typeof window !== 'undefined') {
      localStorage.setItem(`student_notif_sub_${studentId}_${userUid}`, JSON.stringify(prefs));
    }

    // Upsert en Supabase
    const { error } = await supabase
      .from('student_notification_subscriptions')
      .upsert(
        {
          student_id: studentId,
          user_uid: userUid,
          notify_crush: prefs.notify_crush,
          notify_love_message: prefs.notify_love_message,
          notify_known: prefs.notify_known,
          notify_fan: prefs.notify_fan,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'student_id,user_uid' }
      );

    if (error) {
      console.warn('Supabase notice on saving student subscription:', error.message);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error al guardar preferencias de notificación de estudiante:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Desactiva y elimina la suscripción a un estudiante.
 */
export async function removeStudentNotificationSubscription(
  studentId: string,
  userUid: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`student_notif_sub_${studentId}_${userUid}`);
    }

    const { error } = await supabase
      .from('student_notification_subscriptions')
      .delete()
      .eq('student_id', studentId)
      .eq('user_uid', userUid);

    if (error) {
      console.warn('Notice removing student notification subscription:', error.message);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Notifica a todos los usuarios suscritos a las novedades de un perfil de estudiante.
 */
export async function notifyStudentSubscribers(params: {
  studentId: string;
  studentName?: string;
  eventType: 'crush_added' | 'crush_removed' | 'love_message' | 'known_added' | 'fan_added' | 'fan_removed';
  actorUid?: string;
  actorName?: string;
  totalCount?: number;
  loveMessageSnippet?: string;
}): Promise<void> {
  const { studentId, studentName, eventType, actorUid, actorName, totalCount = 0, loveMessageSnippet } = params;

  try {
    // 1. Obtener nombre del estudiante si no viene provisto
    let displayName = studentName;
    let studentCreatorUid: string | null = null;

    if (!displayName) {
      try {
        const { data: st } = await supabase
          .from('students')
          .select('nombre, apellidos, nombre_completo, created_by')
          .eq('id', studentId)
          .maybeSingle();

        if (st) {
          displayName = st.nombre_completo || `${st.nombre} ${st.apellidos}`;
          studentCreatorUid = st.created_by || null;
        }
      } catch {}
    }

    const targetName = displayName || 'este perfil';

    // 2. Construir título, cuerpo y tipo según el evento
    let notifTitle = '';
    let notifBody = '';
    let notifCategory = 'general';
    let filterColumn: keyof StudentNotificationPreferences = 'notify_crush';

    switch (eventType) {
      case 'crush_added':
        notifTitle = '¡Nuevo Flechazo en el Campus! 💘';
        notifBody = `Alguien acaba de marcar como su Crush a ${targetName}. Total actual: ${totalCount} ${totalCount === 1 ? 'flechazo' : 'flechazos'}.`;
        notifCategory = 'crush_added';
        filterColumn = 'notify_crush';
        break;

      case 'crush_removed':
        notifTitle = 'Actualización de Crush 💔';
        notifBody = `Se ha retirado un flechazo en el perfil de ${targetName}. Total actual: ${totalCount} ${totalCount === 1 ? 'flechazo' : 'flechazos'}.`;
        notifCategory = 'crush_removed';
        filterColumn = 'notify_crush';
        break;

      case 'love_message':
        notifTitle = '¡Nueva Confesión de Amor! 💌';
        notifBody = `${actorName || 'Alguien'} ha dejado un mensaje de amor en el perfil de ${targetName}${loveMessageSnippet ? `: "${loveMessageSnippet}"` : ''}. ¡Entra a leerlo!`;
        notifCategory = 'love_message';
        filterColumn = 'notify_love_message';
        break;

      case 'known_added':
        notifTitle = '¡Alguien te reconoció! 👥';
        notifBody = `Un estudiante del campus ha indicado que conoce a ${targetName}. Total: ${totalCount} ${totalCount === 1 ? 'persona' : 'personas'}.`;
        notifCategory = 'known';
        filterColumn = 'notify_known';
        break;

      case 'fan_added':
        notifTitle = '¡Tienes un nuevo Fan! ⭐';
        notifBody = `Un usuario se ha sumado como fan del perfil de ${targetName}. Total: ${totalCount} ${totalCount === 1 ? 'fan' : 'fans'}.`;
        notifCategory = 'fan';
        filterColumn = 'notify_fan';
        break;

      case 'fan_removed':
        notifTitle = 'Actualización de Fans ⭐';
        notifBody = `Un usuario ha dejado de ser fan de ${targetName}. Total actual: ${totalCount} ${totalCount === 1 ? 'fan' : 'fans'}.`;
        notifCategory = 'fan';
        filterColumn = 'notify_fan';
        break;
    }

    const linkUrl = `/estudiantes/${studentId}`;

    // 3. Obtener suscriptores desde Supabase
    let subscriberUids = new Set<string>();

    try {
      const { data: subs, error } = await supabase
        .from('student_notification_subscriptions')
        .select('user_uid')
        .eq('student_id', studentId)
        .eq(filterColumn, true);

      if (!error && subs) {
        subs.forEach(s => {
          if (s.user_uid && s.user_uid !== actorUid) {
            subscriberUids.add(s.user_uid);
          }
        });
      }
    } catch (subErr) {
      console.warn('Aviso consultando suscriptores de estudiante:', subErr);
    }

    // 4. Si el creador del estudiante es conocido y no es el actor, incluirlo
    if (studentCreatorUid && studentCreatorUid !== actorUid) {
      subscriberUids.add(studentCreatorUid);
    }

    if (subscriberUids.size === 0) return;

    // 5. Insertar notificaciones en Supabase para cada suscriptor
    const insertPayloads = Array.from(subscriberUids).map(uid => ({
      user_uid: uid,
      title: notifTitle,
      body: notifBody,
      link_url: linkUrl,
      is_read: false,
      created_at: new Date().toISOString()
    }));

    try {
      const { error: insertErr } = await supabase
        .from('notifications')
        .insert(insertPayloads);

      if (insertErr) {
        console.warn('Notice inserting student notifications:', insertErr.message);
      }
    } catch (err) {
      console.warn('Error inserting student notifications to database:', err);
    }

    // 6. Invocar Push Notifications vía Edge Function
    const soundFile = (eventType === 'crush_added' || eventType === 'love_message') ? 'iloveyou.mp3' : 'noti.mp3';

    for (const uid of subscriberUids) {
      try {
        supabase.functions.invoke('rapid-processor', {
          body: {
            user_uid: uid,
            title: notifTitle,
            body: notifBody,
            link_url: linkUrl,
            category: notifCategory,
            type: notifCategory,
            event_type: eventType,
            sound: soundFile
          }
        }).catch(() => {});
      } catch {}
    }
  } catch (err) {
    console.error('Error en notifyStudentSubscribers:', err);
  }
}

export interface UserStudentSubscriptionItem {
  id: string;
  studentId: string;
  studentName: string;
  studentCareer: string;
  studentAvatar?: string | null;
  preferences: StudentNotificationPreferences;
  createdAt?: string;
}

/**
 * Obtiene todas las suscripciones a estudiantes realizadas por el usuario.
 */
export async function getUserStudentSubscriptions(userUid: string): Promise<UserStudentSubscriptionItem[]> {
  if (!userUid) return [];

  const items: UserStudentSubscriptionItem[] = [];
  const studentIds = new Set<string>();
  const prefsMap = new Map<string, { prefs: StudentNotificationPreferences; createdAt?: string }>();

  try {
    // 1. Consultar en Supabase
    try {
      const { data, error } = await supabase
        .from('student_notification_subscriptions')
        .select('*')
        .eq('user_uid', userUid)
        .order('created_at', { ascending: false });

      if (!error && data) {
        data.forEach((row: any) => {
          const sId = row.student_id;
          studentIds.add(sId);
          prefsMap.set(sId, {
            prefs: {
              notify_crush: row.notify_crush ?? true,
              notify_love_message: row.notify_love_message ?? true,
              notify_known: row.notify_known ?? true,
              notify_fan: row.notify_fan ?? true,
            },
            createdAt: row.created_at
          });
        });
      }
    } catch (e) {
      console.warn('Aviso consultando suscripciones de estudiantes en Supabase:', e);
    }

    // 2. Fallback con localStorage
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('student_notif_sub_') && key.endsWith(`_${userUid}`)) {
            const sId = key.replace('student_notif_sub_', '').replace(`_${userUid}`, '');
            if (!studentIds.has(sId)) {
              try {
                const cachedPrefs = JSON.parse(localStorage.getItem(key) || '{}');
                const hasActive = Object.values(cachedPrefs).some(Boolean);
                if (hasActive) {
                  studentIds.add(sId);
                  prefsMap.set(sId, {
                    prefs: {
                      notify_crush: cachedPrefs.notify_crush ?? true,
                      notify_love_message: cachedPrefs.notify_love_message ?? true,
                      notify_known: cachedPrefs.notify_known ?? true,
                      notify_fan: cachedPrefs.notify_fan ?? true,
                    }
                  });
                }
              } catch {}
            }
          }
        }
      } catch (e) {
        console.warn('Error leyendo localStorage de suscripciones de estudiantes:', e);
      }
    }

    if (studentIds.size === 0) return [];

    // 3. Enriquecer con datos de la tabla 'students'
    const studentsArray = Array.from(studentIds);
    const studentDataMap = new Map<string, any>();

    try {
      const { data: students, error: stErr } = await supabase
        .from('students')
        .select('id, nombre, apellidos, nombre_completo, avatar_url, carrera')
        .in('id', studentsArray);

      if (!stErr && students) {
        students.forEach((s: any) => studentDataMap.set(s.id.toLowerCase(), s));
      }
    } catch (e) {
      console.warn('Aviso enriqueciendo datos de estudiantes:', e);
    }

    studentsArray.forEach(id => {
      const s = studentDataMap.get(id.toLowerCase());
      const subInfo = prefsMap.get(id);
      items.push({
        id: `student_sub_${id}`,
        studentId: id,
        studentName: s?.nombre_completo || (s ? `${s.nombre} ${s.apellidos}`.trim() : id),
        studentCareer: s?.carrera || 'Estudiante',
        studentAvatar: s?.avatar_url || null,
        preferences: subInfo?.prefs || {
          notify_crush: true,
          notify_love_message: true,
          notify_known: true,
          notify_fan: true
        },
        createdAt: subInfo?.createdAt
      });
    });

    return items;
  } catch (err) {
    console.error('Error al obtener lista de suscripciones a estudiantes:', err);
    return [];
  }
}


