'use client';

import React from 'react';
import { Lock, ArrowLeft } from 'lucide-react';

interface PrivacyPolicyPageProps {
  onBack?: () => void;
}

export default function PrivacyPolicyPage({ onBack }: PrivacyPolicyPageProps) {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-black uppercase tracking-wider border border-emerald-500/20">
            <Lock className="w-4 h-4" />
            <span>Privacidad y Protección de Datos</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Política de Privacidad
          </h1>
          <p className="text-xs text-zinc-500 font-mono">
            Última actualización: Noviembre 2026
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm leading-relaxed text-zinc-400">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              1. Información que Recopilamos
            </h2>
            <p>
              En <strong className="text-white">STARRYZ 5</strong> nos tomamos muy en serio la privacidad de nuestra comunidad estudiantil. La información que recopilamos incluye:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                <strong className="text-zinc-200">Datos proporcionados por Google OAuth:</strong> Al hacer clic en <em className="text-white">"Continuar con Google"</em>, nos autorizas a recibir tu nombre de usuario público, correo electrónico (@gmail.com) y foto de perfil.
              </li>
              <li>
                <strong className="text-zinc-200">Datos de Verificación Institucional:</strong> Al reclamar un perfil en el padrón, procesamos tu correo institucional (por ejemplo, <code className="text-[#eab308] bg-zinc-900 px-1.5 py-0.5 rounded">8765432@iesppuchiza.edu.pe</code>) únicamente para validar la autenticidad del estudiante mediante un código temporal OTP.
              </li>
              <li>
                <strong className="text-zinc-200">Contenido Generado por el Usuario:</strong> Calificaciones en estrellas, publicaciones, comentarios, me gusta y confesiones anónimas.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              2. Eliminación de Datos Sensibles (No uso de DNI)
            </h2>
            <p>
              STARRYZ 5 <strong className="text-white">NO recopila, almacena ni procesa números de DNI</strong> ni documentos de identidad gubernamentales. La verificación de perfiles se realiza exclusivamente mediante validación de correos institucionales para proteger la identidad y privacidad legal de los estudiantes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              3. Uso de la Información
            </h2>
            <p>Utilizamos tus datos únicamente para:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>Permitirte iniciar sesión y mantener tu perfil en la plataforma.</li>
              <li>Mostrar tu nombre y foto en las publicaciones y comentarios que realices voluntariamente.</li>
              <li>Enviar notificaciones de la aplicación y códigos de verificación transaccionales.</li>
              <li>Proteger la plataforma contra accesos fraudulentos o suplantación de perfiles.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              4. Confidencialidad y Terceros
            </h2>
            <p>
              <strong className="text-white">No vendemos, alquilamos ni comercializamos tus datos personales.</strong> Únicamente empleamos servicios de infraestructura tecnológica seguros (Google Firebase, Supabase y servicios de correo transaccional Brevo) estrictamente necesarios para el funcionamiento del sistema.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              5. Derechos del Usuario
            </h2>
            <p>
              Puedes solicitar la eliminación de tu cuenta o de tus publicaciones en cualquier momento comunicándote con la administración del sitio o desde la configuración de tu perfil.
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

