import { supabase } from './supabase';

export function toSlug(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '.') // replace non-alphanumeric with dot
    .replace(/\.+/g, '.') // collapse multiple dots
    .replace(/^\.|\.$/g, ''); // trim dots from start/end
}

export interface SearchSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  type: 'professor' | 'center' | 'student' | 'query';
  avatarUrl?: string;
  url: string;
  similarity?: number;
  isFuzzy?: boolean;
  didYouMean?: string;
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Calculador de distancia de Levenshtein para medir ediciones (inserciones, borrados, sustituciones)
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Mide la similitud entre dos palabras (0.0 a 1.0)
 */
export function tokenSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.9;

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(normA, normB);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Búsqueda inteligente con filtrado server-side (ilike) + Fuzzy Matching local.
 * Solo descarga los registros que coincidan con el query en Supabase, no toda la tabla.
 */
export async function searchWithAutocomplete(
  rawQuery: string,
  _threshold: number = 0.25
): Promise<SearchSuggestion[]> {
  const query = rawQuery.trim();
  if (!query || query.length < 1) return [];

  const normQuery = normalizeText(query);
  const queryTokens = normQuery.split(/\s+/).filter(Boolean);

  const exactResults: SearchSuggestion[] = [];
  const fuzzyResults: SearchSuggestion[] = [];
  const seenIds = new Set<string>();

  // Patrón para filtrado server-side: busca el primer token (más selectivo)
  const likePattern = `%${normQuery}%`;
  // Para búsqueda multi-token también buscamos por cada token individualmente
  const tokenPatterns = queryTokens.map(t => `%${t}%`);

  try {
    // ── Filtrado en SERVIDOR: Supabase devuelve solo los que coinciden ──────
    // Usamos columnas reales existentes en 'users' (display_name, email, nombres, apellido_paterno, apellido_materno)
    const usersFilter = supabase
      .from('users')
      .select('id,nombres,apellido_paterno,apellido_materno,display_name,email,photo_url,role,claimed_student_id')
      .or(
        `display_name.ilike.${likePattern},email.ilike.${likePattern},nombres.ilike.${likePattern},apellido_paterno.ilike.${likePattern}`
      )
      .limit(30);

    const isppuFilter = supabase
      .from('isppu')
      .select('id,nombre,apellidos,nombres,apellido_paterno,apellido_materno,nombre_completo,tipo,carrera,avatar_url,is_claimed,claimed_by_uid')
      .or(
        `nombre_completo.ilike.${likePattern},nombre.ilike.${likePattern},nombres.ilike.${likePattern},apellido_paterno.ilike.${likePattern}`
      )
      .limit(30);

    const [usersRes, isppuRes] = await Promise.all([usersFilter, isppuFilter]);

    // ── USUARIOS (tabla users) ──────────────────────────────────────────────
    if (!usersRes.error && Array.isArray(usersRes.data)) {
      usersRes.data.forEach((u: any) => {
        const fullStructured = [u.nombres, u.apellido_paterno, u.apellido_materno]
          .filter(Boolean)
          .join(' ')
          .trim();

        const dispName = u.display_name || u.username || '';
        const emailVal = u.email || '';
        const titleName = fullStructured || dispName || emailVal.split('@')[0] || 'Usuario';
        
        const fullBlob = normalizeText(`${fullStructured} ${dispName} ${emailVal}`);
        const wordsInUser = fullBlob.split(/\s+/).filter(Boolean);

        // 1. Coincidencia Exacta o Subcadena Directa
        const isExactSubstring = fullBlob.includes(normQuery) || 
          (queryTokens.length > 0 && queryTokens.every(t => fullBlob.includes(t)));

        const isClaimed = !!u.claimed_student_id;
        const subtitle = isClaimed 
          ? 'Estudiante Verificado' 
          : (u.role === 'admin' ? 'Administrador' : 'Usuario de Starryz');
        const uid = String(u.firebase_uid || u.id);

        if (isExactSubstring) {
          if (!seenIds.has(uid)) {
            seenIds.add(uid);
            exactResults.push({
              id: uid,
              title: titleName,
              subtitle,
              type: 'student',
              avatarUrl: u.photo_url || undefined,
              url: `/perfil/${uid}`,
              isFuzzy: false,
              similarity: 1.0
            });
          }
          return;
        }

        // 2. Coincidencia Difusa
        if (queryTokens.length > 0) {
          let totalScore = 0;
          let matchedTokensCount = 0;
          const correctedTokens: string[] = [];

          queryTokens.forEach(qToken => {
            let bestWord = '';
            let bestSim = 0;
            wordsInUser.forEach(uWord => {
              const sim = tokenSimilarity(qToken, uWord);
              if (sim > bestSim) { bestSim = sim; bestWord = uWord; }
            });
            if (bestSim >= 0.60) {
              matchedTokensCount++;
              totalScore += bestSim;
              correctedTokens.push(bestWord);
            }
          });

          if (matchedTokensCount === queryTokens.length && matchedTokensCount > 0) {
            const avgSim = totalScore / queryTokens.length;
            if (!seenIds.has(uid)) {
              seenIds.add(uid);
              fuzzyResults.push({
                id: uid,
                title: titleName,
                subtitle: `${subtitle} (Coincidencia cercana)`,
                type: 'student',
                avatarUrl: u.photo_url || undefined,
                url: `/perfil/${uid}`,
                isFuzzy: true,
                similarity: avgSim,
                didYouMean: titleName
              });
            }
          }
        }
      });
    }

    // ── ISPPU (padrón institucional) ────────────────────────────────────────
    if (!isppuRes.error && Array.isArray(isppuRes.data)) {
      isppuRes.data.forEach((m: any) => {
        // Construir nombre completo con todas las variantes disponibles
        const fullStructured = [m.nombres, m.apellido_paterno, m.apellido_materno]
          .filter(Boolean).join(' ').trim();
        const legacyFull = m.nombre_completo || `${m.nombre || ''} ${m.apellidos || ''}`.trim();
        const titleName = fullStructured || legacyFull || m.nombre || 'Miembro';

        const fullBlob = normalizeText(`${titleName} ${legacyFull}`);
        const wordsInMember = fullBlob.split(/\s+/).filter(Boolean);

        const isProfessor = m.tipo === 'profesor';
        const memberType: SearchSuggestion['type'] = isProfessor ? 'professor' : 'student';
        const subtitle = isProfessor
          ? (m.carrera ? `Profesor • ${m.carrera}` : 'Profesor')
          : (m.carrera ? `Estudiante • ${m.carrera}` : 'Estudiante');
        const url = isProfessor ? `/profesores/${m.id}` : `/estudiantes/${m.id}`;
        const memberId = `isppu-${m.id}`;

        // Evitar duplicar si el usuario ya reclamó este perfil (ya aparece en users)
        if (m.is_claimed && m.claimed_by_uid && seenIds.has(m.claimed_by_uid)) return;

        // 1. Coincidencia exacta
        const isExactSubstring = fullBlob.includes(normQuery) ||
          (queryTokens.length > 0 && queryTokens.every(t => fullBlob.includes(t)));

        if (isExactSubstring) {
          if (!seenIds.has(memberId)) {
            seenIds.add(memberId);
            exactResults.push({
              id: memberId,
              title: titleName,
              subtitle,
              type: memberType,
              avatarUrl: m.avatar_url || undefined,
              url,
              isFuzzy: false,
              similarity: 1.0
            });
          }
          return;
        }

        // 2. Coincidencia difusa
        if (queryTokens.length > 0) {
          let totalScore = 0;
          let matchedTokensCount = 0;

          queryTokens.forEach(qToken => {
            let bestSim = 0;
            wordsInMember.forEach(mWord => {
              const sim = tokenSimilarity(qToken, mWord);
              if (sim > bestSim) bestSim = sim;
            });
            if (bestSim >= 0.60) {
              matchedTokensCount++;
              totalScore += bestSim;
            }
          });

          if (matchedTokensCount === queryTokens.length && matchedTokensCount > 0) {
            const avgSim = totalScore / queryTokens.length;
            if (!seenIds.has(memberId)) {
              seenIds.add(memberId);
              fuzzyResults.push({
                id: memberId,
                title: titleName,
                subtitle: `${subtitle} (Coincidencia cercana)`,
                type: memberType,
                avatarUrl: m.avatar_url || undefined,
                url,
                isFuzzy: true,
                similarity: avgSim,
                didYouMean: titleName
              });
            }
          }
        }
      });
    }
  } catch (e) {
    console.warn('Error en búsqueda con autocompletado:', e);
  }

  // Ordenar difusos por similitud descendente
  fuzzyResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

  const finalCombined = [...exactResults, ...fuzzyResults];
  return finalCombined.slice(0, 8);
}
