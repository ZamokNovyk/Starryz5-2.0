export interface ShareOptions {
  title: string;
  text?: string;
  url?: string;
}

export interface ShareResult {
  shared: boolean;
  copied: boolean;
}

/**
 * Abre el menú nativo de compartir del celular (WhatsApp, Telegram, Instagram, etc.)
 * a través de la Web Share API (navigator.share).
 * Si el dispositivo no lo soporta (por ejemplo en PC de escritorio), realiza un
 * fallback copiando el enlace al portapapeles.
 */
export async function shareContent(options: ShareOptions): Promise<ShareResult> {
  const url = options.url || (typeof window !== 'undefined' ? window.location.href : '');
  const title = options.title || 'Wikistars';
  const text = options.text || title;

  // 1. Intentar Web Share API nativo (compatible con teléfonos Android y iOS)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title,
        text,
        url,
      });
      return { shared: true, copied: false };
    } catch (err: any) {
      // Si el usuario canceló la hoja nativa de compartir (AbortError), no hacemos fallback
      if (err?.name === 'AbortError') {
        return { shared: false, copied: false };
      }
      console.warn('Web Share API no completado, recurriendo al portapapeles:', err);
    }
  }

  // 2. Fallback: Copiar al portapapeles si no se soporta el menú nativo
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(url);
      return { shared: false, copied: true };
    } catch (clipErr) {
      console.warn('Fallo al copiar con navigator.clipboard:', clipErr);
    }
  }

  // 3. Fallback secundario para navegadores antiguos
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (success) {
        return { shared: false, copied: true };
      }
    } catch {
      // ignorar
    }
  }

  return { shared: false, copied: false };
}
