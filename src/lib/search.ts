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
 * Búsqueda inteligente y rápida con tolerancia a faltas de ortografía (Fuzzy Matching + ¿Quizás quisiste decir?)
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

  try {
    const { data: usersData, error: usersErr } = await supabase
      .from('users')
      .select('*');

    if (!usersErr && Array.isArray(usersData)) {
      usersData.forEach((u: any) => {
        const fullStructured = [u.nombres, u.apellido_paterno, u.apellido_materno]
          .filter(Boolean)
          .join(' ')
          .trim();

        const dispName = u.display_name || u.username || '';
        const emailVal = u.email || '';
        const titleName = fullStructured || dispName || emailVal.split('@')[0] || 'Usuario';
        
        const fullBlob = normalizeText(`${fullStructured} ${dispName} ${emailVal}`);
        const wordsInUser = fullBlob.split(/\s+/).filter(Boolean);

        // 1. Comprobar si es Coincidencia Exacta o Subcadena Directa
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

        // 2. Comprobar Coincidencia Difusa (Tolerancia a Errores de Ortografía)
        if (queryTokens.length > 0) {
          let totalScore = 0;
          let matchedTokensCount = 0;
          const correctedTokens: string[] = [];

          queryTokens.forEach(qToken => {
            let bestWord = '';
            let bestSim = 0;

            wordsInUser.forEach(uWord => {
              const sim = tokenSimilarity(qToken, uWord);
              if (sim > bestSim) {
                bestSim = sim;
                bestWord = uWord;
              }
            });

            // Umbral de tolerancia a error (similitud >= 0.60 para palabras cortas/medianas)
            if (bestSim >= 0.60) {
              matchedTokensCount++;
              totalScore += bestSim;
              correctedTokens.push(bestWord);
            }
          });

          // Si todos o la gran mayoría de los tokens coinciden difusamente
          if (matchedTokensCount === queryTokens.length && matchedTokensCount > 0) {
            const avgSim = totalScore / queryTokens.length;
            if (!seenIds.has(uid)) {
              seenIds.add(uid);

              // Sugerencia de corrección ortográfica "¿Quizás quisiste decir?"
              const suggestedTerm = titleName;

              fuzzyResults.push({
                id: uid,
                title: titleName,
                subtitle: `${subtitle} (Coincidencia cercana)`,
                type: 'student',
                avatarUrl: u.photo_url || undefined,
                url: `/perfil/${uid}`,
                isFuzzy: true,
                similarity: avgSim,
                didYouMean: suggestedTerm
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
