'use client';

import React, { useState, useEffect } from 'react';
import { Bookmark, Sparkles, Loader2, Layers } from 'lucide-react';
import { UserPublication, getUserSavedPublications } from '@/src/lib/publications';
import PublicationCard from './PublicationCard';

interface UserSavedPublicationsViewProps {
  userUid: string;
}

export default function UserSavedPublicationsView({ userUid }: UserSavedPublicationsViewProps) {
  const [savedPublications, setSavedPublications] = useState<UserPublication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userUid) {
      setLoading(false);
      return;
    }

    async function loadSaved() {
      try {
        setLoading(true);
        const data = await getUserSavedPublications(userUid);
        setSavedPublications(data);
      } catch (err) {
        console.warn('Error al cargar publicaciones guardadas:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSaved();
  }, [userUid]);

  const handleSavedPublicationDelete = (id: string) => {
    setSavedPublications((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) {
    return (
      <div className="py-16 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#eab308] animate-spin mx-auto" />
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Cargando tus publicaciones guardadas...
        </p>
      </div>
    );
  }

  if (savedPublications.length === 0) {
    return (
      <div className="p-10 sm:p-14 rounded-3xl bg-[#0b0b0e] border border-zinc-800/80 text-center space-y-4 max-w-2xl mx-auto shadow-xl animate-in fade-in duration-300">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-md">
          <Bookmark className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h4 className="text-lg font-black text-white uppercase tracking-tight">
            No tienes publicaciones guardadas
          </h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Cuando veas una foto o publicación que te guste en el campus, toca el ícono de marcador (guardar) y se guardará aquí en tu colección personal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-amber-400 fill-amber-400" />
          <h3 className="text-base font-black text-white uppercase tracking-wider">
            Tus Publicaciones Guardadas ({savedPublications.length})
          </h3>
        </div>
        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
          Colección privada
        </span>
      </div>

      <div className="space-y-6">
        {savedPublications.map((pub) => (
          <PublicationCard
            key={pub.id}
            publication={pub}
            currentUserId={userUid}
            isOwner={pub.user_id === userUid}
            onDelete={handleSavedPublicationDelete}
          />
        ))}
      </div>
    </div>
  );
}

