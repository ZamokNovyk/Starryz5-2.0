'use client';

import React from 'react';
import { X, Download, Sparkles, Star, ShieldCheck } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InstallAppModal({ isOpen, onClose }: InstallAppModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0d0d0d] border border-[#eab308] rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(234,179,8,0.2)] space-y-6 overflow-hidden">
        
        {/* Glow corner background */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#eab30810] blur-3xl rounded-full pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-[#151515] border border-[#ffffff15] text-zinc-400 hover:text-white hover:border-[#eab308] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#eab30810] border border-[#eab308] flex items-center justify-center">
            <Star className="w-6 h-6 text-[#eab308] fill-[#eab308]" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#eab308] uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> PWA App Oficial
            </span>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">
              INSTALAR <span className="text-[#eab308]">STARRYZ 5</span>
            </h3>
          </div>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed">
          Accede instantáneamente desde tu pantalla de inicio sin necesidad de descarga pesada en tiendas de aplicaciones.
        </p>

        {/* INSTALLATION STEPS */}
        <div className="space-y-3 bg-[#0a0a0a] p-4 rounded-xl border border-[#ffffff10] text-xs">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-md bg-[#eab30820] text-[#eab308] font-bold flex items-center justify-center shrink-0">1</span>
            <div>
              <p className="font-bold text-white">En Android (Chrome / Edge):</p>
              <p className="text-zinc-400">Toca los 3 puntos del navegador y selecciona <strong className="text-[#eab308] font-semibold">&quot;Agregar a la pantalla principal&quot;</strong>.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-2 border-t border-[#ffffff10]">
            <span className="w-6 h-6 rounded-md bg-[#eab30820] text-[#eab308] font-bold flex items-center justify-center shrink-0">2</span>
            <div>
              <p className="font-bold text-white">En iOS (Safari):</p>
              <p className="text-zinc-400">Toca el botón <strong className="text-[#eab308] font-semibold">&quot;Compartir&quot;</strong> y elige <strong className="text-[#eab308] font-semibold">&quot;Agregar al inicio&quot;</strong>.</p>
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={async () => {
              const deferredPrompt = (window as any).deferredPrompt;
              if (deferredPrompt) {
                try {
                  deferredPrompt.prompt();
                  const { outcome } = await deferredPrompt.userChoice;
                  console.log(`PWA installation outcome: ${outcome}`);
                  (window as any).deferredPrompt = null;
                  onClose();
                } catch (err) {
                  console.error('Error starting native PWA install prompt:', err);
                  alert('Hubo un problema al abrir el instalador nativo. Por favor, sigue los pasos manuales descritos arriba.');
                }
              } else {
                alert('La instalación rápida directa no está disponible en este navegador (común en iOS Safari). Por favor, sigue las instrucciones manuales detalladas arriba para agregar la app a tu inicio.');
              }
            }}
            className="w-full py-3 px-6 rounded-lg bg-[#eab308] hover:bg-[#d9a307] text-black font-black text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>DESCARGAR / INSTALAR AHORA</span>
          </button>
        </div>

        <div className="text-center text-[11px] text-zinc-500 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-[#eab308]" />
          <span>Compatible con iOS, Android, Windows y macOS</span>
        </div>
      </div>
    </div>
  );
}

