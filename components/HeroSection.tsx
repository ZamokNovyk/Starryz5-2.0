'use client';

import React from 'react';
import { Crown } from 'lucide-react';
import AutocompleteSearchBar from './AutocompleteSearchBar';
import { SearchSuggestion } from '@/src/lib/search';
import { useTheme } from '@/src/context/ThemeContext';

interface HeroSectionProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onNavigate?: (url: string) => void;
  onSelectStudent?: (student: any) => void;
  onSelectInstitution?: (inst: any) => void;
}

export default function HeroSection({
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  onNavigate,
}: HeroSectionProps) {
  const { theme } = useTheme();

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
    onSearchSubmit(syntheticEvent);
  };

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    if (onNavigate && suggestion.url) {
      onNavigate(suggestion.url);
    } else {
      handleSearch(suggestion.title);
    }
  };

  return (
    <section className="relative min-h-[580px] lg:min-h-[620px] flex flex-col items-center justify-center pt-12 pb-16 px-6 lg:px-8 bg-[#0a0a0a] bg-radial-grid overflow-hidden">
      {/* Immersive Glowing background element */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#eab30805] blur-[100px] rounded-full pointer-events-none"></div>

      {/* TOP CROWN CARD WITH ROTATION & GOLDEN GLOW */}
      <div className="relative z-10 mb-6 flex items-center justify-center">
        <div className="p-3 bg-[#0d0d0d] border border-[#eab308] rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.2)] transform -rotate-3 transition-transform duration-300 hover:rotate-0 hover:scale-105 cursor-pointer">
          <Crown className="w-8 h-8 text-[#eab308] stroke-[2]" />
        </div>
      </div>

      {/* MAIN TITLE (IMMERSIVE UI STYLE) */}
      <div className="relative z-10 text-center max-w-4xl mx-auto mb-8 select-none">
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-center leading-tight mb-2">
          MIDE TU{' '}
          <span className="relative inline-block text-[#eab308]">
            POPULARIDAD
            <span className="absolute left-0 bottom-1 w-full h-2 bg-[#eab30830] -rotate-1 rounded-full"></span>
          </span>{' '}
          <br className="hidden sm:block" />
          EN EL CAMPUS
        </h1>
      </div>

      {/* AUTOCOMPLETE SEARCH BAR (PILL STYLE) */}
      <div className="relative z-20 w-full max-w-2xl mx-auto mb-6">
        <AutocompleteSearchBar
          value={searchQuery}
          placeholder="Buscar usuarios por nombre..."
          onSearch={handleSearch}
          onSelectSuggestion={handleSelectSuggestion}
          showLeftIcon={false}
          inputClassName="px-6 py-4 sm:py-5 text-base sm:text-lg border border-zinc-800 focus-within:border-[#eab308]"
        />
      </div>

    </section>
  );
}
