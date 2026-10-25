/**
 * profileReports.ts
 * Utilidades para sanitización de biografías.
 * El sistema de reportes comunitarios y votos de expulsión en biografías fue retirado.
 */

/**
 * Limpia cualquier metadato técnico o comentario HTML de la biografía para mantenerla limpia.
 */
export function stripBiographyMetadata(biography: string | null | undefined): string {
  if (!biography) return '';
  return biography
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

export default {
  stripBiographyMetadata,
};
