import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export interface ElementStyleOverride {
  id: string;
  name: string;
  selector?: string;
  dataId?: string;
  targetType: 'global' | 'custom-element';
  styles: {
    backgroundColor?: string;
    color?: string;
    borderColor?: string;
  };
}

export interface CustomThemeConfig {
  pageBg: string;
  headerBg: string;
  primaryColor: string;
  primaryTextColor: string;
  cardBg: string;
  cardBorder: string;
  headingColor: string;
  textColor: string;
  mutedTextColor: string;
  accentColor: string;
  elementOverrides: Record<string, ElementStyleOverride>;
}

export interface DetectedPageElement {
  id: string;
  category: 'background' | 'header' | 'primary-btn' | 'card' | 'heading' | 'text' | 'accent' | 'input';
  name: string;
  description: string;
  selector: string;
  currentBg?: string;
  currentColor?: string;
  currentBorder?: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  accentPreview: string;
  config: Partial<CustomThemeConfig>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default-gold',
    name: 'Starryz Clásico',
    description: 'Dorado original con negro carbón profundo',
    accentPreview: '#eab308',
    config: {
      pageBg: '#0a0a0a',
      headerBg: '#0e1318',
      primaryColor: '#eab308',
      primaryTextColor: '#000000',
      cardBg: '#141414',
      cardBorder: 'rgba(255, 255, 255, 0.1)',
      headingColor: '#ffffff',
      textColor: '#f4f4f5',
      mutedTextColor: '#a1a1aa',
      accentColor: '#eab308',
    },
  },
  {
    id: 'cyberpunk-magenta',
    name: 'Cyberpunk Neón',
    description: 'Fucsia y magenta brillante con fondo ultra oscuro',
    accentPreview: '#ec4899',
    config: {
      pageBg: '#0b0410',
      headerBg: '#150821',
      primaryColor: '#ec4899',
      primaryTextColor: '#ffffff',
      cardBg: '#180c26',
      cardBorder: 'rgba(236, 72, 153, 0.25)',
      headingColor: '#f472b6',
      textColor: '#fdf2f8',
      mutedTextColor: '#c084fc',
      accentColor: '#f43f5e',
    },
  },
  {
    id: 'ocean-cyan',
    name: 'Océano Neón',
    description: 'Cyan eléctrico con azul abisal y contrastes frescos',
    accentPreview: '#06b6d4',
    config: {
      pageBg: '#040d1a',
      headerBg: '#07162c',
      primaryColor: '#06b6d4',
      primaryTextColor: '#02131d',
      cardBg: '#0c223f',
      cardBorder: 'rgba(6, 182, 212, 0.25)',
      headingColor: '#38bdf8',
      textColor: '#f0f9ff',
      mutedTextColor: '#7dd3fc',
      accentColor: '#0ea5e9',
    },
  },
  {
    id: 'emerald-vip',
    name: 'Esmeralda Jade',
    description: 'Verde esmeralda elegante con fondo obsidiana',
    accentPreview: '#10b981',
    config: {
      pageBg: '#04120a',
      headerBg: '#071e11',
      primaryColor: '#10b981',
      primaryTextColor: '#021a0d',
      cardBg: '#0a2a19',
      cardBorder: 'rgba(16, 185, 129, 0.25)',
      headingColor: '#34d399',
      textColor: '#ecfdf5',
      mutedTextColor: '#6ee7b7',
      accentColor: '#059669',
    },
  },
  {
    id: 'sunset-crimson',
    name: 'Atardecer Carmesí',
    description: 'Rojo fuego y ámbar cálido de alto impacto',
    accentPreview: '#ef4444',
    config: {
      pageBg: '#120505',
      headerBg: '#1f0909',
      primaryColor: '#ef4444',
      primaryTextColor: '#ffffff',
      cardBg: '#250c0c',
      cardBorder: 'rgba(239, 68, 68, 0.25)',
      headingColor: '#f87171',
      textColor: '#fff1f2',
      mutedTextColor: '#fda4af',
      accentColor: '#f97316',
    },
  },
  {
    id: 'purple-galaxy',
    name: 'Galaxia Violeta',
    description: 'Púrpura espacial y resplandores violeta cósmico',
    accentPreview: '#8b5cf6',
    config: {
      pageBg: '#090514',
      headerBg: '#120b26',
      primaryColor: '#8b5cf6',
      primaryTextColor: '#ffffff',
      cardBg: '#191035',
      cardBorder: 'rgba(139, 92, 246, 0.25)',
      headingColor: '#a78bfa',
      textColor: '#f5f3ff',
      mutedTextColor: '#c4b5fd',
      accentColor: '#7c3aed',
    },
  },
];

export const DEFAULT_THEME: CustomThemeConfig = {
  pageBg: '#0a0a0a',
  headerBg: '#0e1318',
  primaryColor: '#eab308',
  primaryTextColor: '#000000',
  cardBg: '#141414',
  cardBorder: 'rgba(255, 255, 255, 0.1)',
  headingColor: '#ffffff',
  textColor: '#f4f4f5',
  mutedTextColor: '#a1a1aa',
  accentColor: '#eab308',
  elementOverrides: {},
};

interface ThemeCustomizerContextType {
  isStudioOpen: boolean;
  setIsStudioOpen: (open: boolean) => void;
  openThemeStudio: () => void;
  closeThemeStudio: () => void;
  isMinimized: boolean;
  setIsMinimized: (min: boolean) => void;
  isInspectorActive: boolean;
  setIsInspectorActive: (active: boolean) => void;
  toggleInspector: () => void;
  activeTab: 'page' | 'inspector' | 'presets';
  setActiveTab: (tab: 'page' | 'inspector' | 'presets') => void;
  customTheme: CustomThemeConfig;
  updateGlobalColor: (key: keyof Omit<CustomThemeConfig, 'elementOverrides'>, value: string) => void;
  updateElementOverride: (id: string, override: ElementStyleOverride) => void;
  removeElementOverride: (id: string) => void;
  applyPreset: (presetId: string) => void;
  resetAllColors: () => void;
  hasCustomStyles: boolean;
  selectedElementForEdit: {
    id: string;
    name: string;
    tagName: string;
    selector: string;
    currentBg: string;
    currentColor: string;
    currentBorder: string;
  } | null;
  setSelectedElementForEdit: (element: any) => void;
  detectedPageElements: DetectedPageElement[];
  refreshDetectedElements: () => void;
}

const ThemeCustomizerContext = createContext<ThemeCustomizerContextType | undefined>(undefined);

const STORAGE_KEY = 'starryz_custom_theme_v2';
const STYLE_TAG_ID = 'starryz-dynamic-custom-styles';

export const ThemeCustomizerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isInspectorActive, setIsInspectorActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'page' | 'inspector' | 'presets'>('page');
  const [selectedElementForEdit, setSelectedElementForEdit] = useState<{
    id: string;
    name: string;
    tagName: string;
    selector: string;
    currentBg: string;
    currentColor: string;
    currentBorder: string;
  } | null>(null);

  const [customTheme, setCustomTheme] = useState<CustomThemeConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...DEFAULT_THEME,
            ...parsed,
            elementOverrides: parsed.elementOverrides || {},
          };
        }
      } catch (err) {
        console.warn('Error reading saved custom theme:', err);
      }
    }
    return DEFAULT_THEME;
  });

  const [detectedPageElements, setDetectedPageElements] = useState<DetectedPageElement[]>([]);

  // Check if any customized colors differ from default
  const hasCustomStyles = useMemo(() => {
    const keys: (keyof Omit<CustomThemeConfig, 'elementOverrides'>)[] = [
      'pageBg', 'headerBg', 'primaryColor', 'primaryTextColor',
      'cardBg', 'cardBorder', 'headingColor', 'textColor', 'mutedTextColor', 'accentColor'
    ];
    const hasGlobalDiff = keys.some(k => customTheme[k] !== DEFAULT_THEME[k]);
    const hasOverrides = Object.keys(customTheme.elementOverrides || {}).length > 0;
    return hasGlobalDiff || hasOverrides;
  }, [customTheme]);

  // Inject dynamic styles into <head>
  const applyStylesToDom = useCallback((theme: CustomThemeConfig) => {
    if (typeof document === 'undefined') return;

    let styleEl = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_TAG_ID;
      document.head.appendChild(styleEl);
    }

    // Build CSS rules
    const rules: string[] = [];

    // Root variables for global consumption
    rules.push(`
      :root {
        --custom-page-bg: ${theme.pageBg};
        --custom-header-bg: ${theme.headerBg};
        --custom-primary-color: ${theme.primaryColor};
        --custom-primary-text: ${theme.primaryTextColor};
        --custom-card-bg: ${theme.cardBg};
        --custom-card-border: ${theme.cardBorder};
        --custom-heading-color: ${theme.headingColor};
        --custom-text-color: ${theme.textColor};
        --custom-muted-text: ${theme.mutedTextColor};
        --custom-accent-color: ${theme.accentColor};
      }
    `);

    // 1. Fondo General
    if (theme.pageBg !== DEFAULT_THEME.pageBg) {
      rules.push(`
        body, html, #root, .bg-radial-grid, main,
        .bg-\\[\\#0a0a0a\\], .bg-\\[\\#0d0d0d\\], .bg-\\[\\#0f0f0f\\],
        .bg-\\[\\#0a0a0c\\], .bg-\\[\\#0c0d10\\], .bg-\\[\\#090a0d\\],
        .bg-\\[\\#0e1117\\], .bg-\\[\\#09090b\\] {
          background-color: ${theme.pageBg} !important;
        }
      `);
    }

    // 2. Cabecera / Header
    if (theme.headerBg !== DEFAULT_THEME.headerBg) {
      rules.push(`
        header, header.bg-\\[\\#0e1318\\], header.bg-\\[\\#0e1318\\]\\/90,
        .custom-theme-header {
          background-color: ${theme.headerBg} !important;
        }
      `);
    }

    // 3. Botones y Elementos Primarios (Dorado / Acento)
    if (theme.primaryColor !== DEFAULT_THEME.primaryColor || theme.primaryTextColor !== DEFAULT_THEME.primaryTextColor) {
      rules.push(`
        .bg-\\[\\#eab308\\], .bg-amber-400, .bg-yellow-400, .bg-amber-500,
        button.bg-\\[\\#eab308\\], a.bg-\\[\\#eab308\\],
        .fixed.bottom-24.right-6,
        .bg-amber-500\\/20 {
          background-color: ${theme.primaryColor} !important;
          color: ${theme.primaryTextColor} !important;
        }

        .border-\\[\\#eab308\\], .border-amber-400, .border-yellow-400, .border-amber-500 {
          border-color: ${theme.primaryColor} !important;
        }

        .text-\\[\\#eab308\\], .text-amber-400, .text-yellow-400, .text-amber-500 {
          color: ${theme.primaryColor} !important;
        }

        .fill-\\[\\#eab308\\], .fill-yellow-400, .fill-amber-400 {
          fill: ${theme.primaryColor} !important;
          stroke: ${theme.primaryColor} !important;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: ${theme.primaryColor} !important;
        }
      `);
    }

    // 4. Tarjetas y Paneles
    if (theme.cardBg !== DEFAULT_THEME.cardBg || theme.cardBorder !== DEFAULT_THEME.cardBorder) {
      rules.push(`
        .bg-\\[\\#141414\\], .bg-\\[\\#151515\\], .bg-\\[\\#171717\\],
        .bg-\\[\\#181818\\], .bg-\\[\\#1a1a1a\\], .bg-\\[\\#1c1c1c\\],
        .bg-\\[\\#1e1e1e\\], .bg-\\[\\#1e1e24\\], .bg-\\[\\#121212\\],
        .bg-\\[\\#131313\\], .bg-\\[\\#111111\\], .bg-\\[\\#101010\\],
        .bg-\\[\\#161616\\], .bg-\\[\\#1b1b1b\\], .bg-\\[\\#202020\\],
        .bg-zinc-900, .bg-zinc-850, .bg-zinc-800,
        .bg-zinc-900\\/80, .bg-zinc-900\\/60, .bg-zinc-900\\/40 {
          background-color: ${theme.cardBg} !important;
        }

        .border-\\[\\#ffffff10\\], .border-\\[\\#ffffff15\\], .border-\\[\\#ffffff08\\],
        .border-\\[\\#ffffff0a\\], .border-\\[\\#ffffff20\\], .border-\\[\\#ffffff30\\],
        .border-zinc-800, .border-zinc-800\\/80, .border-zinc-800\\/60,
        .border-zinc-900, .border-zinc-900\\/60 {
          border-color: ${theme.cardBorder} !important;
        }
      `);
    }

    // 5. Títulos y Encabezados
    if (theme.headingColor !== DEFAULT_THEME.headingColor) {
      rules.push(`
        h1, h2, h3, h4, .font-black.text-white, .font-extrabold.text-white {
          color: ${theme.headingColor} !important;
        }
      `);
    }

    // 6. Textos y Párrafos
    if (theme.textColor !== DEFAULT_THEME.textColor) {
      rules.push(`
        .text-zinc-100, .text-zinc-200, .text-zinc-300 {
          color: ${theme.textColor} !important;
        }
      `);
    }

    // 7. Texto secundario / muted
    if (theme.mutedTextColor !== DEFAULT_THEME.mutedTextColor) {
      rules.push(`
        .text-zinc-400, .text-zinc-500 {
          color: ${theme.mutedTextColor} !important;
        }
      `);
    }

    // 8. Element-specific overrides (from Point-and-Click inspector)
    if (theme.elementOverrides) {
      Object.entries(theme.elementOverrides).forEach(([id, override]) => {
        const selector = override.dataId 
          ? `[data-theme-studio-id="${override.dataId}"]`
          : override.selector;

        if (selector) {
          const styleProps: string[] = [];
          if (override.styles.backgroundColor) {
            styleProps.push(`background-color: ${override.styles.backgroundColor} !important;`);
          }
          if (override.styles.color) {
            styleProps.push(`color: ${override.styles.color} !important;`);
          }
          if (override.styles.borderColor) {
            styleProps.push(`border-color: ${override.styles.borderColor} !important;`);
          }
          if (styleProps.length > 0) {
            rules.push(`${selector} { ${styleProps.join(' ')} }`);
          }
        }
      });
    }

    styleEl.innerHTML = rules.join('\n');
  }, []);

  // Update styles whenever customTheme changes
  useEffect(() => {
    applyStylesToDom(customTheme);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customTheme));
    } catch (e) {
      console.warn('Failed saving theme to localStorage:', e);
    }
  }, [customTheme, applyStylesToDom]);

  // Scan current page to find the most relevant contextual components
  const refreshDetectedElements = useCallback(() => {
    if (typeof document === 'undefined') return;

    const detected: DetectedPageElement[] = [
      {
        id: 'bg-page',
        category: 'background',
        name: 'Fondo General',
        description: 'El lienzo y fondo principal de la página actual',
        selector: 'body, main',
        currentBg: customTheme.pageBg,
      },
      {
        id: 'header-nav',
        category: 'header',
        name: 'Barra Superior (Cabecera)',
        description: 'La barra de navegación con logo, buscador y menú',
        selector: 'header',
        currentBg: customTheme.headerBg,
      },
      {
        id: 'primary-buttons',
        category: 'primary-btn',
        name: 'Botones Principales y Acciones',
        description: 'Botones dorados de votación, registrarse y acciones clave',
        selector: 'button.bg-\\[\\#eab308\\], .bg-amber-400',
        currentBg: customTheme.primaryColor,
        currentColor: customTheme.primaryTextColor,
      },
      {
        id: 'cards-surfaces',
        category: 'card',
        name: 'Tarjetas y Contenedores',
        description: 'Tarjetas de colegios, profesores, alumnos y modales',
        selector: '.rounded-2xl, .bg-zinc-900, .bg-\\[\\#141414\\]',
        currentBg: customTheme.cardBg,
        currentBorder: customTheme.cardBorder,
      },
      {
        id: 'main-headings',
        category: 'heading',
        name: 'Títulos y Encabezados',
        description: 'Títulos principales (H1, H2) y textos destacados',
        selector: 'h1, h2, h3',
        currentColor: customTheme.headingColor,
      },
      {
        id: 'body-text',
        category: 'text',
        name: 'Texto y Descripciones',
        description: 'Contenido informativo, párrafos y etiquetas',
        selector: 'p, span.text-zinc-300',
        currentColor: customTheme.textColor,
      },
      {
        id: 'muted-labels',
        category: 'text',
        name: 'Texto Secundario / Metadatos',
        description: 'Fechas, conteos, subtítulos y categorías',
        selector: 'span.text-zinc-400, span.text-zinc-500',
        currentColor: customTheme.mutedTextColor,
      },
    ];

    // Check if search bar is present on screen
    const searchInput = document.querySelector('input[type="text"], input[type="search"]');
    if (searchInput) {
      detected.push({
        id: 'search-input',
        category: 'input',
        name: 'Barra de Búsqueda e Inputs',
        description: 'Cajas de texto y campos de búsqueda',
        selector: 'form input',
        currentBg: '#141414',
      });
    }

    setDetectedPageElements(detected);
  }, [customTheme]);

  // Run initial scan & when studio opens
  useEffect(() => {
    if (isStudioOpen) {
      refreshDetectedElements();
    }
  }, [isStudioOpen, refreshDetectedElements]);

  // Point-and-Click Inspector logic
  useEffect(() => {
    if (!isInspectorActive || typeof document === 'undefined') return;

    let hoveredEl: HTMLElement | null = null;
    const originalOutline = new Map<HTMLElement, string>();

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('#starryz-theme-studio-root')) return;

      if (hoveredEl && hoveredEl !== target) {
        hoveredEl.style.outline = originalOutline.get(hoveredEl) || '';
      }

      hoveredEl = target;
      originalOutline.set(target, target.style.outline);
      target.style.outline = '2px dashed #eab308';
      target.style.outlineOffset = '2px';
      target.style.cursor = 'crosshair';
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('#starryz-theme-studio-root')) return;

      target.style.outline = originalOutline.get(target) || '';
      target.style.cursor = '';
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('#starryz-theme-studio-root')) return;

      e.preventDefault();
      e.stopPropagation();

      // Clean outline
      target.style.outline = originalOutline.get(target) || '';
      target.style.cursor = '';

      // Assign unique ID attribute to element if not already present
      let dataId = target.getAttribute('data-theme-studio-id');
      if (!dataId) {
        dataId = `elem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        target.setAttribute('data-theme-studio-id', dataId);
      }

      // Compute style properties
      const computed = window.getComputedStyle(target);
      const textSample = target.innerText?.trim().slice(0, 30) || target.getAttribute('aria-label') || target.tagName.toLowerCase();
      const friendlyName = `${target.tagName}: "${textSample}"`;

      setSelectedElementForEdit({
        id: dataId,
        name: friendlyName,
        tagName: target.tagName,
        selector: `[data-theme-studio-id="${dataId}"]`,
        currentBg: computed.backgroundColor,
        currentColor: computed.color,
        currentBorder: computed.borderColor,
      });

      // Switch to inspector tab & expand drawer
      setActiveTab('inspector');
      setIsMinimized(false);
      setIsInspectorActive(false); // finish picking
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('click', handleClick, true);
      if (hoveredEl) {
        hoveredEl.style.outline = originalOutline.get(hoveredEl) || '';
        hoveredEl.style.cursor = '';
      }
    };
  }, [isInspectorActive]);

  const updateGlobalColor = (key: keyof Omit<CustomThemeConfig, 'elementOverrides'>, value: string) => {
    setCustomTheme(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateElementOverride = (id: string, override: ElementStyleOverride) => {
    setCustomTheme(prev => ({
      ...prev,
      elementOverrides: {
        ...(prev.elementOverrides || {}),
        [id]: override,
      },
    }));
  };

  const removeElementOverride = (id: string) => {
    setCustomTheme(prev => {
      const next = { ...(prev.elementOverrides || {}) };
      delete next[id];
      return {
        ...prev,
        elementOverrides: next,
      };
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = THEME_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    setCustomTheme(prev => ({
      ...prev,
      ...preset.config,
    }));
  };

  const resetAllColors = () => {
    setCustomTheme(DEFAULT_THEME);
    setSelectedElementForEdit(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      const styleEl = document.getElementById(STYLE_TAG_ID);
      if (styleEl) {
        styleEl.innerHTML = '';
      }
    } catch (e) {
      console.warn('Error clearing theme styles:', e);
    }
  };

  const openThemeStudio = () => {
    setIsStudioOpen(true);
    setIsMinimized(false);
  };

  const closeThemeStudio = () => {
    setIsStudioOpen(false);
    setIsInspectorActive(false);
  };

  const toggleInspector = () => {
    setIsInspectorActive(prev => !prev);
    if (!isInspectorActive) {
      setIsMinimized(true); // minimize drawer so user can touch elements freely
    }
  };

  return (
    <ThemeCustomizerContext.Provider
      value={{
        isStudioOpen,
        setIsStudioOpen,
        openThemeStudio,
        closeThemeStudio,
        isMinimized,
        setIsMinimized,
        isInspectorActive,
        setIsInspectorActive,
        toggleInspector,
        activeTab,
        setActiveTab,
        customTheme,
        updateGlobalColor,
        updateElementOverride,
        removeElementOverride,
        applyPreset,
        resetAllColors,
        hasCustomStyles,
        selectedElementForEdit,
        setSelectedElementForEdit,
        detectedPageElements,
        refreshDetectedElements,
      }}
    >
      {children}
    </ThemeCustomizerContext.Provider>
  );
};

export const useThemeCustomizer = () => {
  const context = useContext(ThemeCustomizerContext);
  if (!context) {
    throw new Error('useThemeCustomizer must be used within a ThemeCustomizerProvider');
  }
  return context;
};
