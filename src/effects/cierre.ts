import { stagger, type AnimationParams } from 'animejs';
import { P } from '../params';
import type { Maestro } from '../core/maestro';
import type { Destino } from '../core/viaje';

// EL CIERRE — la frase final (tanda 4)
// ================================================================================================
// CIERRE eran dos alturas de scroll sin una sola frase, justo antes del contacto. Ahora entra una
// frase con UNA salida (al contacto del pie, con el viaje) y se va justo antes de que suba el pie.
// Hasta el 27/09/2026 esto pasaba mientras el motor despegaba; desde entonces el motor despega en
// la portada (tramo DESPEGUE) y el cierre es solo la frase, centrada sobre el fondo.
//
// LA FRASE ES PROVISIONAL. La tiene que escribir Yoiber; vive en index.html (#cierre-capa) y este
// módulo no sabe lo que dice: anima lo que haya dentro de `.cierre-texto`.
//
// DÓNDE VA. Es una capa fija como la de la galería, y la hoja decide el sitio (base.css): centrada.
//
// CUÁNDO. Fracciones de CIERRE en P.cierre: acaba de entrar antes del 30 %, se queda, y se va
// escalonada antes del 95 %, cuando el pie empieza a subir.
// Todo hijo del maestro con [desde, hasta] explícitos: al subir se deshace por el mismo camino.
//
// FUERA DE SU TRAMO, `visibility: hidden` (la clase `activa` la pone `actualizar` por tiempo del
// maestro): a opacidad 0 el enlace seguiría siendo pinchable y enfocable. Y sin el módulo la capa
// no se ve nunca (base.css), así que la página sin JS no lleva una frase clavada encima del hero.
// Con movimiento reducido, solo opacidad.

export interface Cierre {
  actualizar(tiempo: number): void;
  revertir(): void;
}

export function montarCierre(m: Maestro, reduce: boolean, ir: (destino: Destino) => void): Cierre {
  const capa = document.querySelector<HTMLElement>('#cierre-capa');
  const texto = capa?.querySelector<HTMLElement>('.cierre-texto');
  if (!capa || !texto) return { actualizar: () => undefined, revertir: () => undefined };
  const piezas = Array.from(texto.children) as HTMLElement[];
  const salida = texto.querySelector<HTMLAnchorElement>('[data-ir="contacto"]');
  const pie = document.querySelector<HTMLElement>('#pie');

  const C = P.cierre;
  const dur = m.duracion('CIERRE');
  const u = (f: number): number => Math.round(f * dur);
  const ini = m.L.CIERRE;
  const n = piezas.length;
  // La última pieza acaba de entrar en `entra + escalon·(n−1) + pieza` y de salir en
  // `sale + escalonSalida·(n−1) + piezaSalida`: los dos números que vigila el QA.
  const desde = ini + u(C.entra);
  const hasta = ini + u(C.sale + C.escalonSalida * (n - 1) + C.piezaSalida);
  // El ENLACE solo se puede pulsar o enfocar mientras se ve: de la mitad de su entrada a la mitad de
  // su salida. Es la última pieza, así que entra más tarde y se va más tarde que la capa.
  const iEnlace = salida ? piezas.indexOf(salida) : -1;
  const enlaceDesde = ini + u(C.entra + C.escalon * Math.max(0, iEnlace) + C.pieza * 0.5);
  const enlaceHasta = ini + u(C.sale + C.escalonSalida * Math.max(0, iEnlace) + C.piezaSalida * 0.5);

  const { tl } = m;
  const y = (a: number, b: number): AnimationParams => (reduce ? {} : { y: [a, b] });
  tl.set(texto, { opacity: 0 }, 0)
    .add(texto, { opacity: [0, 1], duration: u(C.pieza), ease: 'linear' }, desde)
    .add(texto, { opacity: [1, 0], duration: u(C.piezaSalida), ease: 'linear' }, hasta - u(C.piezaSalida));
  tl.set(piezas, { opacity: 0, ...(reduce ? {} : { y: C.y }) }, 0)
    .add(piezas, {
      opacity: [0, 1], ...y(C.y, 0), duration: u(C.pieza), ease: 'out(3)', delay: stagger(u(C.escalon)),
    }, desde)
    .add(piezas, {
      opacity: [1, 0], ...y(0, -C.y), duration: u(C.piezaSalida), ease: 'in(2)', delay: stagger(u(C.escalonSalida)),
    }, ini + u(C.sale));

  // LA SALIDA: al contacto del pie, viajando. El href (#pie) es el ancla por si no hay módulo. El
  // foco pasa al pie en el acto (sin desplazar: el scroll lo lleva el viaje), porque la capa se
  // oculta con el viaje y el foco se perdía con ella; así el siguiente Tab entra en el contacto.
  const alPulsar = (ev: Event): void => {
    ev.preventDefault();
    ir(() => (pie ? pie.getBoundingClientRect().top + window.scrollY : 0));
    pie?.focus({ preventScroll: true });
  };
  salida?.addEventListener('click', alPulsar);

  let activa = false;
  let pulsable = false;
  if (salida) salida.inert = true;
  return {
    actualizar(tiempo) {
      const ahora = tiempo > desde && tiempo < hasta;
      if (ahora !== activa) {
        activa = ahora;
        capa.classList.toggle('activa', ahora);
      }
      const enlace = tiempo > enlaceDesde && tiempo < enlaceHasta;
      if (salida && enlace !== pulsable) {
        pulsable = enlace;
        salida.inert = !enlace;
      }
    },
    revertir() {
      salida?.removeEventListener('click', alPulsar);
      capa.classList.remove('activa');
      if (salida) salida.inert = false;
      activa = false;
      // los tweens son hijos del maestro: los deshace el `m.tl.revert()` de main.ts
    },
  };
}
