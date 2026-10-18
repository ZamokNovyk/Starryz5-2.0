'use client';

import React, { useState, useEffect } from 'react';
import { Bookmark, Plus, Loader2, CheckCircle2, Folder, AlertCircle, Trash2, X } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  getUserCollections,
  createNewCollection,
  checkItemCollections,
  toggleItemInCollection,
  Collection
} from '@/src/lib/collections';

interface BookmarkButtonProps {
  itemId: string;
  itemType: 'professor' | 'center' | 'student';
  itemName: string;
  itemImage: string | null;
  itemSubtitle: string | null;
  onRequireAuth?: () => void;
}

export default function BookmarkButton({
  itemId,
  itemType,
  itemName,
  itemImage,
  itemSubtitle,
  onRequireAuth,
}: BookmarkButtonProps) {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [savedCollectionIds, setSavedCollectionIds] = useState<string[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  
  // New collection input
  const [newColName, setNewColName] = useState('');
  const [creatingCol, setCreatingCol] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch initial state of collections
  const loadCollectionsInfo = async () => {
    if (!user) return;
    try {
      const userCols = await getUserCollections(user.uid);
      setCollections(userCols);

      const savedIds = await checkItemCollections(user.uid, itemId);
      setSavedCollectionIds(savedIds);
      setIsSaved(savedIds.length > 0);
    } catch (err) {
      console.error('Error al cargar colecciones de marcadores:', err);
    }
  };

  useEffect(() => {
    if (user && itemId) {
      loadCollectionsInfo();
    } else {
      setIsSaved(false);
      setSavedCollectionIds([]);
    }
  }, [user, itemId]);

  // Click directo: Flujo idéntico a TikTok / Instagram
  // 1. Si no está guardado, se guarda automáticamente en la colección general 'Guardados'.
  // 2. Inmediatamente se abre la ventana flotante para permitir elegir otra colección o crear una nueva.
  // 3. Si el usuario no elige nada y simplemente cierra, queda guardado en 'Guardados' por defecto.
  const handleButtonClick = async () => {
    if (!user) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    if (!isSaved) {
      try {
        setLoading(true);
        let defaultCol = collections.find(c => c.name.toLowerCase() === 'guardados');
        
        if (!defaultCol) {
          const userCols = await getUserCollections(user.uid);
          setCollections(userCols);
          defaultCol = userCols.find(c => c.name.toLowerCase() === 'guardados') || userCols[0];
        }

        if (!defaultCol) {
          defaultCol = await createNewCollection(user.uid, 'Guardados');
          setCollections(prev => [...prev, defaultCol!]);
        }

        const { added } = await toggleItemInCollection(user.uid, defaultCol.id, itemId, {
          item_type: itemType,
          item_name: itemName,
          item_image: itemImage,
          item_subtitle: itemSubtitle,
        });

        if (added) {
          setSavedCollectionIds(prev => [...prev, defaultCol!.id]);
          setIsSaved(true);
        }
      } catch (err) {
        console.error('Error al auto-guardar en Guardados:', err);
      } finally {
        setLoading(false);
      }
    }

    // Abrir ventana flotante para elegir/crear colecciones
    setModalOpen(true);
  };

  // Alternar en una colección específica
  const handleToggleInSpecificCollection = async (colId: string) => {
    if (!user) return;

    try {
      const { added } = await toggleItemInCollection(user.uid, colId, itemId, {
        item_type: itemType,
        item_name: itemName,
        item_image: itemImage,
        item_subtitle: itemSubtitle,
      });

      if (added) {
        setSavedCollectionIds(prev => [...prev, colId]);
        setIsSaved(true);
      } else {
        const updated = savedCollectionIds.filter(id => id !== colId);
        setSavedCollectionIds(updated);
        setIsSaved(updated.length > 0);
      }
    } catch (err) {
      console.error('Error al alternar elemento en colección:', err);
    }
  };

  // Quitar completamente de todas las colecciones
  const handleRemoveAll = async () => {
    if (!user) return;
    try {
      setLoading(true);
      for (const colId of savedCollectionIds) {
        await toggleItemInCollection(user.uid, colId, itemId, {
          item_type: itemType,
          item_name: itemName,
          item_image: itemImage,
          item_subtitle: itemSubtitle,
        });
      }
      setSavedCollectionIds([]);
      setIsSaved(false);
      setModalOpen(false);
    } catch (err) {
      console.error('Error al quitar de colecciones:', err);
    } finally {
      setLoading(false);
    }
  };

  // Crear nueva colección al instante
  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newColName.trim()) return;

    setErrorMsg('');
    setCreatingCol(true);
    try {
      const trimmed = newColName.trim();
      if (collections.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
        setErrorMsg('Ya existe una colección con ese nombre.');
        setCreatingCol(false);
        return;
      }

      const newCol = await createNewCollection(user.uid, trimmed);
      setCollections(prev => [...prev, newCol]);
      setNewColName('');
      
      // Auto-marcar en la nueva colección
      await handleToggleInSpecificCollection(newCol.id);
    } catch (err: any) {
      console.error('Error al crear colección:', err);
      setErrorMsg(err?.message || 'Error al crear la colección.');
    } finally {
      setCreatingCol(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleButtonClick}
        className={`p-3 rounded-full border transition-all cursor-pointer shadow-md relative group flex items-center justify-center ${
          isSaved
            ? 'bg-[#eab308]/10 border-[#eab308]/40 text-[#eab308] hover:bg-[#eab308]/20'
            : 'bg-[#151515] hover:bg-[#202020] border-zinc-800 text-zinc-400 hover:text-[#eab308]'
        }`}
        title={isSaved ? 'Guardado en Colecciones' : 'Guardar en Colecciones'}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#eab308]" />
        ) : (
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
        )}
      </button>

      {/* VENTANA FLOTANTE TIPO TIKTOK / INSTAGRAM */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              className="relative w-full max-w-sm rounded-2xl bg-[#0a0a0a] border border-zinc-800/90 p-5 sm:p-6 shadow-2xl space-y-4 text-left"
            >
              {/* Botón cerrar */}
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Encabezado */}
              <div className="pr-6">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eab308]/10 border border-[#eab308]/25 text-[#eab308] text-[10px] font-black uppercase tracking-wider mb-2">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Guardado en Guardados</span>
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">
                  Organizar en Colecciones
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                  Puedes seleccionar una carpeta específica o crear una nueva. Si cierras, quedará guardado en tu lista general.
                </p>
              </div>

              {/* LISTA DE COLECCIONES CON CHECKBOXES */}
              <div className="space-y-1.5">
                <div className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-500 px-1">
                  Tus Colecciones
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {collections.map(col => {
                    const isChecked = savedCollectionIds.includes(col.id);
                    return (
                      <label
                        key={col.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-[#eab308]/10 border-[#eab308]/40 text-white'
                            : 'bg-[#121212] border-zinc-800/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Folder className={`w-3.5 h-3.5 flex-shrink-0 ${isChecked ? 'text-[#eab308] fill-current' : 'text-zinc-500'}`} />
                          <span className="text-xs font-bold truncate">{col.name}</span>
                        </div>

                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleInSpecificCollection(col.id)}
                          className="w-4 h-4 rounded border-zinc-700 text-[#eab308] focus:ring-[#eab308] focus:ring-offset-0 bg-[#161616] cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* FORMULARIO PARA CREAR NUEVA COLECCIÓN */}
              <form onSubmit={handleCreateCollection} className="pt-2 border-t border-zinc-850 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-500 px-1">
                    + Crear Nueva Colección
                  </label>
                  {errorMsg && (
                    <span className="text-[9px] text-red-400 font-bold flex items-center gap-0.5">
                      <AlertCircle className="w-2.5 h-2.5" /> {errorMsg}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newColName}
                    onChange={(e) => {
                      setNewColName(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="Nombre de la nueva lista..."
                    className="flex-1 bg-[#121212] border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 outline-none focus:border-[#eab308] placeholder-zinc-600"
                    disabled={creatingCol}
                    maxLength={30}
                  />
                  <button
                    type="submit"
                    disabled={creatingCol || !newColName.trim()}
                    className="px-3.5 bg-[#eab308] hover:bg-[#eab308]/90 text-black rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    {creatingCol ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </form>

              {/* FOOTER DE ACCIONES */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-850">
                {isSaved ? (
                  <button
                    type="button"
                    onClick={handleRemoveAll}
                    className="text-[10px] font-bold text-red-400/80 hover:text-red-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Eliminar guardado</span>
                  </button>
                ) : <div />}

                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-white text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Listo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
