import { animate, type JSAnimation } from 'animejs';
import { P } from '../params';

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
// CUÁNDO CORRE. Solo el de la tarjeta que manda (`.tarjeta.viva`, que pone galeria.ts), y solo si
// el esquema está visible: por debajo de cierta ventana `base.css` lo esconde con `display: none` y
// entonces animar es gastar batería para nadie. Con `prefers-reduced-motion` no se crea nada.

const NS = 'http://www.w3.org/2000/svg';

export interface VidaEsquemas {
  /** Arranca el bucle de la tarjeta que manda y pausa los demás. Se llama por fotograma.
   *  `dibujado` es lo que lleva trazado su esquema (0..1, o -1 si no hay tarjeta al mando). */
  actualizar(dibujado: number): void;
  revertir(): void;
}

interface Vivo {
  tarjeta: Element;
  svg: SVGSVGElement;
  grupo: SVGGElement;
  bucles: JSAnimation[];
  corriendo: boolean;
}

/** La caja de un <rect> del esquema, en unidades del viewBox (no en píxeles de pantalla). */
function caja(svg: SVGSVGElement, paso: string): { x: number; y: number; w: number; h: number } | null {
  const el = svg.querySelector(`[data-paso="${paso}"]`);
  if (!el || el.tagName !== 'rect') return null;
  const n = (a: string) => Number(el.getAttribute(a) ?? 0);
  return { x: n('x'), y: n('y'), w: n('width'), h: n('height') };
}

/** EL FOCO: un marco que salta de una caja a la siguiente, en bucle. */
function foco(svg: SVGSVGElement, grupo: SVGGElement, pasos: string[]): JSAnimation | null {
  const cajas = pasos.map((p) => caja(svg, p)).filter(Boolean) as { x: number; y: number; w: number; h: number }[];
  if (cajas.length < 2) return null;
  const V = P.galeria.vida;
  const el = document.createElementNS(NS, 'rect');
  el.setAttribute('class', 'foco');
  el.setAttribute('rx', '4');
  grupo.append(el);

  // Keyframes explícitos en las cuatro medidas: el salto y, después, la espera en la caja. La
  // espera es un fotograma clave "al mismo sitio", que es como Anime.js expresa un mantenerse.
  const marco = (c: { x: number; y: number; w: number; h: number }) => ({
    x: c.x - V.aire, y: c.y - V.aire, width: c.w + V.aire * 2, height: c.h + V.aire * 2,
  });
  type Clave = { to: number; duration: number; ease?: string };
  const claves: Record<string, Clave[]> = { x: [], y: [], width: [], height: [] };
  const primera = marco(cajas[0]);
  for (const nombre of Object.keys(claves)) {
    const k = claves[nombre];
    for (let i = 0; i < cajas.length; i++) {
      const m = marco(cajas[i]) as Record<string, number>;
      // el primer salto parte de la última caja, porque el bucle da la vuelta
      k.push({ to: m[nombre], duration: i === 0 ? 0 : V.salto, ease: 'inOut(3)' });
      k.push({ to: m[nombre], duration: V.espera });
    }
    k.push({ to: (primera as Record<string, number>)[nombre], duration: V.salto, ease: 'inOut(3)' });
  }
  return animate(el, {
    ...claves,
    opacity: [{ to: V.opacidad, duration: V.salto }, { to: V.opacidad, duration: (V.salto + V.espera) * cajas.length }],
    loop: true,
    autoplay: false,
  });
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

export function montarVidaEsquemas(reduce: boolean): VidaEsquemas {
  const vivos: Vivo[] = [];
  if (reduce) return { actualizar() {}, revertir() {} };

  for (const tarjeta of document.querySelectorAll('.tarjeta')) {
    const svg = tarjeta.querySelector('svg.esquema') as SVGSVGElement | null;
    if (!svg) continue;
    const nombre = svg.dataset.esquema ?? '';
    const grupo = document.createElementNS(NS, 'g');
    grupo.setAttribute('class', 'vida');
    svg.append(grupo);   // al final: por orden de documento se pinta por encima de las cajas

    const bucles: JSAnimation[] = [];
    const empujar = (a: JSAnimation | null) => { if (a) bucles.push(a); };
    switch (nombre) {
      case 'flujo':       empujar(foco(svg, grupo, ['caja1', 'caja2', 'caja3'])); break;
      case 'formulario':  empujar(foco(svg, grupo, ['campo1', 'campo2', 'campo3', 'boton'])); break;
      case 'comandas':    empujar(foco(svg, grupo, ['mesa', 'cocina', 'caja'])); break;
      // las tres rutas de la API: cada línea tiene 150 unidades libres de rótulo, sitio de sobra.
      // Salen escalonadas, que es como llegan las peticiones de verdad: no las tres a la vez.
      case 'rutas':
        empujar(chispa(grupo, [[136, 11], [296, 11]], 0));
        empujar(chispa(grupo, [[148, 32], [296, 32]], P.galeria.vida.escalon));
        empujar(chispa(grupo, [[142, 53], [296, 53]], P.galeria.vida.escalon * 2));
        break;
      case 'correlacion': empujar(chispa(grupo, verticesDeRuta(svg), 0)); break;
    }
    if (!bucles.length) { grupo.remove(); continue; }
    vivos.push({ tarjeta, svg, grupo, bucles, corriendo: false });
  }

  return {
    actualizar(dibujado: number): void {
      // La vida espera a que el scroll termine de trazar. Sin esto el foco salta a una caja que
      // el maestro no ha dibujado y aparece un recuadro suelto: el dibujo es del scroll, y esta
      // capa solo entra cuando el scroll ya ha dicho todo lo que tenía que decir.
      const trazado = dibujado >= P.galeria.vida.entra;
      for (const v of vivos) {
        // `display: none` en móvil no da caja: animar ahí es gastar batería sin que se vea nada.
        const debe = trazado && v.tarjeta.classList.contains('viva') && v.svg.getClientRects().length > 0;
        if (debe === v.corriendo) continue;
        v.corriendo = debe;
        v.grupo.style.opacity = debe ? '1' : '0';
        for (const b of v.bucles) (debe ? b.play() : b.pause());
      }
    },
    revertir(): void {
      for (const v of vivos) {
        for (const b of v.bucles) b.revert();
        v.grupo.remove();
      }
      vivos.length = 0;
    },
  };
}
