import { createDraggable, utils, type Draggable } from 'animejs';
import { P } from '../params';
import type { Scroller } from './scroller';

// Píldora con barra de progreso y cursor arrastrable que también mueve el scroll. Y, desde la
// fila 11 del informe, una PARADA por capítulo: un <a> con un punto sobre la barra, en el `ini`
// de su tramo, que lleva ahí de un clic.
export interface Subnav { actualizar(progreso: number): void; revertir(): void }

/** Una parada: la etiqueta del tramo (HERO_OUT, GALERIA...) y el nombre que se lee (aria-label). */
export interface Parada { X: string; nombre: string }

export function montarSubnav(scroller: Scroller, paradas: Parada[] = []): Subnav {
  const nav = document.querySelector<HTMLElement>('#subnav');
  const barra = nav?.querySelector<HTMLElement>('.barra');
  const cursor = nav?.querySelector<HTMLElement>('.cursor');
  if (!nav || !barra || !cursor) return { actualizar: () => undefined, revertir: () => undefined };

  const recorrido = (): number => Math.max(1, barra.clientWidth - cursor.offsetWidth);
  const irA = (p: number): void => window.scrollTo({ top: utils.clamp(p, 0, 1) * scroller.maxScroll });

  const drag: Draggable = createDraggable(cursor, {
    y: false,
    container: barra,
    containerFriction: 1,
    onGrab: () => nav.classList.add('is-grabbed'),
    onRelease: () => nav.classList.remove('is-grabbed'),
    onUpdate: (self) => {
      if (self.grabbed) irA(self.x / recorrido());
    },
  });

  // LAS PARADAS. El href es el id de la sección del tramo (un ancla de verdad, por si no hay
  // módulo); con módulo, el clic va al `ini` del tramo en píxeles, que es donde empieza el capítulo
  // en el maestro. stopPropagation: la barra también escucha el clic y lo traduciría a su posición.
  const anclas = paradas.map(({ X, nombre }) => {
    const a = document.createElement('a');
    a.className = 'parada';
    a.href = `#${document.querySelector<HTMLElement>(`section[data-label="${X}"]`)?.id ?? ''}`;
    a.setAttribute('aria-label', nombre);
    a.title = nombre;
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const tramo = scroller.tramos.find((t) => t.X === X);
      if (tramo) window.scrollTo({ top: tramo.ini });
    });
    barra.append(a);
    return { a, X };
  });
  // Dónde cae cada una: en la misma escala que el cursor, cuyo centro va de cursor/2 a
  // ancho - cursor/2. Se recalcula solo cuando los tramos cambian (resize): `maxScroll` lo delata.
  let maxColocado = -1;
  const colocar = (): void => {
    if (scroller.maxScroll === maxColocado) return;
    maxColocado = scroller.maxScroll;
    const ancho = cursor.offsetWidth;
    for (const { a, X } of anclas) {
      const tramo = scroller.tramos.find((t) => t.X === X);
      const p = tramo ? utils.clamp(tramo.ini / scroller.maxScroll, 0, 1) : 0;
      a.style.left = `calc(${p} * (100% - ${ancho}px) + ${ancho / 2}px)`;
    }
  };

  const clic = (ev: MouseEvent): void => {
    if (ev.target === cursor) return;
    const r = barra.getBoundingClientRect();
    irA((ev.clientX - r.left) / r.width);
  };
  barra.addEventListener('click', clic);

  const actualizar = (progreso: number): void => {
    const [a, b] = P.subnav.visible;
    nav.classList.toggle('is-visible', progreso > a && progreso < b);
    colocar();
    if (!drag.grabbed) drag.setX(progreso * recorrido(), true);
  };

  // EL CURSOR SIGUE AL SCROLL CRUDO, NO AL PROXY (fila 26 del informe). El proxy va suavizado y el
  // cursor llegaba ~200 ms tarde. `scroller.progreso()` es scrollY / maxScroll y se pinta en el
  // propio evento `scroll`, o sea antes del siguiente fotograma, sin esperar al tic del suavizado.
  // El callback del scroller también llama a `actualizar` (así el resize y el primer tic la dejan
  // bien aunque no haya evento): pintar dos veces el mismo número no cuesta nada.
  const alScroll = (): void => actualizar(scroller.progreso());
  window.addEventListener('scroll', alScroll, { passive: true });
  colocar();

  return {
    actualizar,
    revertir() {
      window.removeEventListener('scroll', alScroll);
      barra.removeEventListener('click', clic);
      for (const { a } of anclas) a.remove();
      drag.revert();
    },
  };
}
