import { animate, utils, type JSAnimation } from 'animejs';
import { P } from '../params';

// EL VIAJE — el único sitio de la página que mueve el scroll por su cuenta (tanda 3)
// ================================================================================================
// Antes cada enlace hacía su `window.scrollTo({ top })` y todos saltaban en UN fotograma: un clic en
// «Por dentro» desde el hero pasaba 11 700 px de golpe (medido: 0 ms en Chromium) y el maestro
// cruzaba la galería entera en la cola del suavizado, sin una curva que nadie hubiera elegido. El
// `scroll-behavior: smooth` de base.css estaba en BODY, y la especificación (CSSOM View) solo hace
// caso al del elemento raíz: no suavizaba nada.
//
// Ahora todos pasan por `irA()`: un tween de Anime.js sobre un escalar 0..1 que en cada fotograma
// escribe el scroll. Lo demás de la página no se entera: el scroll se mueve como si lo moviera el
// visitante, y el maestro, la sub-nav y el motor lo siguen por el camino de siempre. Mientras el
// viaje manda, el scroller va CLAVADO al scroll (`alCambiar(true)`, core/scroller.ts): la curva es
// la del viaje, no la del viaje pasada otra vez por el suavizado.
//
// REGLAS
//   · El DESTINO puede ser una función y se relee en cada fotograma: si la ventana cambia a mitad
//     de viaje, los tramos se rehacen y el viaje llega al sitio nuevo sin saltar.
//   · Lo CANCELA cualquier gesto del visitante que mueva el scroll —rueda, dedo, puntero, teclas de
//     desplazamiento— y cualquier cambio de scroll que no haya escrito él (la barra del navegador,
//     un ancla): si el scroll no está donde lo dejó el tween, el viaje se suelta en ese fotograma.
//     Las escuchas van en CAPTURA para correr antes que nadie: una flecha en el cursor de la sub-nav
//     cancela el viaje anterior y DESPUÉS su manejador lanza el nuevo. Con modificadores (Alt+←,
//     Ctrl+Inicio) también: el atajo es del navegador, pero el visitante ya no quiere el viaje.
//   · DOS movimientos ajenos NO lo cancelan, se ABSORBEN (el viaje corre su punto de partida y
//     sigue, y como con u = 1 la partida ya no pesa, llega igual al destino):
//       - el scroll suave del propio navegador que ya venía de antes del clic (AvPág, Espacio, la
//         rueda suave), durante la GRACIA del arranque (P.viaje.gracia). Un scrollTo instantáneo no
//         lo detiene, y sin esto el primer fotograma lo tomaba por un gesto y el clic se perdía. La
//         gracia solo se abre si hubo rueda, tecla de scroll o scroll ajeno justo antes del viaje,
//         y dura fija: con un clic a 0 ms de AvPág el scroll nativo aún no ha empezado a moverse en
//         el primer fotograma, así que «hasta el primer fotograma quieto» no servía;
//       - el ajuste del navegador al cambiar el tamaño de la ventana (tope del documento, anclaje).
//   · Al rehacer los tramos tras un resize, main.ts llama a `recolocar()` justo después: el viaje
//     escribe ya la posición del destino nuevo, antes de que el scroller la traduzca. Si no, había
//     un fotograma con la posición vieja leída con los tramos nuevos (el maestro saltaba 1 200 a
//     2 000 unidades hacia delante y volvía).
//   · Con movimiento reducido, salto directo, como antes.
//   · El arrastre del cursor de la sub-nav NO pasa por aquí: tiene que mover el scroll en el mismo
//     fotograma en que se mueve el dedo.

export type Destino = number | (() => number);

export interface OpcionesViaje {
  /** ms; por defecto, según la distancia (P.viaje). */
  duracion?: number;
  ease?: string;
  /** Salto de un fotograma aunque haya movimiento (el selector de ?debug). */
  inmediato?: boolean;
}

export interface Viaje {
  irA(destino: Destino, opciones?: OpcionesViaje): void;
  /** Adónde va el viaje en curso, en px de scroll; null si no hay ninguno. */
  destino(): number | null;
  /** Escribe ya la posición que toca con el destino de ahora (tras rehacer los tramos). */
  recolocar(): void;
  cancelar(): void;
  revertir(): void;
}

const TECLAS_DE_SCROLL = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar']);

/**
 * @param alCambiar  Se llama con true al empezar un viaje y con false al acabar o cancelarse. main.ts
 *                   lo usa para clavar el scroller al scroll mientras dura.
 */
export function crearViaje(reduce: boolean, alCambiar: (activo: boolean) => void = () => undefined): Viaje {
  const V = P.viaje;
  const avance = { u: 0 };
  let anim: JSAnimation | null = null;
  let meta: () => number = () => 0;
  let desde = 0;
  let escrito = 0;
  let graciaHasta = 0;
  let ultimoAjeno = Number.NEGATIVE_INFINITY;
  let redimensionado = false;

  const topeDocumento = (): number => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const destinoAhora = (): number => utils.clamp(meta(), 0, topeDocumento());

  function soltar(): void {
    if (!anim) return;
    const a = anim;
    anim = null;
    a.cancel();   // libera los tweens y lo saca del motor; `avance` no pinta nada, no hay estilos que limpiar
    alCambiar(false);
  }

  function irA(destino: Destino, opciones: OpcionesViaje = {}): void {
    soltar();
    meta = typeof destino === 'function' ? destino : () => destino;
    desde = window.scrollY;
    const hasta = destinoAhora();
    // `scrollTo(x, y)` con dos números: respeta el scroll-behavior del elemento raíz, que es `auto`.
    // El diccionario con `behavior: 'instant'` rompe en los navegadores que aún no conocen ese valor.
    if (reduce || opciones.inmediato || Math.abs(hasta - desde) < 1) {
      window.scrollTo(0, hasta);
      return;
    }
    const pantallas = Math.abs(hasta - desde) / Math.max(1, window.innerHeight);
    const duracion = opciones.duracion ?? utils.clamp(V.base + V.porRaiz * Math.sqrt(pantallas), V.min, V.max);
    escrito = desde;
    const ahora = performance.now();
    graciaHasta = ahora - ultimoAjeno < V.reciente ? ahora + V.gracia : 0;
    redimensionado = false;
    avance.u = 0;
    alCambiar(true);
    anim = animate(avance, {
      u: [0, 1],
      duration: duracion,
      ease: opciones.ease ?? V.ease,
      composition: 'none',
      onUpdate: () => {
        if (!anim) return;
        // ¿Lo ha movido alguien más desde el último fotograma? Entonces manda él, salvo que sea el
        // scroll del navegador que ya venía de antes (gracia) o su ajuste tras un resize.
        const ajeno = window.scrollY - escrito;
        if (Math.abs(ajeno) > V.desvio) {
          if (redimensionado || performance.now() < graciaHasta) {
            desde += ajeno;
          } else {
            soltar();
            return;
          }
        }
        redimensionado = false;
        escribir();
      },
      onComplete: () => {
        if (!anim) return;
        anim = null;
        alCambiar(false);
      },
    });
  }

  function escribir(): void {
    window.scrollTo(0, desde + (destinoAhora() - desde) * avance.u);
    escrito = window.scrollY;   // lo que dejó el navegador de verdad (redondeo al píxel físico, tope)
  }

  const ajenoAhora = (): void => {
    ultimoAjeno = performance.now();
  };
  const alGesto = (): void => soltar();
  const alRueda = (): void => {
    ajenoAhora();
    soltar();
  };
  const alTeclear = (ev: KeyboardEvent): void => {
    if (!TECLAS_DE_SCROLL.has(ev.key)) return;
    ajenoAhora();
    soltar();
  };
  // Un scroll que llega SIN viaje es de otro (el navegador, el arrastre de la sub-nav): se apunta.
  const alScroll = (): void => {
    if (!anim) ajenoAhora();
  };
  const alRedimensionar = (): void => {
    if (anim) redimensionado = true;
  };
  window.addEventListener('wheel', alRueda, { passive: true, capture: true });
  window.addEventListener('scroll', alScroll, { passive: true });
  window.addEventListener('touchstart', alGesto, { passive: true, capture: true });
  window.addEventListener('pointerdown', alGesto, { capture: true });
  window.addEventListener('keydown', alTeclear, { capture: true });
  window.addEventListener('resize', alRedimensionar);

  return {
    irA,
    destino: () => (anim ? destinoAhora() : null),
    recolocar() {
      if (!anim) return;
      // lo que el navegador haya movido por su cuenta al redimensionar se absorbe antes de escribir
      desde += window.scrollY - escrito;
      redimensionado = false;
      escribir();
    },
    cancelar: soltar,
    revertir() {
      // Un viaje a medias no se deja a medias: al desmontar (también cuando cambia la preferencia de
      // movimiento reducido y el scope remonta todo) se salta al destino, que es lo que haría el
      // montaje con movimiento reducido.
      const pendiente = anim ? destinoAhora() : null;
      soltar();
      if (pendiente !== null) window.scrollTo(0, pendiente);
      window.removeEventListener('wheel', alRueda, { capture: true });
      window.removeEventListener('scroll', alScroll);
      window.removeEventListener('touchstart', alGesto, { capture: true });
      window.removeEventListener('pointerdown', alGesto, { capture: true });
      window.removeEventListener('keydown', alTeclear, { capture: true });
      window.removeEventListener('resize', alRedimensionar);
    },
  };
}
