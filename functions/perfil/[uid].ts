interface Env {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
}

function escapeAttr(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;

  // 1. Obtener el archivo estático index.html de Cloudflare Pages Assets
  const res = await env.ASSETS.fetch(request);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return res;
  }

  const rawUid = params.uid;
  const uidParam = Array.isArray(rawUid) ? rawUid.join('/') : (rawUid as string || '');
  if (!uidParam) return res;

  const url = new URL(request.url);
  const fullUrl = url.href;
  const pubId = url.searchParams.get('pub');

  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://towabrmgsbkjakbymuoy.supabase.co';
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvd2Ficm1nc2JramFrYnltdW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMzNzkxMjcsImV4cCI6MjAzODk1NTEyN30.placeholder';

  let title = 'Perfil de Starryz 5';
  let desc = 'Mira el perfil en la red social universitaria Starryz 5.';
  let photoUrl = `${url.protocol}//${url.host}/Logo/logo.jpg`;

  try {
    // Si viene con un parámetro de publicación (?pub=ID), priorizamos los datos de la publicación
    if (pubId) {
      const pubRes = await fetch(
        `${supabaseUrl.replace(/\/$/, '')}/rest/v1/user_publicaciones?id=eq.${encodeURIComponent(pubId)}&select=*`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (pubRes.ok) {
        const pubs: any[] = await pubRes.json();
        if (pubs && pubs.length > 0) {
          const pub = pubs[0];
          title = `Publicación de ${pub.user_display_name || 'usuario'} en Starryz 5`;
          desc = pub.description || 'Publicación compartida en Starryz 5.';
          if (pub.image_url) {
            photoUrl = pub.image_url;
          }
        }
      }
    } else {
      // De lo contrario, buscamos los datos del perfil del usuario en la tabla `users`
      const userRes = await fetch(
        `${supabaseUrl.replace(/\/$/, '')}/rest/v1/users?id=eq.${encodeURIComponent(uidParam)}&select=*`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (userRes.ok) {
        const users: any[] = await userRes.json();
        if (users && users.length > 0) {
          const u = users[0];
          const fullName = [u.nombres, u.apellido_paterno, u.apellido_materno].filter(Boolean).join(' ') || u.display_name || 'Perfil de Starryz 5';
          title = `${fullName} | Starryz 5`;
          desc = u.description || `Visita el perfil universitario de ${fullName} en Starryz 5.`;
          if (u.photo_url) {
            photoUrl = u.photo_url;
          }
        }
      }
    }
  } catch (e) {
    // Silencio de error para usar fallback seguro
  }

  // Garantizar URL absoluta para la imagen
  if (photoUrl && photoUrl.startsWith('/')) {
    photoUrl = `${url.protocol}//${url.host}${photoUrl}`;
  }

  // Inyectar etiquetas Open Graph dinámicas en el HTML usando HTMLRewriter nativo de Cloudflare
  return new HTMLRewriter()
    .on('title', {
      element(e) {
        e.setInnerContent(`${title}`);
      },
    })
    .on('meta[property^="og:"]', {
      element(e) {
        e.remove();
      },
    })
    .on('meta[name^="twitter:"]', {
      element(e) {
        e.remove();
      },
    })
    .on('meta[name="description"]', {
      element(e) {
        e.setAttribute('content', desc);
      },
    })
    .on('head', {
      element(e) {
        e.append(`
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="Starryz 5" />
          <meta property="og:title" content="${escapeAttr(title)}" />
          <meta property="og:description" content="${escapeAttr(desc)}" />
          <meta property="og:image" content="${escapeAttr(photoUrl)}" />
          <meta property="og:image:secure_url" content="${escapeAttr(photoUrl)}" />
          <meta property="og:image:width" content="600" />
          <meta property="og:image:height" content="600" />
          <meta property="og:url" content="${escapeAttr(fullUrl)}" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="${escapeAttr(title)}" />
          <meta name="twitter:description" content="${escapeAttr(desc)}" />
          <meta name="twitter:image" content="${escapeAttr(photoUrl)}" />
        `, { html: true });
      },
    })
    .transform(res);
};
