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

export interface Titulo {
  /** Escribe nombre y contador. Si el nombre cambia, entra con el gesto; con reduce, solo cambia el texto. */
  pintar(nombre: string, contador: string): void;
  revertir(): void;
}

export function montarTitulo(reduce: boolean): Titulo {
  const nombre = document.querySelector<HTMLElement>('#capitulo-nombre');
  const progreso = document.querySelector<HTMLElement>('#capitulo-progreso');
  let gesto: JSAnimation | null = null;
  let actual = '';

  return {
    pintar(n, c) {
      // El contador cambia cada tarjeta y no lleva gesto: escribir el DOM solo cuando cambia.
      if (progreso && progreso.textContent !== c) progreso.textContent = c;
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
      actual = '';
      if (nombre) nombre.textContent = '';
      if (progreso) progreso.textContent = '';
    },
  };
}
