# yoiber.com rama v2 — reglas para la IA

- Esto es la PRÓXIMA versión de la web personal de Yoiber, no una demo: nada de textos tipo "demo
  de animaciones" o "en construcción", ni créditos de librerías en la página.
- Vive en `yoiberdev/yoiber.com`, **rama `v2`** (el clon de trabajo es `/home/yoiber/proyectos/yoi-demo`
  y el de despliegue `/opt/yoi-demo/src`; los nombres de carpeta son históricos). La versión que hoy
  está en yoiber.com es la rama `main`, y las dos NO comparten un solo fichero: `v2` nació el
  2026-09-06 como rama huérfana y estuvo un tiempo en un repositorio aparte (`yoiberdev/yoi-demo`,
  hoy archivado). Cuando Yoiber lo decida, `v2` pasará a ser `main`. **No fusiones nada de `main`
  en `v2` ni al revés sin que él lo pida.**
- La intro del logo con GSAP de `main` (AnimatedLogo.tsx) está portada literalmente en
  `src/effects/logo-intro.ts`: **no se sustituye ni se traduce a Anime.js**, y no se toca su
  coreografía. Es regla del proyecto.
- Todo se ejecuta como usuario `yoiber` (`runuser -u yoiber -- …`) salvo `git push`, que hace root
  con el alias `github-yoiberdev`; después `chown -R yoiber:yoiber .git`.
- No hay Node en el host: `npm` siempre dentro de `node:22-alpine` (ver README y docker-compose.dev.yml).
- Referencia de la librería, recetas y trampas: `/opt/docs/ANIMEJS.md` (portada con índice). Este
  demo es el ejemplo de código del que salieron las recetas: si cambias un patrón aquí, mira si
  hay que corregir `/opt/docs/ANIMEJS-RECETAS.md`.
- Anime.js **4.5.0 exacto** (`.npmrc` con `save-exact`). Nunca `animejs@beta`.
- Licencia: Anime.js es MIT. La web animejs.com no tiene licencia: no copiar markup, CSS, `d=` de
  SVG, textos, modelos ni fuentes. Se reproducen técnicas con diseño propio.
- Los números viven en `src/params.ts`. Cada efecto es un módulo `src/effects/<id>.ts` con el
  contrato `mount(scope) => cleanup`, montado desde un `createScope` con `mediaQueries.reduceMotion`.
- Gotchas de la API v4: imports con nombre (`import { animate } from 'animejs'`, sin default);
  `ease`, no `easing`; `to`, no `value`; los transforms no se leen de la hoja CSS, fijar estado
  inicial con `utils.set`; los hijos con `from` no se pintan hasta `.init()`; `autoplay: onScroll`
  se ignora en hijos de timeline; `splitText` re-divide en resize (usar `addEffect` o rearmar);
  `loop: 1` son dos iteraciones; `play()` siempre hacia delante (`resume()` para continuar);
  para sincronizar timelines usar `.add(tl, { progress: [0, 1], duration })`, no `.sync(tl)`;
  `engine.pause()` congela también el scroll, pausar solo los bucles decorativos.
- Notas de planificación y material de referencia fuera del repo: `/home/yoiber/yoi-demo-privado/`
  (plan, inventario del sitio, ficheros descargados). No se versiona ni se copia al repo.
- La CSP de `nginx.conf` lleva el hash del script de cabecera de `index.html`: si cambia ese script,
  recalcular `printf %s "<contenido>" | openssl dgst -sha256 -binary | base64`.
- Publicar: `sudo /opt/yoi-demo/actualizar.sh` (pull + build + up). Dominios: demo.yoiber.com y demo.yoiber.dev.
