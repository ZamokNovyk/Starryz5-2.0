'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  ArrowLeft,
  Upload,
  Download,
  Trash2,
  FileUp,
  FilePlus2,
  RotateCw,
  Eye,
  ZoomIn,
  ZoomOut,
  X,
  Check,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { PDFDocument, degrees } from 'pdf-lib';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';

interface PdfOrganizerViewProps {
  onBack: () => void;
  onNavigate?: (url: string) => void;
}

export interface PdfPageItem {
  id: string;
  type: 'pdf' | 'blank';
  bytes: Uint8Array | null;
  originalIndex: number;
  rotation: number;
  tagColor: string;
  tagLabel: string;
}

export default function PdfOrganizerView({ onBack }: PdfOrganizerViewProps) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(true);

  // PDF.js library status
  const [pdfjsReady, setPdfjsReady] = useState(false);

  // Application pages state
  const [pages, setPages] = useState<PdfPageItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Loading indicator modal
  const [loaderVisible, setLoaderVisible] = useState(false);
  const [loaderTitle, setLoaderTitle] = useState('Procesando PDF...');
  const [loaderMessage, setLoaderMessage] = useState('Generando vista previa...');

  // Blank Sheet Modal
  const [blankModalOpen, setBlankModalOpen] = useState(false);
  const [blankQuantity, setBlankQuantity] = useState(1);
  const [blankRefPage, setBlankRefPage] = useState(1);
  const [blankPlacement, setBlankPlacement] = useState<'antes' | 'despues'>('despues');

  // Confirmation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [onConfirmCallback, setOnConfirmCallback] = useState<(() => void) | null>(null);

  // Large Preview Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1.0);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // File naming and Download Modal
  const [namingModalOpen, setNamingModalOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState('Documento_Organizado');

  // Download Fallback Modal
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadBlobUrl, setDownloadBlobUrl] = useState<string | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ title: string; message: string; type: 'info' | 'success' | 'error' } | null>(null);

  // Target position for insertion
  const targetInsertionIndexRef = useRef<number | null>(null);
  const fileInputSpecificRef = useRef<HTMLInputElement | null>(null);
  const fileInputMainRef = useRef<HTMLInputElement | null>(null);

  // Keep track of active renders
  const activeRenderTasksRef = useRef<{ [key: string]: any }>({});
  const renderVersionsRef = useRef<{ [key: string]: number }>({});

  // Check Admin role
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
        console.error('Error checking admin role in PdfOrganizerView:', err);
        setIsAdmin(false);
      } finally {
        setLoadingCheck(false);
      }
    }
    checkRole();
  }, [user]);

  // Dynamically load PDF.js from cdnjs if not already available
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

  const showToast = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ title, message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const showLoader = (show: boolean, title = 'Procesando...', message = 'Por favor espera') => {
    setLoaderTitle(title);
    setLoaderMessage(message);
    setLoaderVisible(show);
  };

  // Render a specific page onto its canvas
  const renderThumbnail = async (item: PdfPageItem, canvas: HTMLCanvasElement | null) => {
    if (!canvas || !pdfjsReady || !(window as any).pdfjsLib) return;

    const canvasId = `canvas_${item.id}`;
    renderVersionsRef.current[canvasId] = (renderVersionsRef.current[canvasId] || 0) + 1;
    const currentVersion = renderVersionsRef.current[canvasId];

    if (activeRenderTasksRef.current[canvasId]) {
      try {
        activeRenderTasksRef.current[canvasId].cancel();
      } catch (e) {}
      delete activeRenderTasksRef.current[canvasId];
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (item.type === 'blank' || !item.bytes) {
      canvas.width = 150;
      canvas.height = 200;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Hoja en Blanco', canvas.width / 2, canvas.height / 2);
      return;
    }

    try {
      const pdfDoc = await (window as any).pdfjsLib.getDocument({ data: item.bytes.slice(0) }).promise;
      if (renderVersionsRef.current[canvasId] !== currentVersion) return;

      const page = await pdfDoc.getPage(item.originalIndex + 1);
      if (renderVersionsRef.current[canvasId] !== currentVersion) return;

      if (activeRenderTasksRef.current[canvasId]) {
        try {
          activeRenderTasksRef.current[canvasId].cancel();
        } catch (e) {}
      }

      const viewport = page.getViewport({ scale: 0.3 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderTask = page.render({
        canvasContext: ctx,
        viewport: viewport
      });
      activeRenderTasksRef.current[canvasId] = renderTask;

      await renderTask.promise;
    } catch (err: any) {
      if (err && (err.name === 'RenderingCancelledException' || err.message?.includes('cancelled'))) {
        return;
      }
      console.error('Error al renderizar miniatura:', err);
    } finally {
      if (activeRenderTasksRef.current[canvasId] && renderVersionsRef.current[canvasId] === currentVersion) {
        delete activeRenderTasksRef.current[canvasId];
      }
    }
  };

  // 1. Cargar PDF Principal
  const handleLoadMainPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!pdfjsReady || !(window as any).pdfjsLib) {
      showToast('Cargando motor PDF', 'Espera unos segundos mientras se inicializa el lector de PDF.', 'info');
      return;
    }

    showLoader(true, 'Cargando PDF Principal', 'Procesando páginas y extrayendo miniaturas...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);

      const pdfDoc = await (window as any).pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
      const total = pdfDoc.numPages;

      const newPages: PdfPageItem[] = [];
      for (let i = 1; i <= total; i++) {
        newPages.push({
          id: 'page_' + Math.random().toString(36).substring(2, 11),
          type: 'pdf',
          bytes: pdfBytes,
          originalIndex: i - 1,
          rotation: 0,
          tagColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
          tagLabel: `Original (${i}/${total})`
        });
      }

      // Default export filename from the original first PDF
      const rawName = file.name.replace(/\.[^/.]+$/, '');
      setExportFileName(rawName || 'Documento_Organizado');

      setPages(newPages);
      showToast('PDF Cargado', `Se importaron ${total} páginas correctamente.`, 'success');
    } catch (err) {
      showToast('Error al abrir PDF', 'El archivo no es válido o está protegido.', 'error');
      console.error(err);
    } finally {
      showLoader(false);
      e.target.value = '';
    }
  };

  // 2. Insertar PDF en posición específica
  const handleTriggerInsertAtPosition = (index: number) => {
    targetInsertionIndexRef.current = index;
    fileInputSpecificRef.current?.click();
  };

  const handleProcessSpecificInsertion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetIndex = targetInsertionIndexRef.current !== null ? targetInsertionIndexRef.current : pages.length;

    showLoader(true, 'Insertando PDF...', `Agregando páginas después de la posición ${targetIndex}`);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);
      const pdfDoc = await (window as any).pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
      const total = pdfDoc.numPages;

      const newPages: PdfPageItem[] = [];
      for (let i = 1; i <= total; i++) {
        newPages.push({
          id: 'page_' + Math.random().toString(36).substring(2, 11),
          type: 'pdf',
          bytes: pdfBytes,
          originalIndex: i - 1,
          rotation: 0,
          tagColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold',
          tagLabel: `Insertado (${i}/${total})`
        });
      }

      const updated = [...pages];
      updated.splice(targetIndex, 0, ...newPages);
      setPages(updated);

      showToast('Páginas insertadas', `Se agregaron ${total} páginas después de la pág. ${targetIndex}.`, 'success');
    } catch (err) {
      showToast('Error', 'No se pudo procesar el archivo secundario.', 'error');
      console.error(err);
    } finally {
      showLoader(false);
      targetInsertionIndexRef.current = null;
      e.target.value = '';
    }
  };

  // 3. Hoja Blanca
  const handleOpenBlankModal = () => {
    if (pages.length === 0) {
      showToast('Carga un PDF primero', 'Primero debes cargar un documento PDF principal.', 'error');
      return;
    }
    setBlankRefPage(pages.length);
    setBlankQuantity(1);
    setBlankPlacement('despues');
    setBlankModalOpen(true);
  };

  const handleConfirmAddBlank = () => {
    const cant = blankQuantity || 1;
    const numPag = blankRefPage;

    if (isNaN(numPag) || numPag < 1 || numPag > pages.length) {
      showToast('Página no válida', `El número de página debe estar entre 1 y ${pages.length}.`, 'error');
      return;
    }

    const refIdx = numPag - 1;
    const insertIndex = blankPlacement === 'despues' ? refIdx + 1 : refIdx;

    const newBlanks: PdfPageItem[] = [];
    for (let i = 0; i < cant; i++) {
      newBlanks.push({
        id: 'page_' + Math.random().toString(36).substring(2, 11),
        type: 'blank',
        bytes: null,
        originalIndex: 0,
        rotation: 0,
        tagColor: 'bg-zinc-800 text-zinc-300 border border-zinc-700',
        tagLabel: 'Blanca'
      });
    }

    const updated = [...pages];
    updated.splice(insertIndex, 0, ...newBlanks);
    setPages(updated);
    setBlankModalOpen(false);

    const posTexto = blankPlacement === 'despues' ? `después de la pág. ${numPag}` : `antes de la pág. ${numPag}`;
    showToast('Hojas agregadas', `Se añadieron ${cant} hoja(s) en blanco ${posTexto}.`, 'success');
  };

  // Rotate page
  const handleRotatePage = (index: number) => {
    const updated = [...pages];
    updated[index].rotation = (updated[index].rotation + 90) % 360;
    setPages(updated);
  };

  // Delete page
  const handleDeletePage = (index: number) => {
    const updated = [...pages];
    updated.splice(index, 1);
    setPages(updated);
    showToast('Página eliminada', 'Se quitó la página seleccionada.', 'info');
  };

  // Clear all
  const handleClearAll = () => {
    setConfirmTitle('¿Vaciar documento?');
    setConfirmMessage('Se eliminarán todas las hojas del organizador.');
    setOnConfirmCallback(() => () => {
      setPages([]);
      showToast('Limpio', 'Se han eliminado todas las páginas.', 'info');
    });
    setConfirmModalOpen(true);
  };

  // Large Preview Modal
  const handleOpenPreview = (index: number) => {
    setPreviewIndex(index);
    setPreviewZoom(1.0);
    setPreviewOpen(true);
  };

  useEffect(() => {
    if (!previewOpen || previewIndex === null || !pages[previewIndex]) return;

    const renderPreviewPage = async () => {
      const item = pages[previewIndex];
      const canvas = previewCanvasRef.current;
      if (!canvas || !pdfjsReady || !(window as any).pdfjsLib) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (item.type === 'blank' || !item.bytes) {
        canvas.width = 400 * previewZoom;
        canvas.height = 550 * previewZoom;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }

      showLoader(true, 'Cargando vista previa', 'Renderizando en alta definición...');
      try {
        const pdfDoc = await (window as any).pdfjsLib.getDocument({ data: item.bytes.slice(0) }).promise;
        const page = await pdfDoc.getPage(item.originalIndex + 1);

        const baseScale = 1.2 * previewZoom;
        const viewport = page.getViewport({ scale: baseScale, rotation: item.rotation });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      } catch (err) {
        console.error('Error al renderizar vista previa:', err);
      } finally {
        showLoader(false);
      }
    };

    renderPreviewPage();
  }, [previewOpen, previewIndex, previewZoom, pages, pdfjsReady]);

  const handleRotatePreview = () => {
    if (previewIndex === null) return;
    const updated = [...pages];
    updated[previewIndex].rotation = (updated[previewIndex].rotation + 90) % 360;
    setPages(updated);
  };

  // Export & Download PDF Final
  const handleDownloadFinalPdf = async (customName?: string) => {
    if (pages.length === 0) return;

    setNamingModalOpen(false);
    showLoader(true, 'Generando PDF Final...', 'Uniendo páginas y aplicando rotaciones...');

    try {
      const newPdf = await PDFDocument.create();

      for (let i = 0; i < pages.length; i++) {
        const item = pages[i];

        if (item.type === 'blank' || !item.bytes) {
          newPdf.addPage([595.28, 841.89]); // A4 standard
        } else {
          const srcDoc = await PDFDocument.load(item.bytes.slice(0), { ignoreEncryption: true });
          const [copiedPage] = await newPdf.copyPages(srcDoc, [item.originalIndex]);

          if (item.rotation !== 0) {
            const currentRotation = copiedPage.getRotation().angle;
            copiedPage.setRotation(degrees((currentRotation + item.rotation) % 360));
          }

          newPdf.addPage(copiedPage);
        }
      }

      const pdfBytesFinal = await newPdf.save();
      const blob = new Blob([pdfBytesFinal], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);

      showLoader(false);

      const rawInput = (customName || exportFileName || 'Documento_Organizado').trim();
      const sanitizedName = rawInput.replace(/[/\\?%*:|"<>]/g, '_') || 'Documento_Organizado';
      const finalFileName = sanitizedName.toLowerCase().endsWith('.pdf') ? sanitizedName : `${sanitizedName}.pdf`;

      try {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = finalFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('¡Éxito!', `Descargando "${finalFileName}"`, 'success');
      } catch (e) {
        setDownloadBlobUrl(downloadUrl);
        setDownloadModalOpen(true);
      }
    } catch (err) {
      showLoader(false);
      showToast('Error al exportar', 'Ocurrió un error al generar el PDF.', 'error');
      console.error('Error detallado al guardar PDF:', err);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updated = [...pages];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setPages(updated);
    setDraggedIndex(null);
  };

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
          Esta herramienta está disponible únicamente para administradores de Starryz 5.
        </p>
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs uppercase tracking-wider transition-all"
        >
          Volver a Herramientas
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-[#7d2ae8] selection:text-white">
      
      {/* Header Sticky */}
      <header className="bg-[#0e1318]/90 backdrop-blur-md border-b border-zinc-800/80 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-[#eab308]/60 transition-colors cursor-pointer"
              title="Volver a Herramientas"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7d2ae8] to-[#00c4cc] flex items-center justify-center text-white font-bold shadow-lg shadow-purple-900/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight tracking-tight text-white flex items-center gap-2">
                Organizador PDF <span className="bg-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 rounded-full border border-purple-500/30 font-extrabold">Canva Style</span>
              </h1>
              <p className="text-[11px] text-zinc-400 hidden sm:block">Combina, organiza e inserta páginas fácilmente</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pages.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/60 px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden md:inline">Vaciar</span>
              </button>
            )}

            {pages.length > 0 && (
              <button
                onClick={() => setNamingModalOpen(true)}
                className="bg-gradient-to-r from-[#7d2ae8] to-indigo-600 hover:from-[#6720c8] hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold shadow-lg shadow-purple-900/30 transition flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar PDF Final</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Subheader Controls */}
      <div className="bg-[#121316] border-b border-zinc-800/80 py-3 px-4 sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center flex-wrap gap-2">
            <input
              ref={fileInputMainRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleLoadMainPdf}
            />

            <button
              onClick={handleOpenBlankModal}
              className="bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4 text-emerald-400" />
              <span>Hoja Blanca</span>
            </button>
          </div>

          {pages.length > 0 && (
            <div className="text-xs text-zinc-400 flex items-center gap-3">
              <span className="bg-zinc-900 px-3 py-1 rounded-lg font-bold border border-zinc-800 text-zinc-300">
                Total Páginas: <strong className="text-[#eab308]">{pages.length}</strong>
              </span>
            </div>
          )}

        </div>
      </div>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">

        {/* Initial Empty State Dropzone */}
        {pages.length === 0 ? (
          <div
            onClick={() => fileInputMainRef.current?.click()}
            className="my-auto py-20 px-6 border-2 border-dashed border-zinc-800 hover:border-[#7d2ae8] bg-[#0c0d10] hover:bg-purple-950/10 rounded-2xl text-center transition-all cursor-pointer max-w-2xl mx-auto w-full flex flex-col items-center justify-center shadow-2xl"
          >
            <div className="w-20 h-20 bg-purple-900/20 text-[#7d2ae8] border border-purple-500/20 rounded-full flex items-center justify-center mb-5 shadow-inner">
              <FileUp className="w-10 h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">Comienza subiendo tu documento PDF</h2>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-md mb-6 leading-relaxed">
              Haz clic aquí o selecciona tu archivo PDF. Podrás reordenar las páginas con arrastrar y soltar, rotarlas, e insertar nuevas hojas en cualquier posición.
            </p>
            <span className="bg-[#7d2ae8] hover:bg-[#6720c8] text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-900/40 transition inline-flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Seleccionar archivo PDF
            </span>
          </div>
        ) : (
          /* Grid of Pages (Canva Style) */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {pages.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className="bg-[#111215] rounded-xl border border-zinc-800 hover:border-purple-500/50 shadow-md hover:shadow-purple-900/20 flex flex-col overflow-hidden relative group transition-all duration-200 cursor-grab active:cursor-grabbing select-none"
              >
                {/* Header card */}
                <div className="px-3 py-2 bg-[#16171b] border-b border-zinc-800/80 flex items-center justify-between pointer-events-none">
                  <span className="text-xs font-black text-white bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-700">
                    #{index + 1}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.tagColor}`}>
                    {item.tagLabel}
                  </span>
                </div>

                {/* Canvas container */}
                <div className="p-3 bg-[#0a0a0c] flex-1 flex items-center justify-center relative min-h-[180px]">
                  <ThumbnailCanvas item={item} onRender={renderThumbnail} />

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPreview(index);
                      }}
                      className="bg-white/90 hover:bg-white text-zinc-900 p-2.5 rounded-full shadow-lg text-xs font-bold flex items-center gap-1 pointer-events-auto cursor-pointer"
                      title="Vista previa"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-2 bg-[#141518] border-t border-zinc-800/80 flex items-center justify-between text-zinc-400 text-xs gap-1">
                  
                  <button
                    onClick={() => handleRotatePage(index)}
                    title="Rotar 90°"
                    className="p-1.5 hover:bg-zinc-800 hover:text-purple-400 rounded-lg transition cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Direct button to insert PDF right after this page */}
                  <button
                    onClick={() => handleTriggerInsertAtPosition(index + 1)}
                    title="Insertar PDF después de esta página"
                    className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-bold rounded-md text-[10px] transition border border-purple-500/30 cursor-pointer"
                  >
                    <FilePlus2 className="w-3 h-3 text-[#00c4cc]" />
                    <span>+ PDF</span>
                  </button>

                  <button
                    onClick={() => handleDeletePage(index)}
                    title="Eliminar página"
                    className="p-1.5 hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Hidden file input for insertion at specific index */}
      <input
        ref={fileInputSpecificRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleProcessSpecificInsertion}
      />

      {/* Loader Modal */}
      {loaderVisible && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-50">
          <div className="bg-[#121316] border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full text-center">
            <div className="w-12 h-12 border-4 border-zinc-800 border-t-[#7d2ae8] rounded-full animate-spin"></div>
            <div>
              <h3 className="font-bold text-white text-sm">{loaderTitle}</h3>
              <p className="text-xs text-zinc-400 mt-1">{loaderMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#121316] border border-zinc-800 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-sm animate-in slide-in-from-bottom-5">
          <div className={toast.type === 'success' ? 'text-emerald-400' : toast.type === 'error' ? 'text-rose-400' : 'text-[#7d2ae8]'}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </div>
          <div className="text-xs">
            <p className="font-bold text-white">{toast.title}</p>
            <p className="text-zinc-400">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Modal Hoja Blanca */}
      {blankModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[#121316] border border-zinc-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <FilePlus2 className="w-5 h-5 text-emerald-400" />
                Insertar Hoja(s) en Blanco
              </h3>
              <button
                onClick={() => setBlankModalOpen(false)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3.5 text-xs text-zinc-300">
              <div>
                <label className="block font-semibold mb-1 text-white">1. Cantidad de hojas en blanco:</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={blankQuantity}
                  onChange={(e) => setBlankQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-[#7d2ae8] focus:outline-none text-sm font-semibold text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-white">2. Número de página de referencia:</label>
                <input
                  type="number"
                  min="1"
                  max={pages.length}
                  value={blankRefPage}
                  onChange={(e) => setBlankRefPage(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-[#7d2ae8] focus:outline-none text-sm font-semibold text-white"
                />
                <p className="text-[11px] text-zinc-500 mt-1">Ingresa un número entre 1 y <span className="font-bold text-zinc-400">{pages.length}</span></p>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-white">3. Ubicación:</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center justify-center gap-2 p-2 border rounded-xl cursor-pointer transition ${blankPlacement === 'antes' ? 'bg-purple-950/30 border-[#7d2ae8] text-white' : 'border-zinc-800 text-zinc-400'}`}>
                    <input
                      type="radio"
                      name="radioUbicacionHoja"
                      value="antes"
                      checked={blankPlacement === 'antes'}
                      onChange={() => setBlankPlacement('antes')}
                      className="accent-[#7d2ae8]"
                    />
                    <span className="font-semibold text-xs">Antes</span>
                  </label>
                  <label className={`flex items-center justify-center gap-2 p-2 border rounded-xl cursor-pointer transition ${blankPlacement === 'despues' ? 'bg-purple-950/30 border-[#7d2ae8] text-white' : 'border-zinc-800 text-zinc-400'}`}>
                    <input
                      type="radio"
                      name="radioUbicacionHoja"
                      value="despues"
                      checked={blankPlacement === 'despues'}
                      onChange={() => setBlankPlacement('despues')}
                      className="accent-[#7d2ae8]"
                    />
                    <span className="font-semibold text-xs">Después</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setBlankModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-800 text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAddBlank}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Insertar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#121316] border border-zinc-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <h3 className="font-bold text-white text-base">{confirmTitle}</h3>
            <p className="text-zinc-400 text-xs leading-relaxed">{confirmMessage}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-800 text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (onConfirmCallback) onConfirmCallback();
                  setConfirmModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Large Preview Modal */}
      {previewOpen && previewIndex !== null && pages[previewIndex] && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-50">
          <div className="bg-[#121316] border border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-[#16171b] flex-wrap gap-2">
              <h3 className="font-bold text-white text-sm">
                Vista previa - Página #{previewIndex + 1} ({pages[previewIndex].tagLabel})
              </h3>
              
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={handleRotatePreview}
                  className="p-1.5 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Rotar 90°"
                >
                  <RotateCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Rotar</span>
                </button>
                
                <div className="h-4 w-[1px] bg-zinc-700 mx-1"></div>
                
                <button
                  onClick={() => setPreviewZoom(Math.max(0.4, previewZoom - 0.25))}
                  className="p-1.5 hover:bg-zinc-800 text-zinc-300 rounded-lg transition cursor-pointer"
                  title="Alejar (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                
                <span className="text-xs font-mono font-semibold text-zinc-400 w-12 text-center">
                  {Math.round(previewZoom * 100)}%
                </span>
                
                <button
                  onClick={() => setPreviewZoom(Math.min(3.0, previewZoom + 0.25))}
                  className="p-1.5 hover:bg-zinc-800 text-zinc-300 rounded-lg transition cursor-pointer"
                  title="Acercar (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="ml-2 p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-auto flex-1 flex justify-center items-center bg-[#09090b] min-h-[350px]">
              <canvas
                ref={previewCanvasRef}
                className="shadow-2xl rounded max-w-full bg-white object-contain transition-all duration-150"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Nombrar y Descargar PDF */}
      {namingModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[#121316] border border-zinc-800 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-[#00c4cc]">
                  <Download className="w-5 h-5 text-[#7d2ae8]" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Descargar PDF Organizado</h3>
                  <p className="text-[11px] text-zinc-400">Personaliza el nombre de tu archivo final</p>
                </div>
              </div>
              <button
                onClick={() => setNamingModalOpen(false)}
                className="text-zinc-500 hover:text-white transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleDownloadFinalPdf(exportFileName);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Nombre del archivo:
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    autoFocus
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    placeholder="Ej. Mi_Documento_Organizado"
                    className="w-full pl-3.5 pr-14 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl focus:border-[#7d2ae8] focus:ring-1 focus:ring-[#7d2ae8] focus:outline-none text-sm font-semibold text-white transition-all placeholder:text-zinc-600"
                  />
                  <span className="absolute right-2.5 text-[11px] font-mono font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-lg border border-zinc-700 pointer-events-none select-none">
                    .pdf
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  Se guardará como: <span className="text-zinc-300 font-mono font-medium">{(exportFileName.trim() || 'Documento_Organizado')}.pdf</span>
                </p>
              </div>

              <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-3 flex items-center gap-2.5 text-xs text-purple-300">
                <Info className="w-4 h-4 text-[#00c4cc] shrink-0" />
                <span className="leading-snug">El documento final incluirá todas las páginas ordenadas, rotadas y hojas añadidas.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setNamingModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-800 text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7d2ae8] to-indigo-600 hover:from-[#6720c8] hover:to-indigo-700 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-purple-900/30 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fallback Download Modal */}
      {downloadModalOpen && downloadBlobUrl && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#121316] border border-zinc-800 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-base">¡Tu PDF está listo!</h3>
            <p className="text-zinc-400 text-xs">Haz clic en el siguiente botón para descargar o abrir tu archivo consolidado.</p>
            <div className="flex flex-col gap-2 pt-2">
              <a
                href={downloadBlobUrl}
                download={`${(exportFileName.trim() || 'Documento_Organizado')}.pdf`}
                className="w-full py-2.5 rounded-xl bg-[#7d2ae8] hover:bg-[#6720c8] text-white text-xs font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30"
              >
                <Download className="w-4 h-4" />
                Descargar PDF
              </a>
              <button
                onClick={() => setDownloadModalOpen(false)}
                className="w-full py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-800 text-xs font-medium transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Subcomponent for thumbnail canvas rendering
function ThumbnailCanvas({
  item,
  onRender
}: {
  item: PdfPageItem;
  onRender: (item: PdfPageItem, canvas: HTMLCanvasElement | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    onRender(item, canvasRef.current);
  }, [item, onRender]);

  return (
    <canvas
      ref={canvasRef}
      className="max-h-[180px] w-auto shadow-sm rounded bg-white transition-transform duration-200 pointer-events-none"
      style={{ transform: `rotate(${item.rotation}deg)` }}
    />
  );
}
