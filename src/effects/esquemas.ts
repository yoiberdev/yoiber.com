import { createDrawable, utils, type DrawableSVGGeometry, type Timeline } from 'animejs';
import { P } from '../params';

// LOS ESQUEMAS VIVOS DE LA GALERÍA — lo que el scroll dibuja dentro de la tarjeta
// ================================================================================================
// Fila 21 del informe BRECHA: "la galería son cinco capturas JPG; nada avanza con el scroll dentro
// de la tarjeta". Ahora cada tarjeta lleva, entre la pila y el detalle, un <svg class="esquema">
// pequeño (tres formas y una línea, en el acento del proyecto) que se traza MIENTRAS la tarjeta
// está delante, y las cifras del detalle (571 pruebas, 47 rutas, 99 pruebas) cuentan de 0 a su
// valor en el mismo tramo. Todo son hijos del maestro: el scroll mueve el reloj y el dibujo hace
// seek, así que al subir se destraza exacto y no hay estados que solo vayan hacia delante.
//
// EL TRAMO. galeria.ts pasa `t0` y `dur`: el TRAMO QUIETO de la tarjeta, del final del cruce de
// entrada (todas las piezas ya a la vista) al principio del de salida. Con cinco tarjetas en diez
// alturas son 1 180 unidades del maestro: en una ventana de 900 px, unos 1 060 px de scroll para
// ver el dibujo entero, y ninguna pieza se traza mientras la tarjeta todavía está entrando.
//
// QUÉ SE TRAZA Y CUÁNDO. Cada elemento del SVG con `data-paso` busca su ventana [desde, hasta] en
// P.galeria.esquemas[<data-esquema del svg>], en fracciones del tramo. Tres tipos de pieza:
//   · las FORMAS (SVGGeometryElement: rect, line, path, polyline, circle) se trazan de '0 0' a
//     '0 1' con createDrawable. TRAMPA que ya mordió una vez (diagrama DSS): `draw` solo funciona
//     sobre el PROXY que devuelve createDrawable, nunca sobre el nodo: sobre el nodo la animación
//     se crea, no avisa y no hace nada;
//   · los RÓTULOS (<text>) y las piezas con `data-fundido` (el relleno del botón) se encienden en
//     opacidad;
//   · el PUNTO con `data-ruta` (el identificador de correlación) recorre la polilínea `.ruta` de
//     su esquema en la ventana `viaje`. Se anima un escalar 0..1 en un objeto con setter y el
//     setter coloca cx/cy interpolando los vértices de la polilínea, leídos del atributo `points`
//     una vez al montar: sin getPointAtLength, que en un SVG con display: none (así va en los
//     teléfonos bajos) no está definido, y sin transform CSS sobre un elemento SVG.
// Todo lineal: a la mitad de su ventana una pieza está exactamente a la mitad, que es lo que mide
// el QA leyendo stroke-dasharray. Las FORMAS llevan [desde, hasta] EXPLÍCITOS en las dos puntas:
// con `composition: 'none'` (defaults del maestro) un tween de un solo valor leería el "desde" del
// atributo al crearse, y al volver desde CIERRE de un salto escribiría ese valor (ver galeria.ts).
//
// LAS CIFRAS. <b class="cifra" data-hasta="571"> en el detalle: un objeto con setter escribe el
// textContent con utils.roundPad(0) (sin decimales) a lo largo del tramo entero. El marcado trae
// el valor final por si el módulo no llega, y el módulo le da un ancho mínimo en ch (tantos como
// dígitos) para que la línea no se recomponga mientras cuenta.
//
// CON MOVIMIENTO REDUCIDO todo va a su estado final de una vez (utils.set sobre los proxies, los
// rótulos a 1, el punto al final de la ruta) y las cifras se quedan como vienen en el marcado:
// nada se mueve dentro de la tarjeta.
//
// COSTE. Los cinco esquemas se montan UNA vez (aquí, antes de tl.init()): 8-11 tweens por
// tarjeta, todos hijos del maestro. En cada fotograma solo escriben los tweens cuyo instante toca,
// o sea los de la tarjeta que está delante; el resto están fuera de su ventana y el maestro no los
// vuelve a pintar. Nada se crea ni se mide por fotograma.

type Ventana = [number, number];
type Punto = { x: number; y: number };

/** Los vértices de la polilínea y la longitud acumulada en cada uno, para colocar el punto por fracción. */
function leerRuta(ruta: SVGPolylineElement | null): { vertices: Punto[]; acumulada: number[] } {
  const vertices: Punto[] = (ruta?.getAttribute('points') ?? '')
    .trim()
    .split(/\s+/)
    .map((par) => par.split(',').map(Number))
    .filter((xy) => xy.length === 2 && xy.every(Number.isFinite))
    .map(([x, y]) => ({ x, y }));
  const acumulada = [0];
  for (let i = 1; i < vertices.length; i++) {
    acumulada.push(acumulada[i - 1] + Math.hypot(vertices[i].x - vertices[i - 1].x, vertices[i].y - vertices[i - 1].y));
  }
  return { vertices, acumulada };
}

/** El punto a la fracción `s` (0..1) de la longitud de la polilínea. */
function puntoEn(r: ReturnType<typeof leerRuta>, s: number): Punto | null {
  const n = r.vertices.length;
  if (n === 0) return null;
  if (n === 1) return r.vertices[0];
  const total = r.acumulada[n - 1];
  const d = utils.clamp(s, 0, 1) * total;
  let i = 1;
  while (i < n - 1 && r.acumulada[i] < d) i++;
  const a = r.vertices[i - 1];
  const b = r.vertices[i];
  const largo = r.acumulada[i] - r.acumulada[i - 1];
  const f = largo > 0 ? (d - r.acumulada[i - 1]) / largo : 0;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/**
 * Monta el esquema y las cifras de UNA tarjeta en el maestro. `t0` y `dur`: el tramo quieto de la
 * tarjeta en unidades del maestro. Sin <svg class="esquema"> (o sin ventanas para su data-esquema)
 * solo quedan las cifras; sin cifras, nada: la tarjeta sigue funcionando igual.
 */
export function montarEsquema(tl: Timeline, tarjeta: HTMLElement, t0: number, dur: number, reduce: boolean): void {
  const svg = tarjeta.querySelector<SVGSVGElement>('svg.esquema');
  const ventanas = svg ? P.galeria.esquemas[svg.dataset.esquema ?? ''] : undefined;
  // Posición y duración de una ventana en el maestro. La duración nunca baja de 1: un tween de
  // duración 0 es un `set`, y el `from` explícito dejaría de contar.
  const en = (v: Ventana): { pos: number; duration: number } => ({ pos: t0 + dur * v[0], duration: Math.max(1, dur * (v[1] - v[0])) });

  if (svg && ventanas) {
    const trazables: DrawableSVGGeometry[] = [];
    const fundibles: Element[] = [];
    const ruta = leerRuta(svg.querySelector<SVGPolylineElement>('.ruta'));

    for (const el of Array.from(svg.querySelectorAll<SVGElement>('[data-paso]'))) {
      const v = ventanas[el.dataset.paso ?? ''];
      if (!v) continue;

      // EL PUNTO QUE VIAJA: aparece en su ventana (`id`) y recorre la ruta en `viaje`.
      if (el.hasAttribute('data-ruta')) {
        let s = 0;
        const colocar = (fraccion: number): void => {
          const p = puntoEn(ruta, fraccion);
          if (!p) return;
          el.setAttribute('cx', p.x.toFixed(2));
          el.setAttribute('cy', p.y.toFixed(2));
        };
        const marcha = { get s(): number { return s; }, set s(valor: number) { s = valor; colocar(valor); } };
        if (reduce) {
          colocar(1);
          utils.set(el, { opacity: 1 });
          continue;
        }
        const viaje = ventanas.viaje ?? v;
        const aparece = en(v);
        const recorre = en(viaje);
        tl.set(el, { opacity: 0 }, 0)
          .add(el, { opacity: [0, 1], duration: aparece.duration, ease: 'linear' }, aparece.pos)
          .set(marcha, { s: 0 }, 0)
          .add(marcha, { s: [0, 1], duration: recorre.duration, ease: 'linear' }, recorre.pos);
        continue;
      }

      // RÓTULOS y piezas que se funden: opacidad. FORMAS: trazado sobre el proxy.
      const fundir = !(el instanceof SVGGeometryElement) || el.hasAttribute('data-fundido');
      if (fundir) {
        if (reduce) { fundibles.push(el); continue; }
        const { pos, duration } = en(v);
        fundibles.push(el);
        tl.add(el, { opacity: [0, 1], duration, ease: 'linear' }, pos);
      } else {
        const [proxy] = createDrawable(el);
        trazables.push(proxy);
        if (reduce) continue;
        const { pos, duration } = en(v);
        tl.add(proxy, { draw: ['0 0', '0 1'], duration, ease: 'linear' }, pos);
      }
    }

    if (reduce) {
      // Estado final de una vez, y ningún tween en el maestro.
      if (trazables.length) utils.set(trazables, { draw: '0 1' });
      if (fundibles.length) utils.set(fundibles, { opacity: 1 });
    } else {
      // El estado de partida, pintado por tl.init(): nada trazado y los rótulos apagados. (La hoja
      // ya los apaga; el `set` es para que el maestro sea el único dueño del valor y lo reponga
      // al volver desde más adelante.)
      if (trazables.length) tl.set(trazables, { draw: '0 0' }, 0);
      if (fundibles.length) tl.set(fundibles, { opacity: 0 }, 0);
    }
  }

  // LAS CIFRAS del detalle, de 0 al valor en el tramo entero.
  for (const el of Array.from(tarjeta.querySelectorAll<HTMLElement>('.cifra'))) {
    const hasta = Number(el.dataset.hasta);
    if (!Number.isFinite(hasta) || reduce) continue; // con reduce se queda el valor del marcado
    el.style.minWidth = `${String(Math.round(hasta)).length}ch`;
    let valor: number | string = 0;
    const cifra = {
      get valor(): number | string { return valor; },
      set valor(v: number | string) { valor = v; el.textContent = String(v); },
    };
    tl.set(cifra, { valor: 0 }, 0)
      .add(cifra, { valor: [0, hasta], modifier: utils.roundPad(0), duration: Math.max(1, dur), ease: 'linear' }, t0);
  }
}
