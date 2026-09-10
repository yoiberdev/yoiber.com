import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: false,
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
