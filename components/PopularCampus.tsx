'use client';

import React, { useState } from 'react';
import { Crown, Flame, Star, Award, CheckCircle2, Sparkles } from 'lucide-react';
import { Student, MOCK_STUDENTS } from '@/lib/mockData';

interface PopularCampusProps {
  onSelectStudent: (student: Student) => void;
  searchQuery: string;
}

export default function PopularCampus({ onSelectStudent, searchQuery }: PopularCampusProps) {
  const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS);
  const [votedStudentIds, setVotedStudentIds] = useState<Record<string, boolean>>({});

  const handleVote = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const hasVoted = votedStudentIds[id];
          return {
            ...s,
            votes: hasVoted ? s.votes - 1 : s.votes + 1,
          };
        }
        return s;
      })
    );

    setVotedStudentIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredStudents = students.filter((s) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(query) ||
      s.institution.toLowerCase().includes(query) ||
      s.career.toLowerCase().includes(query) ||
      s.username.toLowerCase().includes(query)
    );
  });

  return (
    <section className="py-16 px-6 lg:px-8 max-w-7xl mx-auto border-t border-[#ffffff10] bg-[#0a0a0a]">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#eab308] text-xs font-bold uppercase tracking-[0.2em] mb-2">
            <Flame className="w-4 h-4 text-[#eab308] animate-bounce" />
            <span>RANKING OFICIAL STARRYZ 5</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase font-sans">
            ALUMNOS Y CAMPUS <span className="text-[#eab308]">POPULARES</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1 max-w-xl">
            Vota por los líderes estudiantiles y eleva el nivel de tu universidad en el ranking global.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#eab30810] border border-[#eab30830] px-4 py-2 rounded-lg text-[#eab308] text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-[#eab308]" />
          <span>Votación en tiempo real activa</span>
        </div>
      </div>

      {/* TOP PODIUM (RANK 1, 2, 3) SHOWCASE */}
      {searchQuery === '' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {students.slice(0, 3).map((student) => {
            const isRank1 = student.rank === 1;
            const isRank2 = student.rank === 2;
            const isRank3 = student.rank === 3;
            const hasVoted = votedStudentIds[student.id];

            return (
              <div
                key={student.id}
                onClick={() => onSelectStudent(student)}
                className={`relative rounded-xl p-6 transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                  isRank1
                    ? 'bg-gradient-to-br from-[#0d0d0d] to-[#151515] border-2 border-[#eab308] shadow-[0_0_25px_rgba(234,179,8,0.25)] md:-translate-y-2'
                    : 'bg-[#0d0d0d] border border-[#ffffff10] hover:border-[#ffffff20] shadow-xl'
                }`}
              >
                {/* Crown / Rank Badge Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {isRank1 && (
                      <span className="p-2 rounded-md bg-[#eab308] text-black shadow-lg">
                        <Crown className="w-4 h-4 fill-black text-black" />
                      </span>
                    )}
                    {isRank2 && (
                      <span className="p-2 rounded-md bg-slate-300 text-black shadow-lg">
                        <Award className="w-4 h-4" />
                      </span>
                    )}
                    {isRank3 && (
                      <span className="p-2 rounded-md bg-amber-600 text-white shadow-lg">
                        <Award className="w-4 h-4" />
                      </span>
                    )}
                    <span
                      className={`font-black text-xs uppercase tracking-wider px-2.5 py-1 rounded-md ${
                        isRank1
                          ? 'bg-[#eab30820] text-[#eab308] border border-[#eab30840]'
                          : 'bg-[#ffffff10] text-zinc-300'
                      }`}
                    >
                      TOP #{student.rank}
                    </span>
                  </div>

                  <span className="text-[#eab308] font-extrabold text-sm flex items-center gap-1">
                    <Star className="w-4 h-4 fill-[#eab308]" />
                    {student.score}
                  </span>
                </div>

                {/* Avatar & Profile Details */}
                <div className="text-center space-y-3 py-2">
                  <div className="relative inline-block">
                    <img
                      src={student.avatar}
                      alt={student.name}
                      className={`w-20 h-20 rounded-full object-cover mx-auto shadow-2xl ${
                        isRank1
                          ? 'ring-3 ring-[#eab308] shadow-[0_0_15px_rgba(234,179,8,0.4)]'
                          : 'ring-2 ring-[#ffffff20]'
                      }`}
                    />
                    {student.verified && (
                      <div className="absolute bottom-0 right-0 bg-[#eab308] text-black rounded-full p-1 shadow-md">
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-[#eab308]">
                      {student.name}
                    </h3>
                    <p className="text-xs text-[#eab308]/80 font-mono font-medium">
                      {student.username}
                    </p>
                  </div>

                  <div className="text-xs text-zinc-300 bg-[#0a0a0a] py-2 px-3 rounded-lg border border-[#ffffff10] inline-block">
                    <p className="font-semibold text-white">{student.institution}</p>
                    <p className="text-zinc-400">{student.career}</p>
                  </div>
                </div>

                {/* Bottom Vote Action */}
                <div className="mt-6 pt-4 border-t border-[#ffffff10] flex items-center justify-between">
                  <div className="text-left">
                    <span className="block text-[10px] uppercase text-zinc-500 font-bold tracking-wider">
                      Votos recibidos
                    </span>
                    <span className="text-sm font-black text-white">
                      {student.votes.toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleVote(e, student.id)}
                    className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-90 cursor-pointer ${
                      hasVoted
                        ? 'bg-[#eab308] text-black shadow-md'
                        : 'bg-transparent border border-[#eab308] text-[#eab308] hover:bg-[#eab30810]'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${hasVoted ? 'fill-black' : 'fill-[#eab308]'}`} />
                    <span>{hasVoted ? 'VOTADO' : 'VOTAR'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ALL STUDENTS GRID LIST */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.map((student) => {
          const hasVoted = votedStudentIds[student.id];

          return (
            <div
              key={student.id}
              onClick={() => onSelectStudent(student)}
              className="bg-[#0d0d0d] border border-[#ffffff10] hover:border-[#eab30840] p-4 rounded-xl transition-all duration-200 hover:bg-[#121212] cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={student.avatar}
                    alt={student.name}
                    className="w-11 h-11 rounded-full object-cover border border-[#ffffff20] group-hover:border-[#eab308] transition-colors"
                  />
                  <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-[#0d0d0d] border border-[#eab30850] text-[10px] font-bold text-[#eab308] flex items-center justify-center">
                    #{student.rank}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-1">
                    <h4 className="font-bold text-white text-sm group-hover:text-[#eab308] transition-colors">
                      {student.name}
                    </h4>
                    {student.verified && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#eab308]" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">{student.institution}</p>
                  <p className="text-[11px] text-zinc-500 font-mono">{student.votes.toLocaleString()} votos</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleVote(e, student.id)}
                  className={`p-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    hasVoted
                      ? 'bg-[#eab308] text-black shadow-md'
                      : 'bg-transparent text-[#eab308] border border-[#eab30850] hover:bg-[#eab30810]'
                  }`}
                  aria-label="Votar por alumno"
                >
                  <Star className={`w-4 h-4 ${hasVoted ? 'fill-black' : ''}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

