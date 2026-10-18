'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Users,
  Wand2,
  ListOrdered,
  RotateCcw,
  Copy,
  Trash2,
  Maximize2,
  Minimize2,
  Zap,
  Check,
  Info,
  User,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';

interface FormadorGruposViewProps {
  onBack: () => void;
  onNavigate?: (url: string) => void;
}

interface GroupItem {
  id: number;
  name: string;
  members: string[];
  color: string;
}

interface ToastInfo {
  message: string;
  type: 'info' | 'success' | 'error';
}

const COLOR_PALETTE = [
  '#6366F1', '#EC4899', '#10B981', '#F59E0B', 
  '#8B5CF6', '#06B6D4', '#F43F5E', '#3B82F6',
  '#84CC16', '#D946EF', '#14B8A6', '#F97316'
];

export default function FormadorGruposView({ onBack }: FormadorGruposViewProps) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(true);

  // Lists state
  const [rawText, setRawText] = useState<string>('');
  const [names, setNames] = useState<string[]>([]);
  
  // Settings & Modes
  const [groupMode, setGroupMode] = useState<'by_groups' | 'by_members'>('by_groups');
  const [numGroups, setNumGroups] = useState<number>(3);
  const [membersPerGroup, setMembersPerGroup] = useState<number>(4);

  // Results state
  const [generatedGroups, setGeneratedGroups] = useState<GroupItem[]>([]);
  const [copiedGroupIdx, setCopiedGroupIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toast, setToast] = useState<ToastInfo | null>(null);

  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

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
        console.error('Error checking admin role in FormadorGruposView:', err);
        setIsAdmin(false);
      } finally {
        setLoadingCheck(false);
      }
    }
    checkRole();
  }, [user]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const handleTextareaChange = (val: string) => {
    setRawText(val);
    const parsed = val
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0);
    setNames(parsed);
  };

  const loadDemoNames = () => {
    const demo = [
      'María López', 'Carlos Gómez', 'Ana Rodríguez', 'Juan Pérez', 
      'Lucía Fernández', 'Diego Torres', 'Sofia Morales', 'Gabriel Castro', 
      'Elena Vega', 'Mateo Ruiz', 'Valentina Ortiz', 'Santiago Silva'
    ];
    setRawText(demo.join('\n'));
    setNames(demo);
    showToast('Ejemplo de 12 participantes cargado.', 'info');
  };

  const clearNamesList = () => {
    setRawText('');
    setNames([]);
    setGeneratedGroups([]);
    showToast('Lista y grupos limpiados.', 'info');
  };

  const adjustValue = (type: 'numGroups' | 'membersPerGroup', delta: number) => {
    if (type === 'numGroups') {
      setGroupMode('by_groups');
      setNumGroups(prev => Math.max(1, Math.min(100, prev + delta)));
    } else {
      setGroupMode('by_members');
      setMembersPerGroup(prev => Math.max(1, Math.min(100, prev + delta)));
    }
  };

  const generateGroups = () => {
    if (names.length === 0) {
      showToast('Por favor, ingresa los nombres en la casilla antes de formar grupos.', 'error');
      return;
    }

    // Shuffle names randomly
    const shuffled = [...names];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const groups: GroupItem[] = [];

    // LOGIC 1: By Number of Groups (Distribute evenly via Round Robin)
    if (groupMode === 'by_groups') {
      const targetNum = Math.max(1, numGroups);
      if (targetNum > names.length) {
        showToast('No puedes crear más grupos que el número total de personas.', 'error');
        return;
      }

      for (let i = 0; i < targetNum; i++) {
        groups.push({
          id: i,
          name: `Grupo ${i + 1}`,
          members: [],
          color: COLOR_PALETTE[i % COLOR_PALETTE.length]
        });
      }

      shuffled.forEach((person, idx) => {
        groups[idx % targetNum].members.push(person);
      });
    } 
    // LOGIC 2: By Members per Group (Chunking approach)
    else {
      const targetSize = Math.max(1, membersPerGroup);
      if (targetSize > names.length) {
        showToast('El número de integrantes por grupo no puede ser mayor al total de personas.', 'error');
        return;
      }

      for (let i = 0; i < shuffled.length; i += targetSize) {
        const chunk = shuffled.slice(i, i + targetSize);
        groups.push({
          id: groups.length,
          name: `Grupo ${groups.length + 1}`,
          members: chunk,
          color: COLOR_PALETTE[groups.length % COLOR_PALETTE.length]
        });
      }
    }

    setGeneratedGroups(groups);

    // Confetti animation!
    confetti({
      particleCount: 110,
      spread: 75,
      origin: { y: 0.6 }
    });

    showToast(`¡${groups.length} grupos generados con éxito!`, 'success');

    // Smooth scroll to results
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const copySingleGroup = (idx: number) => {
    const g = generatedGroups[idx];
    if (!g) return;

    let text = `📋 ${g.name.toUpperCase()}\n`;
    g.members.forEach((m, mIdx) => {
      text += `${mIdx + 1}. ${m}\n`;
    });

    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedGroupIdx(idx);
        showToast(`¡${g.name} copiado al portapapeles!`, 'success');
        setTimeout(() => setCopiedGroupIdx(null), 2000);
      })
      .catch(err => console.error('Error copying group:', err));
  };

  const copyAllGroups = () => {
    if (generatedGroups.length === 0) {
      showToast('Primero forma los grupos para poder copiarlos.', 'error');
      return;
    }

    let fullText = '👥 GRUPOS FORMADOS:\n\n';
    generatedGroups.forEach((g) => {
      fullText += `--- ${g.name.toUpperCase()} ---\n`;
      g.members.forEach((m, idx) => {
        fullText += `${idx + 1}. ${m}\n`;
      });
      fullText += '\n';
    });

    navigator.clipboard.writeText(fullText)
      .then(() => {
        setCopiedAll(true);
        showToast('¡Todos los grupos copiados al portapapeles!', 'success');
        setTimeout(() => setCopiedAll(false), 2000);
      })
      .catch(err => console.error('Error copying all groups:', err));
  };

  const toggleFullscreen = () => {
    const container = mainContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  if (loadingCheck) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
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
    <div ref={mainContainerRef} className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-[#6366F1] selection:text-white">
      
      {/* Top Header Navigation */}
      <header className="bg-[#0e1318]/90 backdrop-blur-md border-b border-zinc-800/80 sticky top-0 z-40 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-indigo-500/60 transition-colors cursor-pointer"
              title="Volver a Herramientas"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight tracking-tight text-white flex items-center gap-2">
                Formador de Grupos <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/30 font-extrabold">Equipos</span>
              </h1>
              <p className="text-[11px] text-zinc-400 hidden sm:block">Generador de equipos y grupos aleatorios</p>
            </div>
          </div>

          <div>
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition shadow-sm border border-zinc-800 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Pantalla Completa"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">Pantalla</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 items-center">
        
        {/* GROUPS GENERATOR CONTROLS */}
        <section className="w-full bg-[#0c0d10] border border-zinc-800/80 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>Configura tus Equipos</span>
              </h2>
              <p className="text-xs text-zinc-400">Ingresa la lista de personas y elige cómo deseas dividirlos.</p>
            </div>
            <div className="self-start sm:self-auto px-4 py-1.5 bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 rounded-full text-xs sm:text-sm font-bold">
              {names.length} Nombre{names.length === 1 ? '' : 's'} en total
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMN 1: NAMES INPUT */}
            <div className="lg:col-span-2 bg-white text-slate-800 rounded-3xl p-5 shadow-lg border border-slate-200 flex flex-col">
              <label className="text-xs font-extrabold text-slate-700 mb-2 flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <ListOrdered className="w-4 h-4 text-indigo-600" />
                  <span>Lista de Participantes (uno por línea):</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">Se actualiza en vivo</span>
              </label>
              <textarea 
                value={rawText}
                onChange={(e) => handleTextareaChange(e.target.value)}
                className="w-full h-56 p-3.5 bg-slate-50 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none text-slate-800 text-sm font-medium resize-y focus:bg-white transition leading-relaxed shadow-inner"
                placeholder="Ejemplo:&#10;María López&#10;Carlos Gómez&#10;Ana Rodríguez&#10;Juan Pérez&#10;Lucía Fernández"
                spellcheck="false"
              ></textarea>
              
              <div className="mt-4 flex gap-3">
                <button
                  onClick={loadDemoNames}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Cargar Ejemplo</span>
                </button>
                <button
                  onClick={clearNamesList}
                  className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Limpiar Lista</span>
                </button>
              </div>
            </div>

            {/* COLUMN 2: SPLIT CONTROLS */}
            <div className="flex flex-col justify-between bg-zinc-950/70 border border-zinc-800 rounded-3xl p-5 gap-4">
              <div className="space-y-4">
                
                {/* Option 1: Number of Groups */}
                <div 
                  onClick={() => setGroupMode('by_groups')}
                  className={`p-4 rounded-2xl cursor-pointer transition-all ${
                    groupMode === 'by_groups'
                      ? 'bg-zinc-900 border-2 border-indigo-500/60 shadow-[0_0_15px_rgba(99,102,241,0.18)]'
                      : 'bg-zinc-900/60 border border-zinc-800/80 opacity-60 hover:opacity-90 hover:border-zinc-700'
                  }`}
                >
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-white mb-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="groupModeRadio" 
                      checked={groupMode === 'by_groups'} 
                      onChange={() => setGroupMode('by_groups')} 
                      className="w-4 h-4 text-indigo-600 focus:ring-0 accent-indigo-600 cursor-pointer"
                    />
                    <span>Número de Grupos en Total:</span>
                  </label>
                  <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800">
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); adjustValue('numGroups', -1); }} 
                      className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition flex items-center justify-center cursor-pointer active:scale-95 text-lg"
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      min="1" 
                      max="100" 
                      value={numGroups} 
                      onClick={(e) => e.stopPropagation()} 
                      onChange={(e) => setNumGroups(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-transparent text-center text-xl text-white font-black outline-none"
                    />
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); adjustValue('numGroups', 1); }} 
                      className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition flex items-center justify-center cursor-pointer active:scale-95 text-lg"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Option 2: Members per Group */}
                <div 
                  onClick={() => setGroupMode('by_members')}
                  className={`p-4 rounded-2xl cursor-pointer transition-all ${
                    groupMode === 'by_members'
                      ? 'bg-zinc-900 border-2 border-indigo-500/60 shadow-[0_0_15px_rgba(99,102,241,0.18)]'
                      : 'bg-zinc-900/60 border border-zinc-800/80 opacity-60 hover:opacity-90 hover:border-zinc-700'
                  }`}
                >
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-white mb-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="groupModeRadio" 
                      checked={groupMode === 'by_members'} 
                      onChange={() => setGroupMode('by_members')} 
                      className="w-4 h-4 text-indigo-600 focus:ring-0 accent-indigo-600 cursor-pointer"
                    />
                    <span>Integrantes por Grupo:</span>
                  </label>
                  <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800">
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); adjustValue('membersPerGroup', -1); }} 
                      className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition flex items-center justify-center cursor-pointer active:scale-95 text-lg"
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      min="1" 
                      max="100" 
                      value={membersPerGroup} 
                      onClick={(e) => e.stopPropagation()} 
                      onChange={(e) => setMembersPerGroup(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-transparent text-center text-xl text-white font-black outline-none"
                    />
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); adjustValue('membersPerGroup', 1); }} 
                      className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition flex items-center justify-center cursor-pointer active:scale-95 text-lg"
                    >
                      +
                    </button>
                  </div>
                </div>

              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button 
                  onClick={generateGroups} 
                  className="w-full py-4 px-6 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:to-pink-500 text-white font-black text-sm sm:text-base rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.35)] transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  <Zap className="w-5 h-5 fill-current" />
                  <span>¡FORMAR GRUPOS!</span>
                </button>
                <button 
                  onClick={copyAllGroups} 
                  disabled={generatedGroups.length === 0}
                  className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  {copiedAll ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
                  <span>{copiedAll ? '¡Grupos Copiados!' : 'Copiar Todos los Grupos'}</span>
                </button>
              </div>
            </div>

          </div>

        </section>

        {/* RESULTS CONTAINER */}
        <section ref={resultsRef} className="w-full min-h-[300px]">
          {generatedGroups.length === 0 ? (
            <div className="bg-zinc-900/40 border-2 border-dashed border-zinc-800/90 rounded-3xl p-12 sm:p-16 text-center text-zinc-500 flex flex-col items-center justify-center gap-3">
              <div className="w-20 h-20 rounded-3xl bg-zinc-800/80 flex items-center justify-center text-zinc-400 shadow-inner mb-2">
                <Users className="w-10 h-10 text-indigo-400 opacity-80" />
              </div>
              <h3 className="text-xl font-bold text-zinc-300">Aún no has formado los grupos</h3>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md leading-relaxed">
                Ingresa los nombres arriba, elige tu método de división (por cantidad de grupos o por integrantes) y presiona "¡Formar Grupos!".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in">
              {generatedGroups.map((g, idx) => (
                <div 
                  key={g.id} 
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col transition duration-300 transform hover:-translate-y-1"
                >
                  {/* Card Header */}
                  <div 
                    className="p-4 border-b border-zinc-800 flex items-center justify-between"
                    style={{ background: `linear-gradient(135deg, ${g.color}30, ${g.color}08)` }}
                  >
                    <div className="flex items-center gap-3">
                      <span 
                        className="w-3.5 h-3.5 rounded-full inline-block shadow-md" 
                        style={{ backgroundColor: g.color, boxShadow: `0 0 10px ${g.color}88` }}
                      ></span>
                      <h3 className="font-black text-sm sm:text-base text-white tracking-wide">{g.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold bg-zinc-950/80 text-zinc-300 px-2.5 py-1 rounded-lg border border-zinc-700/50 backdrop-blur-sm flex items-center gap-1">
                        <span>{g.members.length}</span>
                        <User className="w-3 h-3 text-zinc-400" />
                      </span>
                      <button 
                        onClick={() => copySingleGroup(idx)} 
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer" 
                        title="Copiar este grupo"
                      >
                        {copiedGroupIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Card Body / Member List */}
                  <div className="p-3.5 flex-1 flex flex-col gap-2 bg-zinc-900/50">
                    {g.members.map((m, mIdx) => (
                      <div 
                        key={mIdx} 
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-800/60 text-zinc-200 border border-zinc-700/40 hover:bg-zinc-800 transition"
                      >
                        <span className="truncate pr-2">
                          <span className="text-zinc-500 mr-2 font-mono text-xs">{mIdx + 1}.</span> 
                          {m}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className={`text-white font-bold text-xs sm:text-sm px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            toast.type === 'error'
              ? 'bg-rose-600 border-rose-400/40'
              : toast.type === 'success'
              ? 'bg-emerald-600 border-emerald-400/40'
              : 'bg-indigo-600 border-indigo-400/40'
          }`}>
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0" />
            ) : toast.type === 'success' ? (
              <Check className="w-5 h-5 shrink-0" />
            ) : (
              <Info className="w-5 h-5 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
}
