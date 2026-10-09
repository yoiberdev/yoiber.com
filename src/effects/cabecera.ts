import { utils, type JSAnimation } from 'animejs';
import { P } from '../params';
import type { Maestro } from '../core/maestro';
import type { Destino } from '../core/viaje';

// LA CABECERA — #cabecera, fija arriba (fila 11 del informe)
// ================================================================================================
// Antes no había ni un enlace en toda la página fuera del pie: nada decía "aquí hay más" ni daba
// forma de saltar. La cabecera es lo mínimo: el monograma (vuelve al principio) y dos enlaces
// —Proyectos, Contacto— que llevan a la primera tarjeta y al pie (hubo un tercero, «Por dentro», al
// despiece del motor; se fue con él el 27/09/2026).
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
// ADÓNDE LLEVA CADA UNO. "Proyectos" y "Contacto" son secciones en flujo, después del maestro: el
// borde de arriba de cada una (Proyectos, menos la cabecera). Los tres
// VIAJAN (core/viaje.ts) con destinos que se releen en cada fotograma. Antes eran scrollTo y
// scrollIntoView, y saltaban en un fotograma: el `scroll-behavior: smooth` que se suponía que los
// suavizaba estaba en el body, y el navegador solo atiende al del elemento raíz.

/** Dónde aterriza "Proyectos" (y "Ver los proyectos" del hero): el borde de arriba de la sección,
 *  que está en flujo después del maestro, menos lo que tapa la cabecera fija. */
export function alturaProyectos(): number {
  const s = document.querySelector<HTMLElement>('#proyectos');
  if (!s) return 0;
  const cab = document.querySelector<HTMLElement>('#cabecera')?.offsetHeight ?? 0;
  return Math.max(0, s.getBoundingClientRect().top + window.scrollY - cab);
}

export interface Cabecera {
  actualizar(tiempo: number): void;
  revertir(): void;
}

/** @param ir  El viaje (core/viaje.ts). */
export function montarCabecera(m: Maestro, reduce: boolean, ir: (destino: Destino) => void): Cabecera {
  const cab = document.querySelector<HTMLElement>('#cabecera');
  if (!cab) return { actualizar: () => undefined, revertir: () => undefined };

  const T = P.intro.texto;
  const enciende = m.L.INTRO_ON + T.delay;

  const pie = document.querySelector<HTMLElement>('#pie');
  const destinos: Record<string, () => void> = {
    inicio: () => ir(0),
    proyectos: () => ir(alturaProyectos),
    contacto: () => ir(() => (pie ? pie.getBoundingClientRect().top + window.scrollY : 0)),
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
