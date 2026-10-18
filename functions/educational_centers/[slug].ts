interface Env {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');
}

function matchSlug(name: string, targetSlug: string): boolean {
  const slug1 = toSlug(name);
  const slug2 = targetSlug.toLowerCase().trim();
  if (slug1 === slug2) return true;
  return slug1.replace(/\./g, '') === slug2.replace(/\./g, '');
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;

  // 1. Fetch static index.html asset from Cloudflare Pages Assets
  const res = await env.ASSETS.fetch(request);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return res;
  }

  const rawSlug = params.slug;
  const slugParam = Array.isArray(rawSlug) ? rawSlug.join('/') : (rawSlug as string || '');
  if (!slugParam) return res;

  const url = new URL(request.url);
  const fullUrl = url.href;

  // Supabase credentials fallback
  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://towabrmgsbkjakbymuoy.supabase.co';
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvd2Ficm1nc2JramFrYnltdW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMzNzkxMjcsImV4cCI6MjAzODk1NTEyN30.placeholder';

  let centerName = '';
  let centerDesc = '';
  let photoUrl = '';

  try {
    // Direct REST API fetch to Supabase (Ultra fast edge query)
    const reqUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/educational_centers?select=*`;
    const apiRes = await fetch(reqUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (apiRes.ok) {
      const centers: any[] = await apiRes.json();
      const match = centers.find(c => 
        c.id === slugParam || 
        matchSlug(c.name || '', slugParam) ||
        toSlug(c.name || '') === slugParam.toLowerCase()
      );

      if (match) {
        centerName = match.name || '';
        centerDesc = match.description || `Descubre el perfil oficial de ${centerName} en STARRYZ. Consulta profesores, alumnos populares, confesiones y más.`;
        photoUrl = match.profile_photo_url || '';

        if (!photoUrl) {
          photoUrl = match.type === 'colegio'
            ? 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop'
            : 'https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800&auto=format&fit=crop';
        }
      }
    }
  } catch (e) {
    // Silence error to safely fallback
  }

  // Fallback title & photo if not found in database
  if (!centerName) {
    const formattedTitle = slugParam
      .split('.')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    centerName = formattedTitle;
    centerDesc = `Explora el perfil de ${formattedTitle} en STARRYZ. Vota por alumnos y profesores, publica confesiones y conoce la comunidad.`;
    photoUrl = `${url.protocol}//${url.host}/Logo/favicon.jpg`;
  }

  // Absolute URL formatting
  if (photoUrl && photoUrl.startsWith('/')) {
    photoUrl = `${url.protocol}//${url.host}${photoUrl}`;
  }

  // Use Cloudflare HTMLRewriter to inject real Open Graph meta tags into index.html
  return new HTMLRewriter()
    .on('title', {
      element(e) {
        e.setInnerContent(`${centerName} | STARRYZ`);
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
        e.setAttribute('content', centerDesc);
      },
    })
    .on('head', {
      element(e) {
        e.append(`
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="STARRYZ" />
          <meta property="og:title" content="${escapeAttr(centerName)}" />
          <meta property="og:description" content="${escapeAttr(centerDesc)}" />
          <meta property="og:image" content="${escapeAttr(photoUrl)}" />
          <meta property="og:image:secure_url" content="${escapeAttr(photoUrl)}" />
          <meta property="og:image:width" content="600" />
          <meta property="og:image:height" content="600" />
          <meta property="og:url" content="${escapeAttr(fullUrl)}" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="${escapeAttr(centerName)}" />
          <meta name="twitter:description" content="${escapeAttr(centerDesc)}" />
          <meta name="twitter:image" content="${escapeAttr(photoUrl)}" />
        `, { html: true });
      },
    })
    .transform(res);
};
