'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Star, CheckCircle2 } from 'lucide-react';
import { Institution } from '@/lib/mockData';
import { getEducationalCenters, EducationalCenter } from '@/src/lib/centers';

interface RegisteredInstitutionsProps {
  onSelectInstitution: (inst: Institution) => void;
  searchQuery: string;
  refreshKey?: number;
  dbCenters?: EducationalCenter[];
  loading?: boolean;
}

function generateAcronym(name: string): string {
  const cleanWords = name
    .trim()
    .split(/\s+/)
    .filter(word => {
      const lower = word.toLowerCase();
      return lower.length > 2 && !['de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'con', 'para', 'por'].includes(lower);
    });

  if (cleanWords.length === 0) return name.substring(0, 4).toUpperCase();
  if (cleanWords.length === 1) return cleanWords[0].substring(0, 4).toUpperCase();
  return cleanWords.map(w => w[0]).join('').toUpperCase().substring(0, 6);
}

export default function RegisteredInstitutions({
  onSelectInstitution,
  searchQuery,
  refreshKey = 0,
  dbCenters: propsDbCenters,
  loading: propsLoading,
}: RegisteredInstitutionsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [internalDbCenters, setInternalDbCenters] = useState<EducationalCenter[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);

  // Usar props o fallback interno
  const dbCenters = propsDbCenters !== undefined ? propsDbCenters : internalDbCenters;
  const loading = propsLoading !== undefined ? propsLoading : internalLoading;

  useEffect(() => {
    if (propsDbCenters !== undefined) return; // Si viene por props, no hacer fetch interno
    async function loadCenters() {
      try {
        setInternalLoading(true);
        const data = await getEducationalCenters();
        setInternalDbCenters(data);
      } catch (err) {
        console.error('Error al cargar centros de Supabase:', err);
      } finally {
        setInternalLoading(false);
      }
    }
    loadCenters();

    const handleUpdated = () => {
      loadCenters();
    };
    window.addEventListener('educational-centers-updated', handleUpdated);
    return () => window.removeEventListener('educational-centers-updated', handleUpdated);
  }, [refreshKey, propsDbCenters]);

  const categories = ['Todas', 'Universidad', 'Instituto', 'Colegio'];

  // Mapear los centros de Supabase al tipo Institution
  const mappedDbCenters: Institution[] = dbCenters.map(center => {
    const category: 'Universidad' | 'Instituto' | 'Colegio' = 
      center.type === 'colegio' 
        ? 'Colegio' 
        : center.type === 'instituto' 
          ? 'Instituto' 
          : 'Universidad';

    const fallbackImages = {
      'Colegio': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop',
      'Instituto': 'https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800&auto=format&fit=crop',
      'Universidad': 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800&auto=format&fit=crop'
    };

    return {
      id: center.id,
      name: center.name,
      acronym: generateAcronym(center.name),
      category,
      campus: 'Sede Principal',
      city: 'Registrado por Alumno',
      studentsCount: 1, // Nuevo centro creado por usuario
      popularityScore: 7.0,
      verified: false,
      image: center.profile_photo_url || fallbackImages[category],
      topStudent: 'Sin líder',
    };
  });

  // Mostrar exclusivamente los centros reales de la base de datos (no inventados/mock)
  const combinedInstitutions = mappedDbCenters;

  const filteredInstitutions = combinedInstitutions.filter((inst) => {
    const matchesCategory =
      selectedCategory === 'Todas' || inst.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.acronym.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.campus.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Limitar a máximo 4 centros educativos por categoría para no saturar la página principal
  const displayedInstitutions = filteredInstitutions.slice(0, 4);

  return (
    <section className="py-16 px-6 lg:px-8 max-w-7xl mx-auto border-t border-[#ffffff10]">
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
        <div>
          <div className="flex items-center gap-2 text-[#eab308] text-xs font-bold uppercase tracking-[0.2em] mb-2">
            <Building2 className="w-4 h-4 text-[#eab308]" />
            <span>RED EDUCATIVA STARRYZ5</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase font-sans">
            INSTITUCIONES <span className="text-[#eab308]">REGISTRADAS</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1 max-w-xl">
            Descubre los campus reales con mayor índice de popularidad y participación estudiantil.
          </p>
        </div>

        {/* CATEGORY FILTERS */}
        <div className="flex flex-wrap items-center gap-2 bg-[#0d0d0d] p-1.5 rounded-xl border border-[#ffffff10]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#eab308] text-black shadow-md shadow-[#eab308]/20'
                  : 'text-zinc-400 hover:text-white hover:bg-[#151515]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* INSTITUTION CARDS GRID */}
      {loading ? (
        <div className="bg-[#0d0d0d] border border-[#ffffff10] rounded-xl p-16 text-center text-zinc-400">
          <div className="w-10 h-10 border-2 border-[#eab308] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-bold text-white uppercase tracking-wider">Cargando instituciones reales...</p>
        </div>
      ) : displayedInstitutions.length === 0 ? (
        <div className="bg-[#0d0d0d] border border-[#ffffff10] rounded-xl p-12 text-center text-zinc-400">
          <Building2 className="w-12 h-12 text-[#eab308]/50 mx-auto mb-3" />
          <p className="text-lg font-bold text-white">No se encontraron instituciones registradas</p>
          <p className="text-sm mt-1 max-w-md mx-auto">
            {dbCenters.length === 0 
              ? 'Aún no se han registrado centros educativos reales en la base de datos. ¡Sé el primero en registrar uno oficial utilizando el botón "Crear Centro" del menú!' 
              : 'Intenta ajustando los términos de búsqueda o filtros de categoría.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayedInstitutions.map((inst) => (
            <div
              key={inst.id}
              onClick={() => onSelectInstitution(inst)}
              className="group relative bg-[#0d0d0d] border border-[#ffffff10] hover:border-[#eab30840] rounded-xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_20px_rgba(234,179,8,0.15)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Banner Image */}
                <div className="relative h-44 w-full overflow-hidden bg-[#151515]">
                  <img
                    src={inst.image}
                    alt={inst.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                    onError={(e) => {
                      const fallbacks: Record<string, string> = {
                        'Colegio': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop',
                        'Instituto': 'https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800&auto=format&fit=crop',
                        'Universidad': 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800&auto=format&fit=crop'
                      };
                      e.currentTarget.src = fallbacks[inst.category] || fallbacks['Instituto'];
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/40 to-transparent"></div>

                  {/* Badge Verified */}
                  {inst.verified && (
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="p-1 rounded-full bg-[#eab308] text-black shadow-md">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  )}
                </div>

                {/* Content Details */}
                <div className="p-5">
                  <h3 className="text-lg font-bold text-white group-hover:text-[#eab308] transition-colors leading-snug">
                    {inst.name}
                  </h3>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

