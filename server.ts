import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Cargar variables de entorno locales desde .env de forma segura
dotenv.config();

const B2_KEY_ID = process.env.B2_KEY_ID || '';
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY || '';
const B2_BUCKET_ID = process.env.B2_BUCKET_ID || '';
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || 'starryz5';

// Cache B2 auth token in memory
let cachedAuth: {
  apiUrl: string;
  downloadUrl: string;
  token: string;
  expiresAt: number;
} | null = null;

async function getB2Auth(forceRefresh = false) {
  if (!B2_KEY_ID || !B2_APPLICATION_KEY) {
    throw new Error('Credenciales de Backblaze B2 no configuradas en las variables de entorno (B2_KEY_ID / B2_APPLICATION_KEY).');
  }

  if (!forceRefresh && cachedAuth && Date.now() < cachedAuth.expiresAt) {
    return cachedAuth;
  }

  const basicAuth = Buffer.from(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`).toString('base64');
  const res = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
    headers: { Authorization: `Basic ${basicAuth}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    cachedAuth = null;
    throw new Error(`B2 authorize failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const storage = data.apiInfo?.storageApi;
  if (!storage) {
    cachedAuth = null;
    throw new Error('Invalid storageApi in B2 authorize response');
  }

  cachedAuth = {
    apiUrl: storage.apiUrl,
    downloadUrl: storage.downloadUrl,
    token: data.authorizationToken,
    // Cache for 6 hours
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  };

  return cachedAuth;
}

/**
 * Valida el token de identidad OAuth (Google) si está presente
 */
async function verifyAuthToken(authHeader?: string): Promise<{ email?: string; valid: boolean }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false };
  }
  const token = authHeader.substring(7).trim();
  if (!token) return { valid: false };

  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const data = await res.json();
      return { email: data.email, valid: true };
    }
  } catch (err) {
    console.warn('Error verificando token de Google:', err);
  }
  return { valid: false };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Dominios autorizados para CORS
  const ALLOWED_ORIGIN_PATTERNS = [
    'https://starryz5.com',
    'https://www.starryz5.com',
    'https://media.starryz5.com',
    'localhost',
    '127.0.0.1',
    '.run.app',
    '.pages.dev'
  ];

  // CORS seguro con validación de origen
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    let allowed = false;

    if (!origin) {
      allowed = true;
    } else {
      allowed = ALLOWED_ORIGIN_PATTERNS.some(pattern => 
        pattern.startsWith('https://') ? origin === pattern : origin.includes(pattern)
      );
    }

    if (allowed && origin) {
      res.header('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      res.header('Access-Control-Allow-Origin', '*');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-User-Id');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Rate Limiting general para rutas API: Máximo 200 peticiones por ventana de 15 min por IP
  const generalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes al servidor. Por favor intenta más tarde.' },
  });
  app.use('/api/', generalApiLimiter);

  // Rate Limiting estricto para subida de fotos: Máximo 15 subidas cada 15 min por IP
  const uploadAvatarLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Límite de subidas de avatar alcanzado. Por favor espera unos minutos antes de volver a intentar.' },
  });

  // JSON payload parser para imágenes base64 (límite estricto de 2MB en body parser)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // POST /api/upload-avatar - Subida de avatar a Backblaze B2 con verificación de seguridad
  app.post('/api/upload-avatar', uploadAvatarLimiter, async (req, res) => {
    try {
      const { imageBase64, contentType, userId, userEmail, fileName: customFileName } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 es obligatorio' });
      }

      // Validar payload base64
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Validar límite estricto de peso: 105 KB máximo
      const sizeBytes = buffer.length;
      if (sizeBytes > 105 * 1024) {
        return res.status(400).json({ 
          error: `La imagen excede el límite máximo de 100 KB. Tamaño recibido: ${(sizeBytes / 1024).toFixed(1)} KB` 
        });
      }

      // Sanitizar userId para evitar ataques de inyección o path traversal
      const cleanUserId = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '');

      // Validación de identidad: si el usuario no es anónimo, verificar token de autenticación
      const authHeader = req.headers.authorization;
      const isAnonymousUser = cleanUserId.startsWith('anon_');

      if (!isAnonymousUser) {
        const authCheck = await verifyAuthToken(authHeader);
        // Si se envió un token, asegurarse de que el email coincide
        if (authCheck.valid && authCheck.email) {
          if (userEmail && authCheck.email.toLowerCase() !== userEmail.toLowerCase()) {
            return res.status(403).json({ error: 'Token de sesión no coincide con el usuario solicitado.' });
          }
        }
      }

      const mime = contentType || 'image/webp';
      const ext = mime.includes('webp') ? 'webp' : 'jpg';
      const timestamp = Date.now();
      const fileName = customFileName || `avatars/${cleanUserId}-${timestamp}.${ext}`;

      // 1. Autorizar con B2 (reintenta una vez si el token expiró)
      let auth;
      try {
        auth = await getB2Auth();
      } catch (authErr) {
        auth = await getB2Auth(true);
      }

      if (!B2_BUCKET_ID) {
        throw new Error('B2_BUCKET_ID no configurado en variables de entorno.');
      }

      // 2. Obtener URL de subida para el bucket
      let uploadUrlRes = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_url?bucketId=${B2_BUCKET_ID}`, {
        headers: { Authorization: auth.token }
      });

      if (uploadUrlRes.status === 401) {
        auth = await getB2Auth(true);
        uploadUrlRes = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_url?bucketId=${B2_BUCKET_ID}`, {
          headers: { Authorization: auth.token }
        });
      }

      if (!uploadUrlRes.ok) {
        const errText = await uploadUrlRes.text();
        throw new Error(`Failed to get B2 upload URL: ${errText}`);
      }

      const uploadUrlData = await uploadUrlRes.json();

      // 3. Subir archivo a Backblaze B2
      const uploadRes = await fetch(uploadUrlData.uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': uploadUrlData.authorizationToken,
          'X-Bz-File-Name': encodeURIComponent(fileName),
          'Content-Type': mime,
          'Content-Length': buffer.length.toString(),
          'X-Bz-Content-Sha1': 'do_not_verify'
        },
        body: buffer
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`B2 file upload failed (${uploadRes.status}): ${errText}`);
      }

      const uploadResult = await uploadRes.json();

      // 4. Limpieza automática de fotos viejas del usuario para ahorrar almacenamiento
      try {
        const prefix = `avatars/${cleanUserId}-`;
        const listRes = await fetch(
          `${auth.apiUrl}/b2api/v3/b2_list_file_names?bucketId=${B2_BUCKET_ID}&prefix=${encodeURIComponent(prefix)}&maxFileCount=20`,
          { headers: { Authorization: auth.token } }
        );

        if (listRes.ok) {
          const listData = await listRes.json();
          const oldFiles = (listData.files || []).filter(
            (f: any) => f.fileName !== fileName && f.fileId !== uploadResult.fileId
          );

          for (const old of oldFiles) {
            await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
              method: 'POST',
              headers: { 
                Authorization: auth.token, 
                'Content-Type': 'application/json' 
              },
              body: JSON.stringify({
                fileName: old.fileName,
                fileId: old.fileId,
              }),
            });
            console.log(`[Storage Cleanup] Foto anterior eliminada: ${old.fileName}`);
          }
        }
      } catch (cleanErr) {
        console.warn('[Storage Cleanup] Aviso no-bloqueante al purgar fotos viejas:', cleanErr);
      }

      // Public URL de la imagen subida (usa el dominio CDN de Cloudflare media.starryz5.com)
      let cdnDomain = process.env.PUBLIC_CDN_URL || process.env.VITE_CLOUDFLARE_CDN_URL || 'https://media.starryz5.com';
      if (cdnDomain.includes('cdn.starryz5.com')) {
        cdnDomain = 'https://media.starryz5.com';
      }
      const baseUrl = cdnDomain ? cdnDomain.replace(/\/$/, '') : auth.downloadUrl;
      const publicUrl = `${baseUrl}/file/${B2_BUCKET_NAME}/${fileName}`;

      return res.json({
        success: true,
        publicUrl,
        fileId: uploadResult.fileId,
        fileName,
        sizeBytes: buffer.length,
        sizeKb: Number((buffer.length / 1024).toFixed(2))
      });

    } catch (err: any) {
      console.error('Error en /api/upload-avatar:', err);
      return res.status(500).json({ 
        error: err.message || 'Error interno al subir avatar a Backblaze B2' 
      });
    }
  });

  // Mount Vite or static dist in production
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Starryz 5 Server corriendo en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Error fatal al iniciar servidor:', err);
  process.exit(1);
});
