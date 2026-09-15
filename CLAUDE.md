# yoiber.com — reglas para la IA

- Web personal de Yoiber, no es de Kip-Up: nada de textos tipo "demo de animaciones" o "en
  construcción", ni créditos de librerías en la página.
- Repo `yoiberdev/yoiber.com` con **dos ramas**: `develop` es donde se trabaja y se prueba
  (https://demo.yoiber.dev, con `noindex`); `main` es lo que ve la gente en https://yoiber.com. Se
  publica fusionando `develop` en `main` por avance rápido. No se commitea directo en `main`.
- Carpetas: clon de trabajo `/home/yoiber/proyectos/yoiber.com` (en `develop`); despliegues
  `/opt/yoiber.com-dev` (contenedor `yoiber-com-dev`) y `/opt/yoiber.com` (contenedor `yoiber-com`).
  Los contenedores llevan guion y no punto: con punto, dentro de la red `proxy` el nombre del
  contenedor tapa al dominio de verdad. Nada de alias de red con nombres viejos.
- Probar: `sudo /opt/yoiber.com-dev/actualizar.sh` (pull de `develop` + build + up). Publicar:
  fusionar en `main` y `sudo /opt/yoiber.com/actualizar.sh`.
- Etiquetas: `v1-react` guarda la versión anterior (React); `v3-tinta` y `v4-vuelco` marcan hitos
  del motor.
- La intro del logo con GSAP de la versión React (`AnimatedLogo.tsx`, etiqueta `v1-react`) está
  portada literalmente en `src/effects/logo-intro.ts`: **no se sustituye ni se traduce a Anime.js**,
  y no se toca su coreografía. Es regla del proyecto.
- Todo se ejecuta como usuario `yoiber` (`runuser -u yoiber -- …`) salvo `git push`, que hace root
  con el alias `github-yoiberdev`; después `chown -R yoiber:yoiber .git`.
- No hay Node en el host: `npm` siempre dentro de `node:22-alpine` (ver README y docker-compose.dev.yml).
- Referencia de la librería, recetas y trampas: `/opt/docs/ANIMEJS.md` (portada con índice). Este
  código es el ejemplo del que salieron las recetas: si cambias un patrón aquí, mira si hay que
  corregir `/opt/docs/ANIMEJS-RECETAS.md`.
- Anime.js **4.5.0 exacto** (`.npmrc` con `save-exact`). Nunca `animejs@beta`.
- Licencia: Anime.js es MIT. La web animejs.com no tiene licencia: no copiar markup, CSS, `d=` de
  SVG, textos, modelos ni fuentes. Se reproducen técnicas con diseño propio.
- Los números viven en `src/params.ts` y `src/params-motor.ts`. Cada efecto es un módulo
  `src/effects/<id>.ts` con el contrato `mount(scope) => cleanup`, montado desde un `createScope`
  con `mediaQueries.reduceMotion`.
- Gotchas de la API v4: imports con nombre (`import { animate } from 'animejs'`, sin default);
  `ease`, no `easing`; `to`, no `value`; los transforms no se leen de la hoja CSS, fijar estado
  inicial con `utils.set`; los hijos con `from` no se pintan hasta `.init()`; `autoplay: onScroll`
  se ignora en hijos de timeline; `splitText` re-divide en resize (usar `addEffect` o rearmar);
  `loop: 1` son dos iteraciones; `play()` siempre hacia delante (`resume()` para continuar);
  para sincronizar timelines usar `.add(tl, { progress: [0, 1], duration })`, no `.sync(tl)`;
  `engine.pause()` congela también el scroll, pausar solo los bucles decorativos.
- Notas de planificación y material de referencia fuera del repo: `/home/yoiber/yoiber.com-privado/`
  (plan, inventario del sitio, informes BRECHA y CANALES, ficheros descargados). No se versiona ni
  se copia al repo.
- La CSP de `nginx.conf` lleva el hash del script de cabecera de `index.html`: si cambia ese script,
  recalcular `printf %s "<contenido>" | openssl dgst -sha256 -binary | base64` y ponerlo en el
  `nginx.conf` del repo y en `/opt/yoiber.com/nginx.conf`. Las pruebas construyen con el del repo,
  así que un hash olvidado se ve en demo.yoiber.dev antes de publicar.
