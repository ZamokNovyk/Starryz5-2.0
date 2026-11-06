import { supabase } from './supabase';
import { sendOtpEmailBrevo } from './brevo';

export interface IsppuMember {
  id: string; // slug e.g. "carlos.mendoza.ramirez"
  nombre: string;
  apellidos: string;
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  nombre_completo: string;
  institute_id: string;
  institutional_email?: string;
  tipo: 'estudiante' | 'profesor';
  created_by?: string;
  created_at?: string;
  knows_count?: number;
  fans_count?: number;
  crushes_count?: number;
  score?: number;
  total_ratings?: number;
  views_count?: number;
  avatar_url?: string;
  gender?: string;
  is_claimed?: boolean;
  claimed_by_uid?: string;
  claimed_at?: string;
  claimed_by_name?: string;
  otp_code?: string;
  otp_expires_at?: string;
}

export interface CreateIsppuMemberData {
  nombres: string;
  apellido_paterno: string;
  apellido_materno?: string;
  institutional_email: string;
  tipo: 'estudiante' | 'profesor';
  instituteId: string;
}

function toSlug(first: string, last: string): string {
  const combined = `${first.trim()} ${last.trim()}`;
  return combined
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');
}

/**
 * Inserta un nuevo miembro en la tabla 'isppu' (solo administradores).
 */
export async function createIsppuMember(
  data: CreateIsppuMemberData,
  firebaseUid: string
): Promise<IsppuMember> {
  const nombresVal = data.nombres.trim();
  const apPaterno = data.apellido_paterno.trim();
  const apMaterno = (data.apellido_materno || '').trim();
  const apellidosVal = `${apPaterno} ${apMaterno}`.trim();
  const nombreCompleto = `${nombresVal} ${apellidosVal}`.trim();
  const cleanEmail = data.institutional_email.trim().toLowerCase();

  const slugId = toSlug(nombresVal, apellidosVal);

  const insertPayload: any = {
    id: slugId,
    nombre: nombresVal,
    apellidos: apellidosVal,
    nombres: nombresVal,
    apellido_paterno: apPaterno,
    apellido_materno: apMaterno || null,
    nombre_completo: nombreCompleto,
    institutional_email: cleanEmail,
    tipo: data.tipo,
    institute_id: data.instituteId,
    created_by: firebaseUid,
    is_claimed: false,
  };

  const { data: resData, error } = await supabase
    .from('isppu')
    .insert([insertPayload])
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Error al guardar miembro en ISPPU.');
  }

  return resData as IsppuMember;
}

/**
 * Obtiene miembros de ISPPU filtrados por tipo ('estudiante' | 'profesor')
 */
export async function getIsppuMembers(
  instituteId?: string,
  tipo?: 'estudiante' | 'profesor'
): Promise<IsppuMember[]> {
  try {
    let query = supabase.from('isppu').select('*');

    if (instituteId) {
      query = query.eq('institute_id', instituteId);
    }
    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error al cargar miembros de ISPPU:', error);
      return [];
    }
    return (data || []) as IsppuMember[];
  } catch (err) {
    console.error('Excepción al cargar miembros:', err);
    return [];
  }
}

/**
 * Solicita el código OTP para reclamar un perfil por correo institucional
 */
export async function requestClaimOtp(
  memberId: string,
  inputEmail: string
): Promise<{ success: boolean; message: string; maskedEmail?: string }> {
  const cleanEmail = inputEmail.trim().toLowerCase();

  // 1. Buscar el miembro en isppu
  const { data: member, error: findError } = await supabase
    .from('isppu')
    .select('*')
    .eq('id', memberId)
    .maybeSingle();

  if (findError || !member) {
    throw new Error('No se encontró el perfil en el padrón de ISPPU.');
  }

  if (member.is_claimed) {
    throw new Error('Este perfil ya ha sido reclamado y verificado.');
  }

  const expectedEmail = (member.institutional_email || '').trim().toLowerCase();
  if (!expectedEmail) {
    throw new Error('Este perfil no tiene un correo institucional asignado por el administrador.');
  }

  if (expectedEmail !== cleanEmail) {
    throw new Error('El correo ingresado no coincide con el registrado en el padrón oficial.');
  }

  // 2. Generar código de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos

  // 3. Guardar el OTP en la tabla isppu
  const { error: updateError } = await supabase
    .from('isppu')
    .update({
      otp_code: code,
      otp_expires_at: expiresAt,
    })
    .eq('id', memberId);

  if (updateError) {
    throw new Error('No se pudo generar el código de verificación.');
  }

  // 4. Enviar correo usando la API de Brevo
  const emailRes = await sendOtpEmailBrevo({
    toEmail: cleanEmail,
    recipientName: member.nombre_completo || member.nombre,
    otpCode: code,
    role: member.tipo || 'estudiante',
  });

  if (!emailRes.success) {
    throw new Error(emailRes.error || 'No se pudo enviar el correo a tu Teams/Outlook.');
  }

  // Enmascarar correo para confirmación visual
  const [userPart, domain] = cleanEmail.split('@');
  const maskedUser = userPart.length > 3 
    ? `${userPart.slice(0, 2)}***${userPart.slice(-1)}` 
    : `${userPart}***`;
  const maskedEmail = `${maskedUser}@${domain}`;

  return {
    success: true,
    message: `Código enviado con éxito a ${maskedEmail}. Revisa tu bandeja de Teams o Outlook.`,
    maskedEmail,
  };
}

/**
 * Valida el OTP ingresado y completa el reclamo del perfil
 */
export async function verifyAndClaimProfile(
  memberId: string,
  inputCode: string,
  user: { uid: string; email?: string | null; displayName?: string | null }
): Promise<{ success: boolean; message: string; member: IsppuMember }> {
  const cleanCode = inputCode.trim();

  // 1. Obtener datos actuales del miembro
  const { data: member, error: findError } = await supabase
    .from('isppu')
    .select('*')
    .eq('id', memberId)
    .single();

  if (findError || !member) {
    throw new Error('No se encontró el perfil a reclamar.');
  }

  if (member.is_claimed) {
    throw new Error('Este perfil ya ha sido reclamado.');
  }

  if (!member.otp_code) {
    throw new Error('No hay un código pendiente de verificación. Solicita uno primero.');
  }

  // Verificar expiración
  const now = new Date();
  const expiresAt = member.otp_expires_at ? new Date(member.otp_expires_at) : null;
  if (!expiresAt || now > expiresAt) {
    throw new Error('El código de verificación ha expirado. Por favor solicita uno nuevo.');
  }

  // Verificar coincidencia de código
  if (member.otp_code !== cleanCode) {
    throw new Error('El código ingresado es incorrecto.');
  }

  const nowIso = new Date().toISOString();

  // 2. Marcar como reclamado en la tabla isppu
  const { data: updatedMember, error: updateError } = await supabase
    .from('isppu')
    .update({
      is_claimed: true,
      claimed_by_uid: user.uid,
      claimed_at: nowIso,
      claimed_by_name: user.displayName || user.email || 'Usuario Verificado',
      otp_code: null, // Limpiar OTP usado
      otp_expires_at: null,
    })
    .eq('id', memberId)
    .select('*')
    .single();

  if (updateError) {
    throw new Error('No se pudo actualizar el estado del perfil en la base de datos.');
  }

  // 3. Actualizar la tabla de usuarios de Supabase
  try {
    const userUpdatePayload: any = {
      is_verified_student: true,
      claimed_student_id: member.id,
      nombre_completo: member.nombre_completo || `${member.nombre} ${member.apellidos}`,
      display_name: member.nombre_completo || `${member.nombre} ${member.apellidos}`,
      institutional_email: member.institutional_email,
    };

    if (user.email) {
      await supabase.from('users').update(userUpdatePayload).eq('email', user.email);
    } else {
      await supabase.from('users').update(userUpdatePayload).eq('id', user.uid);
    }
  } catch (err) {
    console.warn('Aviso vinculando perfil en tabla users:', err);
  }

  // 4. Guardar en localStorage como backup
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`claimed_student_${member.id}`, JSON.stringify({
        claimed: true,
        uid: user.uid,
        at: nowIso,
        name: user.displayName,
      }));
      localStorage.setItem(`user_claimed_profile_${user.uid}`, JSON.stringify({
        studentId: member.id,
        at: nowIso,
      }));
    } catch (e) {}
  }

  return {
    success: true,
    message: `¡Perfil reclamado con éxito! Ahora tu cuenta representa a ${member.nombre_completo}.`,
    member: updatedMember as IsppuMember,
  };
}

