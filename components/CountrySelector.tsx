import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Globe, ChevronDown, Check, X } from 'lucide-react';
import { COUNTRIES, Country, getFlagUrl, findCountry } from '@/src/data/countries';

interface CountrySelectorProps {
  value: string; // Puede ser código ('pe') o nombre ('Perú')
  onChange: (country: Country | null) => void;
  disabled?: boolean;
  label?: string;
}

export const CountrySelector: React.FC<CountrySelectorProps> = ({
  value,
  onChange,
  disabled = false,
  label = 'País / Nacionalidad',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCountry = useMemo(() => {
    return findCountry(value);
  }, [value]);

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return COUNTRIES;
    const q = search.toLowerCase().trim();
    return COUNTRIES.filter(
      c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [search]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (c: Country) => {
    onChange(c);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearch('');
  };

  return (
    <div className="space-y-1.5 relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#eab308] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#eab308]" /> {label}
          </span>
          {selectedCountry && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[9px] font-bold text-zinc-500 hover:text-red-400 transition cursor-pointer lowercase"
            >
              quitar país
            </button>
          )}
        </label>
      )}

      {/* Botón Selector */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3 transition-all outline-none select-none ${
          disabled
            ? 'bg-[#121212] border border-[#ffffff0a] text-zinc-400 cursor-not-allowed font-medium'
            : isOpen
              ? 'bg-[#181818] border-[#eab308] ring-1 ring-[#eab308] text-white shadow-[0_0_15px_rgba(234,179,8,0.15)] cursor-pointer'
              : 'bg-[#151515] border border-[#ffffff15] text-zinc-200 hover:border-zinc-700 hover:bg-[#1a1a1a] cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-3 truncate">
          {selectedCountry ? (
            <>
              <img
                src={getFlagUrl(selectedCountry.code, 'w40')}
                srcSet={`${getFlagUrl(selectedCountry.code, 'w80')} 2x`}
                alt={`Bandera de ${selectedCountry.name}`}
                className="w-6 h-4 object-cover rounded-xs border border-zinc-700/60 shadow-xs flex-shrink-0"
                loading="eager"
              />
              <span className="font-bold text-white tracking-tight truncate">
                {selectedCountry.name}
              </span>
              <span className="text-[10px] font-mono text-zinc-500 uppercase">
                ({selectedCountry.code.toUpperCase()})
              </span>
            </>
          ) : (
            <span className="text-zinc-500 flex items-center gap-2">
              <Globe className="w-4 h-4 text-zinc-600" />
              Selecciona tu país de origen...
            </span>
          )}
        </div>

        {!disabled && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {selectedCountry && (
              <span
                onClick={handleClear}
                className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition"
                title="Limpiar selección"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-[#eab308]' : ''
              }`}
            />
          </div>
        )}
      </button>

      {/* Menú desplegable flotante con búsqueda */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#111111] border border-zinc-800 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
          {/* Campo de búsqueda */}
          <div className="p-3 border-b border-zinc-800/80 bg-[#161616]">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar país... (ej. Perú, México, España)"
                className="w-full bg-[#0d0d0d] border border-zinc-700/60 focus:border-[#eab308] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 outline-none transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 p-1 rounded-md text-zinc-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Lista de países con scroll */}
          <div className="max-h-60 overflow-y-auto divide-y divide-zinc-900/60 scrollbar-thin scrollbar-thumb-zinc-700">
            {filteredCountries.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">
                No se encontró ningún país con "<span className="text-zinc-300">{search}</span>"
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = selectedCountry?.code === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={`w-full px-4 py-2.5 text-xs flex items-center justify-between gap-3 transition-colors text-left cursor-pointer group ${
                      isSelected
                        ? 'bg-[#eab308]/15 text-[#eab308] font-black'
                        : 'text-zinc-300 hover:bg-[#1c1c1c] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <img
                        src={getFlagUrl(c.code, 'w40')}
                        srcSet={`${getFlagUrl(c.code, 'w80')} 2x`}
                        alt={`Bandera de ${c.name}`}
                        className="w-5 h-3.5 object-cover rounded-xs border border-zinc-700/50 shadow-xs flex-shrink-0 group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                      <span className="truncate">{c.name}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-mono uppercase text-zinc-600 group-hover:text-zinc-400">
                        {c.code}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-[#eab308]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CountrySelector;
