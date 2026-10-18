import React from 'react';

export type GenderType = 'male' | 'female' | 'hombre' | 'HOMBRE' | 'mujer' | 'MUJER' | string | null | undefined;

export function normalizeGender(gender?: GenderType): 'male' | 'female' | null {
  if (!gender) return null;
  const g = String(gender).trim().toLowerCase();
  if (g === 'male' || g === 'hombre' || g === 'masculino' || g === 'm' || g === 'varon' || g === 'varón' || g === 'chico') return 'male';
  if (g === 'female' || g === 'mujer' || g === 'femenino' || g === 'f' || g === 'chica' || g === 'dama') return 'female';
  return null;
}

interface GenderBadgeProps {
  gender?: GenderType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function GenderBadge({ gender, className = '', size = 'md' }: GenderBadgeProps) {
  const normalized = normalizeGender(gender);
  if (!normalized) return null;

  const isMale = normalized === 'male';

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm font-black',
    lg: 'text-base font-black',
  }[size];

  if (isMale) {
    return (
      <span
        className={`inline-flex items-center justify-center text-blue-400 select-none shrink-0 transition-transform ${sizeClasses} ${className}`}
        title="Hombre ♂"
        aria-label="Hombre ♂"
      >
        ♂
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center text-pink-400 select-none shrink-0 transition-transform ${sizeClasses} ${className}`}
      title="Mujer ♀"
      aria-label="Mujer ♀"
    >
      ♀
    </span>
  );
}
