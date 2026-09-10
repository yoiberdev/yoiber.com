import { animate, onScroll, stagger, utils, type JSAnimation } from 'animejs';
import { P } from '../params';

// EL PIE DE PÁGINA — #pie, en flujo después de #capitulos
// ================================================================================================
// Es el único trozo visible de la página que NO es una capa fija: un <footer> normal que sube por
// encima de todo cuando el maestro se acaba (z-index 3 en base.css, por encima de las capas fijas,
// que van con z-index auto). El motor se ha fundido a negro en el último cuarto de CIERRE
// (PM.coreo.cierre.fundido), así que el pie asoma sobre negro y no tapa nada a medias.
//
// POR QUÉ NO ESTÁ EN EL MAESTRO. El maestro mide el scroll de #capitulos (onScroll con target
// '#capitulos' y leave 'bottom bottom', ver core/scroller.ts) y se queda en su último fotograma
// justo cuando el pie empieza a asomar: para el maestro, el pie no existe. Lo que el pie hace con
// el scroll es suyo: un segundo observador con su propio target, que lleva los bloques de 0 a 1
// mientras el pie entra por abajo hasta que su borde superior llega al centro de la ventana.
// Scrub (sync) y no "play al entrar": así al subir se deshace, igual que el resto de la página, y
// no hay un estado que solo vaya hacia delante. `autoplay: onScroll(...)` va en un `animate()`
// raíz, nunca en un hijo de timeline, donde se ignora (ANIMEJS-RECETAS 6.3).
//
// SCRUB EXACTO (sync: true) Y NO EL SUAVIZADO DEL MAESTRO (P.scroll.sync = 0,9). Medido en este
// servidor: el suavizado de v4 se hace con un lerp por fotograma que mantiene vivo un `wakeTicker`
// de 500 ms (events/scroll.js:157); si un fotograma dura más que eso —el análisis del trozo 3D, un
// GC, la pestaña en segundo plano— el ticker completa, pausa el `scrollTicker` y el lerp se queda
// donde estaba hasta el siguiente evento `scroll` de verdad. Con SwiftShader se veía a cada salto:
// los bloques del pie se quedaban al 55 % (opacidades 0,99 / 0,96 / 0,87 / 0,72) con el scroll ya
// al final del documento. El maestro tiene el mismo problema (fila 17 del informe) y lo arregla su
// carril; el pie no tiene a nadie que lo rescate, así que va 1:1 con el scroll.
const ENTRADA = P.pie.entrada;

export function montarPie(reduce: boolean): () => void {
  const pie = document.querySelector<HTMLElement>('#pie');
  if (!pie) return () => undefined;
  const bloques = Array.from(pie.querySelectorAll<HTMLElement>('.pie-bloque'));
  const arriba = pie.querySelector<HTMLAnchorElement>('#arriba');

  // "Volver arriba": al principio del documento, que es el hero con el logo ya montado. Sin
  // preventDefault el href="#" saltaría a 0 igual, pero de golpe y dejando "#" en la URL.
  const subir = (ev: Event): void => {
    ev.preventDefault();
    window.scrollTo({ top: 0 });
  };
  arriba?.addEventListener('click', subir);

  // Con movimiento reducido los bloques están en su sitio desde el principio. `utils.set` devuelve
  // una animación, así que también se revierte.
  const entrada: JSAnimation = reduce
    ? utils.set(bloques, { opacity: 1, y: 0 })
    : animate(bloques, {
        opacity: [0, 1],
        y: [ENTRADA.y, 0],
        duration: ENTRADA.duration,
        ease: ENTRADA.ease,
        delay: stagger(ENTRADA.stagger),
        autoplay: onScroll({ target: pie, enter: ENTRADA.enter, leave: ENTRADA.leave, sync: true }),
      });

  return () => {
    arriba?.removeEventListener('click', subir);
    entrada.revert();   // revierte también su observador (timer.revert -> autoplay.revert)
  };
}
