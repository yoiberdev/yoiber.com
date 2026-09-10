import { createTimeline, type Timeline } from 'animejs';
import { P } from '../params';

// Orden propio de capítulos. Cada tramo dura alturas × 1000 unidades y ocupa alturas × 100lvh de scroll,
// así todos los tramos avanzan a la misma velocidad percibida.
export const ORDEN = ['HERO_OUT', 'GALERIA', 'COMO', 'CIERRE'] as const;
export type Tramo = (typeof ORDEN)[number];

export interface Maestro {
  tl: Timeline;
  L: Record<string, number>;
  total: number;
  duracion(tramo: Tramo): number;
}

export function crearMaestro(): Maestro {
  const tl = createTimeline({ autoplay: false, defaults: { ease: 'inOut(3)', composition: 'none' } });
  const L: Record<string, number> = { INTRO: 0, INTRO_ON: P.intro.on, INTRO_END: P.scroll.introDuration };
  let t = P.scroll.introDuration;
  for (const x of ORDEN) {
    L[x] = t;
    t += P.scroll.alturas[x] * 1000;
    L[`${x}_END`] = t;
  }
  for (const [nombre, pos] of Object.entries(L)) tl.label(nombre, pos);
  return { tl, L, total: t, duracion: (x) => L[`${x}_END`] - L[x] };
}

// Capítulo activo (para el rótulo y la sub-nav) a partir del tiempo del maestro.
export function tramoActual(m: Maestro, tiempo: number): { tramo: Tramo | 'INTRO'; progreso: number } {
  if (tiempo < m.L.INTRO_END) return { tramo: 'INTRO', progreso: tiempo / m.L.INTRO_END };
  for (const x of ORDEN) {
    if (tiempo < m.L[`${x}_END`] || x === 'CIERRE') {
      return { tramo: x, progreso: Math.min(1, (tiempo - m.L[x]) / m.duracion(x)) };
    }
  }
  return { tramo: 'CIERRE', progreso: 1 };
}
