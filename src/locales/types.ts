import React, { createContext, useContext, useState, useEffect } from 'react';

export type LanguageCode =
  | 'es' | 'en' | 'zh' | 'hi' | 'ar' | 'fr' | 'bn' | 'pt' | 'id' | 'ur'
  | 'ru' | 'de' | 'ja' | 'mr' | 'vi' | 'te' | 'sw' | 'tr' | 'ha' | 'tl'
  | 'ko' | 'ta' | 'yue' | 'mwr' | 'it' | 'wuu' | 'bho' | 'fa' | 'mey' | 'hak';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  rtl: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  // 10 Iniciales
  { code: 'es', name: 'Español', nativeName: 'Español', flag: '🇪🇸', rtl: false },
  { code: 'en', name: 'Inglés', nativeName: 'English', flag: '🇺🇸', rtl: false },
  { code: 'zh', name: 'Chino Mandarín', nativeName: '中文 (简体)', flag: '🇨🇳', rtl: false },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', rtl: false },
  { code: 'ar', name: 'Árabe', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'fr', name: 'Francés', nativeName: 'Français', flag: '🇫🇷', rtl: false },
  { code: 'bn', name: 'Bengalí', nativeName: 'বাংলা', flag: '🇧🇩', rtl: false },
  { code: 'pt', name: 'Portugués', nativeName: 'Português', flag: '🇧🇷', rtl: false },
  { code: 'id', name: 'Indonesio', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', rtl: false },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', rtl: true },
  // 10 Segundos
  { code: 'ru', name: 'Ruso', nativeName: 'Русский', flag: '🇷🇺', rtl: false },
  { code: 'de', name: 'Alemán', nativeName: 'Deutsch', flag: '🇩🇪', rtl: false },
  { code: 'ja', name: 'Japonés', nativeName: '日本語', flag: '🇯🇵', rtl: false },
  { code: 'mr', name: 'Maratí', nativeName: 'मराठी', flag: '🇮🇳', rtl: false },
  { code: 'vi', name: 'Vietnamita', nativeName: 'Tiếng Việt', flag: '🇻🇳', rtl: false },
  { code: 'te', name: 'Telugú', nativeName: 'తెలుగు', flag: '🇮🇳', rtl: false },
  { code: 'sw', name: 'Suajili', nativeName: 'Kiswahili', flag: '🇰🇪', rtl: false },
  { code: 'tr', name: 'Turco', nativeName: 'Türkçe', flag: '🇹🇷', rtl: false },
  { code: 'ha', name: 'Hausa', nativeName: 'Harshen Hausa', flag: '🇳🇬', rtl: false },
  { code: 'tl', name: 'Tagalo / Filipino', nativeName: 'Tagalog / Filipino', flag: '🇵🇭', rtl: false },
  // 10 Nuevos
  { code: 'ko', name: 'Coreano', nativeName: '한국어', flag: '🇰🇷', rtl: false },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', rtl: false },
  { code: 'yue', name: 'Cantonés', nativeName: '粵語 / 廣東話', flag: '🇭🇰', rtl: false },
  { code: 'mwr', name: 'Marwari', nativeName: 'मारवाड़ी', flag: '🇮🇳', rtl: false },
  { code: 'it', name: 'Italiano', nativeName: 'Italiano', flag: '🇮🇹', rtl: false },
  { code: 'wuu', name: 'Wu', nativeName: '吴语 / 上海话', flag: '🇨🇳', rtl: false },
  { code: 'bho', name: 'Bhojpuri', nativeName: 'भोजपुरी', flag: '🇮🇳', rtl: false },
  { code: 'fa', name: 'Persa / Farsi', nativeName: 'فارسی', flag: '🇮🇷', rtl: true },
  { code: 'mey', name: 'Hassaniya', nativeName: 'الحسانية', flag: '🇲🇷', rtl: true },
  { code: 'hak', name: 'Hakka', nativeName: '客家话', flag: '🇨🇳', rtl: false },
];

export interface LegalSection {
  title: string;
  content: string;
}

export interface LegalDocument {
  title: string;
  badge: string;
  updated: string;
  back: string;
  sections: LegalSection[];
}

export interface TranslationDictionary {
  [key: string]: any;
  legal_terms?: LegalDocument;
  legal_privacy?: LegalDocument;
}

export interface LanguageContextType {
  language: LanguageCode;
  languageInfo: LanguageInfo;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
  isRtl: boolean;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
