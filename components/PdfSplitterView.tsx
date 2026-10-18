'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Scissors,
  ArrowLeft,
  Upload,
  Download,
  RotateCcw,
  FileText,
  FileUp,
  Sliders,
  Columns2,
  CheckSquare,
  Grid,
  Plus,
  Trash2,
  Info,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Check,
  X,
  FileArchive
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';

interface PdfSplitterViewProps {
  onBack: () => void;
  onNavigate?: (url: string) => void;
}

export interface RangeItem {
  id: number;
  start: number;
  end: number;
}

export default function PdfSplitterView({ onBack }: PdfSplitterViewProps) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(true);

  // PDF.js status
  const [pdfjsReady, setPdfjsReady] = useState(false);

  // PDF state
  const [currentPdfBytes, setCurrentPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('documento.pdf');
  const [rawBaseName, setRawBaseName] = useState<string>('documento_dividido');
  const [totalPages, setTotalPages] = useState<number>(0);

  // Modes: 'rango' | 'paginas'
  const [modoActual, setModoActual] = useState<'rango' | 'paginas'>('rango');
  const [rangos, setRangos] = useState<RangeItem[]>([]);
  const [unirRangos, setUnirRangos] = useState<boolean>(false);
  const [paginasSeleccionadas, setPaginasSeleccionadas] = useState<Set<number>>(new Set());
  const [paginasInputTexto, setPaginasInputTexto] = useState<string>('');
  const [paginasPorBloque, setPaginasPorBloque] = useState<number>(2);

  // Loading indicator modal
  const [loaderVisible, setLoaderVisible] = useState(false);
  const [loaderTitle, setLoaderTitle] = useState('Procesando PDF...');
  const [loaderMessage, setLoaderMessage] = useState('Generando vista previa...');

  // Toast notification
  const [toast, setToast] = useState<{ title: string; message: string; type: 'info' | 'success' | 'error' } | null>(null);

  // Custom Naming Modal for Splitting
  const [namingModalOpen, setNamingModalOpen] = useState(false);
  const [customExportName, setCustomExportName] = useState('documento_dividido');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const renderedThumbnailsRef = useRef<{ [key: number]: boolean }>({});
  const activeRenderTasksRef = useRef<{ [key: string]: any }>({});
  const renderVersionsRef = useRef<{ [key: string]: number }>({});
  const pdfjsDocRef = useRef<any>(null);

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
        console.error('Error checking admin role in PdfSplitterView:', err);
        setIsAdmin(false);
      } finally {
        setLoadingCheck(false);
      }
    }
    checkRole();
  }, [user]);

  // Load PDF.js from cdnjs dynamically if needed
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

  // Cargar PDF
  const handleLoadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!pdfjsReady || !(window as any).pdfjsLib) {
      showToast('Cargando motor PDF', 'Espera unos segundos mientras se inicializa el motor PDF.', 'info');
      return;
    }

    showLoader(true, 'Cargando archivo', 'Renderizando páginas del documento PDF...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      setCurrentPdfBytes(bytes);

      const pdfDocJs = await (window as any).pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
      const count = pdfDocJs.numPages;
      setTotalPages(count);

      const baseName = file.name.replace(/\.[^/.]+$/, '');
      setPdfFileName(file.name);
      setRawBaseName(baseName || 'documento_dividido');
      setCustomExportName(baseName ? `${baseName}_dividido` : 'documento_dividido');

      // Initialize default range
      setRangos([{ id: 1, start: 1, end: Math.min(6, count) }]);
      setPaginasSeleccionadas(new Set());
      setPaginasInputTexto('');
      renderedThumbnailsRef.current = {};
      pdfjsDocRef.current = pdfDocJs;

      // Cancel any active render tasks
      Object.keys(activeRenderTasksRef.current).forEach(id => {
        try {
          activeRenderTasksRef.current[id].cancel();
        } catch (e) {}
      });
      activeRenderTasksRef.current = {};
      renderVersionsRef.current = {};

      showToast('PDF cargado', `Se detectaron ${count} páginas exitosamente.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error de carga', 'No se pudo leer el archivo PDF.', 'error');
    } finally {
      showLoader(false);
      e.target.value = '';
    }
  };

  // Render thumbnail canvas
  const renderThumbnail = async (pageNum: number, canvas: HTMLCanvasElement | null) => {
    if (!canvas || !currentPdfBytes || !pdfjsReady || !(window as any).pdfjsLib) return;

    const canvasId = `canvas_split_${pageNum}`;
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

    try {
      if (!pdfjsDocRef.current) {
        pdfjsDocRef.current = await (window as any).pdfjsLib.getDocument({ data: currentPdfBytes.slice(0) }).promise;
      }
      if (renderVersionsRef.current[canvasId] !== currentVersion) return;

      const page = await pdfjsDocRef.current.getPage(pageNum);
      if (renderVersionsRef.current[canvasId] !== currentVersion) return;

      const viewport = page.getViewport({ scale: 0.25 });
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
      console.error(`Error renderizando página ${pageNum}:`, err);
    } finally {
      if (activeRenderTasksRef.current[canvasId] && renderVersionsRef.current[canvasId] === currentVersion) {
        delete activeRenderTasksRef.current[canvasId];
      }
    }
  };

  // Range management
  const handleAddRango = () => {
    const ultimo = rangos[rangos.length - 1];
    let start = 1;
    if (ultimo && ultimo.end < totalPages) {
      start = ultimo.end + 1;
    }
    const end = totalPages;
    setRangos([...rangos, { id: Date.now(), start, end }]);
  };

  const handleRemoveRango = (id: number) => {
    if (rangos.length <= 1) return;
    setRangos(rangos.filter(r => r.id !== id));
  };

  const handleUpdateRango = (id: number, field: 'start' | 'end', val: string) => {
    const v = parseInt(val) || 1;
    setRangos(
      rangos.map(r => {
        if (r.id !== id) return r;
        return {
          ...r,
          [field]: Math.max(1, Math.min(totalPages, v))
        };
      })
    );
  };

  // Individual Page Selection
  const handleTogglePageClick = (pageNum: number) => {
    if (modoActual !== 'paginas') {
      setModoActual('paginas');
    }

    const next = new Set(paginasSeleccionadas);
    if (next.has(pageNum)) {
      next.delete(pageNum);
    } else {
      next.add(pageNum);
    }
    setPaginasSeleccionadas(next);

    const arr = Array.from(next).sort((a, b) => a - b);
    setPaginasInputTexto(arr.join(', '));
  };

  const handleTextInputChange = (val: string) => {
    setPaginasInputTexto(val);
    const next = new Set<number>();
    const partes = val.split(',');

    partes.forEach(p => {
      p = p.trim();
      if (p.includes('-')) {
        const [inicio, fin] = p.split('-').map(n => parseInt(n));
        if (inicio && fin) {
          for (let i = Math.min(inicio, fin); i <= Math.max(inicio, fin); i++) {
            if (i >= 1 && i <= totalPages) next.add(i);
          }
        }
      } else {
        const num = parseInt(p);
        if (num && num >= 1 && num <= totalPages) next.add(num);
      }
    });

    setPaginasSeleccionadas(next);
  };

  // Reset / Load another
  const handleReset = () => {
    setCurrentPdfBytes(null);
    setTotalPages(0);
    setRangos([]);
    setPaginasSeleccionadas(new Set());
    setPaginasInputTexto('');
    pdfjsDocRef.current = null;
    renderedThumbnailsRef.current = {};
    // Cancel any active render tasks
    Object.keys(activeRenderTasksRef.current).forEach(id => {
      try {
        activeRenderTasksRef.current[id].cancel();
      } catch (e) {}
    });
    activeRenderTasksRef.current = {};
    renderVersionsRef.current = {};
  };

  // Process & Split PDF
  const handleStartProcess = () => {
    if (!currentPdfBytes) return;

    if (modoActual === 'paginas' && paginasSeleccionadas.size === 0) {
      showToast('Selección vacía', 'Debes seleccionar al menos una página para extraer.', 'error');
      return;
    }

    setNamingModalOpen(true);
  };

  const executeSplitAndDownload = async (exportBaseName: string) => {
    if (!currentPdfBytes) return;

    setNamingModalOpen(false);
    showLoader(true, 'Generando archivo(s)...', 'Extrayendo páginas y compilando...');

    try {
      const originalDoc = await PDFDocument.load(currentPdfBytes, { ignoreEncryption: true });
      const safePrefix = exportBaseName.trim().replace(/[/\\?%*:|"<>]/g, '_') || 'documento_dividido';

      if (modoActual === 'rango') {
        await executeRangeSplit(originalDoc, safePrefix);
      } else if (modoActual === 'paginas') {
        await executeExtractPages(originalDoc, safePrefix);
      }
    } catch (err) {
      console.error('Error al dividir PDF:', err);
      showToast('Error', 'Ocurrió un error al dividir el archivo PDF.', 'error');
    } finally {
      showLoader(false);
    }
  };

  const executeRangeSplit = async (originalDoc: PDFDocument, baseName: string) => {
    if (unirRangos) {
      // Unir todos los rangos en un único PDF
      const nuevoPdf = await PDFDocument.create();

      for (const r of rangos) {
        const indices: number[] = [];
        for (let i = r.start - 1; i < r.end; i++) {
          if (i >= 0 && i < totalPages) indices.push(i);
        }
        if (indices.length > 0) {
          const copied = await nuevoPdf.copyPages(originalDoc, indices);
          copied.forEach(p => nuevoPdf.addPage(p));
        }
      }

      const pdfBytes = await nuevoPdf.save();
      downloadBlob(pdfBytes, `${baseName}_rangos_unidos.pdf`);
      showToast('¡Completado!', `Descargando "${baseName}_rangos_unidos.pdf"`, 'success');
    } else {
      if (rangos.length === 1) {
        const r = rangos[0];
        const bytes = await extractSubPdf(originalDoc, r.start - 1, r.end - 1);
        downloadBlob(bytes, `${baseName}_pags_${r.start}-${r.end}.pdf`);
        showToast('¡Completado!', `Descargando "${baseName}_pags_${r.start}-${r.end}.pdf"`, 'success');
      } else {
        const zip = new JSZip();

        for (let idx = 0; idx < rangos.length; idx++) {
          const r = rangos[idx];
          const bytes = await extractSubPdf(originalDoc, r.start - 1, r.end - 1);
          zip.file(`${baseName}_rango_${idx + 1}_(pag_${r.start}-${r.end}).pdf`, bytes);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, `${baseName}_rangos.zip`);
        showToast('¡Completado!', `Descargando paquete ZIP con ${rangos.length} rangos.`, 'success');
      }
    }
  };

  const executeExtractPages = async (originalDoc: PDFDocument, baseName: string) => {
    const paginasArr = Array.from(paginasSeleccionadas).sort((a, b) => a - b);
    const nuevoPdf = await PDFDocument.create();
    const indices = paginasArr.map(p => p - 1);

    const copied = await nuevoPdf.copyPages(originalDoc, indices);
    copied.forEach(p => nuevoPdf.addPage(p));

    const pdfBytes = await nuevoPdf.save();
    downloadBlob(pdfBytes, `${baseName}_extraido.pdf`);
    showToast('¡Extraído!', `Descargando "${baseName}_extraido.pdf" con ${paginasArr.length} páginas.`, 'success');
  };

  const extractSubPdf = async (docOriginal: PDFDocument, startIdx: number, endIdx: number) => {
    const nuevoPdf = await PDFDocument.create();
    const indices: number[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      if (i >= 0 && i < totalPages) indices.push(i);
    }
    const copied = await nuevoPdf.copyPages(docOriginal, indices);
    copied.forEach(p => nuevoPdf.addPage(p));
    return await nuevoPdf.save();
  };

  const downloadBlob = (data: Uint8Array | Blob, fileName: string) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
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
          className="px-6 py-3 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer"
        >
          Volver a Herramientas
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-[#e11d48] selection:text-white">
      
      {/* Top Header */}
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#e11d48] to-[#f59e0b] flex items-center justify-center text-white font-bold shadow-lg shadow-rose-900/30">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight tracking-tight text-white flex items-center gap-2">
                Dividir PDF <span className="bg-rose-500/20 text-rose-300 text-[10px] px-2 py-0.5 rounded-full border border-rose-500/30 font-extrabold">Suite</span>
              </h1>
              <p className="text-[11px] text-zinc-400 hidden sm:block">Extrae, separa o divide tu documento en segundos</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentPdfBytes && (
              <button
                onClick={handleReset}
                className="text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/60 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Cargar otro PDF</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">

        {/* Initial Empty State / Dropzone */}
        {!currentPdfBytes ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="my-auto py-20 px-6 border-2 border-dashed border-zinc-800 hover:border-[#e11d48] bg-[#0c0d10] hover:bg-rose-950/10 rounded-3xl text-center transition-all cursor-pointer shadow-2xl max-w-2xl mx-auto w-full flex flex-col items-center justify-center group"
          >
            <div className="w-20 h-20 bg-rose-950/30 text-[#e11d48] border border-rose-500/20 rounded-2xl flex items-center justify-center mb-5 shadow-inner group-hover:scale-105 transition-transform">
              <FileUp className="w-10 h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">Selecciona o arrastra tu archivo PDF</h2>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-md mb-6 leading-relaxed">
              Sube tu documento para separar por rangos de páginas personalizados, extraer páginas individuales o dividir en archivos de tamaño fijo.
            </p>
            <span className="bg-gradient-to-r from-[#e11d48] to-[#be123c] hover:opacity-90 text-white px-7 py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-rose-900/40 transition inline-flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Seleccionar PDF
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleLoadPdf}
            />
          </div>
        ) : (
          /* Main Splitting Workspace */
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* Left Column: PDF Preview Grid */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
              
              {/* Header Info */}
              <div className="bg-[#121316] p-4 rounded-2xl border border-zinc-800/80 shadow-sm flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-[#e11d48] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white text-xs sm:text-sm truncate max-w-xs sm:max-w-md">
                    {pdfFileName}
                  </span>
                </div>
                <span className="bg-zinc-900 text-zinc-300 px-3 py-1 rounded-full text-xs font-bold border border-zinc-800">
                  Total: <strong className="text-[#eab308]">{totalPages}</strong> páginas
                </span>
              </div>

              {/* Grid with Page Thumbnails */}
              <div className="bg-[#0c0d10] p-4 rounded-2xl border border-zinc-800/80 max-h-[calc(100vh-230px)] overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    let isIncluded = false;
                    if (modoActual === 'rango') {
                      isIncluded = rangos.some(r => pageNum >= r.start && pageNum <= r.end);
                    } else if (modoActual === 'paginas') {
                      isIncluded = paginasSeleccionadas.has(pageNum);
                    } else {
                      isIncluded = true;
                    }

                    return (
                      <div
                        key={pageNum}
                        onClick={() => handleTogglePageClick(pageNum)}
                        className={`bg-[#141518] rounded-xl border p-2 cursor-pointer transition-all duration-150 relative select-none flex flex-col items-center group ${
                          isIncluded
                            ? 'ring-2 ring-[#e11d48] border-[#e11d48] bg-rose-950/20 shadow-md shadow-rose-950/30'
                            : 'border-zinc-800 hover:border-zinc-700 opacity-70 hover:opacity-100'
                        }`}
                      >
                        {/* Page Top Bar */}
                        <div className="w-full flex justify-between items-center text-[10px] text-zinc-400 mb-1.5 px-1">
                          <span className="font-bold text-white bg-zinc-800 px-1.5 py-0.5 rounded">
                            Pág. {pageNum}
                          </span>
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                              isIncluded
                                ? 'bg-[#e11d48] text-white'
                                : 'border border-zinc-700 text-transparent'
                            }`}
                          >
                            {isIncluded && <Check className="w-2.5 h-2.5" />}
                          </span>
                        </div>

                        {/* Page Thumbnail Canvas */}
                        <div className="bg-white rounded-lg flex items-center justify-center p-1 w-full min-h-[130px] overflow-hidden">
                          <SplitThumbnailCanvas
                            pageNum={pageNum}
                            onRender={renderThumbnail}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Settings & Actions Panel */}
            <div className="lg:col-span-5 xl:col-span-4 bg-[#121316] rounded-2xl border border-zinc-800/80 shadow-2xl p-5 sticky top-20 flex flex-col gap-5">
              
              <div className="border-b border-zinc-800/80 pb-3">
                <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#e11d48]" />
                  Configurar División
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">Elige el método para separar tu archivo</p>
              </div>

              {/* Mode Selector Tabs */}
              <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs font-semibold">
                <button
                  onClick={() => setModoActual('rango')}
                  className={`py-2 px-1 rounded-lg transition text-center flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                    modoActual === 'rango'
                      ? 'bg-[#1e1f24] text-white font-bold shadow-sm border border-zinc-700'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Columns2 className="w-3.5 h-3.5 text-[#e11d48]" />
                  <span>Rangos</span>
                </button>
                <button
                  onClick={() => setModoActual('paginas')}
                  className={`py-2 px-1 rounded-lg transition text-center flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                    modoActual === 'paginas'
                      ? 'bg-[#1e1f24] text-white font-bold shadow-sm border border-zinc-700'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5 text-[#e11d48]" />
                  <span>Páginas</span>
                </button>
              </div>

              {/* MODO 1: RANGOS PERSONALIZADOS */}
              {modoActual === 'rango' && (
                <div className="space-y-3.5">
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {rangos.map((r, idx) => (
                      <div
                        key={r.id}
                        className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between font-bold text-zinc-300">
                          <span className="text-[11px] text-white">Rango {idx + 1}</span>
                          {rangos.length > 1 && (
                            <button
                              onClick={() => handleRemoveRango(r.id)}
                              className="text-zinc-500 hover:text-rose-400 transition p-1 cursor-pointer"
                              title="Eliminar rango"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                          <div>
                            <label className="block text-[10px] text-zinc-400 font-semibold mb-1">
                              Desde la pág.
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={totalPages}
                              value={r.start}
                              onChange={(e) => handleUpdateRango(r.id, 'start', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-black/40 border border-zinc-700 rounded-lg focus:border-[#e11d48] focus:outline-none text-white font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-zinc-400 font-semibold mb-1">
                              Hasta la pág.
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={totalPages}
                              value={r.end}
                              onChange={(e) => handleUpdateRango(r.id, 'end', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-black/40 border border-zinc-700 rounded-lg focus:border-[#e11d48] focus:outline-none text-white font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleAddRango}
                    className="w-full py-2 rounded-xl border border-dashed border-rose-500/40 hover:border-[#e11d48] bg-rose-950/20 hover:bg-rose-950/30 text-rose-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Añadir Rango</span>
                  </button>

                  <div className="pt-2 border-t border-zinc-800/80">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs text-zinc-300 font-medium select-none">
                      <input
                        type="checkbox"
                        checked={unirRangos}
                        onChange={(e) => setUnirRangos(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-700 text-[#e11d48] focus:ring-0 accent-[#e11d48]"
                      />
                      <span>Unir todos los rangos en un único PDF.</span>
                    </label>
                  </div>
                </div>
              )}

              {/* MODO 2: EXTRAER PÁGINAS */}
              {modoActual === 'paginas' && (
                <div className="space-y-3.5 text-xs">
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Haz clic en las miniaturas de la izquierda para seleccionar o escribe los números manualmente:
                  </p>
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1 text-[11px]">
                      Páginas seleccionadas:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 1, 3, 5-8"
                      value={paginasInputTexto}
                      onChange={(e) => handleTextInputChange(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl focus:border-[#e11d48] focus:outline-none font-medium text-white text-xs"
                    />
                  </div>
                  <div className="bg-amber-950/20 border border-amber-500/20 text-amber-300 p-3 rounded-xl flex items-start gap-2 text-[11px]">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>Se creará un nuevo archivo PDF únicamente con las páginas que selecciones.</span>
                  </div>
                </div>
              )}

              {/* Botón Acción Principal */}
              <button
                onClick={handleStartProcess}
                className="w-full py-3.5 bg-gradient-to-r from-[#e11d48] to-[#be123c] hover:opacity-90 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-xl shadow-rose-900/30 transition flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Dividir PDF</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

            </div>

          </div>
        )}

      </main>

      {/* Modal Nombrar y Guardar Archivos */}
      {namingModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[#121316] border border-zinc-800 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-[#e11d48]">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Descargar PDF Dividido</h3>
                  <p className="text-[11px] text-zinc-400">Personaliza el nombre base de tus archivos</p>
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
                executeSplitAndDownload(customExportName);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Nombre base del archivo:
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    autoFocus
                    value={customExportName}
                    onChange={(e) => setCustomExportName(e.target.value)}
                    placeholder="Ej. Mi_Documento_Dividido"
                    className="w-full pl-3.5 pr-14 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl focus:border-[#e11d48] focus:ring-1 focus:ring-[#e11d48] focus:outline-none text-sm font-semibold text-white transition-all placeholder:text-zinc-600"
                  />
                  <span className="absolute right-2.5 text-[11px] font-mono font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-lg border border-zinc-700 pointer-events-none select-none">
                    {(modoActual === 'rango' && !unirRangos && rangos.length > 1) ? '.zip' : '.pdf'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  Formato de salida: <span className="text-zinc-300 font-mono font-medium">
                    {(modoActual === 'rango' && !unirRangos && rangos.length > 1)
                      ? `${(customExportName.trim() || 'documento_dividido')}.zip`
                      : `${(customExportName.trim() || 'documento_dividido')}.pdf`}
                  </span>
                </p>
              </div>

              <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3 flex items-center gap-2.5 text-xs text-rose-300">
                <Info className="w-4 h-4 text-[#e11d48] shrink-0" />
                <span className="leading-snug">
                  {modoActual === 'rango' && (unirRangos ? 'Se generará un único PDF con todos los rangos unidos.' : rangos.length > 1 ? 'Se empaquetarán los rangos individuales en un archivo ZIP.' : 'Se descargará el rango como un PDF individual.')}
                  {modoActual === 'paginas' && 'Se descargará un PDF conteniendo exactamente las páginas seleccionadas.'}
                </span>
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
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#e11d48] to-[#be123c] hover:opacity-90 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-rose-900/30 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar Ahora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loader Modal */}
      {loaderVisible && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-50">
          <div className="bg-[#121316] border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full text-center">
            <div className="w-12 h-12 border-4 border-zinc-800 border-t-[#e11d48] rounded-full animate-spin"></div>
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
          <div className={toast.type === 'success' ? 'text-emerald-400' : toast.type === 'error' ? 'text-rose-400' : 'text-[#e11d48]'}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </div>
          <div className="text-xs">
            <p className="font-bold text-white">{toast.title}</p>
            <p className="text-zinc-400">{toast.message}</p>
          </div>
        </div>
      )}

    </div>
  );
}

function SplitThumbnailCanvas({
  pageNum,
  onRender
}: {
  pageNum: number;
  onRender: (pageNum: number, canvas: HTMLCanvasElement | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onRenderRef = useRef(onRender);

  useEffect(() => {
    onRenderRef.current = onRender;
  }, [onRender]);

  useEffect(() => {
    onRenderRef.current(pageNum, canvasRef.current);
  }, [pageNum]);

  return (
    <canvas
      ref={canvasRef}
      className="max-h-[130px] max-w-full rounded bg-white shadow-2xs pointer-events-none"
    />
  );
}
