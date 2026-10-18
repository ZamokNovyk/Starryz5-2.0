'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import html2canvas from 'html2canvas';

export type TabType = 
  | 'home' 
  | 'professor' 
  | 'student' 
  | 'tools' 
  | 'center' 
  | 'search' 
  | 'admin' 
  | 'profile' 
  | 'general';

export interface TabRichMeta {
  institutionName?: string;
  institutionAcronym?: string;
  institutionType?: string;
  institutionCity?: string;
  institutionRating?: number;
  institutionReviews?: number;
  institutionBanner?: string;
  institutionLogo?: string;
  professorName?: string;
  professorRating?: number;
  professorSubject?: string;
  studentName?: string;
  studentCrushes?: number;
  studentRating?: number;
  searchQuery?: string;
  searchTotalResults?: number;
  toolType?: 'compressor' | 'organizer' | 'splitter' | 'ruleta' | 'grupos';
  topInstitutions?: { name: string; acronym: string; rating: number; city?: string }[];
}

export interface PwaTab {
  id: string;
  title: string;
  pathname: string;
  search: string;
  type: TabType;
  previewSubtitle?: string;
  updatedAt: number;
  snapshotUrl?: string; // Captura de pantalla real en miniatura (estilo Google Chrome)
  meta?: TabRichMeta; // Metadatos detallados de la página para un render fotorrealista idéntico a Chrome
}

interface PwaTabsContextValue {
  isPwa: boolean;
  togglePwaSimulation: () => void;
  tabs: PwaTab[];
  activeTabId: string;
  activeTab: PwaTab | undefined;
  isTabsSwitcherOpen: boolean;
  setIsTabsSwitcherOpen: (open: boolean) => void;
  openTabsSwitcher: () => Promise<void>;
  captureActiveTabSnapshot: (customTabId?: string) => Promise<string | null>;
  switchTab: (id: string, onNavigate?: (path: string, search?: string) => void) => void;
  closeTab: (id: string, onNavigate?: (path: string, search?: string) => void) => void;
  closeAllTabs: (onNavigate?: (path: string, search?: string) => void) => void;
  createNewTab: (initialPath?: string, onNavigate?: (path: string, search?: string) => void) => void;
  syncCurrentRoute: (pathname: string, search: string, customTitle?: string, customMeta?: TabRichMeta) => void;
}

const PwaTabsContext = createContext<PwaTabsContextValue | undefined>(undefined);

const STORAGE_KEY = 'starryz_pwa_tabs_v2';
const ACTIVE_TAB_KEY = 'starryz_pwa_active_tab_v2';
const FORCE_PWA_KEY = 'starryz_force_pwa_mode';

/**
 * Formatea un slug a texto limpio y legible
 */
export function formatSlug(slug: string): string {
  if (!slug) return '';
  try {
    const decoded = decodeURIComponent(slug);
    return decoded
      .split(/[\.-]/)
      .filter(w => w.trim().length > 0)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  } catch (_) {
    return slug;
  }
}

/**
 * Obtiene los metadatos y título según la ruta actual
 */
export function getTabMetadata(pathname: string, search: string): { title: string; type: TabType; previewSubtitle: string } {
  const urlParams = new URLSearchParams(search);
  const q = urlParams.get('q');

  if (pathname === '/search' || (pathname === '/' && q)) {
    return {
      title: q ? `Búsqueda: ${q}` : 'Buscador',
      type: 'search',
      previewSubtitle: q ? `Resultados para "${q}"` : 'Directorio escolar y perfiles'
    };
  }

  if (pathname === '/') {
    return {
      title: 'Inicio • Campus',
      type: 'home',
      previewSubtitle: 'Explorar rankings y actividad'
    };
  }

  if (pathname.startsWith('/profesores/')) {
    const slug = pathname.replace('/profesores/', '');
    const name = formatSlug(slug) || 'Docente';
    return {
      title: `Prof. ${name}`,
      type: 'professor',
      previewSubtitle: 'Perfil docente y opiniones'
    };
  }

  if (pathname.startsWith('/estudiantes/')) {
    const slug = pathname.replace('/estudiantes/', '');
    const name = formatSlug(slug) || 'Estudiante';
    return {
      title: `${name}`,
      type: 'student',
      previewSubtitle: 'Perfil estudiantil y flechazos'
    };
  }

  if (
    pathname.startsWith('/educational_centers/') ||
    pathname.startsWith('/centros/') ||
    pathname.startsWith('/instituciones/')
  ) {
    const slug = pathname
      .replace('/educational_centers/', '')
      .replace('/centros/', '')
      .replace('/instituciones/', '');
    const name = formatSlug(slug) || 'Centro Educativo';
    return {
      title: `${name}`,
      type: 'center',
      previewSubtitle: 'Campus, docentes y carreras'
    };
  }

  if (pathname === '/herramientas') {
    return {
      title: 'Herramientas',
      type: 'tools',
      previewSubtitle: 'Colección de utilidades de estudio'
    };
  }

  if (
    pathname === '/herramientas/comprimirpdf' ||
    pathname === '/herramientas/compresor-pdf' ||
    pathname === '/herramientas/comprimir-pdf'
  ) {
    return {
      title: 'Compresor PDF',
      type: 'tools',
      previewSubtitle: 'Optimización algorítmica local'
    };
  }

  if (pathname === '/herramientas/organizadorpdf' || pathname === '/herramientas/organizador-pdf') {
    return {
      title: 'Organizador PDF',
      type: 'tools',
      previewSubtitle: 'Edición y ensamble de hojas'
    };
  }

  if (pathname === '/herramientas/dividirpdf' || pathname === '/herramientas/dividir-pdf') {
    return {
      title: 'Dividir PDF',
      type: 'tools',
      previewSubtitle: 'Corte y extracción por rangos'
    };
  }

  if (pathname === '/herramientas/ruleta') {
    return {
      title: 'Ruleta Sorteos',
      type: 'tools',
      previewSubtitle: 'Participación y sorteos en vivo'
    };
  }

  if (pathname === '/herramientas/grupos' || pathname === '/herramientas/formador-grupos') {
    return {
      title: 'Formador Grupos',
      type: 'tools',
      previewSubtitle: 'Equipos y dinámicas aleatorias'
    };
  }

  if (pathname.startsWith('/perfil')) {
    return {
      title: 'Mi Perfil',
      type: 'profile',
      previewSubtitle: 'Configuración y estadísticas'
    };
  }

  if (pathname === '/admin') {
    return {
      title: 'Panel Admin',
      type: 'admin',
      previewSubtitle: 'Administración de Starryz 5'
    };
  }

  return {
    title: 'Starryz 5',
    type: 'general',
    previewSubtitle: pathname
  };
}

/**
 * Función interna para capturar una miniatura del DOM actual usando html2canvas
 */
async function captureDomSnapshot(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const target = (document.querySelector('main') as HTMLElement) || 
                   (document.getElementById('root') as HTMLElement) || 
                   (document.body as HTMLElement);
    if (!target) return null;

    const viewportWidth = Math.min(window.innerWidth, 450);
    const viewportHeight = Math.min(window.innerHeight, 850);

    const canvas = await html2canvas(target, {
      scale: 0.35, // Escala pequeña: súper rápida y genera ~25KB por imagen
      useCORS: true,
      allowTaint: false, // CRÍTICO: false para evitar SecurityError en toDataURL()
      imageTimeout: 1200,
      logging: false,
      backgroundColor: '#0a0a0a',
      width: viewportWidth,
      height: viewportHeight,
      windowWidth: viewportWidth,
      windowHeight: viewportHeight,
      ignoreElements: (el) => {
        return (
          el.id === 'pwa-tabs-switcher-modal' ||
          el.id === 'fcm-toast' ||
          el.classList.contains('pwa-modal-ignore')
        );
      }
    });

    return canvas.toDataURL('image/jpeg', 0.65);
  } catch (err) {
    console.warn('Error capturando miniatura de pestaña con html2canvas:', err);
    return null;
  }
}

export function PwaTabsProvider({ children }: { children: ReactNode }) {
  const [isPwa, setIsPwa] = useState(false);
  const [isTabsSwitcherOpen, setIsTabsSwitcherOpen] = useState(false);

  // Lista de pestañas y pestaña activa
  const [tabs, setTabs] = useState<PwaTab[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error cargando pestañas de PWA:', e);
    }

    const initMeta = getTabMetadata(
      typeof window !== 'undefined' ? window.location.pathname : '/',
      typeof window !== 'undefined' ? window.location.search : ''
    );

    return [
      {
        id: 'tab_init',
        title: initMeta.title,
        pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
        search: typeof window !== 'undefined' ? window.location.search : '',
        type: initMeta.type,
        previewSubtitle: initMeta.previewSubtitle,
        updatedAt: Date.now()
      }
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'tab_init';
    const savedActive = localStorage.getItem(ACTIVE_TAB_KEY);
    return savedActive || 'tab_init';
  });

  // Detección del estado PWA
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkPwaStatus = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIos = (window.navigator as any).standalone === true;
      const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
      const searchParams = new URLSearchParams(window.location.search);
      const isParamPwa = searchParams.get('source') === 'pwa' || searchParams.get('pwa') === '1';
      const isForced = localStorage.getItem(FORCE_PWA_KEY) === 'true';

      setIsPwa(isStandalone || isIos || isFullscreen || isParamPwa || isForced);
    };

    checkPwaStatus();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => checkPwaStatus();
    mediaQuery.addEventListener?.('change', handleChange);
    window.addEventListener('appinstalled', handleChange);

    return () => {
      mediaQuery.removeEventListener?.('change', handleChange);
      window.removeEventListener('appinstalled', handleChange);
    };
  }, []);

  // Guardar pestañas en localStorage con resguardo de espacio
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
      localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
    } catch (e) {
      // Si se excede el límite de localStorage, guardar solo snapshots de las 3 más recientes
      try {
        const trimmed = tabs.map((t, idx) => {
          if (idx < tabs.length - 3) {
            const { snapshotUrl, ...rest } = t;
            return rest;
          }
          return t;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
      } catch (_) {}
    }
  }, [tabs, activeTabId]);

  // Alternar simulación PWA
  const togglePwaSimulation = useCallback(() => {
    setIsPwa(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(FORCE_PWA_KEY, next ? 'true' : 'false');
      }
      return next;
    });
  }, []);

  // Capturar snapshot real de la pestaña activa
  const captureActiveTabSnapshot = useCallback(async (customTabId?: string): Promise<string | null> => {
    const targetId = customTabId || activeTabId;
    if (!targetId || typeof window === 'undefined') return null;

    try {
      const snapshot = await captureDomSnapshot();
      if (snapshot) {
        setTabs(prev => prev.map(t => {
          if (t.id === targetId) {
            return { ...t, snapshotUrl: snapshot, updatedAt: Date.now() };
          }
          return t;
        }));
        return snapshot;
      }
    } catch (err) {
      console.warn('Error al capturar snapshot de pestaña activa:', err);
    }
    return null;
  }, [activeTabId]);

  // Capturar periódicamente la pestaña activa cuando se estabiliza la página
  useEffect(() => {
    if (isTabsSwitcherOpen || typeof window === 'undefined') return;

    const timer = setTimeout(() => {
      captureActiveTabSnapshot().catch(() => {});
    }, 1200);

    return () => clearTimeout(timer);
  }, [activeTabId, isTabsSwitcherOpen, captureActiveTabSnapshot]);

  // Abrir modal de pestañas capturando antes el snapshot actual de forma ágil
  const openTabsSwitcher = useCallback(async () => {
    try {
      // Damos una ventana breve de hasta 280ms para capturar la pantalla antes de superponer el modal
      await Promise.race([
        captureActiveTabSnapshot(),
        new Promise(resolve => setTimeout(resolve, 280))
      ]);
    } catch (_) {}
    setIsTabsSwitcherOpen(true);
  }, [captureActiveTabSnapshot]);

  // Sincronizar ruta activa con la pestaña actual con soporte para metadatos fotorrealistas
  const syncCurrentRoute = useCallback((pathname: string, search: string, customTitle?: string, customMeta?: TabRichMeta) => {
    const meta = getTabMetadata(pathname, search);
    const finalTitle = customTitle || meta.title;

    setTabs(prev => {
      const existingTab = prev.find(t => t.id === activeTabId);
      if (existingTab) {
        // Evitar actualizar estado si la ruta, título y metadatos no han cambiado
        const titleSame = existingTab.title === finalTitle;
        const pathSame = existingTab.pathname === pathname;
        const searchSame = existingTab.search === search;
        const metaSame = !customMeta || (
          existingTab.meta?.institutionName === customMeta.institutionName &&
          existingTab.meta?.toolType === customMeta.toolType &&
          existingTab.meta?.searchQuery === customMeta.searchQuery &&
          existingTab.meta?.professorName === customMeta.professorName &&
          existingTab.meta?.studentName === customMeta.studentName
        );

        if (titleSame && pathSame && searchSame && metaSame) {
          return prev; // Misma referencia -> React omite el re-render por completo
        }
      }

      if (!existingTab) {
        const newTab: PwaTab = {
          id: activeTabId || 'tab_' + Math.random().toString(36).substring(2, 9),
          title: finalTitle,
          pathname,
          search,
          type: meta.type,
          previewSubtitle: meta.previewSubtitle,
          updatedAt: Date.now(),
          meta: customMeta
        };
        return [...prev, newTab];
      }

      return prev.map(tab => {
        if (tab.id === activeTabId) {
          return {
            ...tab,
            title: finalTitle,
            pathname,
            search,
            type: meta.type,
            previewSubtitle: meta.previewSubtitle,
            updatedAt: Date.now(),
            meta: customMeta ? { ...tab.meta, ...customMeta } : tab.meta
          };
        }
        return tab;
      });
    });
  }, [activeTabId]);

  // Cambiar a una pestaña existente capturando el estado previo
  const switchTab = useCallback((id: string, onNavigate?: (path: string, search?: string) => void) => {
    const target = tabs.find(t => t.id === id);
    if (!target) return;

    // Guardar snapshot de la pestaña que se está abandonando
    captureActiveTabSnapshot().catch(() => {});

    setActiveTabId(id);
    setIsTabsSwitcherOpen(false);

    if (onNavigate) {
      onNavigate(target.pathname, target.search);
    }
  }, [tabs, captureActiveTabSnapshot]);

  // Crear y cambiar a una nueva pestaña
  const createNewTab = useCallback((initialPath = '/', onNavigate?: (path: string, search?: string) => void) => {
    captureActiveTabSnapshot().catch(() => {});

    const meta = getTabMetadata(initialPath, '');
    const newId = 'tab_' + Math.random().toString(36).substring(2, 9);
    const newTab: PwaTab = {
      id: newId,
      title: meta.title,
      pathname: initialPath,
      search: '',
      type: meta.type,
      previewSubtitle: meta.previewSubtitle,
      updatedAt: Date.now()
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setIsTabsSwitcherOpen(false);

    if (onNavigate) {
      onNavigate(initialPath, '');
    }
  }, [captureActiveTabSnapshot]);

  // Cerrar pestaña específica
  const closeTab = useCallback((id: string, onNavigate?: (path: string, search?: string) => void) => {
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== id);
      if (remaining.length === 0) {
        const defaultTab: PwaTab = {
          id: 'tab_' + Math.random().toString(36).substring(2, 9),
          title: 'Inicio • Campus',
          pathname: '/',
          search: '',
          type: 'home',
          previewSubtitle: 'Explorar campus y rankings',
          updatedAt: Date.now()
        };
        setActiveTabId(defaultTab.id);
        if (onNavigate) onNavigate('/', '');
        return [defaultTab];
      }

      if (id === activeTabId) {
        const nextActive = remaining[remaining.length - 1];
        setActiveTabId(nextActive.id);
        if (onNavigate) {
          onNavigate(nextActive.pathname, nextActive.search);
        }
      }

      return remaining;
    });
  }, [activeTabId]);

  // Cerrar todas las pestañas y reiniciar a Inicio
  const closeAllTabs = useCallback((onNavigate?: (path: string, search?: string) => void) => {
    const resetTab: PwaTab = {
      id: 'tab_' + Math.random().toString(36).substring(2, 9),
      title: 'Inicio • Campus',
      pathname: '/',
      search: '',
      type: 'home',
      previewSubtitle: 'Explorar campus y rankings',
      updatedAt: Date.now()
    };

    setTabs([resetTab]);
    setActiveTabId(resetTab.id);
    setIsTabsSwitcherOpen(false);

    if (onNavigate) {
      onNavigate('/', '');
    }
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId);

  const contextValue = useMemo(() => ({
    isPwa,
    togglePwaSimulation,
    tabs,
    activeTabId,
    activeTab,
    isTabsSwitcherOpen,
    setIsTabsSwitcherOpen,
    openTabsSwitcher,
    captureActiveTabSnapshot,
    switchTab,
    closeTab,
    closeAllTabs,
    createNewTab,
    syncCurrentRoute
  }), [
    isPwa,
    togglePwaSimulation,
    tabs,
    activeTabId,
    activeTab,
    isTabsSwitcherOpen,
    setIsTabsSwitcherOpen,
    openTabsSwitcher,
    captureActiveTabSnapshot,
    switchTab,
    closeTab,
    closeAllTabs,
    createNewTab,
    syncCurrentRoute
  ]);

  return (
    <PwaTabsContext.Provider value={contextValue}>
      {children}
    </PwaTabsContext.Provider>
  );
}

export function usePwaTabs() {
  const context = useContext(PwaTabsContext);
  if (!context) {
    throw new Error('usePwaTabs must be used within a PwaTabsProvider');
  }
  return context;
}
