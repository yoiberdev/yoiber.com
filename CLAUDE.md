# yoiber.com — reglas para la IA

Web personal de Yoiber. Vite + React 19 + TypeScript + Tailwind 4 + **GSAP** + Lenis.
Repo `yoiberdev/yoiber.com`. En producción en yoiber.com, yoiber.dev y sus www.

## Regla principal: el logo animado no se toca

`src/components/AnimatedLogo.tsx` es la intro de la marca: las tres formas del logo
(`.triangle`, `.trapezoid`, `.diagonal-bar`) entran desde fuera de pantalla, se ensamblan y
después flotan. Está coreografiado a mano con GSAP.

- **No lo reescribas, no lo portes a otra librería y no lo sustituyas por una versión "equivalente".**
  Es difícil de replicar y el resultado nunca es el mismo. Si algo falla, arregla ese algo.
- **No metas Anime.js en este proyecto.** Aquí se anima con GSAP. Anime.js vive en el otro
  repositorio (ver abajo) y mezclar los dos motores en la misma página trae problemas.
- Si hace falta tocar el logo, hazlo dentro de la coreografía existente y enseña una captura
  antes y después.

## Relación con yoi-demo

`yoiberdev/yoi-demo` (demo.yoiber.com) es un laboratorio de animaciones con Anime.js. Es un
repositorio aparte y **no comparte código con este**. Las técnicas del laboratorio no se copian
aquí por iniciativa propia: solo si Yoiber lo pide explícitamente.

## Cómo se trabaja

- No hay Node en el servidor: `npm` va siempre dentro de un contenedor.
  `docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -v "$PWD":/app -w /app node:22-alpine npm ci`
- Publicar: `git push origin main` y después `sudo /opt/yoiblog/actualizar.sh` en el servidor
  (git pull + docker compose build + up). El contenedor `yoiblog` sirve estáticos con nginx.
- CSP estricta en `nginx.conf`: nada de CDN ni de Google Fonts. Las fuentes van autoalojadas.
- Licencia: el código es MIT; los textos, el logo y la tipografía Satoshi no.
- Guía del servidor: /opt/docs/PUBLICAR.md. Inventario: /opt/docs/PROYECTOS.md.
