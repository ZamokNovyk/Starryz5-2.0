'use client';

import React from 'react';
import { X, MapPin, Star, CheckCircle2, Trophy, ArrowRight } from 'lucide-react';
import { Institution } from '@/lib/mockData';

interface InstitutionModalProps {
  institution: Institution | null;
  onClose: () => void;
}

export default function InstitutionModal({ institution, onClose }: InstitutionModalProps) {
  if (!institution) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0d0d0d] border border-[#eab308] rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(234,179,8,0.2)] space-y-5">
        
        {/* Banner image header */}
        <div className="relative h-48 w-full">
          <img
            src={institution.image}
            alt={institution.name}
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/50 to-transparent"></div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-[#151515] border border-[#ffffff15] text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-6 flex items-center gap-3">
            <span className="px-3.5 py-1.5 rounded-lg bg-[#eab308] text-black font-black text-sm tracking-widest shadow-lg">
              {institution.acronym}
            </span>
            {institution.verified && (
              <span className="flex items-center gap-1 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-[#eab308]/40 text-[#eab308] text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Campus Verificado
              </span>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="px-6 pb-6 space-y-4">
          <div>
            <h3 className="text-2xl font-black text-white leading-snug">{institution.name}</h3>
            <p className="text-xs text-zinc-400 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-[#eab308]" />
              <span>{institution.campus} • {institution.city}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-[#0a0a0a] p-4 rounded-xl border border-[#ffffff10] text-center">
            <div>
              <span className="block text-[10px] uppercase text-zinc-400 font-bold tracking-wider">Alumnos en Starryz</span>
              <span className="text-xl font-black text-white">{institution.studentsCount.toLocaleString()}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-zinc-400 font-bold tracking-wider">Puntaje Popularidad</span>
              <span className="text-xl font-black text-[#eab308] flex items-center justify-center gap-1">
                <Star className="w-4 h-4 fill-[#eab308]" />
                {institution.popularityScore} / 10
              </span>
            </div>
          </div>

          <div className="bg-[#0a0a0a] p-4 rounded-xl border border-[#ffffff10] text-xs space-y-2">
            <div className="flex items-center justify-between text-zinc-300">
              <span className="font-bold flex items-center gap-1.5 text-[#eab308]">
                <Trophy className="w-4 h-4" /> Alumno #1 de este Campus:
              </span>
              <span className="font-extrabold text-white">{institution.topStudent}</span>
            </div>
          </div>

          <button
            onClick={() => {
              alert(`Has enviado una solicitud de apoyo al campus ${institution.acronym}!`);
              onClose();
            }}
            className="w-full py-3 rounded-lg bg-[#eab308] hover:bg-[#d9a307] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>VOTAR POR ESTE CAMPUS</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

