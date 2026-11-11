import { useLanguage } from '@/src/context/LanguageContext';
'use client';

import React, { useState, useEffect } from 'react';
import { Bookmark, Sparkles, Loader2, Layers, Lock } from 'lucide-react';
import { UserPublication, getUserSavedPublications } from '@/src/lib/publications';
import PublicationCard from './PublicationCard';
import PrivacyLockButton from './PrivacyLockButton';

interface UserSavedPublicationsViewProps {
  userUid: string;
  isOwnProfile?: boolean;
  savedMode?: 'solo_yo' | 'todos' | null;
  onUpdateSavedMode?: (newMode: 'solo_yo' | 'todos') => void;
}

export default function UserSavedPublicationsView({ 
  userUid,
  isOwnProfile = true,
  savedMode = 'solo_yo',
  onUpdateSavedMode
}: UserSavedPublicationsViewProps) {
  const { t } = useLanguage();
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
          {t('saved.loading', 'Cargando tus publicaciones guardadas...')}
        </p>
      </div>
    );
  }

  // Si no es el dueño y está configurado en "solo_yo" (privado)
  if (!isOwnProfile && (savedMode === 'solo_yo' || !savedMode)) {
    return (
      <div className="p-10 sm:p-14 rounded-3xl bg-[#0b0b0e] border border-zinc-800/80 text-center space-y-3 max-w-3xl mx-auto w-full shadow-xl animate-in fade-in duration-300">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
          <Lock className="w-6 h-6 text-amber-400" />
        </div>
        <h4 className="text-base font-bold text-white uppercase tracking-wider">
          Colección de Guardados Privada
        </h4>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          Este usuario mantiene sus publicaciones guardadas en modo privado (Solo yo).
        </p>
      </div>
    );
  }

  if (savedPublications.length === 0) {
    return (
      <div className="relative p-10 sm:p-14 rounded-3xl bg-[#0b0b0e] border border-zinc-800/80 text-center space-y-4 max-w-3xl mx-auto w-full shadow-xl animate-in fade-in duration-300">
        {/* Candado de Privacidad en la esquina superior derecha */}
        {isOwnProfile && onUpdateSavedMode && (
          <div className="absolute top-4 right-4">
            <PrivacyLockButton
              mode={savedMode || 'solo_yo'}
              onChange={onUpdateSavedMode}
              label="Guardados"
            />
          </div>
        )}

        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-md">
          <Bookmark className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h4 className="text-lg font-black text-white uppercase tracking-tight">
            {t('saved.empty_title', 'No tienes publicaciones guardadas')}
          </h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            {t('saved.empty_desc', 'Cuando veas una foto o publicación que te guste en el campus, toca el ícono de marcador (guardar) y se guardará aquí en tu colección personal.')}
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
            {t('saved.title', 'PUBLICACIONES GUARDADAS')} ({savedPublications.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isOwnProfile && onUpdateSavedMode && (
            <PrivacyLockButton
              mode={savedMode || 'solo_yo'}
              onChange={onUpdateSavedMode}
              label="Guardados"
            />
          )}
        </div>
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

