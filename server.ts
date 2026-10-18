import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';

// Always enforce the exact verified Backblaze B2 credentials
const B2_KEY_ID = '0056bac9fb621d40000000001';
const B2_APPLICATION_KEY = 'K00575GnrUfEa3rzdIEkV0NDBfhDcx0';
const B2_BUCKET_ID = 'a64b1a7cf94f0b26a2110d14';
const B2_BUCKET_NAME = 'starryz5';

// Cache B2 auth token in memory
let cachedAuth: {
  apiUrl: string;
  downloadUrl: string;
  token: string;
  expiresAt: number;
} | null = null;

async function getB2Auth(forceRefresh = false) {
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // CORS middleware for starryz5.com and any client origin
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // JSON payload parser for base64 compressed images (limit 10MB)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // POST /api/upload-avatar - Subida de avatar a Backblaze B2 con eliminación automática de foto anterior
  app.post('/api/upload-avatar', async (req, res) => {
    try {
      const { imageBase64, contentType, userId, previousPhotoUrl, fileName: customFileName } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 es obligatorio' });
      }

      // Validate base64 data
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Check size limit: 105 KB max
      const sizeBytes = buffer.length;
      if (sizeBytes > 105 * 1024) {
        return res.status(400).json({ 
          error: `La imagen excede el límite máximo de 100 KB. Tamaño recibido: ${(sizeBytes / 1024).toFixed(1)} KB` 
        });
      }

      const mime = contentType || 'image/webp';
      const ext = mime.includes('webp') ? 'webp' : 'jpg';
      const cleanUserId = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '');
      const timestamp = Date.now();
      const fileName = customFileName || `avatars/${cleanUserId}-${timestamp}.${ext}`;

      // 1. Authorize with B2 (retry once if token expired)
      let auth;
      try {
        auth = await getB2Auth();
      } catch (authErr) {
        auth = await getB2Auth(true);
      }

      // 2. Get upload URL for bucket
      let uploadUrlRes = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_url?bucketId=${B2_BUCKET_ID}`, {
        headers: { Authorization: auth.token }
      });

      // If token expired (401), force refresh auth and try once more
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

      // 3. Upload file to Backblaze B2
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

      // 4. Eliminación automática de fotos anteriores del usuario para ahorrar almacenamiento
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
