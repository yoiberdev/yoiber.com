import { defineConfig, type Plugin } from 'vite';

// LAS PÁGINAS DEL SITIO. La portada y una por caso (casos/<slug>/index.html). Cada caso es una
// página aparte de verdad, con su dirección: sin motor 3D ni maestro, solo su texto y su diagrama.
const PAGINAS = {
  portada: 'index.html',
  'caso-maritimo': 'casos/videovigilancia-maritima/index.html',
  'caso-erp': 'casos/erp-centro-de-terapias/index.html',
  'caso-campo': 'casos/gestion-de-campo-embarcaciones/index.html',
  'caso-kuidy': 'casos/kuidy-core/index.html',
  contacto: 'contacto/index.html',
};

// LA FECHA DE PUBLICACIÓN. Google lee dos fechas de esta web: el `dateModified` de la ProfilePage
// (index.html) y el `lastmod` del sitemap. Escritas a mano se quedaban viejas (el sitemap decía
// 2026-09-10 una semana y dos publicaciones después), así que salen de la construcción: la web se
// construye al publicar (actualizar.sh), y esa es su fecha. Hora de Lima, que no cambia de horario.
function fechaPublicacion(): Plugin {
  const lima = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 19);
  const fecha = `${lima}-05:00`;
  // Una entrada por página, sacada de PAGINAS para que no haya dos listas que mantener. Las anclas
  // de la portada (#galeria, #como, #pie) no son direcciones propias y no van aquí.
  const direcciones = Object.values(PAGINAS).map((ruta) => `https://yoiber.com/${ruta.replace(/index\.html$/, '')}`);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Lo genera vite.config.ts al construir, con la fecha de la publicación. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${direcciones.map((u) => `  <url>\n    <loc>${u}</loc>\n    <lastmod>${fecha}</lastmod>\n  </url>`).join('\n')}
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
        Object.entries(PAGINAS).map(([nombre, ruta]) => [nombre, new URL(ruta, import.meta.url).pathname]),
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
