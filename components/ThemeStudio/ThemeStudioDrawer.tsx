import React, { useState } from 'react';
import { 
  Palette, 
  Wand2, 
  Sparkles, 
  RotateCcw, 
  X, 
  Minimize2, 
  Maximize2, 
  Check, 
  Layers, 
  ChevronRight, 
  Sliders, 
  Eye,
  Info,
  MousePointerClick,
  Sparkle
} from 'lucide-react';
import { useThemeCustomizer, THEME_PRESETS, CustomThemeConfig } from '@/src/context/ThemeCustomizerContext';

// Quick curated color swatches for instant choice
const QUICK_PALETTE_SWATCHES = [
  { name: 'Dorado Starryz', hex: '#eab308' },
  { name: 'Cyan Neón', hex: '#06b6d4' },
  { name: 'Magenta Cyberpunk', hex: '#ec4899' },
  { name: 'Verde Esmeralda', hex: '#10b981' },
  { name: 'Púrpura Galáctico', hex: '#8b5cf6' },
  { name: 'Rojo Carmesí', hex: '#ef4444' },
  { name: 'Azul Real', hex: '#2563eb' },
  { name: 'Naranja Fuego', hex: '#f97316' },
  { name: 'Carbón Profundo', hex: '#0a0a0a' },
  { name: 'Gris Grafito', hex: '#18181b' },
  { name: 'Blanco Puro', hex: '#ffffff' },
  { name: 'Plata Suave', hex: '#e2e8f0' },
];

export const ThemeStudioDrawer: React.FC = () => {
  const {
    isStudioOpen,
    closeThemeStudio,
    isMinimized,
    setIsMinimized,
    isInspectorActive,
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
  } = useThemeCustomizer();

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  if (!isStudioOpen) return null;

  // Render floating Inspector Mode Banner when active
  if (isInspectorActive) {
    return (
      <div 
        id="starryz-theme-studio-root"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3 px-4 py-2.5 rounded-full bg-zinc-950/95 border-2 border-amber-400 text-white shadow-[0_10px_35px_rgba(234,179,8,0.35)] backdrop-blur-md animate-bounce"
      >
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span className="text-xs md:text-sm font-black tracking-wide text-amber-300">
            🪄 Varita Mágica Activa:
          </span>
          <span className="text-xs text-zinc-200 hidden sm:inline">
            Toca o haz clic en cualquier botón, letra o tarjeta en pantalla
          </span>
        </div>
        <button
          type="button"
          onClick={toggleInspector}
          className="ml-2 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-full transition-all cursor-pointer shadow-sm"
        >
          Listo / Cancelar
        </button>
      </div>
    );
  }

  // Render Minimized Floating Orb
  if (isMinimized) {
    return (
      <div id="starryz-theme-studio-root" className="fixed bottom-20 left-4 z-[99999]">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="group relative flex items-center gap-2 px-4 py-2.5 bg-zinc-950/95 border-2 border-amber-400 text-amber-400 hover:text-white rounded-full shadow-[0_4px_25px_rgba(234,179,8,0.3)] hover:scale-105 transition-all cursor-pointer backdrop-blur-md"
          title="Abrir Estudio de Colores"
        >
          <Palette className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-black tracking-wider uppercase">Estudio de Colores</span>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping absolute -top-1 -right-1" />
        </button>
      </div>
    );
  }

  return (
    <div id="starryz-theme-studio-root" className="fixed inset-y-0 right-0 z-[99998] flex">
      {/* Mobile Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-xs md:hidden"
        onClick={() => setIsMinimized(true)}
      />

      {/* Main Drawer Container */}
      <div className="relative w-full sm:w-[420px] md:w-[450px] h-full bg-[#0d0d11]/98 border-l border-zinc-800 text-zinc-100 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col z-10 transition-transform">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(234,179,8,0.15)]">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black tracking-wide text-white uppercase">
                  Estudio de Colores
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-400 border border-amber-400/40">
                  En Vivo
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Personaliza fondos, botones, letras y detalles
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Reset Button */}
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800/60 transition-colors cursor-pointer"
              title="Restablecer colores originales"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Minimize */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors cursor-pointer"
              title="Minimizar panel para ver pantalla completa"
            >
              <Minimize2 className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={closeThemeStudio}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors cursor-pointer"
              title="Cerrar personalizador"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Confirmation Modal for Reset */}
        {confirmResetOpen && (
          <div className="p-3 bg-red-950/40 border-b border-red-500/30 flex items-center justify-between gap-3 text-xs">
            <span className="text-red-200">¿Restaurar todos los colores originales de la app?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetAllColors();
                  setConfirmResetOpen(false);
                  showToast('¡Colores originales restaurados!');
                }}
                className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-black text-[10px] cursor-pointer"
              >
                Sí, Restaurar
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-[10px] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Success Toast Banner */}
        {successToast && (
          <div className="px-4 py-2 bg-emerald-950/80 border-b border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 p-1.5 gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('page')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all cursor-pointer ${
              activeTab === 'page'
                ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>En Esta Página</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inspector')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all cursor-pointer ${
              activeTab === 'inspector'
                ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Varita Mágica</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all cursor-pointer ${
              activeTab === 'presets'
                ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Paletas Pro</span>
          </button>
        </div>

        {/* Tab 1: Contextual Auto-Detected Elements */}
        {activeTab === 'page' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                Elementos detectados en la pantalla actual:
              </span>
              <button
                type="button"
                onClick={refreshDetectedElements}
                className="text-[11px] text-amber-400 hover:underline cursor-pointer"
              >
                Escanear de nuevo
              </button>
            </div>

            {/* Global Sections List */}
            <div className="space-y-3">
              {/* 1. Fondo General */}
              <ColorSettingCard
                title="Fondo General de la App"
                description="Color del lienzo de fondo principal"
                currentColor={customTheme.pageBg}
                onChange={(val) => updateGlobalColor('pageBg', val)}
                onReset={() => updateGlobalColor('pageBg', '#0a0a0a')}
              />

              {/* 2. Barra de Navegación / Header */}
              <ColorSettingCard
                title="Barra Superior (Cabecera)"
                description="Fondo de la barra de menú superior"
                currentColor={customTheme.headerBg}
                onChange={(val) => updateGlobalColor('headerBg', val)}
                onReset={() => updateGlobalColor('headerBg', '#0e1318')}
              />

              {/* 3. Botones Principales y Acciones (Dorado) */}
              <ColorSettingCard
                title="Botones Principales / Acentos"
                description="Botones de acción (votar, registrar, interactuar)"
                currentColor={customTheme.primaryColor}
                onChange={(val) => updateGlobalColor('primaryColor', val)}
                onReset={() => updateGlobalColor('primaryColor', '#eab308')}
              />

              {/* 4. Letra de Botones Principales */}
              <ColorSettingCard
                title="Letra de Botones Principales"
                description="Color del texto dentro de los botones de acción"
                currentColor={customTheme.primaryTextColor}
                onChange={(val) => updateGlobalColor('primaryTextColor', val)}
                onReset={() => updateGlobalColor('primaryTextColor', '#000000')}
              />

              {/* 5. Tarjetas y Módulos */}
              <ColorSettingCard
                title="Fondo de Tarjetas y Cuadros"
                description="Superficie de profesores, estudiantes y modales"
                currentColor={customTheme.cardBg}
                onChange={(val) => updateGlobalColor('cardBg', val)}
                onReset={() => updateGlobalColor('cardBg', '#141414')}
              />

              {/* 6. Títulos y Encabezados */}
              <ColorSettingCard
                title="Títulos y Encabezados (H1, H2)"
                description="Color de los títulos grandes de cada página"
                currentColor={customTheme.headingColor}
                onChange={(val) => updateGlobalColor('headingColor', val)}
                onReset={() => updateGlobalColor('headingColor', '#ffffff')}
              />

              {/* 7. Texto Principal */}
              <ColorSettingCard
                title="Texto Principal y Nombres"
                description="Color del texto regular de lectura"
                currentColor={customTheme.textColor}
                onChange={(val) => updateGlobalColor('textColor', val)}
                onReset={() => updateGlobalColor('textColor', '#f4f4f5')}
              />

              {/* 8. Texto Secundario (Muted) */}
              <ColorSettingCard
                title="Texto Secundario / Metadatos"
                description="Etiquetas, fechas, contadores y subtítulos"
                currentColor={customTheme.mutedTextColor}
                onChange={(val) => updateGlobalColor('mutedTextColor', val)}
                onReset={() => updateGlobalColor('mutedTextColor', '#a1a1aa')}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Point & Click Inspector Mode */}
        {activeTab === 'inspector' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Wand Activation Card */}
            <div className="p-4 rounded-2xl bg-amber-400/5 border border-amber-400/20 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-400/10 border border-amber-400/30 mx-auto flex items-center justify-center text-amber-400">
                <Wand2 className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider">
                  Varita Mágica de Selección
                </h3>
                <p className="text-xs text-zinc-300 mt-1">
                  Toca cualquier botón, palabra, fondo o tarjeta en la pantalla para editar su color individualmente.
                </p>
              </div>

              <button
                type="button"
                onClick={toggleInspector}
                className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(234,179,8,0.25)]"
              >
                <MousePointerClick className="w-4 h-4" />
                <span>Activar Selector al Toque</span>
              </button>
            </div>

            {/* Currently Selected Element Editor */}
            {selectedElementForEdit ? (
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-700/80 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="truncate max-w-[280px]">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block">
                      Elemento Seleccionado
                    </span>
                    <span className="text-xs font-bold text-white truncate block">
                      {selectedElementForEdit.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedElementForEdit(null)}
                    className="text-zinc-500 hover:text-zinc-300 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Color Editors for this element */}
                <div className="space-y-3">
                  <ColorSettingCard
                    title="Color de Fondo"
                    description="Fondo de este elemento"
                    currentColor={
                      customTheme.elementOverrides[selectedElementForEdit.id]?.styles?.backgroundColor || '#1c1c1c'
                    }
                    onChange={(val) => {
                      updateElementOverride(selectedElementForEdit.id, {
                        id: selectedElementForEdit.id,
                        name: selectedElementForEdit.name,
                        dataId: selectedElementForEdit.id,
                        targetType: 'custom-element',
                        styles: {
                          ...(customTheme.elementOverrides[selectedElementForEdit.id]?.styles || {}),
                          backgroundColor: val,
                        },
                      });
                    }}
                    onReset={() => {
                      updateElementOverride(selectedElementForEdit.id, {
                        id: selectedElementForEdit.id,
                        name: selectedElementForEdit.name,
                        dataId: selectedElementForEdit.id,
                        targetType: 'custom-element',
                        styles: {
                          ...(customTheme.elementOverrides[selectedElementForEdit.id]?.styles || {}),
                          backgroundColor: undefined,
                        },
                      });
                    }}
                  />

                  <ColorSettingCard
                    title="Color de Letra / Texto"
                    description="Color del texto o palabra"
                    currentColor={
                      customTheme.elementOverrides[selectedElementForEdit.id]?.styles?.color || '#ffffff'
                    }
                    onChange={(val) => {
                      updateElementOverride(selectedElementForEdit.id, {
                        id: selectedElementForEdit.id,
                        name: selectedElementForEdit.name,
                        dataId: selectedElementForEdit.id,
                        targetType: 'custom-element',
                        styles: {
                          ...(customTheme.elementOverrides[selectedElementForEdit.id]?.styles || {}),
                          color: val,
                        },
                      });
                    }}
                    onReset={() => {
                      updateElementOverride(selectedElementForEdit.id, {
                        id: selectedElementForEdit.id,
                        name: selectedElementForEdit.name,
                        dataId: selectedElementForEdit.id,
                        targetType: 'custom-element',
                        styles: {
                          ...(customTheme.elementOverrides[selectedElementForEdit.id]?.styles || {}),
                          color: undefined,
                        },
                      });
                    }}
                  />

                  <ColorSettingCard
                    title="Color de Borde"
                    description="Contorno o borde"
                    currentColor={
                      customTheme.elementOverrides[selectedElementForEdit.id]?.styles?.borderColor || '#3f3f46'
                    }
                    onChange={(val) => {
                      updateElementOverride(selectedElementForEdit.id, {
                        id: selectedElementForEdit.id,
                        name: selectedElementForEdit.name,
                        dataId: selectedElementForEdit.id,
                        targetType: 'custom-element',
                        styles: {
                          ...(customTheme.elementOverrides[selectedElementForEdit.id]?.styles || {}),
                          borderColor: val,
                        },
                      });
                    }}
                    onReset={() => {
                      updateElementOverride(selectedElementForEdit.id, {
                        id: selectedElementForEdit.id,
                        name: selectedElementForEdit.name,
                        dataId: selectedElementForEdit.id,
                        targetType: 'custom-element',
                        styles: {
                          ...(customTheme.elementOverrides[selectedElementForEdit.id]?.styles || {}),
                          borderColor: undefined,
                        },
                      });
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    removeElementOverride(selectedElementForEdit.id);
                    showToast('Se eliminaron los estilos personalizados de este elemento');
                  }}
                  className="w-full py-2 px-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-bold transition-colors cursor-pointer"
                >
                  Restaurar colores originales de este elemento
                </button>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 text-center text-zinc-400 text-xs">
                <MousePointerClick className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <span>Ningún elemento seleccionado aún. Activa el selector y haz clic sobre el elemento deseado.</span>
              </div>
            )}

            {/* List of custom element overrides */}
            {Object.keys(customTheme.elementOverrides || {}).length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Elementos personalizados ({Object.keys(customTheme.elementOverrides).length})
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {Object.entries(customTheme.elementOverrides).map(([id, override]) => (
                    <div
                      key={id}
                      className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs"
                    >
                      <div className="truncate max-w-[220px]">
                        <span className="font-bold text-zinc-200 block truncate">{override.name}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          {override.styles.backgroundColor && (
                            <span 
                              className="w-3 h-3 rounded-full border border-white/20 inline-block"
                              style={{ backgroundColor: override.styles.backgroundColor }}
                              title="Fondo"
                            />
                          )}
                          {override.styles.color && (
                            <span 
                              className="w-3 h-3 rounded-full border border-white/20 inline-block"
                              style={{ backgroundColor: override.styles.color }}
                              title="Letra"
                            />
                          )}
                          {override.styles.borderColor && (
                            <span 
                              className="w-3 h-3 rounded-full border border-white/20 inline-block"
                              style={{ backgroundColor: override.styles.borderColor }}
                              title="Borde"
                            />
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeElementOverride(id)}
                        className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                        title="Eliminar personalización"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Presets Pro */}
        {activeTab === 'presets' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <p className="text-xs text-zinc-400 mb-2">
              Elige una paleta diseñada profesionalmente para aplicarla con un solo toque:
            </p>

            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  applyPreset(preset.id);
                  showToast(`¡Paleta "${preset.name}" aplicada!`);
                }}
                className="w-full p-3.5 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 transition-all text-left group cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span 
                    className="w-8 h-8 rounded-xl shadow-md border border-white/20 flex items-center justify-center text-black font-black text-xs"
                    style={{ backgroundColor: preset.accentPreview }}
                  >
                    ★
                  </span>
                  <div>
                    <h4 className="text-xs font-black text-white group-hover:text-amber-300 transition-colors">
                      {preset.name}
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      {preset.description}
                    </p>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        )}

        {/* Footer info & live status */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/90 text-center flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">
            {hasCustomStyles ? '✓ Cambios activos y guardados' : 'Colores estándar de la app'}
          </span>
          <button
            type="button"
            onClick={closeThemeStudio}
            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-wider cursor-pointer shadow-sm"
          >
            Listo
          </button>
        </div>

      </div>
    </div>
  );
};

// Reusable Color Setting Row with swatch selector & HTML5 color picker
interface ColorSettingCardProps {
  title: string;
  description: string;
  currentColor: string;
  onChange: (val: string) => void;
  onReset?: () => void;
}

const ColorSettingCard: React.FC<ColorSettingCardProps> = ({
  title,
  description,
  currentColor,
  onChange,
  onReset,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors">
      <div className="flex items-center justify-between">
        <div className="truncate max-w-[240px]">
          <h4 className="text-xs font-bold text-zinc-200">{title}</h4>
          <p className="text-[10px] text-zinc-400 truncate">{description}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Native Color Picker trigger */}
          <div className="relative">
            <input
              type="color"
              value={currentColor.startsWith('#') && currentColor.length === 7 ? currentColor : '#eab308'}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="Abrir selector de color"
            />
            <div 
              className="w-8 h-8 rounded-lg border-2 border-zinc-700 shadow-inner flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
              style={{ backgroundColor: currentColor }}
            />
          </div>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-[11px] font-bold cursor-pointer"
          >
            {expanded ? 'Ocultar' : 'Paleta'}
          </button>
        </div>
      </div>

      {/* Expanded Quick Palette dots */}
      {expanded && (
        <div className="mt-3 pt-2.5 border-t border-zinc-800/60">
          <div className="text-[10px] text-zinc-400 mb-1.5 flex items-center justify-between">
            <span>Tonos rápidos:</span>
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="text-amber-400 hover:underline cursor-pointer"
              >
                Por defecto
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PALETTE_SWATCHES.map((swatch) => (
              <button
                key={swatch.hex}
                type="button"
                onClick={() => onChange(swatch.hex)}
                className={`w-6 h-6 rounded-md border transition-all cursor-pointer ${
                  currentColor.toLowerCase() === swatch.hex.toLowerCase()
                    ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                    : 'border-zinc-700/80 hover:scale-105'
                }`}
                style={{ backgroundColor: swatch.hex }}
                title={swatch.name}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeStudioDrawer;
