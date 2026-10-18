/**
 * imageCompressor.ts
 * Motor de compresión y recorte de avatares para Starryz 5.
 * 
 * Reglas de negocio:
 * 1. Límite máximo de subida original: 5 MB (5 * 1024 * 1024 bytes).
 * 2. Peso final comprimido: Máximo 100 KB y Mínimo 90 KB (o lo más cercano posible según el contenido).
 * 3. Formato de salida: WebP de ultra alta fidelidad (compatible con todos los navegadores modernos).
 * 4. Soporta recorte interactivo (pan, zoom, rotación) definido por el usuario.
 */

export interface CropSettings {
  x: number;          // Desplazamiento X en píxeles del viewport
  y: number;          // Desplazamiento Y en píxeles del viewport
  zoom: number;       // Factor de zoom (1.0 a 3.0)
  rotation: number;   // Rotación en grados (0, 90, 180, 270)
  viewportSize: number; // Tamaño del visor (ej: 260px)
}

export interface CompressionResult {
  blob: Blob;
  base64: string;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  width: number;
  height: number;
  format: 'image/webp' | 'image/jpeg';
}

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const TARGET_MAX_BYTES = 100 * 1024; // 100 KB (102,400 bytes)
export const TARGET_MIN_BYTES = 90 * 1024;  // 90 KB (92,160 bytes)

/**
 * Valida el archivo seleccionado antes de procesarlo
 */
export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No se seleccionó ningún archivo.' };
  }

  if (!file.type.startsWith('image/')) {
    return { 
      valid: false, 
      error: 'Formato no soportado. Por favor selecciona una imagen válida (JPG, PNG, WebP o GIF).' 
    };
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return { 
      valid: false, 
      error: `La foto seleccionada pesa ${sizeMb} MB. El límite máximo permitido es de 5 MB.` 
    };
  }

  return { valid: true };
}

/**
 * Carga un File en un elemento Image
 */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Renderiza el recorte interactivo (con zoom, pan y rotación) en un canvas
 */
export function renderCroppedCanvas(
  img: HTMLImageElement,
  dimension: number,
  crop?: CropSettings
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = dimension;
  canvas.height = dimension;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('No se pudo obtener el contexto 2D de Canvas');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (!crop) {
    // Recorte centrado por defecto
    const minSide = Math.min(img.width, img.height);
    const sx = (img.width - minSide) / 2;
    const sy = (img.height - minSide) / 2;
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, dimension, dimension);
    return canvas;
  }

  const { x, y, zoom, rotation, viewportSize } = crop;
  const scaleRatio = dimension / viewportSize;

  ctx.save();
  // Trasladar al centro del canvas
  ctx.translate(dimension / 2, dimension / 2);

  // Aplicar rotación
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }

  // Aplicar zoom y traslación
  ctx.scale(zoom, zoom);
  ctx.translate(x * scaleRatio, y * scaleRatio);

  // Calcular tamaño base para que la imagen cubra el viewport inicialmente
  const baseScale = Math.max(dimension / img.width, dimension / img.height);
  const drawWidth = img.width * baseScale;
  const drawHeight = img.height * baseScale;

  ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();

  return canvas;
}

/**
 * Convierte un canvas a Blob WebP con una calidad específica
 */
function canvasToBlob(
  canvas: HTMLCanvasElement, 
  quality: number, 
  format: 'image/webp' | 'image/jpeg' = 'image/webp'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Error al generar Blob'));
      },
      format,
      quality
    );
  });
}

/**
 * Convierte un Blob a base64 Data URL
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Algoritmo iterativo inteligente para ajustar el peso entre 90 KB y 100 KB
 */
export async function compressAvatarToTarget(
  fileOrImg: File | HTMLImageElement,
  originalSizeParam?: number,
  crop?: CropSettings
): Promise<CompressionResult> {
  let img: HTMLImageElement;
  let originalSize = 0;

  if (fileOrImg instanceof File) {
    const validation = validateAvatarFile(fileOrImg);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    img = await loadImageFromFile(fileOrImg);
    originalSize = fileOrImg.size;
  } else {
    img = fileOrImg;
    originalSize = originalSizeParam || 200 * 1024;
  }

  // Soporte de formato: Preferir WebP, fallback a JPEG
  let format: 'image/webp' | 'image/jpeg' = 'image/webp';
  const testCanvas = document.createElement('canvas');
  testCanvas.width = 1;
  testCanvas.height = 1;
  if (!testCanvas.toDataURL('image/webp').startsWith('data:image/webp')) {
    format = 'image/jpeg';
  }

  // Candidatos de calibración para aterrizar en 90 KB - 100 KB
  const candidateConfigs = [
    { dim: 1000, quality: 0.94 },
    { dim: 950,  quality: 0.92 },
    { dim: 900,  quality: 0.90 },
    { dim: 850,  quality: 0.88 },
    { dim: 800,  quality: 0.85 },
    { dim: 750,  quality: 0.82 },
    { dim: 700,  quality: 0.80 },
    { dim: 650,  quality: 0.78 },
    { dim: 1150, quality: 0.96 },
    { dim: 1250, quality: 0.97 },
    { dim: 600,  quality: 0.74 },
    { dim: 550,  quality: 0.70 },
  ];

  let bestBlob: Blob | null = null;
  let bestDim = 850;
  let closestUnder100: { blob: Blob; size: number; dim: number } | null = null;

  for (const cfg of candidateConfigs) {
    const canvas = renderCroppedCanvas(img, cfg.dim, crop);
    const blob = await canvasToBlob(canvas, cfg.quality, format);

    // Si cae exactamente en el rango óptimo 90 KB - 100 KB
    if (blob.size >= TARGET_MIN_BYTES && blob.size <= TARGET_MAX_BYTES) {
      bestBlob = blob;
      bestDim = cfg.dim;
      break;
    }

    // Registrar el mejor candidato que no supere 100 KB
    if (blob.size <= TARGET_MAX_BYTES) {
      if (!closestUnder100 || blob.size > closestUnder100.size) {
        closestUnder100 = { blob, size: blob.size, dim: cfg.dim };
      }
    }
  }

  // Si no cayó directamente entre 90 y 100 KB, realizamos ajuste fino
  if (!bestBlob) {
    if (closestUnder100 && closestUnder100.size < TARGET_MIN_BYTES) {
      // El archivo es menor a 90 KB: Subimos la resolución y calidad para máxima fidelidad
      let targetDim = Math.min(1400, Math.round(closestUnder100.dim * 1.35));
      let canvas = renderCroppedCanvas(img, targetDim, crop);
      
      // Probar calidades altas
      for (let q = 0.98; q >= 0.75; q -= 0.03) {
        const b = await canvasToBlob(canvas, q, format);
        if (b.size <= TARGET_MAX_BYTES) {
          if (!bestBlob || b.size > bestBlob.size) {
            bestBlob = b;
            bestDim = targetDim;
          }
          if (b.size >= TARGET_MIN_BYTES) break;
        }
      }
    } else {
      // Búsqueda binaria de calidad hacia abajo para no sobrepasar los 100 KB
      let lowQ = 0.50;
      let highQ = 0.92;
      let safeDim = 600;
      let safeCanvas = renderCroppedCanvas(img, safeDim, crop);
      bestDim = safeDim;

      for (let i = 0; i < 6; i++) {
        const midQ = (lowQ + highQ) / 2;
        const b = await canvasToBlob(safeCanvas, midQ, format);
        if (b.size > TARGET_MAX_BYTES) {
          highQ = midQ;
        } else {
          bestBlob = b;
          if (b.size >= TARGET_MIN_BYTES) break;
          lowQ = midQ;
        }
      }
    }
  }

  // Fallback si por algún motivo extremo aún no se obtuvo blob válido
  if (!bestBlob || bestBlob.size > TARGET_MAX_BYTES) {
    const fallbackCanvas = renderCroppedCanvas(img, 500, crop);
    bestBlob = await canvasToBlob(fallbackCanvas, 0.75, format);
    bestDim = 500;
  }

  const base64 = await blobToBase64(bestBlob);
  const compressedSize = bestBlob.size;
  const savingsPercent = Math.max(0, Number((((originalSize - compressedSize) / originalSize) * 100).toFixed(1)));

  return {
    blob: bestBlob,
    base64,
    originalSize,
    compressedSize,
    savingsPercent,
    width: bestDim,
    height: bestDim,
    format
  };
}
