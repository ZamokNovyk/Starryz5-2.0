'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Upload, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  FileCheck2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Move,
  Maximize2
} from 'lucide-react';
import { 
  validateAvatarFile, 
  loadImageFromFile,
  compressAvatarToTarget, 
  CompressionResult,
  CropSettings
} from '@/src/lib/imageCompressor';
import { uploadAvatarToBackblaze, syncUserAvatarProfile } from '@/src/lib/backblaze';

interface AvatarUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentPhotoUrl?: string | null;
  onAvatarUpdated: (newPhotoUrl: string) => void;
}

const VIEWPORT_SIZE = 260; // Tamaño del visor de recorte en píxeles

export default function AvatarUploadModal({
  isOpen,
  onClose,
  userId,
  currentPhotoUrl,
  onAvatarUpdated
}: AvatarUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  
  // Estados de Recorte Interactivo
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [compressing, setCompressing] = useState(false);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = useRef<any>(null);

  // Recalcular compresión cuando cambien zoom, pan o rotación
  const runCompression = useCallback(async (
    img: HTMLImageElement, 
    fileSize: number, 
    crop: CropSettings
  ) => {
    try {
      setCompressing(true);
      const res = await compressAvatarToTarget(img, fileSize, crop);
      setCompressionResult(res);
    } catch (err: any) {
      console.error('Error al optimizar imagen:', err);
      setErrorMsg(err.message || 'Error al procesar la imagen');
    } finally {
      setCompressing(false);
    }
  }, []);

  // Debounced update al mover o hacer zoom
  useEffect(() => {
    if (!loadedImage || !selectedFile) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const crop: CropSettings = {
        x: pan.x,
        y: pan.y,
        zoom,
        rotation,
        viewportSize: VIEWPORT_SIZE,
      };
      runCompression(loadedImage, selectedFile.size, crop);
    }, 180);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [loadedImage, selectedFile, pan, zoom, rotation, runCompression]);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // 1. Validar límite de 5 MB y tipo
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Archivo no válido');
      return;
    }

    try {
      setCompressing(true);
      const img = await loadImageFromFile(file);
      setSelectedFile(file);
      setLoadedImage(img);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setRotation(0);

      const initialCrop: CropSettings = {
        x: 0,
        y: 0,
        zoom: 1,
        rotation: 0,
        viewportSize: VIEWPORT_SIZE,
      };

      const result = await compressAvatarToTarget(img, file.size, initialCrop);
      setCompressionResult(result);
    } catch (err: any) {
      console.error('Error al cargar imagen:', err);
      setErrorMsg(err.message || 'No se pudo cargar la imagen seleccionada');
      resetSelection();
    } finally {
      setCompressing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (compressing || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  // Controles de Arrastre (Mouse y Touch)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!loadedImage || uploading) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !loadedImage || uploading) return;
    // Limitar desplazamiento razonable
    const maxOffset = VIEWPORT_SIZE * 0.8 * zoom;
    const newX = Math.max(-maxOffset, Math.min(maxOffset, e.clientX - dragStart.x));
    const newY = Math.max(-maxOffset, Math.min(maxOffset, e.clientY - dragStart.y));
    setPan({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleResetCrop = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleUpload = async () => {
    if (!compressionResult || !userId) return;

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      setUploadProgressMsg('Guardando foto de perfil...');
      const uploadRes = await uploadAvatarToBackblaze(userId, compressionResult, currentPhotoUrl);

      setUploadProgressMsg('Actualizando datos en tu perfil...');
      await syncUserAvatarProfile(userId, uploadRes.publicUrl);

      setSuccessMsg('¡Foto de perfil actualizada con éxito!');
      onAvatarUpdated(uploadRes.publicUrl);

      // Cerrar modal automáticamente tras 1.2 segundos
      setTimeout(() => {
        onClose();
      }, 1200);

    } catch (err: any) {
      console.error('Error durante la subida:', err);
      setErrorMsg(err.message || 'Ocurrió un error al guardar la foto de perfil');
    } finally {
      setUploading(false);
      setUploadProgressMsg('');
    }
  };

  const resetSelection = () => {
    setSelectedFile(null);
    setLoadedImage(null);
    setCompressionResult(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) onClose();
      }}
    >
      <div 
        className="w-full max-w-xl bg-[#0e0e0e] border border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow sutil */}
        <div className="absolute top-0 right-0 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Encabezado sin referencias de infraestructura */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#eab308]/15 border border-[#eab308]/30 flex items-center justify-center text-[#eab308]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Foto de Perfil
              </h3>
              <p className="text-xs text-zinc-400">
                Ajusta el encuadre a tu gusto • Máx 5 MB (optimizado a 90 - 100 KB)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido del Modal */}
        <div className="py-4 overflow-y-auto space-y-4 relative z-10 no-scrollbar">
          
          {/* Mensajes de Alerta */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Vista 1: Selector de archivo */}
          {!loadedImage && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 hover:border-[#eab308] bg-zinc-900/40 hover:bg-zinc-900/80 rounded-2xl p-9 flex flex-col items-center justify-center text-center cursor-pointer transition-all group space-y-3"
            >
              <div className="w-16 h-16 rounded-full bg-zinc-800 group-hover:bg-[#eab308]/20 flex items-center justify-center text-zinc-400 group-hover:text-[#eab308] transition-colors shadow-inner">
                <Upload className="w-7 h-7 group-hover:scale-110 transition-transform" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-white group-hover:text-[#eab308] transition-colors">
                  Haz clic o arrastra tu foto aquí
                </p>
                <p className="text-xs text-zinc-400">
                  Formatos permitidos: JPG, PNG o WebP
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Límite: 5.0 MB
                </span>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-600/30">
                  Salida: 90 - 100 KB
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(file);
                }}
              />
            </div>
          )}

          {/* Vista 2: Recortador Interactivo */}
          {loadedImage && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Visor interactivo con máscara circular */}
              <div className="flex flex-col items-center">
                <div 
                  className="relative w-[260px] h-[260px] rounded-3xl bg-black overflow-hidden border border-zinc-700 shadow-inner select-none touch-none cursor-grab active:cursor-grabbing group"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  {/* Imagen dinámica orientada y escalada */}
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-75"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <img
                      src={loadedImage.src}
                      alt="Ajuste de avatar"
                      className="max-w-none object-cover"
                      style={{
                        width: loadedImage.width >= loadedImage.height ? 'auto' : `${VIEWPORT_SIZE}px`,
                        height: loadedImage.height > loadedImage.width ? 'auto' : `${VIEWPORT_SIZE}px`,
                        minWidth: `${VIEWPORT_SIZE}px`,
                        minHeight: `${VIEWPORT_SIZE}px`,
                      }}
                      draggable={false}
                    />
                  </div>

                  {/* Máscara oscura exterior con agujero circular iluminado */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div 
                      className="w-[220px] h-[220px] rounded-full border-2 border-[#eab308] shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] relative"
                    >
                      {/* Cuadrícula de guía sutil */}
                      <div className="absolute inset-0 rounded-full opacity-20 pointer-events-none grid grid-cols-3 grid-rows-3 border border-dashed border-white/50" />
                    </div>
                  </div>

                  {/* Indicador de ayuda al arrastrar */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/75 border border-zinc-700 text-[10px] text-zinc-300 font-medium flex items-center gap-1 opacity-80 pointer-events-none">
                    <Move className="w-3 h-3 text-[#eab308]" /> Arrastra para mover
                  </div>
                </div>
              </div>

              {/* Barra de Controles: Zoom, Rotar, Reajustar */}
              <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-300 font-semibold">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <ZoomIn className="w-3.5 h-3.5 text-[#eab308]" /> Acercar / Alejar
                  </span>
                  <span className="font-mono text-amber-400 font-bold">
                    {zoom.toFixed(1)}x
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(1, Number((z - 0.1).toFixed(1))))}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
                    title="Reducir zoom"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>

                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="flex-1 accent-[#eab308] cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
                  />

                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(1))))}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
                    title="Aumentar zoom"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>

                  <div className="h-5 w-[1px] bg-zinc-700 mx-1" />

                  <button
                    type="button"
                    onClick={handleRotate}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                    title="Girar 90 grados"
                  >
                    <RotateCw className="w-4 h-4 text-[#eab308]" />
                  </button>

                  <button
                    type="button"
                    onClick={handleResetCrop}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                    title="Centrar foto"
                  >
                    Centrar
                  </button>
                </div>
              </div>

              {/* Métricas de Optimización y Vista Previa Circular */}
              {compressionResult && (
                <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                  <div className="relative flex-shrink-0">
                    <img
                      src={compressionResult.base64}
                      alt="Vista previa final"
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-[#eab308] shadow-md"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-emerald-500 text-black shadow">
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Peso Original:</span>
                      <span className="font-mono text-zinc-300 font-bold">
                        {(compressionResult.originalSize / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Peso Optimizado:</span>
                      <span className="font-mono text-emerald-400 font-black flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {(compressionResult.compressedSize / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-0.5">
                      <span>Resolución: {compressionResult.width}×{compressionResult.height}px</span>
                      <span className="text-amber-400 font-mono font-semibold">WebP HD</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Botón para cambiar foto */}
              <button
                type="button"
                onClick={resetSelection}
                disabled={uploading}
                className="w-full py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Elegir otra imagen
              </button>
            </div>
          )}

        </div>

        {/* Pie del Modal */}
        <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-end gap-3 relative z-10">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          {loadedImage && compressionResult && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || compressing || Boolean(successMsg)}
              className="px-5 py-2.5 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(234,179,8,0.35)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>{uploadProgressMsg || 'Guardando...'}</span>
                </>
              ) : successMsg ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-black stroke-[2.5]" />
                  <span>Guardar Foto de Perfil</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
