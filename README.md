# yoiber.com · rama `v2`

La próxima versión de mi web personal: una sola página dirigida por el scroll, con un motor cohete
construido por código (sin modelos descargados) que se monta, se aparta para dejar ver los
proyectos, se despieza y se enciende.

**En vivo mientras se construye: https://demo.yoiber.com** · La versión que hoy está en
[yoiber.com](https://yoiber.com) vive en la rama `main` de este mismo repositorio.

Hecho con [Anime.js](https://animejs.com) 4.5 (MIT), [GSAP](https://gsap.com) 3.15 para la intro del
logo y [Three.js](https://threejs.org) 0.185 para el motor. Es una recreación técnica inspirada en la
portada de animejs.com: mismas técnicas, con diseño, textos y assets propios. No contiene código,
assets ni textos de ese sitio.

## Cómo está hecho

| Pieza | Cómo funciona |
|---|---|
| Reloj maestro | Un solo `createTimeline` con etiquetas por capítulo. Nada se anima por su cuenta: todo es función del reloj, así que el scroll hacia atrás lo deshace exacto. |
| Scroll | El scroll no mueve nada: mueve el reloj. Cada sección traduce su paso por la pantalla a un tramo, y un `createTimer` propio persigue ese objetivo con suavizado por tiempo. |
| Intro | La entrada del logo corre por tiempo (GSAP, la misma de yoiber.com) sobre un anillo de marcas que respira, y cede el mando en cuanto el visitante baja. |
| Motor 3D | Geometría procedimental: campana de perfil de Rao, 36 tubos de refrigeración instanciados, turbobomba, celosía y tornillería. Llega en un trozo diferido y solo si la máquina lo aguanta. |
| Dibujo | Material *toon* de tres tonos con una luz y un filo cálido por shader; la tinta de los contornos es un pase de pantalla propio (profundidad y normales con cruz de Roberts) y FXAA. |
| Galería | Cinco proyectos con demo viva. Cada tarjeta entra por piezas y traza un esquema con el scroll; el color de la página cambia con cada proyecto. |
| Escenario de reserva | Sin WebGL, o en una máquina justa, la misma coreografía se cuenta con capas CSS en 3D. |
| Accesibilidad | Con `prefers-reduced-motion` no hay intro temporal, ni rotaciones, ni bucles: el contenido queda en su estado final. |

Añade `?debug` a la URL para ver el reloj, el capítulo, los fotogramas por segundo y saltar a
cualquier etiqueta; `?motor=css` fuerza el escenario de reserva y `?calidad=baja|media|alta` fija el
nivel de detalle.

## Estructura

- `src/params.ts` y `src/params-motor.ts`: la única fuente de números. Ajustar el ritmo o el encuadre
  es cambiar un valor, nunca lógica.
- `src/core/`: maestro, scroller, escena, tema, acento, barra de progreso y overlay de depuración.
- `src/effects/`: un fichero por efecto, con el contrato `mount(scope) => cleanup`.
- `src/motor/`: geometría, rig, coreografía, rótulos, penacho y el pase de tinta. Todo esto viaja en
  un trozo aparte que solo se descarga cuando hace falta.

## Desarrollo

No hace falta Node en la máquina: todo va en contenedores.

```bash
printf "DEV_UID=%s\nDEV_GID=%s\nWEB_PORT=5174\n" "$(id -u)" "$(id -g)" > .env
docker compose -f docker-compose.dev.yml up -d      # recarga en caliente en 127.0.0.1:5174
```

## Publicación

Estáticos servidos con nginx en Docker. En el servidor, `/opt/yoi-demo` tiene un clon de esta rama
en `src/` y se actualiza con `sudo /opt/yoi-demo/actualizar.sh`.

## Licencia

Código MIT (ver `LICENSE`). Anime.js es de Julian Garnier (MIT) y Three.js también es MIT; GSAP se
usa bajo su licencia estándar sin coste.
