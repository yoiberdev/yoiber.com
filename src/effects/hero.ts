import { stagger, utils } from 'animejs';
import { P } from '../params';
import type { Maestro } from '../core/maestro';

// EL TEXTO DEL HERO — lo que queda debajo del logo
// ================================================================================================
// Sustituye a effects/intro.ts (el titular "yoiber." de texto partido con splitText, borrado).
//
// POR QUÉ SE VA EL TITULAR Y SE QUEDA EL RESTO. El logo de yoiber.com ES la marca: sus tres formas
// dibujan la Y del monograma. Poner debajo, a 9 rem, la palabra "yoiber" en letra era decir dos
// veces lo mismo, y además se solapaban (el logo mide hasta 320 px y el h1 estaba pegado a él).
// Lo que queda debajo dice lo que el logo no dice: el lema (#lema), una línea de qué hace Yoiber
// (#nota) y el enlace a los proyectos (#bajar, con la flecha en bucle por CSS). Eso es contenido,
// no decoración, y se queda como subtítulo del logo. Con el titular se fue también el punto de
// acento y su pulso: era el remate tipográfico del h1.
//
// QUIÉN ANIMA QUÉ EN EL HERO. Dos librerías y una frontera limpia:
//   · el LOGO, con GSAP:  effects/logo-intro.ts (entrada + flotación) y effects/logo-salida.ts.
//   · el TEXTO y el VELO, con Anime.js y dentro del maestro: este fichero.
// No comparten ni un nodo, así que no hay dos escritores para ninguna propiedad.
//
// CUÁNDO ENTRA EL TEXTO. Tarde, a propósito: `P.intro.texto.delay` está medido para que el logo ya
// esté montado. Si el texto subiera a la vez que las formas cruzan la pantalla a 15 aumentos, se
// leería como parte del ruido; apareciendo después, el logo aterriza y entonces la página se
// presenta. Como es un hijo del maestro y no un `animate()` suelto, sigue siendo reversible con el
// scroll: quien vuelva arriba desde la galería lo ve deshacerse.
//
// EL ENLACE INVISIBLE. Cuando el hero ya se ha ido, `.intro` sigue en el centro de la ventana con
// `pointer-events: auto` (lo necesita para que #bajar se pueda pulsar) y #bajar sigue en el orden
// de tabulación a opacidad 0: un clic en mitad de la galería, o un Tab, caía en un enlace que no se
// ve. `actualizar()` pone la clase `se-fue` cuando el último en irse (el texto) ha terminado de
// irse, y base.css la traduce a `visibility: hidden`, que quita el nodo del hit-testing y del foco.
// Va por tiempo del maestro, como `viva` en galeria.ts, así que se deshace al subir.

export interface Hero {
  actualizar(tiempo: number): void;
  revertir(): void;
}

export function montarHero(m: Maestro, reduce: boolean): Hero {
  const { tl } = m;
  const intro = document.querySelector<HTMLElement>('#hero .intro');
  const velo = document.querySelector<HTMLElement>('#velo');
  const lema = document.querySelector<HTMLElement>('#lema');
  const nota = document.querySelector<HTMLElement>('#nota');
  const bajar = document.querySelector<HTMLElement>('#bajar');
  if (!velo) return { actualizar: () => undefined, revertir: () => undefined };

  // Los tres textos se buscan por separado: si alguno falta del marcado, los demás se animan igual.
  const texto = [lema, nota, bajar].filter((e): e is HTMLElement => e !== null);
  const dur = m.duracion('HERO_OUT') * P.intro.salidaTexto;
  // El texto es lo último que se va (salidaTexto > salidaLogo): cuando termina, no queda nada.
  const fuera = m.L.HERO_OUT + m.duracion('HERO_OUT') * Math.max(P.intro.salidaTexto, P.intro.salidaLogo);

  let seFue = false;
  const actualizar = (tiempo: number): void => {
    const ahora = tiempo >= fuera;
    if (ahora === seFue || !intro) return;
    intro.classList.toggle('se-fue', ahora);
    seFue = ahora;
  };
  const revertir = (): void => {
    intro?.classList.remove('se-fue');
    seFue = false;
  };

  if (reduce) {
    utils.set([velo, ...texto], { opacity: 1, y: 0 });
    tl.add([velo, ...texto], { opacity: 0, duration: dur, ease: 'linear' }, 'HERO_OUT');
    return { actualizar, revertir };
  }

  const T = P.intro.texto;
  // El velo entra ANTES que el texto y con el logo: es el suelo sobre el que se lee todo lo demás.
  tl.set(velo, { opacity: 0 }, 0)
    .add(velo, { opacity: 1, duration: 1200, ease: 'linear' }, 'INTRO_ON')
    // HERO_OUT: el velo se va mientras el motor toma el centro.
    .add(velo, { opacity: 0, duration: dur, ease: 'in(2)' }, 'HERO_OUT');

  if (texto.length) {
    tl.set(texto, { opacity: 0, y: T.y }, 0)
      .add(texto, {
        opacity: 1, y: 0, duration: T.duration, ease: 'out(3)', delay: stagger(T.stagger),
      }, `INTRO_ON+=${T.delay}`)
      .add(texto, { y: -120, opacity: 0, duration: dur, ease: 'in(2)' }, 'HERO_OUT');
  }

  // Nada más que soltar: no hay nodos creados ni escuchadores, y los hijos del maestro los deshace
  // el `m.tl.revert()` de main.ts.
  return { actualizar, revertir };
}
