import { defineConfig, type Plugin } from 'vite';

// LAS PÁGINAS DEL SITIO. La portada, una por caso (casos/<slug>/) y el contacto, cada una con su
// dirección de verdad: sin motor 3D ni maestro, solo su texto y, si lo lleva, su diagrama.
//
// LOS DOS IDIOMAS. El español es el original y vive en la raíz; el inglés cuelga de /en/. Cada
// página en español declara a su gemela en inglés y al revés (`alterna`), y de ahí salen tanto los
// `hreflang` del sitemap como el enlace de idioma de cada barra. La portada animada NO está
// traducida a propósito: sus textos están medidos para las animaciones (los cortes del lema, los
// títulos partidos por letras, las cotas del motor en el móvil), así que /en/ es una página de
// entrada propia, no su gemela, y por eso no se declaran alternas entre las dos.
interface Pagina {
  nombre: string;
  entrada: string;
  url: string;
  lang: 'es' | 'en';
  alterna?: string;
}

const PAGINAS: Pagina[] = [
  { nombre: 'portada', entrada: 'index.html', url: '/', lang: 'es' },
  { nombre: 'caso-maritimo', entrada: 'casos/videovigilancia-maritima/index.html', url: '/casos/videovigilancia-maritima/', lang: 'es', alterna: '/en/cases/live-video-from-vessels/' },
  { nombre: 'caso-erp', entrada: 'casos/erp-centro-de-terapias/index.html', url: '/casos/erp-centro-de-terapias/', lang: 'es', alterna: '/en/cases/therapy-center-erp/' },
  { nombre: 'caso-campo', entrada: 'casos/gestion-de-campo-embarcaciones/index.html', url: '/casos/gestion-de-campo-embarcaciones/', lang: 'es', alterna: '/en/cases/field-operations-at-sea/' },
  { nombre: 'caso-kuidy', entrada: 'casos/kuidy-core/index.html', url: '/casos/kuidy-core/', lang: 'es', alterna: '/en/cases/kuidy-core/' },
  { nombre: 'caso-kuantera', entrada: 'casos/kuantera/index.html', url: '/casos/kuantera/', lang: 'es', alterna: '/en/cases/kuantera/' },
  { nombre: 'contacto', entrada: 'contacto/index.html', url: '/contacto/', lang: 'es', alterna: '/en/contact/' },
  { nombre: 'en-entrada', entrada: 'en/index.html', url: '/en/', lang: 'en' },
  { nombre: 'en-caso-maritimo', entrada: 'en/cases/live-video-from-vessels/index.html', url: '/en/cases/live-video-from-vessels/', lang: 'en', alterna: '/casos/videovigilancia-maritima/' },
  { nombre: 'en-caso-erp', entrada: 'en/cases/therapy-center-erp/index.html', url: '/en/cases/therapy-center-erp/', lang: 'en', alterna: '/casos/erp-centro-de-terapias/' },
  { nombre: 'en-caso-campo', entrada: 'en/cases/field-operations-at-sea/index.html', url: '/en/cases/field-operations-at-sea/', lang: 'en', alterna: '/casos/gestion-de-campo-embarcaciones/' },
  { nombre: 'en-caso-kuidy', entrada: 'en/cases/kuidy-core/index.html', url: '/en/cases/kuidy-core/', lang: 'en', alterna: '/casos/kuidy-core/' },
  { nombre: 'en-caso-kuantera', entrada: 'en/cases/kuantera/index.html', url: '/en/cases/kuantera/', lang: 'en', alterna: '/casos/kuantera/' },
  { nombre: 'en-contacto', entrada: 'en/contact/index.html', url: '/en/contact/', lang: 'en', alterna: '/contacto/' },
];

// LA FECHA DE PUBLICACIÓN. Google lee dos fechas de esta web: el `dateModified` de la ProfilePage
// (index.html) y el `lastmod` del sitemap. Escritas a mano se quedaban viejas (el sitemap decía
// 2026-09-10 una semana y dos publicaciones después), así que salen de la construcción: la web se
// construye al publicar (actualizar.sh), y esa es su fecha. Hora de Lima, que no cambia de horario.
function fechaPublicacion(): Plugin {
  const lima = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 19);
  const fecha = `${lima}-05:00`;
  // Una entrada por página, sacada de PAGINAS para que no haya dos listas que mantener. Las anclas
  // de la portada (#galeria, #como, #pie) no son direcciones propias y no van aquí. Las páginas que
  // tienen gemela en el otro idioma se declaran entre ellas con `xhtml:link`, que es como pide
  // Google que se anuncien las versiones por idioma (cada una se nombra a sí misma y a la otra).
  const sede = 'https://yoiber.com';
  const entrada = (p: Pagina): string => {
    const alternas = p.alterna
      ? [
          `    <xhtml:link rel="alternate" hreflang="${p.lang}" href="${sede}${p.url}" />`,
          `    <xhtml:link rel="alternate" hreflang="${p.lang === 'es' ? 'en' : 'es'}" href="${sede}${p.alterna}" />`,
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${sede}${p.lang === 'es' ? p.url : p.alterna}" />`,
        ].join('\n') + '\n'
      : '';
    return `  <url>\n    <loc>${sede}${p.url}</loc>\n${alternas}    <lastmod>${fecha}</lastmod>\n  </url>`;
  };
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Lo genera vite.config.ts al construir, con la fecha de la publicación. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${PAGINAS.map(entrada).join('\n')}
</urlset>
`;
  return {
    name: 'fecha-publicacion',
    // `pre`: antes de que Vite busque sus propias variables %…% en el HTML y avise de la que no conoce
    transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%FECHA_PUBLICACION%', fecha) },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
    },
  };
}

export default defineConfig({
  plugins: [fechaPublicacion()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: Object.fromEntries(
        // rutas absolutas resueltas contra este fichero, sin `node:path` (el typecheck va sin @types/node)
        PAGINAS.map((p) => [p.nombre, new URL(p.entrada, import.meta.url).pathname]),
      ),
    },
    // NADA INCRUSTADO COMO data: URI. Por defecto Vite mete en el CSS cualquier asset de menos de
    // 4 096 B, y el subset cyrillic-ext de JetBrains Mono (2 028 B) caía dentro: la CSP de nginx.conf
    // lleva `font-src 'self'` y el navegador lo rechazaba en CADA carga ("Refused to load the font
    // 'data:font/woff2;base64,...'"). No se veía en el servidor de desarrollo porque ahí no hay CSP.
    // Con 0 cada subset es un fichero en /assets y solo se descarga si su unicode-range hace falta.
    // No se abre `data:` en font-src: sería abrir la puerta a cualquier fuente incrustada.
    assetsInlineLimit: 0,
  },
  server: { host: '0.0.0.0', port: 5174, strictPort: true },
});
