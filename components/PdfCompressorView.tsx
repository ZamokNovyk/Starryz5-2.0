'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  FileCheck2,
  ShieldCheck,
  Zap,
  Sparkles,
  Image as ImageIcon,
  Sliders,
  FileUp,
  Files,
  HardDrive,
  ArrowDownRight,
  Percent,
  ListChecks,
  Play,
  FileText,
  Loader2,
  Check,
  Eye,
  Download,
  Trash2,
  Archive,
  X,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';

interface PdfCompressorViewProps {
  onBack: () => void;
  onNavigate?: (url: string) => void;
}

export interface PdfQueueItem {
  id: string;
  file: File;
  originalSize: number;
  compressedBlob: Blob | null;
  compressedSize: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  pagesCount: number;
}

export default function PdfCompressorView({ onBack }: PdfCompressorViewProps) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(true);

  // PDF.js status
  const [pdfjsReady, setPdfjsReady] = useState(false);

  // Settings
  const [modoCompresion, setModoCompresion] = useState<'preset' | 'custom'>('preset');
  const [presetSeleccionado, setPresetSeleccionado] = useState<'max' | 'balanced' | 'high_quality'>('balanced');
  const [customQuality, setCustomQuality] = useState<number>(60);
  const [customScale, setCustomScale] = useState<number>(1.0);
  const [isGrayscale, setIsGrayscale] = useState<boolean>(false);

  // Queue
  const [archivosEnCola, setArchivosEnCola] = useState<PdfQueueItem[]>([]);
  const isCompressingBatchRef = useRef(false);

  // Drag & drop
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewDocTitle, setPreviewDocTitle] = useState('');
  const [previewBlobTemp, setPreviewBlobTemp] = useState<Blob | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Toast
  const [toast, setToast] = useState<{ title: string; message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const showToast = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ title, message, type });
    setTimeout(() => {
      setToast(null);
    }, 3800);
  };

  // Check admin role
  useEffect(() => {
    async function checkRole() {
      if (!user) {
        setIsAdmin(false);
        setLoadingCheck(false);
        return;
      }
      try {
        let query = supabase.from('users').select('role');
        if (user.email) {
          query = query.eq('email', user.email);
        } else {
          query = query.eq('id', user.uid);
        }
        const { data, error } = await query.maybeSingle();
        if (!error && data && data.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error checking admin role in PdfCompressorView:', err);
        setIsAdmin(false);
      } finally {
        setLoadingCheck(false);
      }
    }
    checkRole();
  }, [user]);

  // Load PDF.js dynamically
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
      setPdfjsReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if ((window as any).pdfjsLib) {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        setPdfjsReady(true);
      }
    };
    document.head.appendChild(script);
  }, []);

  // Handle files added
  const handleFilesAdded = (files: File[]) => {
    const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      showToast('Formato no válido', 'Solo se permiten archivos en formato PDF.', 'error');
      return;
    }

    const newItems: PdfQueueItem[] = pdfs.map(f => ({
      id: 'pdf_' + Math.random().toString(36).substring(2, 10),
      file: f,
      originalSize: f.size,
      compressedBlob: null,
      compressedSize: 0,
      status: 'pending',
      progress: 0,
      pagesCount: 0
    }));

    setArchivosEnCola(prev => [...prev, ...newItems]);
    showToast('Archivos agregados', `${newItems.length} documento(s) listo(s) para comprimir.`, 'info');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(Array.from(e.dataTransfer.files));
    }
  };

  // Compress single file
  const comprimirArchivoIndividual = async (id: string) => {
    const pdfjs = (window as any).pdfjsLib;
    if (!pdfjs) {
      showToast('Espere un momento', 'El motor PDF local se está inicializando...', 'info');
      return;
    }

    setArchivosEnCola(prev =>
      prev.map(item => (item.id === id ? { ...item, status: 'processing', progress: 5 } : item))
    );

    const target = archivosEnCola.find(a => a.id === id);
    if (!target) return;

    try {
      let quality = 0.6;
      let scale = 1.0;
      let grayscale = false;

      if (modoCompresion === 'preset') {
        if (presetSeleccionado === 'max') {
          quality = 0.35;
          scale = 0.85;
        } else if (presetSeleccionado === 'balanced') {
          quality = 0.60;
          scale = 1.0;
        } else if (presetSeleccionado === 'high_quality') {
          quality = 0.82;
          scale = 1.2;
        }
      } else {
        quality = customQuality / 100;
        scale = customScale;
        grayscale = isGrayscale;
      }

      const arrayBuffer = await target.file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      const totalPages = pdfDoc.numPages;

      const newPdfDoc = await PDFDocument.create();

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No se pudo inicializar canvas context');

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;

        if (grayscale) {
          const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          for (let j = 0; j < data.length; j += 4) {
            const avg = (data[j] + data[j + 1] + data[j + 2]) / 3;
            data[j] = avg;
            data[j + 1] = avg;
            data[j + 2] = avg;
          }
          context.putImageData(imgData, 0, 0);
        }

        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        const jpegBytes = await fetch(jpegDataUrl).then(res => res.arrayBuffer());

        const embeddedImage = await newPdfDoc.embedJpg(jpegBytes);
        const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);

        newPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height,
        });

        const currentProg = Math.round((i / totalPages) * 100);
        setArchivosEnCola(prev =>
          prev.map(item =>
            item.id === id ? { ...item, progress: currentProg, pagesCount: totalPages } : item
          )
        );
      }

      const compressedBytes = await newPdfDoc.save({ useObjectStreams: true });
      const compressedBlob = new Blob([compressedBytes], { type: 'application/pdf' });

      setArchivosEnCola(prev =>
        prev.map(item =>
          item.id === id
            ? {
                ...item,
                compressedBlob,
                compressedSize: compressedBlob.size,
                status: 'done',
                progress: 100
              }
            : item
        )
      );

      showToast('Compresión lista', `${target.file.name} se comprimió con éxito.`, 'success');
    } catch (err) {
      console.error('Error comprimiendo PDF:', err);
      setArchivosEnCola(prev =>
        prev.map(item => (item.id === id ? { ...item, status: 'error' } : item))
      );
      showToast('Error', `No se pudo comprimir ${target.file.name}.`, 'error');
    }
  };

  // Compress all pending
  const comprimirTodos = async () => {
    if (isCompressingBatchRef.current) return;
    isCompressingBatchRef.current = true;

    const pendientes = archivosEnCola.filter(a => a.status === 'pending' || a.status === 'error');
    for (const item of pendientes) {
      await comprimirArchivoIndividual(item.id);
    }

    isCompressingBatchRef.current = false;
  };

  const eliminarArchivo = (id: string) => {
    setArchivosEnCola(prev => prev.filter(a => a.id !== id));
  };

  const vaciarTodo = () => {
    setArchivosEnCola([]);
    showToast('Lista vaciada', 'Se eliminaron todos los archivos en cola.', 'info');
  };

  const descargarIndividual = (item: PdfQueueItem) => {
    if (!item.compressedBlob) return;
    const url = URL.createObjectURL(item.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprimido_${item.file.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const descargarZipTodos = async () => {
    const listos = archivosEnCola.filter(a => a.status === 'done' && a.compressedBlob);
    if (listos.length === 0) return;

    try {
      const zip = new JSZip();
      listos.forEach(item => {
        if (item.compressedBlob) {
          zip.file(`comprimido_${item.file.name}`, item.compressedBlob);
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'archivos_comprimidos.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Descarga iniciada', 'Se descargó el paquete ZIP con todos tus PDFs comprimidos.', 'success');
    } catch (err) {
      console.error('Error generando zip:', err);
      showToast('Error', 'No se pudo generar el archivo ZIP.', 'error');
    }
  };

  const verPreview = async (item: PdfQueueItem) => {
    if (!item.compressedBlob) return;
    const pdfjs = (window as any).pdfjsLib;
    if (!pdfjs) return;

    setPreviewDocTitle(item.file.name);
    setPreviewBlobTemp(item.compressedBlob);
    setPreviewModalOpen(true);

    try {
      const arrayBuffer = await item.compressedBlob.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;
      const page = await doc.getPage(1);

      const viewport = page.getViewport({ scale: 1.25 });
      setTimeout(async () => {
        const canvas = previewCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport }).promise;
          }
        }
      }, 100);
    } catch (err) {
      console.error('Error rendering preview:', err);
    }
  };

  // Stats
  const totalCount = archivosEnCola.length;
  const completadosCount = archivosEnCola.filter(a => a.status === 'done').length;
  const origTotalBytes = archivosEnCola.reduce((acc, curr) => acc + curr.originalSize, 0);
  const compTotalBytes = archivosEnCola.reduce(
    (acc, curr) => acc + (curr.compressedSize || curr.originalSize),
    0
  );
  const origTotalMB = (origTotalBytes / (1024 * 1024)).toFixed(2);
  const compTotalMB = (compTotalBytes / (1024 * 1024)).toFixed(2);
  const ahorroPercent =
    origTotalBytes > 0
      ? Math.max(0, Math.round(((origTotalBytes - compTotalBytes) / origTotalBytes) * 100))
      : 0;

  if (loadingCheck) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-32 text-center space-y-6 px-4">
        <div className="text-rose-500 font-black text-2xl uppercase tracking-wider">Acceso Restringido</div>
        <p className="text-zinc-400 text-xs leading-relaxed">
          Esta herramienta de compresión algorítmica de archivos está disponible exclusivamente para administradores.
        </p>
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(234,179,8,0.2)]"
        >
          Volver a Herramientas
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080a] text-zinc-100 flex flex-col selection:bg-blue-600 selection:text-white pb-20">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-[#111218] border border-zinc-700/80 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 duration-200 max-w-sm">
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-blue-400 shrink-0" />
          )}
          <div className="text-xs">
            <p className="font-bold text-white">{toast.title}</p>
            <p className="text-zinc-400 text-[11px]">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#0e0f13] border-b border-zinc-800/90 sticky top-0 z-40 shadow-xl backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-blue-500/60 transition-colors cursor-pointer flex items-center justify-center"
              title="Volver a Herramientas"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base leading-tight tracking-tight text-white flex items-center gap-2">
                Compresor de PDF <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">100% Local</span>
              </h1>
              <p className="text-[11px] text-zinc-400 hidden sm:block">Procesamiento directo en tu navegador sin enviar archivos a la nube</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {totalCount > 0 && (
              <button
                onClick={vaciarTodo}
                className="text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/80 px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden md:inline">Vaciar lista</span>
              </button>
            )}

            {completadosCount > 0 && (
              <button
                onClick={descargarZipTodos}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-emerald-900/30 cursor-pointer"
              >
                <Archive className="w-4 h-4" />
                <span>Descargar ZIP ({completadosCount})</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">

        {/* Hero Banner */}
        <div className="relative rounded-3xl p-6 sm:p-8 text-white overflow-hidden shadow-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/80 via-[#0d1527] to-emerald-950/60">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-white border border-white/20">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Privacidad Total: Sin servidores ni almacenamiento externo
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Compresor de PDF Algorítmico Local
            </h2>
            <p className="text-blue-100/90 text-xs sm:text-sm leading-relaxed">
              Optimiza y reduce el tamaño de tus documentos re-codificando flujos de datos directamente en la memoria de tu dispositivo mediante HTML5 Canvas y PDF.js. ¡Rápido, privado y sin límites de páginas!
            </p>
          </div>
        </div>

        {/* Settings Panel */}
        <section className="bg-[#0f1015] rounded-2xl p-5 border border-zinc-800 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-3 border-b border-zinc-800/80">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                Ajustes de Calidad y Algoritmo
              </h3>
              <p className="text-xs text-zinc-400">Selecciona el perfil de compresión para tus archivos</p>
            </div>

            <div className="flex items-center gap-1.5 bg-[#171821] p-1 rounded-xl text-xs font-medium self-start md:self-auto border border-zinc-800">
              <button
                type="button"
                onClick={() => setModoCompresion('preset')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  modoCompresion === 'preset'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Perfiles Listos
              </button>
              <button
                type="button"
                onClick={() => setModoCompresion('custom')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  modoCompresion === 'custom'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Personalizado
              </button>
            </div>
          </div>

          {/* Presets Grid */}
          {modoCompresion === 'preset' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Max */}
              <div
                onClick={() => setPresetSeleccionado('max')}
                className={`cursor-pointer rounded-xl p-4 transition-all flex flex-col justify-between border-2 ${
                  presetSeleccionado === 'max'
                    ? 'border-blue-500 bg-blue-950/30 shadow-md shadow-blue-500/10'
                    : 'border-zinc-800 bg-[#13141a]/60 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Máxima Compresión
                  </span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    presetSeleccionado === 'max' ? 'border-blue-500 bg-blue-600' : 'border-zinc-600'
                  }`}>
                    {presetSeleccionado === 'max' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 mt-2">Máximo ahorro de espacio. Ideal para correos o límites estrictos.</p>
                <span className="inline-block mt-3 text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30 w-max">
                  Reducción: ~70% - 90%
                </span>
              </div>

              {/* Balanced */}
              <div
                onClick={() => setPresetSeleccionado('balanced')}
                className={`cursor-pointer rounded-xl p-4 transition-all flex flex-col justify-between border-2 ${
                  presetSeleccionado === 'balanced'
                    ? 'border-blue-500 bg-blue-950/40 shadow-md shadow-blue-500/10'
                    : 'border-zinc-800 bg-[#13141a]/60 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Recomendada (Balance)
                  </span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    presetSeleccionado === 'balanced' ? 'border-blue-500 bg-blue-600' : 'border-zinc-600'
                  }`}>
                    {presetSeleccionado === 'balanced' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 mt-2">Equilibrio entre nitidez de texto y reducción óptima de peso.</p>
                <span className="inline-block mt-3 text-[10px] font-black text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-md border border-blue-500/40 w-max">
                  Reducción: ~50% - 75%
                </span>
              </div>

              {/* High Quality */}
              <div
                onClick={() => setPresetSeleccionado('high_quality')}
                className={`cursor-pointer rounded-xl p-4 transition-all flex flex-col justify-between border-2 ${
                  presetSeleccionado === 'high_quality'
                    ? 'border-blue-500 bg-blue-950/30 shadow-md shadow-blue-500/10'
                    : 'border-zinc-800 bg-[#13141a]/60 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    Baja Compresión
                  </span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    presetSeleccionado === 'high_quality' ? 'border-blue-500 bg-blue-600' : 'border-zinc-600'
                  }`}>
                    {presetSeleccionado === 'high_quality' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 mt-2">Mantiene alta fidelidad de imágenes y detalles técnicos.</p>
                <span className="inline-block mt-3 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30 w-max">
                  Reducción: ~20% - 40%
                </span>
              </div>
            </div>
          )}

          {/* Custom Panel */}
          {modoCompresion === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-[#14151c] p-4 rounded-xl border border-zinc-800/90">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-zinc-300">Calidad JPEG</label>
                  <span className="text-xs font-black text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-md border border-blue-500/30">
                    {customQuality}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="95"
                  value={customQuality}
                  onChange={(e) => setCustomQuality(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Nivel de compresión de compresión por cuadro.</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-zinc-300">Escala de Resolución</label>
                  <span className="text-xs font-black text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-md border border-blue-500/30">
                    {customScale.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={customScale}
                  onChange={(e) => setCustomScale(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Escalado dimensional de renderizado.</p>
              </div>

              <div className="flex flex-col justify-center">
                <label className="cursor-pointer flex items-center gap-3 p-3 bg-[#1b1c26] border border-zinc-700/80 rounded-xl hover:border-zinc-600 transition">
                  <input
                    type="checkbox"
                    checked={isGrayscale}
                    onChange={(e) => setIsGrayscale(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Convertir a Blanco y Negro</span>
                    <span className="text-[10px] text-zinc-400 block">Procesamiento de píxeles desaturado para mayor ahorro.</span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </section>

        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center group ${
            isDragOver
              ? 'border-blue-500 bg-blue-950/20 scale-[1.005]'
              : 'border-zinc-800 hover:border-blue-500/60 bg-[#0d0e12] hover:bg-[#10121a]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesAdded(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
          />

          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition duration-300 shadow-inner">
            <FileUp className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>

          <h3 className="text-lg sm:text-xl font-black text-white mb-1">
            Arrastra tus archivos PDF aquí
          </h3>
          <p className="text-zinc-400 text-xs sm:text-sm max-w-md mb-6">
            Selecciona uno o varios documentos PDF desde tu dispositivo.
          </p>

          <span className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition flex items-center gap-2">
            <Files className="w-4 h-4" />
            Seleccionar Archivos
          </span>
        </div>

        {/* Stats Dashboard */}
        {totalCount > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
            <div className="bg-[#0f1015] p-4 rounded-2xl border border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                <Files className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-zinc-500 block uppercase tracking-wider">Archivos</span>
                <span className="text-lg font-black text-white">{totalCount}</span>
              </div>
            </div>

            <div className="bg-[#0f1015] p-4 rounded-2xl border border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-zinc-500 block uppercase tracking-wider">Peso Original</span>
                <span className="text-lg font-black text-white">{origTotalMB} MB</span>
              </div>
            </div>

            <div className="bg-[#0f1015] p-4 rounded-2xl border border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                <ArrowDownRight className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-zinc-500 block uppercase tracking-wider">Peso Comprimido</span>
                <span className="text-lg font-black text-emerald-400">{compTotalMB} MB</span>
              </div>
            </div>

            <div className="bg-[#0f1015] p-4 rounded-2xl border border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-zinc-500 block uppercase tracking-wider">Ahorro Total</span>
                <span className="text-lg font-black text-amber-400">-{ahorroPercent}%</span>
              </div>
            </div>
          </section>
        )}

        {/* Queue List */}
        {totalCount > 0 && (
          <section className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-blue-400" />
                Cola de Procesamiento
              </h3>

              <button
                onClick={comprimirTodos}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Comprimir Todos</span>
              </button>
            </div>

            <div className="space-y-3">
              {archivosEnCola.map((item) => {
                const origMB = (item.originalSize / (1024 * 1024)).toFixed(2);
                const compMB = item.compressedSize ? (item.compressedSize / (1024 * 1024)).toFixed(2) : '0';
                const ahorro = item.compressedSize
                  ? Math.round(((item.originalSize - item.compressedSize) / item.originalSize) * 100)
                  : 0;

                return (
                  <div
                    key={item.id}
                    className="bg-[#0f1015] border border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:border-zinc-700"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-red-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-red-500/20">
                        <FileText className="w-6 h-6" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-white text-sm truncate max-w-xs sm:max-w-md" title={item.file.name}>
                            {item.file.name}
                          </h4>
                          
                          {item.status === 'pending' && (
                            <span className="bg-zinc-800 text-zinc-400 text-[11px] font-bold px-2.5 py-0.5 rounded-lg">
                              En espera
                            </span>
                          )}
                          {item.status === 'processing' && (
                            <span className="bg-blue-500/20 text-blue-400 text-[11px] font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> {item.progress}%
                            </span>
                          )}
                          {item.status === 'done' && (
                            <span className="bg-emerald-500/20 text-emerald-400 text-[11px] font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1 border border-emerald-500/30">
                              <Check className="w-3 h-3" /> Reducido (-{ahorro}%)
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span className="bg-rose-500/20 text-rose-400 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-rose-500/30">
                              Error
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                          <span>Original: <strong className="text-zinc-200">{origMB} MB</strong></span>
                          {item.compressedSize > 0 && (
                            <span>• Comprimido: <strong className="text-emerald-400">{compMB} MB</strong></span>
                          )}
                        </div>

                        {item.status === 'processing' && (
                          <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-200"
                              style={{ width: `${item.progress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {item.status === 'done' && (
                        <>
                          <button
                            onClick={() => verPreview(item)}
                            title="Ver vista previa"
                            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-blue-400" />
                            <span className="hidden md:inline">Ver</span>
                          </button>

                          <button
                            onClick={() => descargarIndividual(item)}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-900/20"
                          >
                            <Download className="w-4 h-4" />
                            <span>Descargar</span>
                          </button>
                        </>
                      )}

                      {(item.status === 'pending' || item.status === 'error') && (
                        <button
                          onClick={() => comprimirArchivoIndividual(item.id)}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-900/20"
                        >
                          <Play className="w-4 h-4" />
                          <span>Comprimir</span>
                        </button>
                      )}

                      <button
                        onClick={() => eliminarArchivo(item.id)}
                        className="p-2 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 rounded-xl transition cursor-pointer"
                        title="Eliminar de la lista"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </main>

      {/* Modal Preview */}
      {previewModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#101217] border border-zinc-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-[#14161f]">
              <div>
                <h3 className="font-extrabold text-white text-sm sm:text-base">Vista Previa</h3>
                <p className="text-xs text-zinc-400 truncate max-w-md">{previewDocTitle} — Página 1 renderizada</p>
              </div>
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-auto flex-1 bg-[#090a0d] flex flex-col items-center justify-center">
              <canvas
                ref={previewCanvasRef}
                className="max-w-full h-auto bg-white shadow-2xl rounded-lg border border-zinc-700"
              />
            </div>

            <div className="p-4 bg-[#14161f] border-t border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500">Página 1</span>
              <div className="flex items-center gap-2">
                {previewBlobTemp && (
                  <button
                    onClick={() => {
                      const url = URL.createObjectURL(previewBlobTemp);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `comprimido_${previewDocTitle}`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Descargar PDF
                  </button>
                )}
                <button
                  onClick={() => setPreviewModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
