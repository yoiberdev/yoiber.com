import { createDraggable, spring, type Draggable } from 'animejs';
import { Vector3 } from 'three';
import { PM } from '../params-motor';
import type { Rig } from './rig';

// ARRASTRAR EL MOTOR (tanda 5) — la única interacción directa con la pieza central
// ===============================================================================================
// El argumento del portafolio es que el motor está construido por código, y se demuestra dejando que
// el visitante lo gire: si solo se mueve con la rueda, se lee como un vídeo. En el despiece abierto
// (capítulo COMO) se puede coger con el ratón o con el dedo y girarlo sobre su eje; al soltarlo
// vuelve con un muelle. La técnica es la del disco arrastrable de animejs.com (goma al tirar,
// muelle al soltar), no su pieza.
//
// CÓMO, SIN UN SEGUNDO DUEÑO. El giro no se escribe en el grafo desde aquí: este módulo deja un
// número (`rig.arrastre.giro`, en radianes) y la coreografía, que es la única que escribe la
// guiñada de `sacudida` (la deriva), lo suma ahí. `sacudida` está DENTRO de `raiz`, así que el giro
// es sobre el eje del propio motor y la inclinación de la placa de inyectores, que ya cuenta con la
// guiñada de `sacudida`, sigue siendo exacta.
//
// EL DRAGGABLE mueve un objeto JS (`{ x }`) y no un nodo: el disparador es una capa transparente
// sobre la columna del motor. Contenedor [0, 0, 0, 0] con fricción: todo el recorrido es "fuera de
// los límites", o sea goma; y al soltar, `releaseContainerFriction` 0 y un `spring` lo devuelven a
// 0 con un rebote. La `x` se traduce a grados con un tope suave (tanh), para que tirar más no gire
// sin fin.
//
// LA CAPA solo recibe eventos con el despiece abierto (`aplicar(true)`), va sobre la COLUMNA del
// motor a todo lo alto (no sobre los rótulos laterales) y deja el scroll vertical y la ampliación al
// navegador (`touch-action: pan-y pinch-zoom`): en el teléfono, un barrido vertical sobre el motor
// sigue bajando la página. Con movimiento reducido no se crea (y el trozo 3D ni se carga).

export interface Arrastre {
  /** Por fotograma y ANTES de la coreografía: deja el giro de ahora en `rig.arrastre.giro`. */
  leer(): void;
  /** Por fotograma: si el despiece manda, coloca la capa sobre el motor y la activa; si no, la
   *  desactiva y suelta un agarre a medias. `abierto`: la apertura del despiece (0..1). */
  aplicar(activo: boolean, abierto: number): void;
  /** true mientras el visitante lo tiene cogido. */
  agarrado(): boolean;
  /** El giro de ahora, en grados (para el QA). */
  grados(): number;
  revertir(): void;
}

export function montarArrastre(rig: Rig, host: HTMLElement, reduce: boolean): Arrastre {
  const A = PM.motor.arrastre;
  rig.arrastre.giro = 0;
  if (reduce) {
    return { leer() {}, aplicar() {}, agarrado: () => false, grados: () => 0, revertir() {} };
  }
  const capa = document.createElement('div');
  capa.className = 'motor-agarre';
  capa.setAttribute('aria-hidden', 'true');
  host.append(capa);

  const mango = { x: 0, y: 0, width: 0, height: 0 };
  const drag: Draggable = createDraggable(mango, {
    trigger: capa,
    // con un objeto JS el Draggable escribe `translateX` salvo que se le diga otra cosa (draggable.js)
    x: { mapTo: 'x' },
    y: false,
    container: [0, 0, 0, 0],
    containerFriction: A.goma,
    releaseContainerFriction: 0,
    releaseEase: spring({ bounce: A.muelle.bounce, duration: A.muelle.duracion }),
    // el Draggable no tiene nada que desplazar: ni la ventana ni un contenedor
    scrollSpeed: 0,
    scrollThreshold: 0,
  });

  // Con `y: false` el Draggable deja `touch-action: pan-y`, que prohíbe ampliar con dos dedos.
  capa.style.touchAction = 'pan-y pinch-zoom';

  const GRA = Math.PI / 180;
  const aGrados = (x: number): number => A.max * Math.tanh((x * A.gradosPorPx) / A.max);
  const soltar = (): void => { if (drag.grabbed) drag.handleUp(); };

  // SOLO EL BOTÓN PRINCIPAL coge el motor (el Draggable no mira `button`): el derecho abre el menú
  // del navegador, que se traga el mouseup y dejaba el motor pegado al ratón.
  const alBajar = (e: MouseEvent): void => { if (e.button !== 0) e.stopPropagation(); };
  host.addEventListener('mousedown', alBajar, { capture: true });
  // Y si el mouseup se pierde (otra pestaña, otra aplicación, el menú contextual), se suelta: el
  // Draggable no escucha nada de eso y seguía agarrado, con el cuerpo en `grabbing` y la selección
  // de texto bloqueada en todo el documento.
  const alMover = (e: MouseEvent): void => { if (e.buttons === 0) soltar(); };
  const alOcultar = (): void => { if (document.hidden) soltar(); };
  window.addEventListener('blur', soltar);
  window.addEventListener('contextmenu', soltar);
  window.addEventListener('mousemove', alMover, { passive: true });
  document.addEventListener('visibilitychange', alOcultar);

  // EL EJE DEL DEDO. Un barrido vertical con algo de deriva lateral pasaba los 7 px del umbral del
  // Draggable y giraba el motor mientras la página bajaba. Se decide en los primeros `eje` px: si
  // domina el vertical, el gesto es un scroll y el arrastre se suelta.
  let inicio: { x: number; y: number } | null = null;
  const alTocar = (e: TouchEvent): void => {
    const t = e.touches[0];
    inicio = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null;
  };
  const alDeslizar = (e: TouchEvent): void => {
    const t = e.touches[0];
    if (!inicio || !t) return;
    const dx = Math.abs(t.clientX - inicio.x);
    const dy = Math.abs(t.clientY - inicio.y);
    if (Math.max(dx, dy) < A.eje) return;
    if (dy > dx) soltar();
    inicio = null;   // decidido: el resto del gesto ya no se mira
  };
  capa.addEventListener('touchstart', alTocar, { passive: true, capture: true });
  capa.addEventListener('touchmove', alDeslizar, { passive: true, capture: true });
  const rMaxPiezas = Math.max(0, ...PM.piezas.map((p) => p.r));

  const centro = new Vector3();
  const escala = new Vector3();
  let activa = false;
  let caja = '';
  const colocar = (abierto: number): void => {
    const r = host.getBoundingClientRect();
    const alto = Math.max(1, r.height);
    const cam = rig.camara;
    const altoVis = (cam.top - cam.bottom) / cam.zoom;
    const pxPorUnidad = alto / altoVis;
    rig.raiz.getWorldPosition(centro).project(cam);
    rig.raiz.getWorldScale(escala);
    const cx = (centro.x * 0.5 + 0.5) * r.width;
    const medio = (rig.radioMax + rMaxPiezas * abierto) * escala.x * pxPorUnidad * A.holgura;
    const x0 = Math.max(0, cx - medio);
    const x1 = Math.min(r.width, cx + medio);
    const y0 = 0;
    const y1 = alto;
    const nueva = `${Math.round(x0)},${Math.round(y0)},${Math.round(x1 - x0)},${Math.round(y1 - y0)}`;
    if (nueva === caja) return;
    caja = nueva;
    capa.style.left = `${Math.round(x0)}px`;
    capa.style.top = `${Math.round(y0)}px`;
    capa.style.width = `${Math.round(x1 - x0)}px`;
    capa.style.height = `${Math.round(y1 - y0)}px`;
  };

  return {
    leer(): void {
      rig.arrastre.giro = aGrados(drag.x) * GRA;
    },
    aplicar(activo: boolean, abierto: number): void {
      if (activo) colocar(abierto);
      if (activo !== activa) {
        activa = activo;
        capa.classList.toggle('activa', activo);
        // se cierra el despiece con el motor cogido (la rueda sigue funcionando): se suelta y vuelve
        if (!activo) soltar();
      }
    },
    agarrado: () => drag.grabbed,
    grados: () => aGrados(drag.x),
    revertir(): void {
      host.removeEventListener('mousedown', alBajar, { capture: true });
      window.removeEventListener('blur', soltar);
      window.removeEventListener('contextmenu', soltar);
      window.removeEventListener('mousemove', alMover);
      document.removeEventListener('visibilitychange', alOcultar);
      capa.removeEventListener('touchstart', alTocar, { capture: true });
      capa.removeEventListener('touchmove', alDeslizar, { capture: true });
      drag.revert();
      capa.remove();
      rig.arrastre.giro = 0;
    },
  };
}
