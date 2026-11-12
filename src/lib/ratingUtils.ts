/**
 * Utilidades para formateo de calificaciones al estilo Nosedive (Black Mirror)
 * Muestra el puntaje base (ej. 4.5 o 5.0) y los siguientes 3 decimales de precisión (ej. 897 o 000)
 */

export interface NosediveScoreParts {
  main: string;
  sub: string;
  full: string;
}

export function formatNosediveScore(score: number | string | undefined | null): NosediveScoreParts {
  const num = typeof score === 'string' ? parseFloat(score) : Number(score);
  const validNum = !isNaN(num) && num >= 0 ? num : 0;
  
  // 4 decimales en total: 1er decimal en 'main', siguientes 3 en 'sub'
  const fixed = validNum.toFixed(4);
  const dotIndex = fixed.indexOf('.');
  
  if (dotIndex === -1) {
    return {
      main: `${fixed}.0`,
      sub: '000',
      full: `${fixed}.0000`,
    };
  }

  const main = fixed.slice(0, dotIndex + 2); // ej. "4.5" o "5.0"
  const sub = fixed.slice(dotIndex + 2, dotIndex + 5); // ej. "897" o "000"
  
  return {
    main,
    sub,
    full: `${main}${sub}`,
  };
}

