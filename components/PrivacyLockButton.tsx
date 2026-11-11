'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Lock, Globe, Check, ChevronDown } from 'lucide-react';

interface PrivacyLockButtonProps {
  mode?: 'solo_yo' | 'todos' | null;
  onChange: (newMode: 'solo_yo' | 'todos') => void;
  label?: string;
  className?: string;
}

export default function PrivacyLockButton({
  mode = 'solo_yo',
  onChange,
  label = 'Privacidad',
  className = ''
}: PrivacyLockButtonProps) {
  const currentMode = mode === 'todos' ? 'todos' : 'solo_yo';
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const isPrivate = currentMode === 'solo_yo';

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={`Visibilidad: ${isPrivate ? 'Solo yo (Privado)' : 'Todos (Público)'}`}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer select-none ${
          isPrivate
            ? 'bg-[#18181b]/80 hover:bg-zinc-800 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
            : 'bg-[#18181b]/80 hover:bg-zinc-800 text-sky-400 border-sky-500/30 shadow-[0_0_10px_rgba(56,189,248,0.15)]'
        }`}
      >
        {isPrivate ? (
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <Globe className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        <span className="hidden sm:inline text-[11px] font-black uppercase tracking-wider">
          {isPrivate ? 'Solo yo' : 'Todos'}
        </span>
        <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-52 bg-[#0e0e11] border border-zinc-800 rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,0.85)] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 border-b border-zinc-800/80 mb-1">
            {label}
          </div>

          {/* Opción 1: Solo yo */}
          <button
            type="button"
            onClick={() => {
              onChange('solo_yo');
              setIsOpen(false);
            }}
            className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
              isPrivate
                ? 'bg-amber-500/10 text-amber-300 font-bold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <div className={`p-1 rounded-lg mt-0.5 ${isPrivate ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-900 text-zinc-500'}`}>
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Solo yo</span>
                {isPrivate && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                Privado. Solo tú puedes ver este contenido.
              </p>
            </div>
          </button>

          {/* Opción 2: Todos */}
          <button
            type="button"
            onClick={() => {
              onChange('todos');
              setIsOpen(false);
            }}
            className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer mt-0.5 ${
              !isPrivate
                ? 'bg-sky-500/10 text-sky-300 font-bold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <div className={`p-1 rounded-lg mt-0.5 ${!isPrivate ? 'bg-sky-500/20 text-sky-400' : 'bg-zinc-900 text-zinc-500'}`}>
              <Globe className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Todos</span>
                {!isPrivate && <Check className="w-3.5 h-3.5 text-sky-400" />}
              </div>
              <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                Público. Visible para todos los visitantes.
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
