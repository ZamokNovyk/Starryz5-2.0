/**
 * Servicio para envío de correos transaccionales a través de la API REST de Brevo.
 * Remitente oficial: starryz5.iesppu@gmail.com
 */

const BREVO_API_KEY = (import.meta as any).env?.VITE_BREVO_API_KEY || '';
const SENDER_EMAIL = 'starryz5.iesppu@gmail.com';
const SENDER_NAME = 'Starryz 5 (ISPPU)';

export interface SendOtpEmailParams {
  toEmail: string;
  recipientName: string;
  otpCode: string;
  role: 'estudiante' | 'profesor';
}

export async function sendOtpEmailBrevo({
  toEmail,
  recipientName,
  otpCode,
  role
}: SendOtpEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const roleText = role === 'profesor' ? 'profesor(a)' : 'estudiante';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0c10; color: #ffffff; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background-color: #14151b; border: 1px solid #282a36; border-radius: 16px; padding: 32px 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .logo { text-align: center; margin-bottom: 24px; }
          .logo-text { font-size: 24px; font-weight: 800; color: #f59e0b; letter-spacing: 1px; }
          h2 { color: #f3f4f6; font-size: 20px; margin-top: 0; text-align: center; }
          p { color: #9ca3af; font-size: 15px; line-height: 1.6; }
          .code-box { background: linear-gradient(135deg, #1f2937 0%, #111827 100%); border: 2px dashed #f59e0b; border-radius: 12px; padding: 18px; text-align: center; margin: 28px 0; }
          .code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #fbbf24; font-family: monospace; }
          .footer { font-size: 12px; color: #6b7280; text-align: center; margin-top: 28px; border-top: 1px solid #1f2937; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <span class="logo-text">★ STARRYZ 5</span>
          </div>
          <h2>Código de Verificación</h2>
          <p>Hola <strong>${recipientName}</strong>,</p>
          <p>Has solicitado reclamar y verificar tu perfil de <strong>${roleText}</strong> en la plataforma del Instituto de Educación Superior Pedagógico Público de Uchiza (ISPPU).</p>
          
          <div class="code-box">
            <div class="code">${otpCode}</div>
          </div>
          
          <p style="text-align: center; font-size: 13px; color: #9ca3af;">
            Este código vencerá en <strong>10 minutos</strong>.<br>
            Si tú no solicitaste este código, puedes ignorar este mensaje con seguridad.
          </p>
          
          <div class="footer">
            IESPP Uchiza &bull; Sistema Oficial de Reclamo Starryz 5
          </div>
        </div>
      </body>
      </html>
    `;

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL,
        },
        to: [
          {
            email: toEmail,
            name: recipientName,
          },
        ],
        subject: `${otpCode} es tu código de verificación para Starryz 5 (ISPPU)`,
        htmlContent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error al enviar correo con Brevo:', data);
      return {
        success: false,
        error: data?.message || 'No se pudo enviar el correo de verificación. Intenta nuevamente.',
      };
    }

    return {
      success: true,
      messageId: data?.messageId,
    };
  } catch (err: any) {
    console.error('Excepción al conectar con Brevo:', err);
    return {
      success: false,
      error: err?.message || 'Error de conexión con el servicio de correos.',
    };
  }
}
