'use client';

import React from 'react';

interface FooterProps {
  onNavigate?: (url: string) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  const handleNav = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new Event('popstate'));
    }
  };

  return (
    <footer className="bg-[#0d0d0d] border-t border-[#ffffff05] text-zinc-500 text-xs py-10 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img 
            src="/Logo/logo.jpg" 
            alt="Logo Starryz 5" 
            className="w-7 h-7 rounded-full object-cover border border-[#eab308]/30 shadow-md"
            referrerPolicy="no-referrer"
          />
          <span className="font-black text-white text-sm tracking-wider">
            STARRYZ <span className="text-[#eab308]">5</span>
          </span>
        </div>

        {/* Links legales */}
        <div className="flex items-center gap-6 text-xs text-zinc-400">
          <button
            onClick={() => handleNav('/terminos-de-servicio')}
            className="hover:text-[#eab308] transition-colors cursor-pointer"
          >
            Términos de Servicio
          </button>
          <span className="text-zinc-700">&bull;</span>
          <button
            onClick={() => handleNav('/politica-de-privacidad')}
            className="hover:text-[#eab308] transition-colors cursor-pointer"
          >
            Política de Privacidad
          </button>
        </div>

        {/* Copyright */}
        <div className="text-zinc-600 text-[10px] font-mono tracking-widest uppercase">
          © {new Date().getFullYear()} STARRYZ 5. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
