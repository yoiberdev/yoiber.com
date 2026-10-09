# yoiber.com

Mi web personal. La portada la mueve el scroll: un motor cohete construido por código (sin modelos
descargados) se monta, se enciende y despega. Debajo están los proyectos, cada uno en el formato de
lo que es, y al tocarlo se abre con su trabajo andando, grabado o simulado.

**En vivo: https://yoiber.com** (rama `main`) · Pruebas: https://demo.yoiber.dev (rama `develop`).

Hecho con [Anime.js](https://animejs.com) 4.5 (MIT), [GSAP](https://gsap.com) 3.15 para la intro del
logo y [Three.js](https://threejs.org) 0.185 para el motor. Es una recreación técnica inspirada en la
portada de animejs.com: mismas técnicas, con diseño, textos y assets propios. No contiene código,
assets ni textos de ese sitio.

## Cómo está hecho

| Pieza | Cómo funciona |
|---|---|
| Reloj maestro | La portada es un solo `createTimeline` con etiquetas por capítulo. Nada se anima por su cuenta: todo es función del reloj, así que el scroll hacia atrás lo deshace exacto. Lo que viene después (los proyectos, el cierre y el pie) va en flujo normal. |
| Scroll | El scroll no mueve nada: mueve el reloj. Cada sección traduce su paso por la pantalla a un tramo, y un `createTimer` propio persigue ese objetivo con suavizado por tiempo. |
| Intro | La entrada del logo corre por tiempo (GSAP, la misma de la versión anterior) sobre un anillo de marcas que respira, y cede el mando en cuanto el visitante baja. |
| Motor 3D | Geometría procedimental: campana de perfil de Rao, 36 tubos de refrigeración instanciados, turbobomba, celosía y tornillería. Llega en un trozo diferido y solo si la máquina lo aguanta. |
| Dibujo | Material *toon* de tres tonos con una luz y un filo cálido por shader; la tinta de los contornos es un pase de pantalla propio (profundidad y normales con cruz de Roberts) y FXAA. |
| Proyectos | Quince proyectos a la vista, en cuatro grupos con filtro, y cada uno en el formato de lo que es: la boleta que recibe la constancia de SUNAT, el radar de los barcos, la comanda en el riel de la cocina, la terminal del agente, el guion de Daebon. Las vistas son HTML, CSS y SVG (`src/styles/portada.css`) y solo se animan mientras se ven. Al tocar uno se abre su ficha (`src/proyectos/`) con la grabación o la simulación (`src/sim/`), cómo está hecho y sus enlaces. |
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

Estáticos servidos con nginx en Docker. Se trabaja en `develop`, que se despliega en
demo.yoiber.dev para probar; cuando está bien, se fusiona en `main` y se publica en yoiber.com.

## Licencia

Código MIT (ver `LICENSE`). Anime.js es de Julian Garnier (MIT) y Three.js también es MIT; GSAP se
usa bajo su licencia estándar sin coste.
