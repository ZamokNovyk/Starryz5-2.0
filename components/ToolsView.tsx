'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  ArrowLeft,
  FileText,
  ExternalLink,
  Layers,
  ChevronRight,
  Maximize2,
  Lock,
  Plus,
  Scissors,
  Disc,
  Users,
  FileCheck2
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';

interface ToolsViewProps {
  onBack: () => void;
  onNavigate: (url: string) => void;
}

interface WindowTool {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  brandColor: string;
  buttonGradient?: string;
  isAvailable: boolean;
  isExternal?: boolean;
  icon: React.ReactNode;
}

export default function ToolsView({ onBack, onNavigate }: ToolsViewProps) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(true);

  // Check admin role
  useEffect(() => {
    async function checkRole() {
      if (!user) {
        setIsAdmin(false);
        setLoadingCheck(false);
        return;
      }
      try {
        let query = supabase.from('users').select('role');
        if (user.email) {
          query = query.eq('email', user.email);
        } else {
          query = query.eq('id', user.uid);
        }
        const { data, error } = await query.maybeSingle();
        if (!error && data && data.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error checking admin role in ToolsView:', err);
        setIsAdmin(false);
      } finally {
        setLoadingCheck(false);
      }
    }
    checkRole();
  }, [user]);

  // List of Window Tools
  const tools: WindowTool[] = [
    {
      id: 'organizador-pdf',
      title: 'Organizador de PDF',
      description: 'Combina, organiza, rota, extrae y añade hojas en blanco a tus documentos PDF estilo Canva.',
      category: 'Edición & Organización',
      url: '/herramientas/organizadorpdf',
      brandColor: 'from-[#7d2ae8] to-[#00c4cc]',
      buttonGradient: 'bg-gradient-to-r from-[#7d2ae8] to-[#00c4cc] shadow-[0_4px_16px_rgba(125,42,232,0.25)]',
      isAvailable: true,
      isExternal: false,
      icon: <Layers className="w-8 h-8 text-white" />
    },
    {
      id: 'dividir-pdf',
      title: 'Dividir PDF',
      description: 'Separa por rangos de páginas personalizados, extrae hojas individuales o divide en bloques de tamaño fijo.',
      category: 'Corte & Extracción',
      url: '/herramientas/dividirpdf',
      brandColor: 'from-[#e11d48] to-[#f59e0b]',
      buttonGradient: 'bg-gradient-to-r from-[#e11d48] to-[#be123c] shadow-[0_4px_16px_rgba(225,29,72,0.25)]',
      isAvailable: true,
      isExternal: false,
      icon: <Scissors className="w-8 h-8 text-white" />
    },
    {
      id: 'ruleta',
      title: 'Ruleta de Nombres',
      description: 'Sorteos y selecciones aleatorias en vivo para participación en clase o dinámicas de grupo.',
      category: 'Dinámicas & Sorteos',
      url: '/herramientas/ruleta',
      brandColor: 'from-[#6366F1] to-[#EC4899]',
      buttonGradient: 'bg-gradient-to-r from-[#6366F1] to-[#EC4899] shadow-[0_4px_16px_rgba(99,102,241,0.25)]',
      isAvailable: true,
      isExternal: false,
      icon: <Disc className="w-8 h-8 text-white" />
    },
    {
      id: 'formador-grupos',
      title: 'Formador de Grupos',
      description: 'Generador de equipos y grupos aleatorios por número total de grupos o por integrantes.',
      category: 'Dinámicas & Equipos',
      url: '/herramientas/grupos',
      brandColor: 'from-[#6366F1] via-[#8B5CF6] to-[#EC4899]',
      buttonGradient: 'bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#EC4899] shadow-[0_4px_16px_rgba(99,102,241,0.25)]',
      isAvailable: true,
      isExternal: false,
      icon: <Users className="w-8 h-8 text-white" />
    },
    {
      id: 'word-to-pdf',
      title: 'Convertidor Word a PDF',
      description: 'Convierte tus documentos .docx a archivos PDF de forma rápida, precisa y con el formato intacto.',
      category: 'Conversión de Archivos',
      url: 'https://www.ilovepdf.com/word_to_pdf',
      brandColor: 'from-[#e11d48] to-[#be123c]', // iLovePDF theme reddish
      isAvailable: true,
      isExternal: true,
      icon: <FileText className="w-8 h-8 text-white" />
    },
    {
      id: 'compresor-pdf',
      title: 'Compresor de PDF',
      description: 'Reduce el tamaño y peso de tus documentos PDF con algoritmo de compresión 100% local, seguro y sin límites.',
      category: 'Optimización de Archivos',
      url: '/herramientas/comprimirpdf',
      brandColor: 'from-[#2563eb] to-[#10b981]',
      buttonGradient: 'bg-gradient-to-r from-[#2563eb] to-[#0d9488] shadow-[0_4px_16px_rgba(37,99,235,0.25)]',
      isAvailable: true,
      isExternal: false,
      icon: <FileCheck2 className="w-8 h-8 text-white" />
    }
  ];

  if (loadingCheck) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-32 text-center space-y-6 px-4">
        <div className="text-rose-500 font-black text-2xl uppercase tracking-wider">Acceso Restringido</div>
        <p className="text-zinc-400 text-xs leading-relaxed">
          Esta sección de herramientas escolares y utilidades exclusivas está disponible únicamente para usuarios administradores de Starryz 5.
        </p>
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(234,179,8,0.2)]"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-10 animate-in fade-in duration-200">
      
      {/* Header section with back button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-[#eab308]/60 transition-colors cursor-pointer flex items-center justify-center"
            title="Volver al inicio"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-[#eab308] uppercase tracking-widest block">Acceso Admin</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight mt-0.5">
              VENTANAS DE HERRAMIENTAS
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-bold bg-zinc-900/40 border border-zinc-800/80 px-3 py-1.5 rounded-lg">
          <Sparkles className="w-3.5 h-3.5 text-[#eab308]" />
          <span>Colección de utilidades directas de estudio</span>
        </div>
      </div>

      {/* Grid of Tools ("Ventanas") */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <div 
            key={tool.id} 
            className={`relative group bg-[#0a0a0c] border rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 ${
              tool.isAvailable 
                ? 'border-zinc-800 hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(234,179,8,0.06)] hover:-translate-y-1' 
                : 'border-zinc-900/60 opacity-60'
            }`}
          >
            {/* Window header representing a browser style */}
            <div className="bg-[#0e0e11] px-4 py-2.5 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${tool.isAvailable ? 'bg-rose-500/80' : 'bg-zinc-800'}`}></span>
                <span className={`w-2.5 h-2.5 rounded-full ${tool.isAvailable ? 'bg-amber-500/80' : 'bg-zinc-800'}`}></span>
                <span className={`w-2.5 h-2.5 rounded-full ${tool.isAvailable ? 'bg-emerald-500/80' : 'bg-zinc-800'}`}></span>
              </div>
              <span className="text-[9px] font-black tracking-widest text-zinc-600 uppercase">
                {tool.category}
              </span>
            </div>

            {/* Window Body */}
            <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
              
              <div className="space-y-4">
                {/* Brand Visual Window */}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${tool.brandColor} flex items-center justify-center shadow-lg`}>
                  {tool.icon}
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-black text-white group-hover:text-amber-400 transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-zinc-400 text-xs leading-relaxed font-medium">
                    {tool.description}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              {tool.isAvailable ? (
                tool.isExternal ? (
                  <a 
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-[#eab308] hover:bg-white text-black font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_4px_12px_rgba(234,179,8,0.1)]"
                  >
                    <span>Abrir Ventana</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <button 
                    onClick={() => onNavigate(tool.url)}
                    className={`w-full py-3 ${tool.buttonGradient || 'bg-gradient-to-r from-[#7d2ae8] to-[#00c4cc] shadow-[0_4px_16px_rgba(125,42,232,0.25)]'} hover:opacity-90 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer`}
                  >
                    <span>Abrir Ventana</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )
              ) : (
                <button 
                  disabled
                  className="w-full py-3 bg-zinc-900/60 border border-zinc-800 text-zinc-500 font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <span>Bloqueado</span>
                  <Lock className="w-3.5 h-3.5" />
                </button>
              )}

            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
