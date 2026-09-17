import { splitText, stagger, utils, type TextSplitter } from 'animejs';
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
// EL LEMA, LETRA A LETRA (tanda 4). Es la frase que lleva el mensaje y la única que se lee en los
// primeros segundos, y entraba con el mismo gesto que un pie de foto. Ahora se escribe carácter a
// carácter (x 0,35 em → 0 y opacidad) mientras se enciende el anillo. Tres decisiones:
//   · `splitText` con PALABRAS y LETRAS, sin líneas. Solo el reparto por líneas vuelve a partir el
//     texto al cambiar el ancho (text/split.js: con caché y sin plantilla de línea, `split()` no
//     toca el DOM), así que los nodos que animan los tweens del maestro no se quedan huérfanos al
//     redimensionar.
//   · Las letras siguen siendo cajas EN LÍNEA y se mueven con `left` (posición relativa), no con un
//     transform: un transform exige inline-block, y con letras en inline-block el navegador podía
//     partir una palabra a mitad.
//   · LAS LÍNEAS SON LAS DEL TEXTO SIN PARTIR. WebKit (Safari, iOS) deja de equilibrar las líneas
//     (`text-wrap: balance`) en cuanto el párrafo lleva elementos dentro, y entre 304 y 359 px de
//     ancho dejaba «mira.» sola abajo (medido; Chromium difería a 360 px justos). Así que antes de
//     partir se miden los cortes del texto normal, y después se ponen <br> en esos mismos sitios.
//   · Y AL ACABAR LAS LETRAS SE DESHACE EL PARTIDO: el texto vuelve a ser texto, con su balance, sus
//     cortes al redimensionar y una sola copia al seleccionar. No se nota, porque las líneas ya eran
//     esas. El scroll nunca lleva el maestro por debajo del final de la intro, así que los tweens de
//     las letras no vuelven a escribir; solo un remontaje repite la intro, y ese vuelve a partir.
//   · El escalón es un RANGO (P.intro.lema): 53 letras con un escalón fijo no caben antes de
//     INTRO_END.
//   · `accessible` por defecto: la frase entera queda en una copia oculta y los trozos llevan
//     aria-hidden, así que un lector la lee una vez y seguida.
// La SALIDA en HERO_OUT sigue siendo del nodo entero: las letras ya están quietas a 1 desde antes
// de INTRO_END y el nodo se las lleva; al subir, el nodo vuelve y las letras siguen en su sitio.
// Con movimiento reducido no se parte nada.
//
// EL ENLACE INVISIBLE. Cuando el hero ya se ha ido, `.intro` sigue en el centro de la ventana con
// `pointer-events: auto` (lo necesita para que #bajar se pueda pulsar) y #bajar sigue en el orden
// de tabulación a opacidad 0: un clic en mitad de la galería, o un Tab, caía en un enlace que no se
// ve. `actualizar()` pone la clase `se-fue` cuando el último en irse (el texto) ha terminado de
// irse, y base.css la traduce a `visibility: hidden`, que quita el nodo del hit-testing y del foco.
// Va por tiempo del maestro, como `viva` en galeria.ts, así que se deshace al subir.

/** Cuántos caracteres visibles (sin espacios) hay antes de cada palabra que empieza una línea nueva,
 *  en el texto tal como está maquetado ahora. */
function cortesDeLinea(el: HTMLElement): number[] {
  const cortes: number[] = [];
  const rango = document.createRange();
  const recorrido = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let cuenta = 0;
  let arriba: number | null = null;
  for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
    const txt = n.nodeValue ?? '';
    const palabra = /\S+/g;
    let m: RegExpExecArray | null;
    let hecho = 0;
    while ((m = palabra.exec(txt))) {
      cuenta += txt.slice(hecho, m.index).replace(/\s/g, '').length;
      rango.setStart(n, m.index);
      rango.setEnd(n, m.index + 1);
      const r = rango.getBoundingClientRect();
      if (arriba !== null && r.top - arriba > r.height * 0.5) cortes.push(cuenta);
      if (arriba === null || r.top - arriba > r.height * 0.5) arriba = r.top;
      cuenta += m[0].length;
      hecho = m.index + m[0].length;
    }
  }
  return cortes;
}

/** Pone un <br> delante de cada palabra partida que empieza en uno de los cortes. Si las cuentas no
 *  cuadran (un texto con algo que no cae dentro de una palabra), no toca nada y devuelve false. */
function forzarCortes(palabras: HTMLElement[], cortes: number[]): boolean {
  let cuenta = 0;
  const inicios = palabras.map((p) => {
    const i = cuenta;
    cuenta += (p.textContent ?? '').replace(/\s/g, '').length;
    return i;
  });
  const destino = cortes.map((c) => inicios.indexOf(c));
  if (destino.some((i) => i <= 0)) return false;
  for (const i of destino) palabras[i].before(document.createElement('br'));
  return true;
}

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

  let partido: TextSplitter | null = null;
  let seFue = false;
  const Lm = P.intro.lema;
  const finLetras = m.L.INTRO_ON + P.intro.texto.delay + Lm.rango + Lm.duracion;
  const actualizar = (tiempo: number): void => {
    if (partido && tiempo >= finLetras) {
      partido.revert();
      partido = null;
      lema?.classList.remove('partido');
    }
    const ahora = tiempo >= fuera;
    if (ahora === seFue || !intro) return;
    intro.classList.toggle('se-fue', ahora);
    seFue = ahora;
  };
  const revertir = (): void => {
    intro?.classList.remove('se-fue');
    seFue = false;
    partido?.revert();   // deja #lema con su HTML de index.html
    partido = null;
    lema?.classList.remove('partido');
  };

  if (reduce) {
    utils.set([velo, ...texto], { opacity: 1, y: 0 });
    tl.add([velo, ...texto], { opacity: 0, duration: dur, ease: 'linear' }, 'HERO_OUT');
    return { actualizar, revertir };
  }

  const T = P.intro.texto;
  // El velo entra ANTES que el texto y con el logo: es el suelo sobre el que se lee todo lo demás.
  tl.set(velo, { opacity: 0 }, 0)
    // (explícito, como el resto: con un valor suelto el velo saltaba de 0 a 1 en INTRO_ON)
    .add(velo, { opacity: [0, 1], duration: 1200, ease: 'linear' }, 'INTRO_ON')
    // HERO_OUT: el velo se va mientras el motor toma el centro.
    .add(velo, { opacity: [1, 0], duration: dur, ease: 'in(2)' }, 'HERO_OUT');

  // EL LEMA, partido. Si no se puede partir (sin nodo), entra con los demás como antes.
  const cortes = lema ? cortesDeLinea(lema) : [];
  partido = lema ? splitText(lema, { words: true, chars: true }) : null;
  // Con los cortes puestos, ningún otro: letra a letra se pierde el kerning entre letras y una línea
  // que en texto normal cabía por menos de un píxel (359-360 px de ancho) se partía otra vez.
  if (partido && lema && forzarCortes(partido.words, cortes)) lema.classList.add('partido');
  const letras = partido?.chars ?? [];
  const bloques = letras.length ? [nota, bajar].filter((e): e is HTMLElement => e !== null) : texto;
  if (letras.length) {
    tl.set(letras, { opacity: 0, left: Lm.x }, 0)
      .add(letras, {
        opacity: [0, 1], left: [Lm.x, '0em'], duration: Lm.duracion, ease: Lm.ease,
        delay: stagger([0, Lm.rango], { ease: Lm.reparto }),
      }, `INTRO_ON+=${T.delay}`);
  }
  if (bloques.length) {
    // [desde, hasta] EXPLÍCITOS: con composition 'none' un valor suelto toma su «desde» del estilo
    // computado al crear el tween, antes de que el `set` de arriba se haya escrito, y quedaba 1 → 1:
    // la nota y el enlace aparecían de golpe (medido: de 0 a 1 en un fotograma; ya pasaba antes).
    tl.set(bloques, { opacity: 0, y: T.y }, 0)
      .add(bloques, {
        opacity: [0, 1], y: [T.y, 0], duration: T.duration, ease: 'out(3)', delay: stagger(T.stagger),
      }, `INTRO_ON+=${T.delay + (letras.length ? Lm.resto : 0)}`);
  }
  if (texto.length) {
    tl
      // Se van en el mismo orden en que llegaron, uno tras otro. El escalón se RESTA de la duración
      // para que el último siga acabando en `dur`: si no, la clase `se-fue` (que quita el texto del
      // árbol de accesibilidad) llegaría con #bajar todavía a la vista.
      .add(texto, {
        y: [0, -120], opacity: [1, 0],
        duration: Math.max(1, dur - T.stagger * (texto.length - 1)),
        ease: 'in(2)',
        delay: stagger(T.stagger),
      }, 'HERO_OUT');
  }

  // Lo único que soltar es el partido del lema (en `revertir`); los hijos del maestro los deshace el
  // `m.tl.revert()` de main.ts.
  return { actualizar, revertir };
}
