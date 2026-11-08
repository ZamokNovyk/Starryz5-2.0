'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  LanguageCode, 
  LanguageInfo, 
  SUPPORTED_LANGUAGES, 
  dictionaries, 
  LanguageContextType,
  LanguageContext 
} from '../locales';

function detectBrowserLanguage(): LanguageCode {
  if (typeof window === 'undefined' || !navigator.language) {
    return 'es';
  }

  const browserLang = navigator.language.toLowerCase();
  
  // Coincidencias exactas o de prefijo (30 idiomas)
  if (browserLang.startsWith('en')) return 'en';
  if (browserLang.startsWith('zh-hk') || browserLang.startsWith('zh-mo') || browserLang.startsWith('yue')) return 'yue';
  if (browserLang.startsWith('zh')) return 'zh';
  if (browserLang.startsWith('hi')) return 'hi';
  if (browserLang.startsWith('ar')) return 'ar';
  if (browserLang.startsWith('fr')) return 'fr';
  if (browserLang.startsWith('bn')) return 'bn';
  if (browserLang.startsWith('pt')) return 'pt';
  if (browserLang.startsWith('id')) return 'id';
  if (browserLang.startsWith('ur')) return 'ur';
  if (browserLang.startsWith('ru')) return 'ru';
  if (browserLang.startsWith('de')) return 'de';
  if (browserLang.startsWith('ja')) return 'ja';
  if (browserLang.startsWith('mr')) return 'mr';
  if (browserLang.startsWith('vi')) return 'vi';
  if (browserLang.startsWith('te')) return 'te';
  if (browserLang.startsWith('sw')) return 'sw';
  if (browserLang.startsWith('tr')) return 'tr';
  if (browserLang.startsWith('ha')) return 'ha';
  if (browserLang.startsWith('tl') || browserLang.startsWith('fil')) return 'tl';
  if (browserLang.startsWith('ko')) return 'ko';
  if (browserLang.startsWith('ta')) return 'ta';
  if (browserLang.startsWith('it')) return 'it';
  if (browserLang.startsWith('fa')) return 'fa';
  if (browserLang.startsWith('bho')) return 'bho';
  if (browserLang.startsWith('mwr')) return 'mwr';
  if (browserLang.startsWith('wuu')) return 'wuu';
  if (browserLang.startsWith('hak')) return 'hak';
  if (browserLang.startsWith('mey')) return 'mey';
  if (browserLang.startsWith('es')) return 'es';

  return 'es'; // Idioma por defecto
}

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('starryz_language') as LanguageCode;
      if (saved && dictionaries[saved]) {
        return saved;
      }
      return detectBrowserLanguage();
    }
    return 'es';
  });

  const languageInfo = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const setLanguage = (newLang: LanguageCode) => {
    if (dictionaries[newLang]) {
      setLanguageState(newLang);
      if (typeof window !== 'undefined') {
        localStorage.setItem('starryz_language', newLang);
      }
    }
  };

  // Efecto para aplicar RTL / LTR en la etiqueta html
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const htmlEl = document.documentElement;
      htmlEl.lang = language;
      if (languageInfo.rtl) {
        htmlEl.setAttribute('dir', 'rtl');
      } else {
        htmlEl.setAttribute('dir', 'ltr');
      }
    }
  }, [language, languageInfo.rtl]);

  // Función de traducción
  const t = (key: string, fallback?: string): string => {
    const currentDict = dictionaries[language];
    if (currentDict && currentDict[key]) {
      return currentDict[key];
    }
    // Fallback a español si no está en el idioma actual
    const fallbackDict = dictionaries.es;
    if (fallbackDict && fallbackDict[key]) {
      return fallbackDict[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        languageInfo,
        setLanguage,
        t,
        isRtl: languageInfo.rtl,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export { useLanguage, SUPPORTED_LANGUAGES } from '../locales';
export type { LanguageCode, LanguageInfo } from '../locales';

