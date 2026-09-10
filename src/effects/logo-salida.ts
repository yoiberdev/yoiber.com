import gsap from 'gsap';
import { P } from '../params';
import type { Maestro } from '../core/maestro';

// LA SALIDA DEL LOGO — el relevo con el motor 3D
// ================================================================================================
// En HERO_OUT el logo se retira y el motor se ensambla en su sitio. El motor lo mueve el scroll a
// través del maestro (Anime.js); el logo lo mueve GSAP. Este fichero es la costura entre los dos.
//
// EL PROBLEMA. La entrada y la flotación del logo corren en el RELOJ DE GSAP: empiezan solas, van
// hacia adelante y no saben nada del scroll. Eso está bien para la intro, que ocurre una vez. Pero
// la salida NO puede ser así: el visitante puede arrastrar el scroll hacia atrás desde la galería y
// el logo tiene que volver, exactamente, al fotograma que le corresponde. Una reproducción
// independiente (`salida.play()` al llegar a HERO_OUT) no vuelve: habría que detectar el sentido
// del scroll, y `reverse()` desde un punto cualquiera no cae en el mismo sitio que el ida.
//
// LA ATADURA, en dos piezas, que es el patrón que ya usa motor/coreografia.ts (su "canal derivado"):
//   1) El MAESTRO anima un escalar: `estado.p`, de 0 a 1, colocado en la etiqueta HERO_OUT y con la
//      duración que le toca. Ese número es del maestro, no de GSAP: lo mueve el scroll, se rebobina
//      con el scroll y `seek()` lo deja siempre en el valor que corresponde al tiempo pedido.
//   2) `aplicar()` copia ese escalar a la timeline de GSAP con `progress()`. La timeline de la
//      salida se crea PAUSADA y no se reproduce nunca: solo se la coloca. main.ts llama a
//      `aplicar()` justo después de cada `m.tl.seek()`.
// Resultado: la salida es una función pura del tiempo del maestro. No hay estado que mantener, no
// hay que detectar sentido de scroll y la reversibilidad sale gratis, igual que la del motor.
//
// (No se usa `onUpdate` del hijo del maestro para escribir el progreso. Este proyecto ya tiene la
// regla escrita en coreografia.ts: "nada de onComplete/onBegin para cambiar de estado: con scrub no
// son simétricos". Un `tl.set(estado, {p:0}, 0)` —que hace falta, porque con scrub el principio es
// un sitio al que se VUELVE— no dispara `onUpdate`, así que el logo se quedaría fuera de pantalla
// al rebobinar del todo. Copiando el escalar a mano después del seek eso no puede pasar.)
//
// DOS CAPAS DE TRANSFORMACIÓN, NO UNA. La entrada y la flotación escriben en los tres `<path>`; la
// salida escribe en los tres `<g>` que los envuelven. Se componen solas (g ∘ path) y no comparten
// ni una propiedad, así que:
//   · el logo puede seguir flotando mientras se retira, sin tirones ni saltos;
//   · si el visitante hace scroll con la entrada todavía en el aire, las dos coreografías conviven
//     en vez de pelearse por la misma matriz;
//   · a progreso 0 la capa de salida es la identidad, o sea que mientras nadie baja no existe.

export type Gesto = 'retorno' | 'colapso' | 'velo';

/** El gesto que se queda. Los otros dos siguen aquí y se miran con ?salida=retorno|colapso|velo. */
export const GESTO_POR_DEFECTO: Gesto = 'colapso';

/** El punto donde se cruzan las tres formas, en unidades del viewBox (0 0 439 523). Es el vértice
 *  que comparten los tres trazados: "141.891 229.411", "141.839 229.348" y "141.84 229.347". */
const CRUCE = '141.84 229.35';

export interface Salida {
  gesto: Gesto;
  /** Copia el escalar del maestro a la timeline de GSAP. Se llama después de cada seek. */
  aplicar(): void;
  /** 0..1, para el overlay de ?debug. */
  progreso(): number;
  revertir(): void;
}

export interface OpcionesSalida {
  reduce: boolean;
  /** Se llama la primera vez que la salida deja de ser la identidad: el visitante ha bajado. */
  alEmpezar?: () => void;
  /** true cuando el logo ya está del todo fuera; false cuando vuelve a asomar. */
  alTapar?: (fuera: boolean) => void;
}

export function montarLogoSalida(m: Maestro, op: OpcionesSalida): Salida {
  const caja = document.querySelector<HTMLElement>('#logo');
  const svg = caja?.querySelector<SVGSVGElement>('.logo-svg') ?? null;
  const formas = svg ? Array.from(svg.querySelectorAll<SVGGElement>('.g-forma')) : [];

  const pedido = new URLSearchParams(location.search).get('salida');
  const gesto: Gesto = op.reduce
    ? 'velo' // con movimiento reducido no hay viajes ni giros: el logo se funde y ya está
    : pedido === 'retorno' || pedido === 'colapso' || pedido === 'velo'
      ? pedido
      : GESTO_POR_DEFECTO;

  // El escalar del maestro. Va SIEMPRE, aunque falte el SVG: el maestro tiene que quedar igual
  // en los dos casos para que las etiquetas y el resto de la página no dependan del marcado.
  const estado = { p: 0 };
  m.tl
    .set(estado, { p: 0 }, 0)
    .add(estado, {
      p: [0, 1],
      duration: m.duracion('HERO_OUT') * P.intro.salidaLogo,
      // LINEAL A PROPÓSITO: el maestro pone el CUÁNDO y GSAP el CÓMO. Toda la curva del gesto vive
      // en la timeline de abajo, que es la que hay que mirar para entender el movimiento.
      ease: 'linear',
    }, 'HERO_OUT');

  if (!caja || !svg || formas.length !== 3) {
    return { gesto, aplicar: () => undefined, progreso: () => estado.p, revertir: () => undefined };
  }
  const [triangulo, trapecio, barra] = formas;

  let tl: gsap.core.Timeline | null = null;
  let anterior = -1;
  let empezado = false;
  let tapado = false;

  function construir(): void {
    tl?.kill();
    gsap.set([caja, ...formas], { clearProps: 'transform,opacity' });

    const t = gsap.timeline({ paused: true });

    if (gesto === 'retorno') {
      // GESTO A — "por donde vinieron". Cada forma vuelve a su posición de salida de la entrada:
      // las mismas coordenadas, el mismo tamaño y el mismo giro con los que llegó, en el mismo
      // orden. Los números son los de effects/logo-intro.ts, que son los del original.
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const ida = { ease: 'power2.in', duration: 0.88 };
      t.fromTo(triangulo, { x: 0, y: 0, scale: 1, rotation: 0 },
        { ...ida, x: -vw * 1.5, y: -vh * 1.2, scale: 15, rotation: -45 }, 0)
        .fromTo(trapecio, { x: 0, y: 0, scale: 1, rotation: 0 },
          { ...ida, x: -vw * 1.8, y: vh * 1.5, scale: 18, rotation: 90 }, 0.06)
        .fromTo(barra, { x: 0, y: 0, scale: 1, rotation: 0 },
          { ...ida, x: vw * 1.8, y: -vh * 1.3, scale: 20, rotation: -60 }, 0.12)
        // La opacidad va en su propio tramo y se apaga PRONTO. Metida en los tweens de arriba
        // heredaría `power2.in` y las formas seguirían opacas justo cuando más grandes están: tres
        // manchas a 15-20 aumentos tapando el motor que está subiendo detrás.
        .to(formas, { opacity: 0, duration: 0.4, ease: 'power1.in' }, 0.1);
    } else if (gesto === 'colapso') {
      // GESTO B — "al punto donde se cruzan". Las tres formas se encogen hacia el vértice que
      // comparten (el centro de la Y) y desaparecen ahí. `svgOrigin` fija ese punto en unidades del
      // viewBox, así que las tres colapsan sobre el MISMO sitio pese a tener cajas distintas.
      // Escalonadas: primero la barra blanca (la que más pesa en la imagen), luego el trapecio y al
      // final el triángulo, que es el que deja la última chispa en el centro.
      gsap.set(formas, { svgOrigin: CRUCE });
      const dentro = { ease: 'power2.in', duration: 0.72, scale: 0.04, opacity: 0 };
      t.fromTo(barra, { scale: 1, rotation: 0, opacity: 1 }, { ...dentro, rotation: -18 }, 0)
        .fromTo(trapecio, { scale: 1, rotation: 0, opacity: 1 }, { ...dentro, rotation: 14 }, 0.1)
        .fromTo(triangulo, { scale: 1, rotation: 0, opacity: 1 }, { ...dentro, rotation: -10 }, 0.2)
        // Un empujón hacia atrás del conjunto mientras se cierra: da la sensación de que el logo se
        // mete en el hueco que el motor está ocupando, en vez de encogerse en el aire.
        .fromTo(caja, { scale: 1, y: 0 }, { scale: 0.86, y: -18, duration: 0.92, ease: 'power2.in' }, 0);
    } else {
      // GESTO C — "el motor entra por detrás y el logo se disuelve". El de control: sin viajes ni
      // colapsos, solo un empujón hacia el espectador y un fundido. Es también el de movimiento
      // reducido, y ahí se queda en el fundido a secas.
      t.fromTo(caja, { scale: 1, opacity: 1 },
        op.reduce
          ? { opacity: 0, duration: 1, ease: 'none' }
          : { scale: 1.18, opacity: 0, duration: 1, ease: 'power1.in' }, 0);
    }

    tl = t;
    anterior = -1;
  }

  function aplicar(): void {
    if (!tl || estado.p === anterior) return;
    anterior = estado.p;
    tl.progress(gsap.utils.clamp(0, 1, estado.p));

    if (!empezado && estado.p > 0.02) {
      empezado = true;
      op.alEmpezar?.();
    }
    // Cuando el logo ya no se ve, se avisa para poder congelar la flotación: mientras dura la
    // galería entera no hay ninguna razón para seguir moviendo tres formas invisibles.
    const fuera = estado.p >= 0.999;
    if (fuera !== tapado) {
      tapado = fuera;
      op.alTapar?.(fuera);
    }
  }

  // Las coordenadas del gesto 'retorno' se miden en anchos y altos de ventana, igual que las de la
  // entrada: si la ventana cambia, la timeline se rehace y se vuelve a colocar donde tocaba.
  let temporizador = 0;
  const alRedimensionar = (): void => {
    if (gesto !== 'retorno') return;
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(() => { construir(); aplicar(); }, 250);
  };
  window.addEventListener('resize', alRedimensionar);

  construir();
  aplicar();

  return {
    gesto,
    aplicar,
    progreso: () => estado.p,
    revertir() {
      window.removeEventListener('resize', alRedimensionar);
      window.clearTimeout(temporizador);
      tl?.kill();
      tl = null;
      // Aquí SÍ se limpian los estilos, al revés que en la entrada: los <g> son andamiaje de este
      // efecto y nadie más los toca, así que dejarlos a medio camino escondería el logo para siempre
      // si el scope se rehace (un cambio de prefers-reduced-motion a mitad de HERO_OUT).
      gsap.set([caja, ...formas], { clearProps: 'all' });
    },
  };
}
