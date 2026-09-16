import { createAnimatable, utils, type AnimatableObject } from 'animejs';
import { PM } from '../params-motor';
import type { Rig } from './rig';

const GRA = Math.PI / 180;

// EL MOTOR MIRA AL CURSOR (tanda 2, «motor-sigue-cursor»)
// ===============================================================================================
// Con un despiece abierto y el scroll quieto, el motor se inclina unos grados hacia el ratón. Es
// lo que hace que la pieza que vendemos se lea como un objeto y no como un vídeo pegado al scroll:
// en animejs.com la máquina responde, aquí no respondía a nada.
//
// FUERA DEL MAESTRO, y a propósito: el destino lo pone el ratón, no el scroll, así que no tiene un
// instante al que atarse. Se escribe en `rig.inclinacion`, un grupo entre `desvio` y `raiz` que
// NADIE más toca, así que no pisa ni a la timeline (que mueve `raiz`) ni a la composición (que
// mueve `desvio`).
//
// `createAnimatable` y no un `animate` por evento: el ratón manda decenas de destinos por segundo
// y crear una animación en cada uno es caro y además se pisan. El animatable mantiene UNA animación
// por propiedad y solo le cambia el destino (ANIMEJS-API.md, 4.5).
//
// Apagado con movimiento reducido y con puntero grueso (un dedo no tiene "posición en reposo": el
// motor saltaría a donde se tocó y se quedaría ahí).

export interface Cursor {
  /** Escribe la inclinación con la ganancia del momento (0 = quieto de frente). Por fotograma. */
  aplicar(ganancia: number): void;
  revertir(): void;
}

export function montarCursor(rig: Rig, reduce: boolean): Cursor {
  const grueso = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (reduce || grueso) {
    return { aplicar() {}, revertir() {} };
  }
  const C = PM.motor.cursor;
  const destino = { rx: 0, ry: 0 };
  const sigue = createAnimatable(destino, { rx: C.ms, ry: C.ms, ease: C.ease }) as AnimatableObject;

  const mover = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    const nx = utils.clamp(utils.mapRange(e.clientX, 0, window.innerWidth, -1, 1), -1, 1);
    const ny = utils.clamp(utils.mapRange(e.clientY, 0, window.innerHeight, -1, 1), -1, 1);
    sigue.ry(nx * C.max[1]).rx(ny * C.max[0]);
  };
  // Al salir de la ventana, vuelve de frente: si no, se quedaría mirando al último sitio.
  const salir = (): void => { sigue.rx(0).ry(0); };
  window.addEventListener('pointermove', mover, { passive: true });
  document.documentElement.addEventListener('pointerleave', salir);

  return {
    aplicar(ganancia: number): void {
      rig.inclinacion.rotation.x = ganancia * destino.rx * GRA;
      rig.inclinacion.rotation.y = ganancia * destino.ry * GRA;
    },
    revertir(): void {
      window.removeEventListener('pointermove', mover);
      document.documentElement.removeEventListener('pointerleave', salir);
      sigue.revert();
      rig.inclinacion.rotation.set(0, 0, 0);
    },
  };
}
