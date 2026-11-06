'use client';

import React from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

interface TermsOfServicePageProps {
  onBack?: () => void;
}

export default function TermsOfServicePage({ onBack }: TermsOfServicePageProps) {
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
          <span>Volver</span>
        </button>

        {/* Header */}
        <div className="border-b border-zinc-800 pb-6 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eab308]/10 text-[#eab308] text-xs font-black uppercase tracking-wider border border-[#eab308]/20">
            <ShieldCheck className="w-4 h-4" />
            <span>Condiciones Legales</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Términos de Servicio
          </h1>
          <p className="text-xs text-zinc-500 font-mono">
            Última actualización: Noviembre 2026
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm leading-relaxed text-zinc-400">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              1. Aceptación de los Términos
            </h2>
            <p>
              Al acceder, navegar o utilizar la plataforma <strong className="text-white">STARRYZ 5</strong> e iniciar sesión mediante Google o en modo anónimo, reconoces que has leído, comprendido y aceptado en su totalidad estos Términos de Servicio.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              2. Propósito de la Plataforma
            </h2>
            <p>
              STARRYZ 5 es una red social y comunitaria estudiantil diseñada para conectar a estudiantes e instituciones educativas, facilitando la interacción comunitaria, calificaciones de perfil, muro de publicaciones, confesiones anónimas moderadas y herramientas educativas.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              3. Registro y Uso de Cuentas
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Inicio con Google:</strong> Al autenticarte con tu cuenta de Google, autorizas a STARRYZ 5 a obtener tu nombre visible, dirección de correo electrónico y fotografía de perfil para generar tu identidad de usuario.
              </li>
              <li>
                <strong className="text-zinc-200">Acceso Anónimo:</strong> Te permite explorar y participar temporalmente. Las acciones se vinculan localmente a tu navegador.
              </li>
              <li>
                <strong className="text-zinc-200">Reclamo de Perfil Institucional:</strong> Los perfiles preexistentes creados en el padrón educativo oficial requieren validación mediante código OTP enviado al correo institucional correspondiente. Cada usuario solo puede reclamar un único perfil oficial.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              4. Normas de Conducta y Publicaciones
            </h2>
            <p>
              Queda estrictamente prohibido utilizar la plataforma para:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>Publicar o difundir información personal privada (DNI, números telefónicos privados, direcciones físicas o contenido confidencial no autorizado).</li>
              <li>Incurrir en acoso, difamación, amenazas, intimidación o discurso de odio contra otros estudiantes, docentes o miembros de la institución.</li>
              <li>Subir contenido pornográfico, obsceno, ilegal o que infrinja los derechos de autor de terceros.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              5. Moderación y Suspensión
            </h2>
            <p>
              El equipo de administración de STARRYZ 5 se reserva el derecho de eliminar cualquier publicación, comentario, reseña o suspender cuentas que incumplan estas normas de convivencia comunitaria.
            </p>
          </section>
        </div>

        {/* Footer actions */}
        <div className="pt-6 border-t border-zinc-800 text-center">
          <button
            onClick={handleBack}
            className="px-6 py-2.5 rounded-xl bg-[#eab308] hover:bg-[#d9a307] text-black font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Entendido y Volver
          </button>
        </div>

      </div>
    </div>
  );
}

