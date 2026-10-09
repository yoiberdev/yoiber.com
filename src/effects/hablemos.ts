import { animate, onScroll, stagger, utils, type JSAnimation } from 'animejs';
import { P } from '../params';

// LA FRASE DE CIERRE — #hablemos, en flujo antes del pie (09/10/2026)
// ================================================================================================
// Antes era una capa fija con su tramo en el maestro (CIERRE, dos alturas). Ahora es una sección
// normal: sus tres piezas (titular, frase y botones) suben con el scroll mientras la sección entra,
// con scrub exacto como el pie (effects/pie.ts, donde está el porqué de `sync: true`).
// LA FRASE ES PROVISIONAL: vive en index.html y este módulo anima lo que haya dentro.

export function montarHablemos(reduce: boolean): () => void {
  const seccion = document.querySelector<HTMLElement>('#hablemos');
  if (!seccion) return () => undefined;
  const piezas = Array.from(seccion.children) as HTMLElement[];
  const E = P.pie.entrada;
  const entrada: JSAnimation = reduce
    ? utils.set(piezas, { opacity: 1, y: 0 })
    : animate(piezas, {
        opacity: [0, 1],
        y: [E.y * 1.5, 0],
        duration: E.duration,
        ease: E.ease,
        delay: stagger(E.stagger),
        autoplay: onScroll({ target: seccion, enter: 'bottom top', leave: 'center top', sync: true }),
      });
  return () => entrada.revert();
}
