import { utils, type JSAnimation } from 'animejs';
import { P } from '../params';
import type { Maestro } from '../core/maestro';

// LA CABECERA — #cabecera, fija arriba (fila 11 del informe)
// ================================================================================================
// Antes no había ni un enlace en toda la página fuera del pie: nada decía "aquí hay más" ni daba
// forma de saltar. La cabecera es lo mínimo: el monograma (vuelve al principio) y tres enlaces
// —Proyectos, Por dentro, Contacto— que llevan a la primera tarjeta, al despiece y al pie.
//
// CUÁNDO ENTRA. Con el texto del hero: mismo instante (INTRO_ON + intro.texto.delay) y misma curva,
// como hijo del maestro. Es la misma razón que tiene el texto para entrar tarde (effects/hero.ts):
// mientras las formas del logo cruzan la pantalla a quince aumentos, nada más debe moverse. Y como
// va en el maestro, quien vuelva arriba desde la galería la ve deshacerse con el resto.
// A diferencia del texto, NO se va en HERO_OUT: se queda toda la página, también sobre el pie.
//
// MIENTRAS NO ESTÁ, `inert`. A opacidad 0 los enlaces seguirían siendo pinchables y estarían en el
// orden de tabulación (el mismo problema que #bajar cuando el hero se va, ver hero.ts). `inert`
// los saca del foco y del hit-testing de una vez, y se decide por tiempo del maestro, así que se
// deshace al subir igual que la opacidad. No se usa `visibility` porque el fallback sin módulo
// (el script de cabecera destapa la página a los 2,5 s) tiene que dejar los <a> utilizables como
// anclas normales: lo son, sus href apuntan a las secciones.
//
// ADÓNDE LLEVA CADA UNO. El scroll se calcula desde el maestro (scroller.pxParaTiempo), no desde
// los id de las secciones: "Proyectos" aterriza en la primera tarjeta ya entera (el mismo cálculo
// que #bajar, `tiempoPrimeraTarjeta`), y "Por dentro" en el 30 % de COMO, donde el despiece ya
// está abierto. "Contacto" es el pie, que está fuera del maestro: scrollIntoView, que respeta el
// scroll-behavior del body (suave, y sin suavizar con reduce).

/** El tiempo del maestro en que aterrizan "Ver los proyectos" (#bajar) y el enlace Proyectos:
 *  pasado el arranque que se le regala al motor y pasado el cruce de entrada, con la primera
 *  tarjeta ya entera (el porqué de cada sumando, en P.galeria). */
export function tiempoPrimeraTarjeta(m: Maestro): number {
  return m.L.GALERIA + m.duracion('GALERIA') * P.galeria.arranque + P.galeria.margenBajar;
}

export interface Cabecera {
  actualizar(tiempo: number): void;
  revertir(): void;
}

/**
 * @param pxParaTiempo  Traductor de tiempo del maestro a scroll. Se pasa como función y no como
 *                      scroller porque la cabecera se monta ANTES de tl.init() (añade tweens al
 *                      maestro) y el scroller nace después; los clics llegan cuando ya existe.
 */
export function montarCabecera(m: Maestro, reduce: boolean, pxParaTiempo: (t: number) => number): Cabecera {
  const cab = document.querySelector<HTMLElement>('#cabecera');
  if (!cab) return { actualizar: () => undefined, revertir: () => undefined };

  const T = P.intro.texto;
  const enciende = m.L.INTRO_ON + T.delay;

  const destinos: Record<string, () => void> = {
    inicio: () => window.scrollTo({ top: 0 }),
    proyectos: () => window.scrollTo({ top: pxParaTiempo(tiempoPrimeraTarjeta(m)) }),
    dentro: () => window.scrollTo({ top: pxParaTiempo(m.L.COMO + m.duracion('COMO') * P.cabecera.dentro) }),
    contacto: () => document.querySelector('#pie')?.scrollIntoView(),
  };
  // Un solo escuchador en la cabecera: el destino lo dice `data-ir` del enlace pulsado. Sin
  // data-ir (o sin destino conocido) el enlace se comporta como el ancla que es.
  const clic = (ev: Event): void => {
    const a = (ev.target as Element | null)?.closest<HTMLAnchorElement>('a[data-ir]');
    const ir = a ? destinos[a.dataset.ir ?? ''] : undefined;
    if (!ir) return;
    ev.preventDefault();
    ir();
  };
  cab.addEventListener('click', clic);

  let fija: JSAnimation | null = null;
  if (reduce) {
    fija = utils.set(cab, { opacity: 1 });
  } else {
    m.tl.set(cab, { opacity: 0 }, 0)
      .add(cab, { opacity: [0, 1], duration: T.duration, ease: 'out(3)' }, `INTRO_ON+=${T.delay}`);
  }

  let puesta = false;
  cab.inert = true;
  return {
    actualizar(tiempo) {
      const ahora = tiempo >= enciende;
      if (ahora === puesta) return;
      puesta = ahora;
      cab.inert = !ahora;
    },
    revertir() {
      cab.removeEventListener('click', clic);
      cab.inert = false;
      puesta = false;
      fija?.revert();
    },
  };
}
