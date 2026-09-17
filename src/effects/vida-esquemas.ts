import { animate, createTimer, spring, utils, type JSAnimation, type Timer } from 'animejs';
import { P } from '../params';
import { finDelDibujo, type EstadoEsquema } from './galeria';

// LA VIDA DE LOS ESQUEMAS — lo que se mueve en la galería con el scroll PARADO
// ================================================================================================
// El hueco que cierra esto está medido, no opinado. Con el reloj suavizado ya quieto en la galería,
// a 1440×900, cambiaba por segundo:
//
//   · el lienzo del motor ........ 9,5 % de sus píxeles
//   · la tarjeta del proyecto .... 0 %
//   · el esquema de la tarjeta ... 0 %
//
// O sea: la página entera estaba muerta menos el motor. En animejs.com pasa lo contrario: sus ocho
// demos tienen CADA UNA un bucle decorativo propio que arranca al entrar la sección y se pausa al
// salir (tabla 2.3 de CANALES-ANIMEJS.md), además de su línea de tiempo scrubbeada por el scroll.
// Por eso su página parece encendida aunque no toques la rueda, y la nuestra parecía una captura
// con un motor pegado encima.
//
// LA REGLA QUE NO SE ROMPE. El maestro es el dueño del DIBUJO del esquema: `draw`, opacidad y el
// punto de la ruta son suyos y función del scroll, para que al subir se deshaga exacto. Esta capa
// NO toca ni una de esas piezas: se crea sus propios elementos (un <g class="vida"> al final del
// SVG, que por orden de documento queda por encima) y anima solo esos. Dos dueños sobre la misma
// propiedad es la forma más rápida de que el scroll hacia atrás deje de cuadrar.
//
// LA TANDA 5 hizo del foco una CADENA y no un bucle de fotogramas clave: una vuelta idéntica de 4 s
// se leía como un GIF a la segunda. Cada salto llega con un muelle (se pasa un 3,5 % y vuelve), cada
// espera dura distinto (azar con semilla fija por tarjeta) y la CAJA por la que pasa reacciona: su
// trazo engorda. Eso último rompe a medias la regla de arriba, con cuidado: la vida no toca ni el
// `draw` ni la opacidad de la caja, solo una variable CSS propia (`--toque`), y el grosor que ve el
// ojo es `--toque × --vida` (base.css). `--vida` es la intensidad de la capa que escribe
// `actualizar()` en el svg, así que al irse la tarjeta el grosor vuelve con el scroll, sin saltos.
//
// QUÉ HACE CADA UNA. Dos mecanismos, no cinco:
//   · EL FOCO: un rectángulo que salta de caja en caja siguiendo la geometría real de los
//     <rect> del esquema, leída del DOM. Es el registro avanzando por las etapas. Va POR FUERA de
//     la caja (se infla `aire` px) para no taparle el rótulo.
//   · LA CHISPA: un trazo corto que recorre una línea, hecho con stroke-dasharray. Solo donde hay
//     línea de verdad: las tres rutas de la API y la polilínea de la correlación.
//     Empezó siendo un PUNTO de 3,2 unidades y se midió: movía el 0,2 % de los píxeles del esquema
//     por segundo, o sea nada. El esquema es una tira de 416×72 px y un punto de 3,7 px en pantalla
//     no se ve moverse; un trazo encendido de 26 unidades sí. Misma idea, veinte veces más señal.
//
// CUÁNDO CORRE Y CUÁNTO SE VE. Lo decide galeria.esquemaDe(), que dice qué esquema está en
// pantalla y cuánto lleva trazado. Tres tramos:
//   · mientras el scroll traza, apagada (el foco saltaría a cajas sin dibujar: visto en captura);
//   · en cuanto acaba la última pieza, se ENCIENDE EN PROPORCIÓN a lo que avanza el scroll durante
//     `entraLargo` del tramo: es función del reloj, así que al subir se apaga por el mismo camino.
//     Antes era un umbral más una transición CSS de 240 ms: saltaba de 0 a 1 y el resultado
//     dependía de cuánto tiempo pasara después del salto;
//   · cuando la tarjeta se va, se queda a 1 y se funde CON el esquema, porque es hija suya y hereda
//     la opacidad que le pone el maestro. Antes se cortaba en seco en `fin`, 87 unidades antes de
//     que el esquema terminara de irse.
// Al encenderse, restart() y no play(): el foco empieza en la primera caja, no a medio salto.
// Y solo si el esquema está visible: por debajo de cierta ventana `base.css` lo esconde con
// `display: none` y animar sería gastar batería para nadie. Con movimiento reducido no se crea nada.
//
// EL BRILLO DE LA BARRA (tanda 4). Donde el esquema está oculto —en vertical por debajo de 900 px
// de alto: iPhone 13, Pixel 5, 360x640— la tarjeta cambiaba el 0 % de sus píxeles por segundo con
// el scroll parado, que es justo lo que esta capa vino a arreglar en escritorio. Ahí se ve la barra
// `.avance`, así que la vida va en ella: un destello que la recorre. Reglas:
//   · va en un HIJO nuevo (<span class="brillo">): el scaleX de la barra es del maestro. Como es
//     hijo, se escala con ella y solo recorre lo que la barra ya ha avanzado;
//   · se enciende con la MISMA regla que la vida del esquema (proporción a lo trazado), pero
//     preguntando por la caja de la barra y no por la del svg. Las dos cajas no existen a la vez
//     (base.css), así que en cada ventana corre una sola de las dos vidas;
//   · su opacidad es suya; la de la barra la lleva galeria.ts con la captura, y se multiplican. Y
//     sigue encendido mientras la barra se va (`soloBarra`): la barra se va con la captura, más
//     tarde que el esquema, y apagarlo con el esquema lo cortaba en seco con la barra a 2/3.
//   · lo que lo mantiene dentro de lo avanzado es el recorte de la barra (su clip-path de destape,
//     galeria.ts, y su overflow en base.css), no solo la escala.

const NS = 'http://www.w3.org/2000/svg';

export interface VidaEsquemas {
  /** Enciende el bucle del esquema que está en pantalla, en proporción a lo trazado, y apaga los
   *  demás. Se llama por fotograma con lo que devuelve galeria.esquemaDe(). */
  actualizar(estado: EstadoEsquema): void;
  /** Para el QA: cuántas cadenas de foco tienen un salto o una espera en marcha. */
  enMarcha(): number;
  revertir(): void;
}

/** Lo que se enciende y se apaga: un bucle de Anime.js o la cadena del foco. */
interface Bucle {
  restart(): unknown;
  pause(): unknown;
  revert(): unknown;
}

/** Una vida que se enciende y se apaga: su nodo, sus bucles y lo último escrito. */
interface Capa {
  barra: boolean;       // la del brillo (sigue encendida mientras la barra se va) o la del esquema
  el: HTMLElement | SVGElement;
  caja: HTMLElement | SVGElement;   // de quién se pregunta si tiene caja (el svg, o la barra)
  bucles: Bucle[];
  opacidad: string;     // la última escrita, para no ensuciar el estilo en cada fotograma
  corriendo: boolean;
}

interface Vivo {
  indice: number;       // posición de su tarjeta en la galería, la misma que usa esquemaDe()
  capas: Capa[];        // la del esquema y la del brillo de la barra, si las hay
}

/** La caja de un <rect> del esquema, en unidades del viewBox (no en píxeles de pantalla). */
function caja(svg: SVGSVGElement, paso: string): { x: number; y: number; w: number; h: number } | null {
  const el = svg.querySelector(`[data-paso="${paso}"]`);
  if (!el || el.tagName !== 'rect') return null;
  const n = (a: string) => Number(el.getAttribute(a) ?? 0);
  return { x: n('x'), y: n('y'), w: n('width'), h: n('height') };
}

/** Cuántas cadenas de foco tienen un salto o una espera en marcha (lo lee el QA por ?debug). */
let cadenasEnMarcha = 0;

/** EL FOCO: un marco que salta de una caja a la siguiente, en cadena. Cada salto es un `animate`
 *  con muelle sobre los atributos del rect, y la espera hasta el siguiente, un `createTimer` con
 *  duración al azar. Pausar corta los dos; reanudar empieza siempre por la primera caja y con la
 *  misma semilla, así que la secuencia de una tarjeta es la misma cada vez que se enciende. */
function foco(svg: SVGSVGElement, grupo: SVGGElement, pasos: string[], semilla: number): Bucle | null {
  const rects = pasos
    .map((p) => svg.querySelector(`[data-paso="${p}"]`))
    .filter((e): e is SVGRectElement => e !== null && e.tagName === 'rect');
  const cajas = pasos.map((p) => caja(svg, p)).filter(Boolean) as { x: number; y: number; w: number; h: number }[];
  if (cajas.length < 2 || rects.length !== cajas.length) return null;
  const V = P.galeria.vida;
  const el = document.createElementNS(NS, 'rect');
  el.setAttribute('class', 'foco');
  el.setAttribute('rx', '4');
  grupo.append(el);

  const marco = (c: { x: number; y: number; w: number; h: number }) => ({
    x: c.x - V.aire, y: c.y - V.aire, width: c.w + V.aire * 2, height: c.h + V.aire * 2,
  });
  const muelle = spring({ bounce: V.muelle, duration: V.salto });
  // Los límites de todos los marcos: el muelle no puede sacar el foco del esquema. Y los saltos que
  // RETROCEDEN (de la última caja a la primera, o de vuelta a la columna izquierda en el formulario)
  // van sin sobrepaso: son los largos, y con un 3,5 % de 200 unidades el marco se salía 8 fuera.
  const marcos = cajas.map((c) => marco(c));
  const tope = {
    x: [Math.min(...marcos.map((m) => m.x)), Math.max(...marcos.map((m) => m.x))],
    y: [Math.min(...marcos.map((m) => m.y)), Math.max(...marcos.map((m) => m.y))],
    width: [Math.min(...marcos.map((m) => m.width)), Math.max(...marcos.map((m) => m.width))],
    height: [Math.min(...marcos.map((m) => m.height)), Math.max(...marcos.map((m) => m.height))],
  };
  const conTope = (clave: keyof typeof tope, valor: number) => ({
    to: valor, modifier: (v: number) => utils.clamp(v, tope[clave][0], tope[clave][1]),
  });
  let azar = utils.createSeededRandom(semilla);
  let salto: JSAnimation | null = null;
  let entrada: JSAnimation | null = null;
  let espera: Timer | null = null;
  let actual = -1;
  let enMarcha = false;
  const toques: (JSAnimation | null)[] = rects.map(() => null);

  const tocar = (i: number, valor: number): void => {
    toques[i]?.cancel();
    toques[i] = animate(rects[i], {
      '--toque': valor, duration: valor > 0 ? V.toque.entra : V.toque.sale, ease: 'out(3)',
    });
  };
  const ir = (k: number): void => {
    const m = marcos[k];
    const atras = actual >= 0 && m.x < marcos[actual].x;
    salto?.cancel();
    salto = animate(el, {
      x: conTope('x', m.x), y: conTope('y', m.y), width: conTope('width', m.width), height: conTope('height', m.height),
      ...(atras ? { ease: 'out(3)', duration: V.salto } : { ease: muelle }),
    });
    if (actual >= 0 && actual !== k) tocar(actual, 0);
    tocar(k, 1);
    actual = k;
    const [a, b] = V.azar;
    const dura = V.salto + V.espera * azar(a * 1000, b * 1000) / 1000;
    espera = createTimer({ duration: dura, onComplete: () => { if (enMarcha) ir((k + 1) % cajas.length); } });
  };
  const parar = (): void => {
    if (enMarcha) cadenasEnMarcha--;
    enMarcha = false;
    espera?.cancel();
    salto?.cancel();
    entrada?.cancel();
    espera = salto = entrada = null;
    // --toque a 0 de golpe: no se ve, porque la capa ya está a 0 (--vida) cuando se pausa
    for (let i = 0; i < rects.length; i++) { toques[i]?.cancel(); toques[i] = null; }
    utils.set(rects, { '--toque': 0 });
    actual = -1;
  };
  return {
    restart(): void {
      parar();
      enMarcha = true;
      cadenasEnMarcha++;
      azar = utils.createSeededRandom(semilla);
      utils.set(el, { ...marco(cajas[0]), opacity: 0 });
      entrada = animate(el, { opacity: [0, V.opacidad], duration: V.salto, ease: 'linear' });
      ir(0);
    },
    pause: parar,
    revert(): void {
      parar();
      // (sin utils.remove sobre las cajas: se llevaría también los tweens del maestro que las dibujan)
      for (const r of rects) r.style.removeProperty('--toque');
    },
  };
}

/** LA CHISPA: un trazo corto que recorre una polilínea, en bucle, con stroke-dasharray.
 *  `retraso` reparte las de un mismo esquema para que salgan una tras otra y no a la vez. */
function chispa(grupo: SVGGElement, puntos: [number, number][], retraso: number): JSAnimation | null {
  if (puntos.length < 2) return null;
  const V = P.galeria.vida;
  let largo = 0;
  for (let i = 1; i < puntos.length; i++) {
    largo += Math.hypot(puntos[i][0] - puntos[i - 1][0], puntos[i][1] - puntos[i - 1][1]);
  }
  if (largo < 1) return null;

  const el = document.createElementNS(NS, 'polyline');
  el.setAttribute('class', 'chispa');
  el.setAttribute('points', puntos.map((p) => `${p[0]},${p[1]}`).join(' '));
  // el trazo encendido y, detrás, un hueco tan largo como la línea entera: solo se ve un tramo
  el.setAttribute('stroke-dasharray', `${V.chispa} ${largo}`);
  grupo.append(el);

  // De `chispa` a `-largo`: entra por el principio de la línea y sale por el final. El tiempo es
  // proporcional al largo para que todas las chispas del sitio vayan a la MISMA velocidad, que es
  // lo que hace que parezcan la misma cosa y no cinco animaciones distintas.
  return animate(el, {
    strokeDashoffset: [V.chispa, -largo],
    duration: (largo / 100) * V.viaje,
    delay: retraso,
    loopDelay: V.respiro,
    ease: 'linear',
    loop: true,
    autoplay: false,
  });
}

/** Los vértices de la polilínea `.ruta` que ya existe para el punto del scroll. Se leen del
 *  atributo `points`, no con getPointAtLength, que en un SVG con `display: none` no está definido
 *  (la misma trampa que ya mordió en esquemas.ts). */
function verticesDeRuta(svg: SVGSVGElement): [number, number][] {
  const ruta = svg.querySelector('polyline.ruta');
  if (!ruta) return [];
  const v = (ruta.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number);
  const puntos: [number, number][] = [];
  for (let i = 0; i + 1 < v.length; i += 2) puntos.push([v[i], v[i + 1]]);
  return puntos;
}

/** EL BRILLO: un destello que recorre la barra de avance, en bucle. */
function brillo(barra: HTMLElement): { el: HTMLElement; anim: JSAnimation } {
  const B = P.galeria.vida.brillo;
  const el = document.createElement('span');
  el.className = 'brillo';
  el.setAttribute('aria-hidden', 'true');
  el.style.width = `${B.largo * 100}%`;
  barra.append(el);
  // En % de su PROPIO ancho: de fuera por la izquierda (-100 %) a fuera por la derecha (1 / largo).
  const fin = `${(100 / B.largo).toFixed(2)}%`;
  const anim = animate(el, {
    x: ['-100%', fin],
    duration: B.viaje,
    ease: B.ease,
    loop: true,
    loopDelay: B.respiro,
    autoplay: false,
  });
  return { el, anim };
}

export function montarVidaEsquemas(reduce: boolean): VidaEsquemas {
  const vivos: Vivo[] = [];
  if (reduce) return { actualizar() {}, enMarcha: () => 0, revertir() {} };

  const tarjetas = Array.from(document.querySelectorAll('#galeria-tarjetas .tarjeta'));
  for (const [indice, tarjeta] of tarjetas.entries()) {
    const capas: Capa[] = [];
    const barra = tarjeta.querySelector<HTMLElement>('.avance');
    if (barra) {
      const b = brillo(barra);
      capas.push({ barra: true, el: b.el, caja: barra, bucles: [b.anim], opacidad: '', corriendo: false });
    }
    const svg = tarjeta.querySelector('svg.esquema') as SVGSVGElement | null;
    if (!svg) {
      if (capas.length) vivos.push({ indice, capas });
      continue;
    }
    const nombre = svg.dataset.esquema ?? '';
    const grupo = document.createElementNS(NS, 'g');
    grupo.setAttribute('class', 'vida');
    svg.append(grupo);   // al final: por orden de documento se pinta por encima de las cajas

    const bucles: Bucle[] = [];
    const empujar = (a: Bucle | null) => { if (a) bucles.push(a); };
    const semilla = P.galeria.vida.semilla + indice;
    switch (nombre) {
      case 'flujo':       empujar(foco(svg, grupo, ['caja1', 'caja2', 'caja3'], semilla)); break;
      case 'formulario':  empujar(foco(svg, grupo, ['campo1', 'campo2', 'campo3', 'boton'], semilla)); break;
      case 'comandas':    empujar(foco(svg, grupo, ['mesa', 'cocina', 'caja'], semilla)); break;
      // las tres rutas de la API: cada línea tiene 150 unidades libres de rótulo, sitio de sobra.
      // Salen escalonadas, que es como llegan las peticiones de verdad: no las tres a la vez.
      case 'rutas':
        empujar(chispa(grupo, [[136, 11], [296, 11]], 0));
        empujar(chispa(grupo, [[148, 32], [296, 32]], P.galeria.vida.escalon));
        empujar(chispa(grupo, [[142, 53], [296, 53]], P.galeria.vida.escalon * 2));
        break;
      case 'correlacion': empujar(chispa(grupo, verticesDeRuta(svg), 0)); break;
    }
    if (bucles.length) capas.push({ barra: false, el: grupo, caja: svg, bucles, opacidad: '', corriendo: false });
    else grupo.remove();
    if (capas.length) vivos.push({ indice, capas });
  }

  return {
    actualizar({ i, f, soloBarra }: EstadoEsquema): void {
      const desde = finDelDibujo();
      const largo = P.galeria.vida.entraLargo;
      const kTarjeta = f >= 0 ? Math.min(1, Math.max(0, (f - desde) / largo)) : 0;
      for (const v of vivos) {
        for (const c of v.capas) {
          let k = 0;
          // `display: none` no da caja: el esquema en los teléfonos bajos, la barra en el resto.
          if (v.indice === i && kTarjeta > 0 && (c.barra || !soloBarra) && c.caja.getClientRects().length > 0) k = kTarjeta;
          const op = k.toFixed(3);
          if (op !== c.opacidad) {
            c.el.style.opacity = op;
            c.opacidad = op;
            // la intensidad con que reaccionan las cajas del esquema (base.css, --toque × --vida)
            if (!c.barra) c.caja.style.setProperty('--vida', op);
          }
          const debe = k > 0;
          if (debe === c.corriendo) continue;
          c.corriendo = debe;
          for (const b of c.bucles) (debe ? b.restart() : b.pause());
        }
      }
    },
    enMarcha: () => cadenasEnMarcha,
    revertir(): void {
      for (const v of vivos) {
        for (const c of v.capas) {
          for (const b of c.bucles) b.revert();
          c.el.remove();
          if (!c.barra) c.caja.style.removeProperty('--vida');
        }
      }
      vivos.length = 0;
    },
  };
}
