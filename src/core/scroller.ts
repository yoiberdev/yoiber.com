import { createTimer, utils, type Timer } from 'animejs';
import { P } from '../params';
import type { Maestro } from './maestro';

// EL SCROLLER: del scroll al tiempo del maestro, con suavizado
// ================================================================================================
// Cada <section data-label="X"> de #capitulos "pasa" por el viewport desde que su borde superior
// asoma por abajo hasta que su borde inferior toca el borde inferior: ese recorrido en píxeles es
// el tramo [ini, fin] y se traduce linealmente a [L.X, L.X_END]. Así 1 px de scroll = 1 unidad
// del maestro, los tramos son contiguos y el último también se recorre entero. `maxScroll` es el
// scroll en que el borde inferior de #capitulos toca el de la ventana, o sea el final del maestro:
// el pie (<footer id="pie">, en flujo detrás) queda más allá y no cuenta. Con scrollHeight - vh la
// sub-nav mapeaba su 100 % al fondo del pie y el cursor iba un viewport por delante del capítulo.
//
// POR QUÉ NO USA EL SUAVIZADO DE onScroll (sync: 0,9) — fila 17 del informe, medido aquí.
// La versión anterior era el patrón "timeline con autoplay: onScroll({ sync })" que anima el proxy.
// Ese suavizado es un lerp POR FOTOGRAMA (events/scroll.js:843) que solo sigue vivo mientras un
// Timer de 500 ms (`wakeTicker`, scroll.js:157) esté corriendo, y ese Timer se reinicia únicamente
// desde `handleScroll` cuando el progreso enlazado no es 0 ni 1 (scroll.js:850). Dos agujeros:
//   1) un fotograma de más de 500 ms (el análisis del trozo 3D de 617 kB, un GC, la pestaña
//      ocluida; aquí, SwiftShader) completa el Timer, que pausa el `scrollTicker`, y el proxy se
//      queda donde iba hasta el siguiente evento `scroll` real. Medido: de CIERRE 50 % a GALERIA
//      30 %, proxy clavado en 15 693 durante 4 s con el scroll ya en 3 600 (esperado 10 100).
//   2) al reconstruir tras un resize, `tl.revert()` e `init()` escriben en el proxy el `from` del
//      primer tween (5 100 = HERO_OUT) y el lerp arranca de progreso 0: la página saltaba de
//      GALERIA 50 % a HERO_OUT (proxy 7 458) y volvía a subir; y como el progreso era 0, nadie
//      reiniciaba el Timer. Y aun sin agujeros, 27 pasos de 0,181 son 0,45 s a 60 fps pero 2,7 s a
//      10 fps: la sensación dependía de la máquina.
// Aquí el suavizado es propio y POR TIEMPO: un Timer sin duración que en cada tic lee el scroll, lo
// traduce y acerca el proxy al objetivo con k = 1 - (1 - 0,181)^(dt / 16,7 ms). Se despierta con
// cada evento `scroll` y se para solo cuando ha llegado, así que ningún fotograma largo lo mata
// (un dt grande solo hace k -> 1) y a cualquier fps recorre la misma fracción del camino por
// segundo. `P.scroll.sync` sigue siendo el mismo número con la misma fórmula que le daba la
// librería: factor por fotograma = 0,01 + 0,19 · sync (0,181 con 0,9); sync >= 1 es scrub exacto.
export interface Proxy { currentTime: number }
export interface TramoPx { X: string; ini: number; fin: number }

export interface Scroller {
  tramos: TramoPx[];
  /** Scroll en el que termina el maestro (borde inferior de #capitulos en el borde inferior de la ventana). */
  maxScroll: number;
  /** Rehace los tramos con la ventana actual y vuelve a perseguir el objetivo. */
  refrescar(): void;
  revertir(): void;
  pxParaTiempo(t: number): number;
  tiempoParaPx(px: number): number;
  /** El tiempo que corresponde al scroll de ahora mismo: adonde va el proxy. */
  objetivo(): number;
  /** true cuando el proxy ha llegado al objetivo y el suavizado está parado. */
  quieto(): boolean;
  /** scrollY / maxScroll, crudo y sin suavizar: es lo que sigue el cursor de la sub-nav. */
  progreso(): number;
}

// Los dos números del suavizado que no son de diseño (ver P.scroll.suavizado).
const SUAVIZADO = P.scroll.suavizado;

/**
 * @param manda  El traspaso de la intro: mientras devuelva false el scroller no toca el proxy (la
 *               intro corre por tiempo y el visitante no ha bajado). Lo decide main.ts.
 */
export function crearScroller(m: Maestro, proxy: Proxy, alActualizar: () => void, manda: () => boolean = () => true): Scroller {
  const secciones = Array.from(document.querySelectorAll<HTMLElement>('section[data-label]'));
  const capitulos = document.querySelector<HTMLElement>('#capitulos');
  const k60 = P.scroll.sync >= 1 ? 1 : 0.01 + (0.2 - 0.01) * P.scroll.sync;
  const estado: Scroller = {
    tramos: [],
    maxScroll: 1,
    refrescar,
    revertir,
    pxParaTiempo,
    tiempoParaPx,
    objetivo: () => tiempoParaPx(window.scrollY),
    quieto: () => persecucion.paused,
    progreso: () => utils.clamp(window.scrollY / estado.maxScroll, 0, 1),
  };

  // El reloj del suavizado. `performance.now()` propio y no `deltaTime` del Timer: el de la librería
  // va un tic por detrás (render.js:129 lo calcula con el tiempo del tic anterior) y tras una pausa
  // del motor (pestaña oculta) hace falta que el primer dt sea el real, para que k llegue a 1 y el
  // proxy se clave en vez de recorrer en diferido lo que pasó con la pestaña escondida.
  let ultimo = 0;
  const persecucion: Timer = createTimer({
    autoplay: false,
    onUpdate: (self) => {
      if (!manda()) {
        self.pause(); // la intro sigue por tiempo: el siguiente `scroll` volverá a preguntar
        return;
      }
      const ahora = performance.now();
      const dt = ahora - ultimo;
      ultimo = ahora;
      const meta = tiempoParaPx(window.scrollY);
      const resto = meta - proxy.currentTime;
      if (Math.abs(resto) < SUAVIZADO.umbral) {
        proxy.currentTime = meta;
        self.pause();
      } else {
        const k = k60 >= 1 ? 1 : 1 - Math.pow(1 - k60, dt / SUAVIZADO.fotograma);
        proxy.currentTime += resto * k;
      }
      alActualizar();
    },
  });

  const despertar = (): void => {
    if (!persecucion.paused) return;
    ultimo = performance.now();
    persecucion.resume();
  };

  function construir(): void {
    const vh = window.innerHeight;
    const fondo = capitulos ? capitulos.offsetTop + capitulos.offsetHeight : document.documentElement.scrollHeight;
    const max = Math.max(1, fondo - vh);
    estado.maxScroll = max;
    estado.tramos = [];
    for (const s of secciones) {
      const X = s.dataset.label ?? '';
      if (!(X in m.L)) continue;
      const ini = utils.clamp(s.offsetTop - vh, 0, max);
      const fin = utils.clamp(s.offsetTop + s.offsetHeight - vh, 0, max);
      if (fin <= ini) continue;
      estado.tramos.push({ X, ini, fin });
    }
  }

  function refrescar(): void {
    construir();
    despertar(); // la misma posición de scroll es ahora otro tiempo: se persigue el nuevo
  }

  function revertir(): void {
    window.removeEventListener('scroll', despertar);
    persecucion.revert();
  }

  function pxParaTiempo(t: number): number {
    for (const { X, ini, fin } of estado.tramos) {
      const a = m.L[X];
      const b = m.L[`${X}_END`];
      if (t >= a && t <= b) return ini + ((t - a) / (b - a)) * (fin - ini);
    }
    return t < m.L.INTRO_END ? 0 : estado.maxScroll;
  }

  // El inverso. Antes del primer tramo (scroll 0) es su principio, que es INTRO_END: la intro ya
  // acabada. Más allá del último, su final: ahí empieza el pie y el maestro se queda en el último fotograma.
  function tiempoParaPx(px: number): number {
    const primero = estado.tramos[0];
    if (!primero) return m.L.INTRO_END;
    if (px <= primero.ini) return m.L[primero.X];
    for (const { X, ini, fin } of estado.tramos) {
      if (px <= fin) return m.L[X] + ((px - ini) / (fin - ini)) * (m.L[`${X}_END`] - m.L[X]);
    }
    const ultimoTramo = estado.tramos[estado.tramos.length - 1];
    return m.L[`${ultimoTramo.X}_END`];
  }

  window.addEventListener('scroll', despertar, { passive: true });
  refrescar(); // un primer tic coloca el maestro donde esté el scroll (recarga a mitad de página)
  return estado;
}
