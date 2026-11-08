'use client';

import React from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/src/context/LanguageContext';
import { dictionaries } from '@/src/locales';

interface TermsOfServicePageProps {
  onBack?: () => void;
}

export default function TermsOfServicePage({ onBack }: TermsOfServicePageProps) {
  const { language } = useLanguage();
  const dict = dictionaries[language] || dictionaries.es;
  const doc = dict.legal_terms || dictionaries.es.legal_terms;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.pushState(null, '', '/');
      window.dispatchEvent(new Event('popstate'));
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-300 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8 bg-[#0e0f14] border border-[#23242d] rounded-3xl p-6 sm:p-10 shadow-2xl">
        
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-[#eab308] transition-colors cursor-pointer uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{doc.back}</span>
        </button>

        {/* Header */}
        <div className="space-y-3 border-b border-[#23242d] pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eab308]/10 text-[#eab308] text-xs font-black uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{doc.badge}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            {doc.title}
          </h1>
          <p className="text-xs text-zinc-500 font-mono">
            {doc.updated}
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
          {doc.sections.map((sec: any, idx: number) => (
            <section key={idx} className="space-y-2">
              <h2 className="text-base font-bold text-white uppercase tracking-wide">
                {sec.title}
              </h2>
              <p className="text-zinc-400 whitespace-pre-line leading-relaxed">
                {sec.content}
              </p>
            </section>
          ))}
        </div>

        {/* Footer info */}
        <div className="pt-6 border-t border-[#23242d] flex justify-between items-center text-xs text-zinc-500 font-mono">
          <span>STARRYZ 5 • CAMPUS COMMUNITY</span>
          <button
            onClick={handleBack}
            className="text-[#eab308] hover:underline cursor-pointer"
          >
            {doc.back}
          </button>
        </div>

      </div>
    </div>
  );
}
