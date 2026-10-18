'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Filter, 
  ArrowLeft, 
  GraduationCap, 
  BookOpen, 
  LayoutGrid, 
  List, 
  UserCheck, 
  User, 
  Sparkles,
  ChevronRight,
  Search
} from 'lucide-react';
import { Institution, Student } from '@/lib/mockData';
import { Professor as DbProfessor, getAllProfessors } from '@/src/lib/professors';
import { supabase } from '@/src/lib/supabase';

export type SearchCategory = 'Universidad' | 'Instituto' | 'Colegio' | 'Profesor' | 'Estudiante';
export type FilterType = 'todos' | 'estudiantes' | 'profesores' | 'universidades' | 'institutos' | 'colegios';
export type ViewMode = 'mosaico' | 'lista';

export interface UnifiedSearchResult {
  id: string;
  name: string;
  category: SearchCategory;
  typeKey: FilterType;
  subtitle: string;
  image?: string;
  slug?: string;
  rawItem: any;
}

interface SearchResultsViewProps {
  query: string;
  results: Institution[];
  onSelectInstitution: (inst: Institution) => void;
  onSelectProfessor?: (slug: string) => void;
  onSelectStudent?: (uid: string) => void;
  onBack: () => void;
}

const FILTER_OPTIONS: { id: FilterType; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'estudiantes', label: 'Estudiantes' },
  { id: 'profesores', label: 'Profesores' },
  { id: 'universidades', label: 'Universidades' },
  { id: 'institutos', label: 'Institutos' },
  { id: 'colegios', label: 'Colegios' },
];

export default function SearchResultsView({
  query,
  results: initialInstitutions,
  onSelectInstitution,
  onSelectProfessor,
  onSelectStudent,
  onBack,
}: SearchResultsViewProps) {
  const [filter, setFilter] = useState<FilterType>('todos');
  const [viewMode, setViewMode] = useState<ViewMode>('mosaico');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [allData, setAllData] = useState<UnifiedSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Cerrar el menú desplegable al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setFilterMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cargar y consolidar todas las fuentes de datos (Instituciones, Profesores, Estudiantes)
  useEffect(() => {
    async function loadAllSearchData() {
      try {
        setLoading(true);

        // Búsqueda EXCLUSIVA en la tabla 'users' de Supabase
        let usersData: UnifiedSearchResult[] = [];
        try {
          const dbUsersRes = await supabase.from('users').select('*');

          if (dbUsersRes.data) {
            dbUsersRes.data
              .filter(u => u.display_name || u.email || u.nombres || u.apellido_paterno)
              .forEach((u) => {
                const fullStructured = [u.nombres, u.apellido_paterno, u.apellido_materno]
                  .filter(Boolean)
                  .join(' ')
                  .trim();
                const displayName = fullStructured || u.display_name || u.email?.split('@')[0] || 'Usuario';
                const isClaimed = !!u.claimed_student_id;
                const subtitle = isClaimed 
                  ? 'Estudiante Verificado' 
                  : (u.role === 'admin' ? 'Administrador' : 'Usuario de Starryz');

                usersData.push({
                  id: `user-${u.id}`,
                  name: displayName,
                  category: 'Estudiante' as SearchCategory,
                  typeKey: 'estudiantes' as FilterType,
                  subtitle,
                  image: u.photo_url || undefined,
                  slug: u.id,
                  rawItem: u,
                });
              });
          }
        } catch (e) {
          console.warn('No se pudieron obtener usuarios para la búsqueda:', e);
        }

        const unique = Array.from(new Map(usersData.map(item => [item.id, item])).values());
        setAllData(unique);
      } catch (err) {
        console.error('Error al compilar datos de búsqueda:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAllSearchData();
  }, [initialInstitutions]);

  const normalize = (text: string) => 
    (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Filtrado por término de búsqueda inteligente
  const cleanQuery = normalize(query);
  const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);

  // 1. Coincidencias Exactas o Subcadenas
  const exactMatches = allData.filter((item) => {
    if (!cleanQuery) return true;
    const itemName = normalize(item.name);
    const itemSub = normalize(item.subtitle);
    const itemCat = normalize(item.category);

    if (itemName.includes(cleanQuery) || itemSub.includes(cleanQuery) || itemCat.includes(cleanQuery)) {
      return true;
    }

    if (queryTokens.length > 1) {
      return queryTokens.every(token => itemName.includes(token) || itemSub.includes(token));
    }
    return false;
  });

  // 2. Coincidencias Difusas (Tolerancia a faltas de ortografía si no hay exactas o para sugerir)
  let fuzzyMatches: UnifiedSearchResult[] = [];
  let suggestedCorrection = '';

  if (exactMatches.length === 0 && cleanQuery) {
    const fuzzyCandidates: { item: UnifiedSearchResult; score: number }[] = [];

    allData.forEach((item) => {
      const itemName = normalize(item.name);
      const itemSub = normalize(item.subtitle);
      const wordsInItem = `${itemName} ${itemSub}`.split(/\s+/).filter(Boolean);

      let matchedTokensCount = 0;
      let totalSim = 0;

      queryTokens.forEach((qToken) => {
        let bestSim = 0;
        wordsInItem.forEach((iWord) => {
          // Token similarity
          let sim = 0;
          if (qToken === iWord) sim = 1.0;
          else if (iWord.includes(qToken) || qToken.includes(iWord)) sim = 0.9;
          else {
            const maxLen = Math.max(qToken.length, iWord.length);
            if (maxLen > 0) {
              const matrix = Array.from({ length: qToken.length + 1 }, () => new Array(iWord.length + 1).fill(0));
              for (let i = 0; i <= qToken.length; i++) matrix[i][0] = i;
              for (let j = 0; j <= iWord.length; j++) matrix[0][j] = j;
              for (let i = 1; i <= qToken.length; i++) {
                for (let j = 1; j <= iWord.length; j++) {
                  const cost = qToken[i - 1] === iWord[j - 1] ? 0 : 1;
                  matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
                }
              }
              const dist = matrix[qToken.length][iWord.length];
              sim = Math.max(0, 1 - dist / maxLen);
            }
          }

          if (sim > bestSim) bestSim = sim;
        });

        if (bestSim >= 0.60) {
          matchedTokensCount++;
          totalSim += bestSim;
        }
      });

      if (matchedTokensCount === queryTokens.length && matchedTokensCount > 0) {
        fuzzyCandidates.push({ item, score: totalSim / queryTokens.length });
      }
    });

    fuzzyCandidates.sort((a, b) => b.score - a.score);
    fuzzyMatches = fuzzyCandidates.map(c => c.item);
    if (fuzzyMatches.length > 0) {
      suggestedCorrection = fuzzyMatches[0].name;
    }
  }

  const termMatches = exactMatches.length > 0 ? exactMatches : fuzzyMatches;

  // Filtrado por tipo de entidad seleccionado
  const typeFiltered = termMatches.filter((item) => {
    if (filter === 'todos') return true;
    return item.typeKey === filter;
  });

  // Restricción a un MÁXIMO DE 10 RESULTADOS
  const finalResults = typeFiltered.slice(0, 10);

  const handleItemClick = (item: UnifiedSearchResult) => {
    if (item.category === 'Profesor' && onSelectProfessor) {
      onSelectProfessor(item.slug || item.id);
    } else if (item.category === 'Estudiante' && onSelectStudent) {
      onSelectStudent(item.slug || item.id);
    } else if (['Universidad', 'Instituto', 'Colegio'].includes(item.category)) {
      onSelectInstitution(item.rawItem);
    }
  };

  const getCategoryIcon = (cat: SearchCategory) => {
    switch (cat) {
      case 'Universidad':
        return GraduationCap;
      case 'Instituto':
        return Building2;
      case 'Colegio':
        return BookOpen;
      case 'Profesor':
        return UserCheck;
      case 'Estudiante':
        return User;
    }
  };

  const getCategoryBadgeClass = (cat: SearchCategory) => {
    switch (cat) {
      case 'Universidad':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Instituto':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'Colegio':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Profesor':
        return 'bg-amber-500/10 text-[#eab308] border-amber-500/20';
      case 'Estudiante':
        return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-8 animate-in fade-in duration-300">
      
      {/* Botón de regreso */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-[#eab308] transition-colors cursor-pointer group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Volver a la Red</span>
      </button>

      {/* BANNER SUGERENCIA ORTOGRÁFICA "¿Quizás quisiste decir...?" */}
      {suggestedCorrection && (
        <div className="p-4 rounded-2xl bg-[#eab308]/10 border border-[#eab308]/30 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#eab308] shrink-0" />
            <span className="text-xs sm:text-sm text-zinc-200">
              No se encontraron coincidencias exactas para &quot;<span className="text-zinc-400">{query}</span>&quot;. ¿Quizás quisiste decir <strong className="font-bold text-[#eab308] underline">{suggestedCorrection}</strong>?
            </span>
          </div>
        </div>
      )}

      {/* Encabezado y Barra de Controles (Filtro y Tipo de Vista) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-zinc-800/50 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Resultados para <span className="text-[#eab308]">&quot;{query}&quot;</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 flex items-center gap-2">
            <span>Se encontraron {typeFiltered.length} resultados</span>
            {typeFiltered.length > 10 && (
              <span className="text-[11px] font-mono text-[#eab308] bg-[#eab30810] px-2 py-0.5 rounded border border-[#eab30820]">
                (Mostrando los primeros 10)
              </span>
            )}
          </p>
        </div>

        {/* Toolbar de Controles */}
        <div className="flex items-center gap-3 self-start sm:self-center">
          
          {/* LADO IZQUIERDO: Selector de Tipo de Vista (Mosaico / Lista) */}
          <div className="flex items-center bg-[#0d0d0d] border border-zinc-800/80 rounded-xl p-1 gap-1 shadow-sm">
            <button
              onClick={() => setViewMode('mosaico')}
              title="Vista en Mosaico"
              className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                viewMode === 'mosaico'
                  ? 'bg-[#eab308] text-black shadow-md font-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden md:inline">Mosaico</span>
            </button>

            <button
              onClick={() => setViewMode('lista')}
              title="Vista en Lista"
              className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                viewMode === 'lista'
                  ? 'bg-[#eab308] text-black shadow-md font-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden md:inline">Lista</span>
            </button>
          </div>

          {/* LADO DERECHO: Botón y Menú Desplegable de Filtrar */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                filterMenuOpen || filter !== 'todos'
                  ? 'bg-[#151515] border-[#eab308] text-white shadow-[0_0_15px_rgba(234,179,8,0.15)]'
                  : 'bg-[#0d0d0d] border-zinc-800/80 hover:border-[#eab308]/40 text-zinc-300 hover:text-white'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-[#eab308]" />
              <span>Filtrar</span>
              {filter !== 'todos' && (
                <span className="w-2 h-2 rounded-full bg-[#eab308] animate-pulse"></span>
              )}
            </button>

            {/* Menú Desplegable (Exacto al diseño de la imagen enviada) */}
            {filterMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-[#0d0d0d] border border-zinc-800 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.9)] py-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-5 pb-2 text-sm font-black text-white tracking-tight border-b border-zinc-800/70 mb-2">
                  Filtrar por tipo
                </div>
                <div className="space-y-0.5 px-2">
                  {FILTER_OPTIONS.map((opt) => {
                    const isSelected = filter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setFilter(opt.id);
                          setFilterMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all text-left cursor-pointer ${
                          isSelected
                            ? 'text-white bg-zinc-800/60 font-black'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80 font-medium'
                        }`}
                      >
                        <span className="w-3 flex items-center justify-center">
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                          )}
                        </span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Contenido de Resultados */}
      <div className="space-y-4">
        
        {/* Cabecera de Sección */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#eab308]" />
            <span>
              {filter === 'todos' ? 'Todos los Resultados' : FILTER_OPTIONS.find(f => f.id === filter)?.label}
            </span>
          </h2>
          <span className="text-xs text-zinc-500 font-mono">
            {finalResults.length} de {typeFiltered.length}
          </span>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-[#0d0d0d] border border-zinc-800/30 rounded-2xl">
            <div className="w-8 h-8 border-2 border-[#eab308] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-zinc-400 font-mono">Buscando en la comunidad...</p>
          </div>
        ) : finalResults.length === 0 ? (
          <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-2xl p-16 text-center text-zinc-400 space-y-3">
            <Building2 className="w-12 h-12 text-zinc-600 mx-auto" />
            <p className="text-base font-bold text-white">No se encontraron resultados</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Intenta con otro término de búsqueda o cambia el filtro de tipo seleccionado arriba.
            </p>
            {filter !== 'todos' && (
              <button
                onClick={() => setFilter('todos')}
                className="mt-2 px-4 py-2 bg-[#151515] hover:bg-[#202020] text-[#eab308] text-xs font-bold rounded-xl border border-[#eab308]/30 transition-all cursor-pointer"
              >
                Limpiar Filtro
              </button>
            )}
          </div>
        ) : viewMode === 'lista' ? (
          
          /* ===== 1. VISTA EN LISTA ===== */
          <div className="space-y-2.5 animate-in fade-in duration-200">
            {finalResults.map((item) => {
              const Icon = getCategoryIcon(item.category);
              const badgeClass = getCategoryBadgeClass(item.category);

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="group flex items-center justify-between gap-4 bg-[#0d0d0d] border border-zinc-800/40 hover:border-[#eab308]/60 rounded-xl p-4 transition-all duration-300 cursor-pointer hover:shadow-[0_4px_25px_rgba(234,179,8,0.06)]"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Imagen / Avatar */}
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-11 h-11 rounded-xl object-cover ring-1 ring-zinc-800 group-hover:ring-[#eab308]/50 transition-all flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-[#151515] border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-[#eab308] group-hover:border-[#eab308]/30 transition-colors flex-shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                    )}

                    {/* Título y Subtítulo */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-[#eab308] transition-colors truncate">
                          {item.name}
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Badge & Flecha */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${badgeClass}`}>
                      {item.category}
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-[#eab308] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>

        ) : (

          /* ===== 2. VISTA EN MOSAICO (GRID) ===== */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-200">
            {finalResults.map((item) => {
              const Icon = getCategoryIcon(item.category);
              const badgeClass = getCategoryBadgeClass(item.category);

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="group bg-[#0d0d0d] border border-zinc-800/40 hover:border-[#eab308]/60 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 cursor-pointer hover:shadow-[0_8px_30px_rgba(234,179,8,0.08)] hover:-translate-y-0.5"
                >
                  <div className="space-y-4">
                    {/* Header de la tarjeta con Badge */}
                    <div className="flex items-start justify-between gap-3">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-14 h-14 rounded-2xl object-cover ring-2 ring-zinc-800 group-hover:ring-[#eab308]/50 transition-all flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-[#151515] border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-[#eab308] group-hover:border-[#eab308]/30 transition-colors flex-shrink-0">
                          <Icon className="w-7 h-7" />
                        </div>
                      )}

                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${badgeClass}`}>
                        {item.category}
                      </span>
                    </div>

                    {/* Información */}
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-white group-hover:text-[#eab308] transition-colors line-clamp-2 leading-snug">
                        {item.name}
                      </h3>
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Pie de tarjeta */}
                  <div className="pt-4 mt-4 border-t border-zinc-800/40 flex items-center justify-between text-xs font-bold text-zinc-500 group-hover:text-[#eab308] transition-colors">
                    <span>Ver detalles</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>

        )}

      </div>

    </div>
  );
}
