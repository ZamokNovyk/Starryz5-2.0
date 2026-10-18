'use client';

import React, { useState } from 'react';
import { X, Star, Crown, CheckCircle2, Share2 } from 'lucide-react';
import { Student } from '@/lib/mockData';
import { shareContent } from '@/src/lib/share';

interface ProfileModalProps {
  student: Student | null;
  onClose: () => void;
}

export default function ProfileModal({ student, onClose }: ProfileModalProps) {
  const [votes, setVotes] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);

  if (!student) return null;

  const currentVotes = votes !== null ? votes : student.votes;

  const handleVoteClick = () => {
    if (!voted) {
      setVotes(currentVotes + 1);
      setVoted(true);
    } else {
      setVotes(currentVotes - 1);
      setVoted(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0d0d0d] border border-[#eab308] rounded-2xl p-6 shadow-[0_0_40px_rgba(234,179,8,0.2)] space-y-6 overflow-hidden">
        
        {/* Glow Header */}
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-[#eab30815] to-transparent"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-[#151515] border border-[#ffffff15] text-zinc-400 hover:text-white hover:border-[#eab308] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Card Center */}
        <div className="relative z-10 pt-4 text-center space-y-3">
          <div className="relative inline-block">
            <img
              src={student.avatar}
              alt={student.name}
              className="w-24 h-24 rounded-full object-cover mx-auto ring-3 ring-[#eab308] shadow-[0_0_20px_rgba(234,179,8,0.3)]"
            />
            {student.rank === 1 && (
              <div className="absolute -top-2 -right-2 bg-[#eab308] text-black p-1.5 rounded-md shadow-lg">
                <Crown className="w-4 h-4 fill-black text-black" />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h3 className="text-2xl font-black text-white">{student.name}</h3>
              {student.verified && <CheckCircle2 className="w-5 h-5 text-[#eab308]" />}
            </div>
            <p className="text-xs text-[#eab308] font-mono font-bold mt-0.5">{student.username}</p>
          </div>

          <div className="bg-[#0a0a0a] border border-[#ffffff10] p-3 rounded-xl text-xs space-y-1">
            <p className="font-bold text-white">{student.institution}</p>
            <p className="text-zinc-400">{student.career} • {student.semester}</p>
          </div>

          <p className="text-xs text-zinc-300 italic px-2">&quot;{student.bio}&quot;</p>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-[#0a0a0a] border border-[#ffffff10] p-3 rounded-xl text-center">
              <span className="block text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Ranking Campus</span>
              <span className="text-xl font-black text-[#eab308]">#{student.rank}</span>
            </div>
            <div className="bg-[#0a0a0a] border border-[#ffffff10] p-3 rounded-xl text-center">
              <span className="block text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Popularidad</span>
              <span className="text-xl font-black text-white">{student.score} / 100</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex gap-2">
            <button
              onClick={handleVoteClick}
              className={`flex-1 py-3 rounded-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                voted
                  ? 'bg-[#eab308] text-black shadow-md'
                  : 'bg-[#eab308] hover:bg-[#d9a307] text-black shadow-md'
              }`}
            >
              <Star className="w-4 h-4 fill-black text-black" />
              <span>{voted ? '¡VOTO REGISTRADO!' : 'VOTAR POR ESTRELLA'}</span>
            </button>

            <button
              onClick={async () => {
                const res = await shareContent({
                  title: `${student.name} | Wikistars`,
                  text: `Conoce el perfil de ${student.name} en Wikistars ⭐`,
                  url: window.location.href,
                });
                if (res.copied) {
                  alert(`¡Enlace del perfil de ${student.name} copiado al portapapeles!`);
                }
              }}
              className="p-3 rounded-lg bg-[#0a0a0a] border border-[#ffffff10] text-[#eab308] hover:bg-[#151515] transition-colors cursor-pointer"
              title="Compartir perfil"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

