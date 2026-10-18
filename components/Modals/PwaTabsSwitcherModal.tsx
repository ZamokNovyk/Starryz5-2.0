'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Search,
  MoreVertical,
  LayoutGrid,
  Sparkles,
  GraduationCap,
  UserCheck,
  Building2,
  Wrench,
  Home,
  Check,
  ExternalLink,
  Crown,
  FileText,
  Sliders,
  Compass,
  Star,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { usePwaTabs, PwaTab, TabType } from '@/src/context/PwaTabsContext';

interface PwaTabsSwitcherModalProps {
  onNavigate: (pathname: string, search?: string) => void;
}

/**
 * Retorna el icono favicon correspondiente a cada tipo de pestaña
 */
function getFaviconIcon(type: TabType) {
  switch (type) {
    case 'professor':
      return (
        <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
          <GraduationCap className="w-2.5 h-2.5" />
        </div>
      );
    case 'student':
      return (
        <div className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
          <UserCheck className="w-2.5 h-2.5" />
        </div>
      );
    case 'center':
      return (
        <div className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
          <Building2 className="w-2.5 h-2.5" />
        </div>
      );
    case 'tools':
      return (
        <div className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
          <Wrench className="w-2.5 h-2.5" />
        </div>
      );
    case 'search':
      return (
        <div className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
          <Search className="w-2.5 h-2.5" />
        </div>
      );
    case 'home':
    default:
      return (
        <div className="w-4 h-4 rounded-full bg-amber-500/25 text-[#eab308] flex items-center justify-center">
          <Star className="w-2.5 h-2.5 fill-[#eab308]" />
        </div>
      );
  }
}

/**
 * Renderiza la miniatura fotorrealista de la página similar a Google Chrome mobile
 */
function TabPreviewSnapshot({ tab, isActive }: { tab: PwaTab; isActive: boolean }) {
  // 1. Si la pestaña tiene una captura real (snapshot del DOM de la página), la renderizamos como Google Chrome
  if (tab.snapshotUrl) {
    return (
      <div className="w-full h-full bg-[#121316] relative overflow-hidden flex items-start justify-center select-none">
        <img
          src={tab.snapshotUrl}
          alt={tab.title}
          className="w-full h-full object-cover object-top pointer-events-none select-none transition-transform duration-200"
          loading="lazy"
        />
        <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      </div>
    );
  }

  // 2. Renderizado fotorrealista adaptado a la identidad visual exacta de cada página
  const isCenter = tab.type === 'center' || tab.pathname.includes('/educational_centers/') || tab.pathname.includes('/centros/');
  const isSearch = tab.type === 'search' || tab.pathname === '/search' || tab.pathname.includes('?q=');
  const isTools = tab.type === 'tools' || tab.pathname.includes('/herramientas');
  const isProfessor = tab.type === 'professor' || tab.pathname.includes('/profesores/');
  const isStudent = tab.type === 'student' || tab.pathname.includes('/estudiantes/');

  // Barra de estado móvil simulada (similar a la barra superior del celular en Chrome)
  const MobileStatusBar = () => (
    <div className="h-3.5 px-2 flex items-center justify-between text-[7px] text-zinc-400/80 font-mono select-none">
      <span>12:00</span>
      <div className="flex items-center gap-1">
        <span className="text-[6px]">4G</span>
        <span className="w-2.5 h-1.5 border border-zinc-500 rounded-[1px] relative inline-block">
          <span className="absolute inset-0 bg-zinc-300 w-[70%]" />
        </span>
      </div>
    </div>
  );

  // A. CENTRO EDUCATIVO / UNIVERSIDAD (Ficha institucional de alta fidelidad)
  if (isCenter) {
    const centerName = tab.meta?.institutionName || tab.title;
    const acronym = tab.meta?.institutionAcronym || centerName.split(' ').filter(w => w.length > 2).map(w => w[0]).slice(0, 4).join('').toUpperCase() || 'IES';
    const city = tab.meta?.institutionCity || 'Perú';
    const rating = tab.meta?.institutionRating || 4.8;
    const reviews = tab.meta?.institutionReviews || 34;
    const centerType = tab.meta?.institutionType || 'Instituto Superior';

    return (
      <div className="w-full h-full bg-[#0b0e14] flex flex-col justify-between text-left select-none overflow-hidden text-zinc-100">
        <div>
          <MobileStatusBar />
          {/* Banner de portada universitario */}
          <div className="h-14 w-full bg-gradient-to-r from-blue-950 via-sky-900 to-indigo-950 relative p-2 flex items-end">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-400/10 via-transparent to-black/40" />
            
            {/* Escudo / Sello institucional con siglas */}
            <div className="absolute -bottom-3.5 left-2.5 w-8 h-8 rounded-xl bg-[#0f172a] border-2 border-sky-400 shadow-md flex items-center justify-center text-sky-300 font-black text-[9px] tracking-wider z-10">
              {acronym}
            </div>

            <div className="ml-9 min-w-0 z-10">
              <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-sky-500/30 text-sky-200 font-bold uppercase tracking-wider">
                {centerType}
              </span>
            </div>
          </div>

          {/* Información del Centro */}
          <div className="pt-4 px-2.5 space-y-1">
            <h4 className="text-[10px] font-black text-white leading-tight line-clamp-2">
              {centerName}
            </h4>

            <div className="flex items-center gap-2 text-[7px] text-zinc-300 pt-0.5">
              <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                ★ {rating} <span className="text-zinc-400 font-normal">({reviews})</span>
              </span>
              <span>•</span>
              <span className="text-sky-300 font-medium truncate flex items-center gap-0.5">
                <MapPin className="w-2 h-2 shrink-0" /> {city}
              </span>
            </div>

            {/* Pestañas de navegación simuladas */}
            <div className="flex gap-1 pt-1.5 border-b border-zinc-800/80 pb-1">
              <span className="text-[7px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">Perfil</span>
              <span className="text-[7px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">Carreras</span>
              <span className="text-[7px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">Docentes</span>
            </div>

            {/* Tarjeta de Carreras */}
            <div className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 mt-1">
              <div className="text-[7px] font-bold text-zinc-300 flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5 text-sky-400" /> Carreras Populares
              </div>
              <div className="text-[6.5px] text-zinc-400 mt-0.5 truncate">
                Sistemas • Educación • Administración
              </div>
            </div>
          </div>
        </div>

        {/* Botón inferior institucional */}
        <div className="p-2 pt-0">
          <div className="w-full py-1 rounded-lg bg-sky-600/25 border border-sky-500/40 text-sky-300 font-bold text-[8px] text-center shadow-sm">
            Ver Campus y Carreras
          </div>
        </div>
      </div>
    );
  }

  // B. HERRAMIENTAS (Compresor PDF, Ruleta de Sorteos, Organizador)
  if (isTools) {
    const isCompressor = tab.pathname.includes('comprimir') || tab.meta?.toolType === 'compressor';
    const isRuleta = tab.pathname.includes('ruleta') || tab.meta?.toolType === 'ruleta';

    if (isCompressor) {
      return (
        <div className="w-full h-full bg-[#121014] flex flex-col justify-between text-left select-none p-2.5 overflow-hidden text-zinc-100">
          <div>
            <MobileStatusBar />
            {/* Header Compresor PDF */}
            <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-zinc-800">
              <div className="w-5 h-5 rounded-md bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <FileText className="w-3 h-3" />
              </div>
              <div>
                <div className="text-[9px] font-black text-white leading-none">Compresor PDF</div>
                <div className="text-[7px] text-zinc-400">Optimización ultrarrápida</div>
              </div>
            </div>

            {/* Zona Dropzone punteada */}
            <div className="p-2.5 rounded-xl border border-dashed border-rose-500/40 bg-rose-500/5 text-center my-1 flex flex-col items-center justify-center">
              <FileText className="w-5 h-5 text-rose-400 mb-1 animate-pulse" />
              <div className="text-[8px] font-bold text-zinc-200">Arrastra tu archivo PDF</div>
              <div className="text-[6.5px] text-zinc-400">o pulsa para examinar</div>
            </div>

            {/* Archivo simulado con reducción */}
            <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[7px] text-zinc-300 flex items-center justify-between mt-1.5">
              <span className="font-semibold text-rose-300 truncate">documento.pdf</span>
              <span className="text-emerald-400 font-bold shrink-0">-80%</span>
            </div>
          </div>

          <div className="w-full py-1 rounded-lg bg-rose-600/25 border border-rose-500/40 text-rose-300 font-bold text-[8px] text-center">
            Comprimir Archivo
          </div>
        </div>
      );
    }

    if (isRuleta) {
      return (
        <div className="w-full h-full bg-[#130f1e] flex flex-col justify-between text-left select-none p-2.5 overflow-hidden text-zinc-100">
          <div>
            <MobileStatusBar />
            <div className="text-center mb-1">
              <span className="text-[9px] font-black text-amber-300 tracking-wide">🎡 RULETA DE SORTEOS</span>
            </div>

            {/* Gráfico circular de ruleta fotorrealista */}
            <div className="w-20 h-20 mx-auto my-1 rounded-full border-2 border-amber-400/60 relative flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <div className="absolute inset-0 bg-[conic-gradient(#ef4444_0deg_45deg,#3b82f6_45deg_90deg,#eab308_90deg_135deg,#10b981_135deg_180deg,#8b5cf6_180deg_225deg,#ec4899_225deg_270deg,#06b6d4_270deg_315deg,#f97316_315deg_360deg)] opacity-80" />
              <div className="w-6 h-6 rounded-full bg-zinc-950 border-2 border-amber-400 z-10 flex items-center justify-center">
                <span className="text-[7px] text-amber-300 font-black">★</span>
              </div>
            </div>

            <div className="text-center text-[7px] text-zinc-400">
              6 opciones cargadas listas
            </div>
          </div>

          <div className="w-full py-1 rounded-lg bg-amber-500/30 border border-amber-500/50 text-amber-300 font-black text-[8px] text-center">
            ¡GIRAR RULETA!
          </div>
        </div>
      );
    }

    // Otras herramientas
    return (
      <div className="w-full h-full bg-[#111217] flex flex-col justify-between text-left select-none p-2.5 text-zinc-100">
        <div>
          <MobileStatusBar />
          <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-zinc-800">
            <Wrench className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[9px] font-bold text-white">Utilidades Starryz</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-center">
              <Sliders className="w-3.5 h-3.5 text-purple-400 mx-auto mb-1" />
              <span className="text-[7.5px] font-bold text-zinc-200">Organizar</span>
            </div>
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-center">
              <FileText className="w-3.5 h-3.5 text-sky-400 mx-auto mb-1" />
              <span className="text-[7.5px] font-bold text-zinc-200">Dividir</span>
            </div>
          </div>
        </div>
        <div className="text-[7px] text-zinc-500 text-center">Procesamiento 100% privado</div>
      </div>
    );
  }

  // C. BUSCADOR (Estilo Google Chrome Search Results)
  if (isSearch) {
    const query = tab.meta?.searchQuery || tab.previewSubtitle?.replace('Resultados para "', '').replace('"', '') || 'Directorio';
    const total = tab.meta?.searchTotalResults || 16;

    return (
      <div className="w-full h-full bg-[#141518] flex flex-col justify-between text-left select-none p-2.5 overflow-hidden text-zinc-100">
        <div>
          <MobileStatusBar />
          {/* Barra de búsqueda de Google */}
          <div className="w-full px-2.5 py-1.5 rounded-full bg-[#202124] border border-zinc-700/80 flex items-center gap-1.5 mb-2 shadow-sm">
            <Search className="w-2.5 h-2.5 text-blue-400 shrink-0" />
            <span className="text-[8.5px] text-zinc-200 font-medium truncate">
              {query}
            </span>
          </div>

          {/* Chips de filtro */}
          <div className="flex gap-1 mb-2 border-b border-zinc-800 pb-1.5">
            <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold">Todo ({total})</span>
            <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">Centros</span>
            <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">Docentes</span>
          </div>

          {/* Resultados tipo Google */}
          <div className="space-y-1.5">
            <div className="p-1.5 rounded-md bg-[#1b1c20] border border-zinc-800">
              <div className="text-[6.5px] text-zinc-500 truncate">starryz.com &gt; centros &gt; superior</div>
              <div className="text-[8px] font-bold text-sky-400 truncate">Instituto Superior Tecnológico...</div>
              <div className="text-[6.5px] text-zinc-400 line-clamp-1 mt-0.5">
                Plana docente evaluada, carreras acreditadas y rankings...
              </div>
            </div>

            <div className="p-1.5 rounded-md bg-[#1b1c20] border border-zinc-800">
              <div className="text-[6.5px] text-zinc-500 truncate">starryz.com &gt; docentes</div>
              <div className="text-[8px] font-bold text-sky-400 truncate">Docentes mejor calificados ★ 4.9</div>
            </div>
          </div>
        </div>

        <div className="w-full py-1 rounded-lg bg-blue-500/20 text-blue-300 font-bold text-[8px] text-center border border-blue-500/30">
          Explorar Resultados
        </div>
      </div>
    );
  }

  // D. DOCENTE / PROFESOR
  if (isProfessor) {
    const profName = tab.meta?.professorName || tab.title.replace('Prof. ', '');
    const rating = tab.meta?.professorRating || 4.8;

    return (
      <div className="w-full h-full bg-[#12121a] flex flex-col justify-between text-left select-none p-2.5 overflow-hidden text-zinc-100">
        <div>
          <MobileStatusBar />
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-indigo-500/20">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border-2 border-indigo-400 flex items-center justify-center text-indigo-300 text-[10px] font-bold shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black text-white truncate leading-tight">Prof. {profName}</div>
              <div className="text-[7.5px] text-indigo-400 font-medium">Cátedra Universitaria</div>
            </div>
          </div>

          <div className="space-y-1.5 mt-1">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className="text-amber-400 text-[9px]">★</span>
              ))}
              <span className="text-[7.5px] text-zinc-300 font-bold ml-1">{rating} / 5.0</span>
            </div>
            <div className="p-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[7px] text-zinc-300 leading-snug">
              &quot;Excelente docente, metodología didáctica y dominio de los temas.&quot;
            </div>
          </div>
        </div>

        <div className="w-full py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold text-[8px] text-center">
          Ver Reseñas Docentes
        </div>
      </div>
    );
  }

  // E. ESTUDIANTE
  if (isStudent) {
    const studName = tab.meta?.studentName || tab.title;

    return (
      <div className="w-full h-full bg-[#131218] flex flex-col justify-between text-left select-none p-2.5 overflow-hidden text-zinc-100">
        <div>
          <MobileStatusBar />
          <div className="h-10 w-full rounded-lg bg-gradient-to-r from-purple-700/40 via-amber-600/30 to-purple-800/40 relative mb-3">
            <div className="absolute -bottom-2.5 left-2 w-7 h-7 rounded-full bg-amber-500/30 border-2 border-amber-400 flex items-center justify-center text-amber-300 font-black text-[9px]">
              {studName.charAt(0).toUpperCase()}
            </div>
          </div>

          <div className="px-1">
            <div className="text-[10px] font-black text-white truncate">{studName}</div>
            <div className="text-[7.5px] text-zinc-400">Estudiante Verificado</div>
          </div>

          <div className="grid grid-cols-2 gap-1 my-2">
            <div className="p-1 rounded bg-zinc-900/90 border border-zinc-800 text-center">
              <span className="text-[8px] text-rose-400 font-extrabold block">❤️ 140+</span>
              <span className="text-[6px] text-zinc-500 uppercase">Flechazos</span>
            </div>
            <div className="p-1 rounded bg-zinc-900/90 border border-zinc-800 text-center">
              <span className="text-[8px] text-amber-400 font-extrabold block">⭐ 4.9</span>
              <span className="text-[6px] text-zinc-500 uppercase">Popularidad</span>
            </div>
          </div>
        </div>

        <div className="w-full py-1 rounded-lg bg-purple-500/25 border border-purple-500/40 text-purple-300 font-bold text-[8px] text-center">
          Ver Perfil
        </div>
      </div>
    );
  }

  // F. INICIO • CAMPUS (Página Principal de Starryz)
  return (
    <div className="w-full h-full bg-[#0d0e11] flex flex-col justify-between text-left select-none p-2.5 overflow-hidden text-zinc-100 relative">
      <div>
        <MobileStatusBar />
        {/* Cabecera Starryz Gold */}
        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800 mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Star className="w-2.5 h-2.5 fill-[#eab308] text-[#eab308]" />
            </div>
            <span className="text-[10px] font-black text-white tracking-wider">Starryz 5</span>
          </div>
          <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
            Campus Activo
          </span>
        </div>

        {/* Buscador integrado del Campus */}
        <div className="w-full px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[7.5px] text-zinc-400 flex items-center gap-1.5 mb-2">
          <Search className="w-2.5 h-2.5 text-[#eab308]" />
          <span className="truncate">Buscar colegios, institutos, docentes...</span>
        </div>

        {/* Podio / Novedades del Campus */}
        <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/15 via-zinc-900 to-zinc-900 border border-amber-500/25 space-y-1">
          <div className="text-[8px] font-black text-white flex items-center gap-1">
            <Crown className="w-2.5 h-2.5 text-amber-400" /> Ranking Nacional 2025
          </div>
          <div className="text-[7px] text-zinc-300 space-y-0.5">
            <div className="flex justify-between">
              <span className="font-semibold text-amber-300">1º Univ. Nac. Trujillo</span>
              <span className="text-zinc-400">★ 4.9</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-300">2º SENATI Perú</span>
              <span className="text-zinc-400">★ 4.8</span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full py-1 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-[8px] text-center border border-amber-500/30">
        {isActive ? 'Pestaña activa' : 'Abrir Campus'}
      </div>
    </div>
  );
}

export default function PwaTabsSwitcherModal({ onNavigate }: PwaTabsSwitcherModalProps) {
  const {
    isTabsSwitcherOpen,
    setIsTabsSwitcherOpen,
    tabs,
    activeTabId,
    switchTab,
    closeTab,
    closeAllTabs,
    createNewTab
  } = usePwaTabs();

  const [tabSearchQuery, setTabSearchQuery] = useState('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar el menú de tres puntos si se hace click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [moreMenuOpen]);

  // Si no está abierto, no renderizamos
  if (!isTabsSwitcherOpen) return null;

  // Filtrar pestañas en tiempo real según el buscador
  const filteredTabs = tabs.filter((t) => {
    if (!tabSearchQuery.trim()) return true;
    const query = tabSearchQuery.toLowerCase().trim();
    const titleMatch = t.title.toLowerCase().includes(query);
    const pathMatch = t.pathname.toLowerCase().includes(query);
    const subtitleMatch = t.previewSubtitle?.toLowerCase().includes(query);
    return titleMatch || pathMatch || subtitleMatch;
  });

  return (
    <div className="fixed inset-0 z-[100] bg-[#131314] text-white flex flex-col animate-in fade-in duration-150 select-none overflow-hidden">
      
      {/* ========================================================= */}
      {/* 1. BARRA SUPERIOR ESTILO GOOGLE CHROME                   */}
      {/* ========================================================= */}
      <header className="px-3 sm:px-4 py-2.5 bg-[#131314] flex items-center justify-between shrink-0 border-b border-zinc-800/40">
        
        {/* Botón "+": Nueva Pestaña (Izquierda) */}
        <button
          onClick={() => {
            createNewTab('/', onNavigate);
          }}
          className="w-10 h-10 rounded-2xl bg-[#282a2d] hover:bg-[#35373b] active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm"
          title="Abrir nueva pestaña"
          aria-label="Abrir nueva pestaña"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Agrupador Central: [ Contador de Pestañas | Icono Cuadrícula ] */}
        <div className="flex items-center bg-[#282a2d] p-1 rounded-2xl border border-zinc-700/40 gap-1 shadow-sm">
          {/* Contador de pestañas (Pill con número) */}
          <div 
            className="min-w-[34px] h-[34px] px-2 rounded-xl bg-[#37393e] flex items-center justify-center text-xs font-black text-white"
            title={`${tabs.length} pestañas abiertas`}
          >
            {tabs.length}
          </div>

          {/* Icono de cuadrícula (Visual Google Tabs) */}
          <div 
            className="w-[34px] h-[34px] rounded-xl flex items-center justify-center text-zinc-300"
            title="Vista de pestañas"
          >
            <LayoutGrid className="w-4 h-4" />
          </div>
        </div>

        {/* Menú de Opciones Tres Puntos "⋮" y Botón Listo */}
        <div className="flex items-center gap-1.5 relative" ref={moreMenuRef}>
          {/* Botón 3 puntos */}
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className="w-10 h-10 rounded-2xl hover:bg-[#282a2d] text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Más opciones"
            aria-label="Más opciones"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Botón "Listo" o "✕" para volver a la app */}
          <button
            onClick={() => setIsTabsSwitcherOpen(false)}
            className="px-3 py-2 rounded-xl bg-[#282a2d] hover:bg-[#35373b] text-xs font-bold text-zinc-200 hover:text-white transition-all cursor-pointer"
            title="Volver a la pestaña actual"
          >
            Listo
          </button>

          {/* Dropdown del menú de 3 puntos */}
          {moreMenuOpen && (
            <div className="absolute right-0 top-12 w-56 bg-[#282a2d] border border-zinc-700/70 rounded-2xl shadow-2xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  createNewTab('/', onNavigate);
                }}
                className="w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-200 hover:bg-[#383a3e] flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-zinc-400" />
                <span>Nueva pestaña</span>
              </button>

              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  createNewTab('/search', onNavigate);
                }}
                className="w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-200 hover:bg-[#383a3e] flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4 text-zinc-400" />
                <span>Nueva búsqueda</span>
              </button>

              <div className="h-px bg-zinc-700/60 my-1" />

              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  closeAllTabs(onNavigate);
                }}
                className="w-full px-4 py-2.5 text-left text-xs font-medium text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Cerrar todas las pestañas</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. BARRA DE BÚSQUEDA IDÉNTICA A GOOGLE CHROME              */}
      {/*    "Realiza búsquedas en las pestañas"                    */}
      {/* ========================================================= */}
      <div className="px-3 sm:px-4 pt-2 pb-3 shrink-0 bg-[#131314]">
        <div className="w-full max-w-2xl mx-auto relative flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-zinc-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={tabSearchQuery}
            onChange={(e) => setTabSearchQuery(e.target.value)}
            placeholder="Realiza búsquedas en las pestañas"
            className="w-full h-11 pl-10 pr-9 rounded-full bg-[#282a2d] hover:bg-[#303236] focus:bg-[#35373c] text-sm text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-all"
          />
          {tabSearchQuery && (
            <button
              onClick={() => setTabSearchQuery('')}
              className="absolute right-3 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
              title="Borrar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. CUADRÍCULA DE TARJETAS EN 2 COLUMNAS (GOOGLE STYLE)     */}
      {/* ========================================================= */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-4 pb-20 pt-1 max-w-4xl w-full mx-auto">
        {filteredTabs.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6">
            <Search className="w-10 h-10 text-zinc-600 mb-3" />
            <p className="text-sm font-semibold text-zinc-300">No se encontraron pestañas</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              No hay ninguna pestaña abierta que coincida con &quot;{tabSearchQuery}&quot;
            </p>
            <button
              onClick={() => setTabSearchQuery('')}
              className="mt-4 px-4 py-2 rounded-full bg-[#282a2d] text-xs font-bold text-zinc-200 hover:text-white transition"
            >
              Mostrar todas las pestañas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredTabs.map((tab) => {
              const isActive = tab.id === activeTabId;

              return (
                <div
                  key={tab.id}
                  onClick={() => switchTab(tab.id, onNavigate)}
                  className={`group relative rounded-[20px] overflow-hidden flex flex-col h-[230px] sm:h-[260px] select-none transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'ring-[2.5px] ring-[#a8c7fa] shadow-[0_4px_24px_rgba(168,199,250,0.25)] scale-[1.01]'
                      : 'border border-zinc-700/60 hover:border-zinc-500 bg-[#1e1f20]'
                  }`}
                >
                  {/* CABECERA INTEGRADA DE LA TARJETA (ESTILO CHROME) */}
                  <div
                    className={`h-9 px-2.5 flex items-center justify-between gap-1.5 shrink-0 z-10 ${
                      isActive ? 'bg-[#2b303c]' : 'bg-[#282a2d]'
                    }`}
                  >
                    {/* Favicon / Icono */}
                    <div className="shrink-0">
                      {getFaviconIcon(tab.type)}
                    </div>

                    {/* Título de la pestaña */}
                    <span 
                      className={`text-xs font-medium truncate flex-1 ${
                        isActive ? 'text-white font-semibold' : 'text-zinc-200'
                      }`}
                      title={tab.title}
                    >
                      {tab.title}
                    </span>

                    {/* Botón de cierre "✕" */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id, onNavigate);
                      }}
                      className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                      title="Cerrar pestaña"
                      aria-label="Cerrar pestaña"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* CUERPO DE LA TARJETA CON SNAPSHOT VISUAL DE LA PÁGINA */}
                  <div className="flex-1 overflow-hidden relative">
                    <TabPreviewSnapshot tab={tab} isActive={isActive} />

                    {/* Indicador de pestaña activa si está seleccionada */}
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#a8c7fa] shadow-[0_0_8px_#a8c7fa]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

    </div>
  );
}
