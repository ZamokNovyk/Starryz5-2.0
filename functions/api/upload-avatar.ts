/**
 * functions/api/upload-avatar.ts
 * Cloudflare Pages Function para subida de avatares con eliminación automática de fotos anteriores.
 */

interface Env {
  B2_KEY_ID?: string;
  B2_APPLICATION_KEY?: string;
  B2_BUCKET_ID?: string;
  B2_BUCKET_NAME?: string;
  PUBLIC_CDN_URL?: string;
  VITE_CLOUDFLARE_CDN_URL?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const { request, env } = context;

    const B2_KEY_ID = (env.B2_KEY_ID || '0056bac9fb621d40000000001').trim();
    let B2_APPLICATION_KEY = (env.B2_APPLICATION_KEY || 'K00575GnrUfEa3rzdIEkV0NDBfhDcx0').trim();
    if (B2_APPLICATION_KEY.includes('dlEk')) {
      B2_APPLICATION_KEY = B2_APPLICATION_KEY.replace('dlEk', 'dIEk');
    }
    const B2_BUCKET_ID = (env.B2_BUCKET_ID || 'a64b1a7cf94f0b26a2110d14').trim();
    const B2_BUCKET_NAME = (env.B2_BUCKET_NAME || 'starryz5').trim();

    const body: any = await request.json();
    const { imageBase64, contentType, userId, fileName: customFileName } = body;

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 es obligatorio' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Decodificar Base64 a Uint8Array
    const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const binaryStr = atob(base64Clean);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Validar peso: límite de 105 KB
    if (bytes.length > 105 * 1024) {
      return new Response(
        JSON.stringify({
          error: `La imagen excede el límite máximo de 100 KB. Tamaño: ${(bytes.length / 1024).toFixed(1)} KB`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const mime = contentType || 'image/webp';
    const ext = mime.includes('webp') ? 'webp' : 'jpg';
    const cleanUserId = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '');
    const timestamp = Date.now();
    const fileName = customFileName || `avatars/${cleanUserId}-${timestamp}.${ext}`;

    // 1. Autorizar con Backblaze B2
    const basicAuth = btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`);
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: { Authorization: `Basic ${basicAuth}` },
    });

    if (!authRes.ok) {
      const errText = await authRes.text();
      throw new Error(`B2 authorize failed (${authRes.status}): ${errText}`);
    }

    const authData: any = await authRes.json();
    const apiUrl = authData.apiInfo?.storageApi?.apiUrl;
    const downloadUrl = authData.apiInfo?.storageApi?.downloadUrl;
    const token = authData.authorizationToken;

    if (!apiUrl || !downloadUrl || !token) {
      throw new Error('Respuesta inválida de autorización');
    }

    // 2. Obtener URL de subida para el bucket
    const uploadUrlRes = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url?bucketId=${B2_BUCKET_ID}`, {
      headers: { Authorization: token },
    });

    if (!uploadUrlRes.ok) {
      const errText = await uploadUrlRes.text();
      throw new Error(`Error al obtener URL de subida (${uploadUrlRes.status}): ${errText}`);
    }

    const uploadUrlData: any = await uploadUrlRes.json();

    // 3. Subir archivo nuevo
    const uploadRes = await fetch(uploadUrlData.uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': uploadUrlData.authorizationToken,
        'X-Bz-File-Name': encodeURIComponent(fileName),
        'Content-Type': mime,
        'Content-Length': bytes.length.toString(),
        'X-Bz-Content-Sha1': 'do_not_verify',
      },
      body: bytes,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Error en subida de archivo (${uploadRes.status}): ${errText}`);
    }

    const uploadResult: any = await uploadRes.json();
    
    // Usar el dominio CDN de Cloudflare si está configurado (media.starryz5.com), o fallback
    let cdnDomain = (env as any).PUBLIC_CDN_URL || (env as any).VITE_CLOUDFLARE_CDN_URL || 'https://media.starryz5.com';
    if (cdnDomain.includes('cdn.starryz5.com')) {
      cdnDomain = 'https://media.starryz5.com';
    }
    const baseUrl = cdnDomain ? cdnDomain.trim().replace(/\/$/, '') : downloadUrl;
    const publicUrl = `${baseUrl}/file/${B2_BUCKET_NAME}/${fileName}`;

    // 4. Limpieza automática: Buscar y eliminar fotos anteriores del mismo usuario
    try {
      const prefix = `avatars/${cleanUserId}-`;
      const listRes = await fetch(
        `${apiUrl}/b2api/v3/b2_list_file_names?bucketId=${B2_BUCKET_ID}&prefix=${encodeURIComponent(prefix)}&maxFileCount=20`,
        { headers: { Authorization: token } }
      );

      if (listRes.ok) {
        const listData: any = await listRes.json();
        const oldFiles = (listData.files || []).filter(
          (f: any) => f.fileName !== fileName && f.fileId !== uploadResult.fileId
        );

        for (const old of oldFiles) {
          await fetch(`${apiUrl}/b2api/v3/b2_delete_file_version`, {
            method: 'POST',
            headers: { 
              Authorization: token, 
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
              fileName: old.fileName,
              fileId: old.fileId,
            }),
          });
        }
      }
    } catch (cleanErr) {
      console.warn('Aviso no crítico al limpiar foto anterior:', cleanErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        publicUrl,
        fileId: uploadResult.fileId,
        fileName,
        sizeBytes: bytes.length,
        sizeKb: Number((bytes.length / 1024).toFixed(2)),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (err: any) {
    console.error('Error en Cloudflare Function /api/upload-avatar:', err);
    return new Response(
      JSON.stringify({
        error: err.message || 'Error interno al procesar subida',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
