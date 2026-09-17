import { animate, type JSAnimation } from 'animejs';
import { P } from '../params';

// EL TITULAR DEL CAPÍTULO — #rotulo, arriba a la izquierda
// ================================================================================================
// Antes era un rótulo de 0,85 rem abajo a la izquierda ("galería · 2 / 5"). Ahora es el titular
// del capítulo (Proyectos, Por dentro, Encendido) y, debajo, el contador de la galería. Qué nombre
// toca en cada instante lo decide main.ts desde el reloj (NOMBRES) y lo pasa por `pintar()`.
//
// POR QUÉ VA FUERA DEL MAESTRO. Todo lo demás de la página es función del reloj: se le hace seek y
// queda exactamente como estaría en ese instante. El titular no: su gesto de entrada es la REACCIÓN
// a un cambio de estado —el nombre acaba de cambiar— y no tiene un instante del maestro al que
// atarse. Escribirlo en la timeline obligaría a repetir el mismo tween en cada frontera de capítulo
// y, aun así, al arrastrar la sub-nav de CIERRE a GALERIA el cabezal cruzaría al revés el tween de
// COMO y el titular saldría con el gesto de otro capítulo. Como `animate()` suelto de 380 ms se
// dispara una vez por cambio, da igual desde dónde venga el scroll, y si el visitante cruza dos
// fronteras seguidas el gesto anterior se revierte antes de arrancar el nuevo.
const GESTO = P.titulo.gesto;

// EL PULSO DEL ARCO (tanda 5), por la misma razón: el cambio de tarjeta es un cambio de estado. Un
// segmento LLENO engorda un instante (50 ms arriba, 100 abajo); si llega otro cambio antes de acabar,
// el pulso anterior se revierte y deja el trazo limpio.
const PULSO = P.titulo.pulso;

export interface Titulo {
  /** Escribe nombre y contador. Si el nombre cambia, entra con el gesto; con reduce, solo cambia el
   *  texto. `indice` es la tarjeta del contador (-1 sin tarjeta): al cambiar, su segmento late. */
  pintar(nombre: string, contador: string, indice?: number): void;
  revertir(): void;
}

export function montarTitulo(reduce: boolean): Titulo {
  const nombre = document.querySelector<HTMLElement>('#capitulo-nombre');
  const progreso = document.querySelector<HTMLElement>('#capitulo-progreso');
  let gesto: JSAnimation | null = null;
  let pulso: JSAnimation | null = null;
  let actual = '';
  let indiceActual = -1;

  const latir = (k: number): void => {
    pulso?.revert();
    pulso = null;
    const seg = document.querySelectorAll<SVGPathElement>('#capitulo-arco .segmento')[k];
    if (reduce || !seg) return;
    const reposo = parseFloat(getComputedStyle(seg).strokeWidth) || 2;
    pulso = animate(seg, {
      strokeWidth: [
        { from: reposo, to: PULSO.pico, duration: PULSO.sube, ease: 'out(4)' },
        { to: reposo, duration: PULSO.baja, ease: 'inOut(2)' },
      ],
      onComplete: (a) => a.revert(),
    });
  };

  return {
    pintar(n, c, k = -1) {
      // El contador cambia cada tarjeta y no lleva gesto: escribir el DOM solo cuando cambia. Lo que
      // late es el segmento del arco de la tarjeta que entra.
      if (progreso && progreso.textContent !== c) progreso.textContent = c;
      if (k !== indiceActual) {
        const antes = indiceActual;
        indiceActual = k;
        // Al AVANZAR late el segmento que se acaba de completar (el nuevo aún está en '0 0' y no se
        // vería); al retroceder, el de la tarjeta a la que se vuelve, que está lleno.
        if (k >= 0 && antes >= 0) latir(k > antes ? k - 1 : k);
      }
      if (!nombre || n === actual) return;
      actual = n;
      gesto?.revert();   // deja el nodo sin estilos en línea: el siguiente gesto parte de limpio
      gesto = null;
      nombre.textContent = n;
      // Vacío (INTRO, HERO_OUT, el pie): no hay nada que hacer entrar.
      if (reduce || !n) return;
      // `animate()` hace init() al crearse: el `from` (opacity 0, y 14) se pinta en este mismo tic.
      gesto = animate(nombre, { opacity: [0, 1], y: [GESTO.y, 0], duration: GESTO.duration, ease: GESTO.ease });
    },
    revertir() {
      gesto?.revert();
      gesto = null;
      pulso?.revert();
      pulso = null;
      indiceActual = -1;
      actual = '';
      if (nombre) nombre.textContent = '';
      if (progreso) progreso.textContent = '';
    },
  };
}
