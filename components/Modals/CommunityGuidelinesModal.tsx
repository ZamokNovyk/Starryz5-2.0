import React from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  HeartHandshake, 
  Lock, 
  X 
} from 'lucide-react';

interface CommunityGuidelinesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommunityGuidelinesModal({
  isOpen,
  onClose
}: CommunityGuidelinesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-[#0e0e11] border border-zinc-800 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[90vh] text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-[#14151a]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                Normas de la Comunidad
              </h2>
              <p className="text-[11px] text-zinc-400 font-medium">
                Reglas y principios de convivencia en Starryz 5
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Mensaje de bienvenida / contexto */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 text-zinc-300 text-xs leading-relaxed">
            <span className="font-bold text-amber-400 block mb-1">🌟 Compromiso con el respeto y la libertad</span>
            Starryz 5 es un espacio universitario y estudiantil creado para calificar, opinar, confesar y conectar con total autenticidad. Para mantener una comunidad sana, segura y divertida, todos los miembros deben seguir estas pautas:
          </div>

          {/* Sección: Lo que SÍ puedes hacer */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Lo que SÍ puedes hacer (Permitido)</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-[#131418] border border-emerald-500/20 space-y-1">
                <span className="font-bold text-white text-xs block">✅ Reseñas Constructivas</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Evaluar metodologías de enseñanza, puntualidad, claridad y trato con respeto y sinceridad.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#131418] border border-emerald-500/20 space-y-1">
                <span className="font-bold text-white text-xs block">✅ Confesiones con Respeto</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Compartir anécdotas, historias divertidas o desahogos del campus sin difamar a terceros.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#131418] border border-emerald-500/20 space-y-1">
                <span className="font-bold text-white text-xs block">✅ Interacciones Sanas</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Dar Crushes, Fan y "Yo te conozco" a tus profesores o compañeros como muestra de reconocimiento.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#131418] border border-emerald-500/20 space-y-1">
                <span className="font-bold text-white text-xs block">✅ Guardar Privacidad</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Puedes interactuar en anonimato para proteger tu identidad y expresarte sin presiones.
                </p>
              </div>
            </div>
          </div>

          {/* Sección: Lo que NO está permitido */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
              <XCircle className="w-4 h-4 text-rose-400" />
              <span>Lo que NO está permitido (Prohibido)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-[#131418] border border-rose-500/20 space-y-1">
                <span className="font-bold text-white text-xs block">❌ Acoso o Doxxing</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Prohibido publicar números telefónicos, direcciones, documentos o datos personales privados.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#131418] border border-rose-500/20 space-y-1">
                <span className="font-bold text-white text-xs block">❌ Insultos o Discurso de Odio</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Cero tolerancia a ataques por motivos de raza, género, religión, orientación sexual o discapacidad.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#131418] border border-rose-500/20 space-y-1">
                <span className="font-bold text-white text-xs block">❌ Spam o Publicidad No Autorizada</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  No se permite la venta de exámenes, enlaces maliciosos, estafas ni promoción comercial masiva.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#131418] border border-rose-500/20 space-y-1">
                <span className="font-bold text-white text-xs block">❌ Suplantación de Identidad</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Hacerse pasar maliciosamente por docentes, autoridades o compañeros está sancionado con baneo.
                </p>
              </div>
            </div>
          </div>

          {/* Moderación Comunitaria y Apoyo */}
          <div className="p-4 rounded-xl bg-[#16171d] border border-zinc-800 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <HeartHandshake className="w-4 h-4" />
              <span>Convivencia y Cuidado Mutuo</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Starryz 5 es un proyecto independiente hecho con dedicación para la comunidad estudiantil. La plataforma se mantiene sana gracias a la colaboración de todos: si ves algún comentario irrespetuoso o que cruce la línea, repórtalo para poder retirarlo y mantener un espacio libre de toxicidad.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800/80 bg-[#14151a] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Lock className="w-3.5 h-3.5 text-amber-500/60" />
            <span>Comunidad Segura Starryz 5</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
