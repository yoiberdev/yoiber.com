import { createAnimatable, createDraggable, utils, type AnimatableObject, type Draggable } from 'animejs';
import { P } from '../params';
import type { Scroller } from './scroller';
import type { Viaje } from './viaje';

// Píldora con barra de progreso y cursor arrastrable que también mueve el scroll. Y, desde la
// fila 11 del informe, una PARADA por capítulo: un <a> con un punto sobre la barra, en el `ini`
// de su tramo, que lleva ahí de un clic.
//
// LA TANDA 3 (navegación que viaja) la reescribió entera, porque sus cinco huecos pasaban por aquí:
//   · los clics (paradas y barra) VIAJAN con core/viaje.ts en vez de saltar; el arrastre no, que
//     tiene que mover el scroll en el mismo fotograma que el dedo;
//   · el cursor es un deslizador DE VERDAD: `aria-valuenow/min/max/valuetext`, flechas, RePag/AvPag
//     de capítulo en capítulo, Inicio y Fin. Antes se enfocaba con Tab y no hacía nada, y un lector
//     de pantalla anunciaba «deslizador» sin valor;
//   · oculta, es `inert`: antes se podía enfocar un control invisible. Con el foco dentro no se
//     oculta, porque Inicio y Fin llevan el progreso fuera de `visible` y el foco se perdía;
//   · el cursor mide 4 px: se agarra por un área de 24 px (un ::before en base.css) y su MARCA, un
//     hijo, crece al pasar el ratón y al agarrarlo. En un hijo y no en el cursor, porque el
//     Draggable escribe el `transform` del cursor, y la propiedad CSS `scale` se aplica DESPUÉS del
//     transform: escalaría también el translateX y el cursor saltaría de sitio;
//   · las 32 rayitas no eran la rejilla de nada. Ahora son las ESTACIONES, los fotogramas pensados
//     para verse quietos (cada tarjeta entera y cada capítulo): el clic en la barra viaja a la más
//     cercana y el cursor, al soltarlo cerca de una, encaja en ella (el imán).
export interface Subnav { actualizar(progreso: number): void; revertir(): void }

/** Una parada: la etiqueta del tramo (HERO_OUT, GALERIA...) y el nombre que se lee (aria-label).
 *  `destino`, si lo trae, es el scroll EN PÍXELES donde tiene que aterrizar; sin él, el `ini` del
 *  tramo. Hace falta porque el borde de un tramo no siempre es donde empieza lo que se ve: la
 *  galería regala un arranque al motor para apartarse, y en ese borde no hay ni una tarjeta. */
export interface Parada { X: string; nombre: string; destino?: () => number }

export interface OpcionesSubnav {
  reduce: boolean;
  /** Los px de scroll de las estaciones (además de las paradas, que lo son siempre). */
  estaciones?: () => number[];
}

export function montarSubnav(scroller: Scroller, viaje: Viaje, paradas: Parada[], opciones: OpcionesSubnav): Subnav {
  const nav = document.querySelector<HTMLElement>('#subnav');
  const barra = nav?.querySelector<HTMLElement>('.barra');
  const cursor = nav?.querySelector<HTMLElement>('.cursor');
  if (!nav || !barra || !cursor) return { actualizar: () => undefined, revertir: () => undefined };
  const S = P.subnav;

  const marcaHtml = cursor.querySelector<HTMLElement>('.cursor-marca');
  const marca = marcaHtml ?? document.createElement('span');
  if (!marcaHtml) {
    marca.className = 'cursor-marca';
    cursor.append(marca);
  }

  const recorrido = (): number => Math.max(1, barra.clientWidth - cursor.offsetWidth);
  const irA = (p: number): void => window.scrollTo(0, utils.clamp(p, 0, 1) * scroller.maxScroll);

  // El sitio de cada parada, en píxeles: el suyo si lo trae, el borde del tramo si no.
  const dondeVa = (X: string, destino?: () => number): number | null => {
    if (destino) return destino();
    return scroller.tramos.find((t) => t.X === X)?.ini ?? null;
  };
  const posicionesParadas = (): number[] =>
    paradas.map(({ X, destino }) => dondeVa(X, destino)).filter((v): v is number => v !== null);
  // LAS ESTACIONES: las paradas más las que pase main.ts, ordenadas y sin repetir (a 2 px).
  const estaciones = (): number[] => {
    const todas = [...posicionesParadas(), ...(opciones.estaciones?.() ?? [])]
      .map((v) => utils.clamp(v, 0, scroller.maxScroll))
      .sort((a, b) => a - b);
    return todas.filter((v, i) => i === 0 || v - todas[i - 1] > 2);
  };
  // En px de barra, en la misma escala que el cursor (su borde izquierdo va de 0 a `recorrido`).
  const enBarra = (px: number): number => utils.clamp(px / scroller.maxScroll, 0, 1) * recorrido();
  const masCercana = (x: number): { px: number; distancia: number } | null => {
    let mejor: { px: number; distancia: number } | null = null;
    for (const px of estaciones()) {
      const d = Math.abs(enBarra(px) - x);
      if (!mejor || d < mejor.distancia) mejor = { px, distancia: d };
    }
    return mejor;
  };

  // EL AGARRE: la marca crece al pasar el ratón y más al agarrarla. Con movimiento reducido no hay
  // escala (es movimiento); el área de toque y el imán se quedan.
  const agarre: AnimatableObject | null = opciones.reduce
    ? null
    : (createAnimatable(marca, { scaleX: S.agarre.ms, scaleY: S.agarre.ms, ease: S.agarre.ease }) as AnimatableObject);
  let encima = false;
  let movido = false;
  let agarrado = false;
  // El navegador se ha quedado el gesto (un barrido vertical con el dedo que empezó en el área de
  // toque: el Draggable deja `touch-action: pan-y` y llega `pointercancel`). Desde ese momento el
  // arrastre no escribe el scroll, que ya lo mueve el navegador, y al soltar no hay imán. Medido
  // antes: el scroll nativo y el arrastre escribían a la vez y la página iba a saltos (+973 px en
  // un barrido de 150).
  let panNativo = false;
  // El gesto empezó en el cursor: el click que cierra un arrastre con ratón cae en la BARRA (el
  // Draggable pone `pointer-events: none` al cursor mientras arrastra, y el navegador manda el click
  // al antecesor común), y la barra lo traducía a un viaje a la estación más cercana aunque se
  // soltara lejos (medido: -908 px).
  let gestoEnCursor = false;
  const escalar = (): void => {
    if (!agarre) return;
    const [sx, sy] = agarrado ? S.agarre.agarrado : encima ? S.agarre.hover : [1, 1];
    agarre.scaleX(sx).scaleY(sy);
  };

  const drag: Draggable = createDraggable(cursor, {
    y: false,
    container: barra,
    containerFriction: 1,
    // Sin inercia al soltar: el cursor lo coloca el scroll (`actualizar` → setX) y una inercia
    // propia del Draggable pelearía con él unos fotogramas.
    velocityMultiplier: 0,
    onGrab: () => {
      agarrado = true;
      movido = false;
      panNativo = false;
      nav.classList.add('is-grabbed');
      escalar();
    },
    onRelease: (self) => {
      agarrado = false;
      nav.classList.remove('is-grabbed');
      escalar();
      if (panNativo) {
        panNativo = false;
        actualizar(scroller.progreso());
        return;
      }
      if (!movido) return;
      // EL IMÁN: soltado cerca de una estación, el scroll viaja hasta ella. Viaja y no salta: son
      // unos cientos de px, y el scroller ya iba persiguiendo el arrastre.
      const cerca = masCercana(self.x);
      if (cerca && cerca.distancia <= S.iman) viaje.irA(cerca.px);
    },
    onUpdate: (self) => {
      if (!self.grabbed || panNativo) return;
      movido = true;
      irA(self.x / recorrido());
    },
  });

  // EL ÁREA DE TOQUE TAPA LAS PARADAS CERCANAS: el ::before de 24 px del cursor va por encima
  // (z-index 1) y un clic en un punto a menos de ~12 px del cursor lo recibía el cursor, que sin
  // arrastre no hacía nada (medido: «Por dentro» a 8 px no respondía, ni con ratón ni con el dedo).
  // Subir la parada por encima no vale: justo tras pulsarla el cursor queda encima y ya no se podría
  // agarrar. Así que el CLICK de un toque sin arrastre sobre el cursor (ver `clic`) mira si debajo
  // hay una parada, y la pulsa. En el click y no en onRelease: con el dedo, onRelease llega dos
  // veces (el toque y el ratón de compatibilidad). Solo fuera de la marca visible: tocar la marca
  // misma es agarrarla, no ir a ningún sitio.
  const paradaBajo = (x: number, y: number): HTMLAnchorElement | null => {
    const m = marca.getBoundingClientRect();
    if (x >= m.left - 1 && x <= m.right + 1) return null;
    const bajoPuntero = document.elementsFromPoint(x, y).find((e) => e.classList.contains('parada'));
    return (bajoPuntero as HTMLAnchorElement | undefined) ?? null;
  };
  const alEmpezarEnBarra = (ev: PointerEvent): void => {
    gestoEnCursor = cursor.contains(ev.target as Node);
  };
  barra.addEventListener('pointerdown', alEmpezarEnBarra, { capture: true });
  const alCancelar = (ev: PointerEvent): void => {
    if (!agarrado || ev.pointerType !== 'touch') return;
    panNativo = true;
    drag.handleUp();   // público en draggable.d.ts: suelta ya, y el cursor vuelve a seguir al scroll
  };
  nav.addEventListener('pointercancel', alCancelar, { capture: true });

  const alEntrar = (ev: PointerEvent): void => {
    if (ev.pointerType === 'touch') return;
    encima = true;
    escalar();
  };
  const alSalir = (ev: PointerEvent): void => {
    if (ev.pointerType === 'touch') return;
    encima = false;
    escalar();
  };
  // Firefox no manda `pointerleave` cuando es el CURSOR el que se va de debajo del ratón quieto
  // (rueda, teclado), pero sí `mouseleave`: se escuchan los dos. Salir siempre es seguro.
  const alSalirRaton = (): void => {
    encima = false;
    escalar();
  };
  cursor.addEventListener('pointerenter', alEntrar);
  cursor.addEventListener('pointerleave', alSalir);
  cursor.addEventListener('mouseleave', alSalirRaton);

  // LAS PARADAS. El href es el id de la sección del tramo (un ancla de verdad, por si no hay
  // módulo); con módulo, el clic viaja al sitio de la parada. stopPropagation: la barra también
  // escucha el clic y lo traduciría a su estación más cercana.
  const anclas = paradas.map(({ X, nombre, destino }) => {
    const a = document.createElement('a');
    a.className = 'parada';
    a.href = `#${document.querySelector<HTMLElement>(`section[data-label="${X}"]`)?.id ?? ''}`;
    a.setAttribute('aria-label', nombre);
    a.title = nombre;
    // Un <a> es arrastrable por defecto, y en Chromium, si se agarraba el cursor estando encima de
    // una parada, el arrastre NATIVO del enlace se quedaba el mouseup: el Draggable seguía agarrado
    // y la página seguía al ratón sin ningún botón pulsado (ya pasaba antes de la tanda 3).
    a.draggable = false;
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (dondeVa(X, destino) !== null) viaje.irA(() => dondeVa(X, destino) ?? 0);
    });
    barra.append(a);
    return { a, X, destino };
  });
  // LAS RAYITAS, una por estación. `aria-hidden`: son dibujo; lo que se puede pulsar son las paradas.
  const rayas = estaciones().map(() => {
    const r = document.createElement('span');
    r.className = 'raya';
    r.setAttribute('aria-hidden', 'true');
    barra.prepend(r);
    return r;
  });

  // Dónde cae cada una: en la misma escala que el cursor, cuyo centro va de cursor/2 a
  // ancho - cursor/2. Se recalcula solo cuando los tramos cambian (resize): `maxScroll` lo delata.
  let maxColocado = -1;
  const lugar = (px: number | null, ancho: number): string => {
    const p = px !== null ? utils.clamp(px / scroller.maxScroll, 0, 1) : 0;
    return `calc(${p} * (100% - ${ancho}px) + ${ancho / 2}px)`;
  };
  const colocar = (): void => {
    if (scroller.maxScroll === maxColocado) return;
    maxColocado = scroller.maxScroll;
    const ancho = cursor.offsetWidth;
    // El punto va donde ATERRIZA el clic, no en el borde del tramo: si no, se pulsa un punto y el
    // cursor acaba en otro sitio de la barra.
    for (const { a, X, destino } of anclas) a.style.left = lugar(dondeVa(X, destino), ancho);
    const lista = estaciones();
    rayas.forEach((r, i) => {
      r.hidden = i >= lista.length;
      if (i < lista.length) r.style.left = lugar(lista[i], ancho);
    });
  };

  // EL CLIC EN LA BARRA: a la estación más cercana. El cursor (y su área de toque) no cuenta: eso
  // es agarrar.
  const clic = (ev: MouseEvent): void => {
    if (gestoEnCursor || cursor.contains(ev.target as Node)) {
      if (!movido) paradaBajo(ev.clientX, ev.clientY)?.click();
      return;
    }
    const r = barra.getBoundingClientRect();
    const cerca = masCercana(ev.clientX - r.left - cursor.offsetWidth / 2);
    if (cerca) viaje.irA(cerca.px);
  };
  barra.addEventListener('click', clic);

  // EL TECLADO, según el patrón de deslizador de la APG: derecha y arriba suben, izquierda y abajo
  // bajan. `preventDefault` para que la flecha no haga además el scroll nativo.
  const siguienteParada = (desde: number, sentido: 1 | -1): number => {
    const lista = posicionesParadas().sort((a, b) => a - b);
    if (sentido > 0) return lista.find((v) => v > desde + 2) ?? scroller.maxScroll;
    return [...lista].reverse().find((v) => v < desde - 2) ?? 0;
  };
  const alTeclear = (ev: KeyboardEvent): void => {
    // Con Alt, Ctrl o Meta la tecla es un atajo del navegador (Alt+← es Atrás): no se toca.
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    // El viaje en curso ya lo ha cancelado la tecla (core/viaje.ts escucha en captura): se parte de
    // donde está el scroll AHORA, así una flecha mantenida avanza desde donde va y no a saltos.
    const ahora = window.scrollY;
    const max = scroller.maxScroll;
    const T = S.tecla;
    const corto = { duracion: T.duracion, ease: T.ease };
    let destino: number;
    let opciones = {};
    switch (ev.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        destino = Math.min(max, ahora + T.paso * max);
        opciones = corto;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        destino = Math.max(0, ahora - T.paso * max);
        opciones = corto;
        break;
      case 'PageDown':
        destino = siguienteParada(ahora, 1);
        break;
      case 'PageUp':
        destino = siguienteParada(ahora, -1);
        break;
      case 'Home':
        destino = 0;
        break;
      case 'End':
        destino = max;
        break;
      default:
        return;
    }
    ev.preventDefault();
    // Las teclas que SUBEN el valor nunca llevan hacia atrás. En el pie el scroll está más allá del
    // final del maestro (el valor ya es 100) y `max` quedaba detrás: la página retrocedía una
    // pantalla con una flecha a la derecha.
    const sube = ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'PageDown' || ev.key === 'End';
    if (sube && destino <= ahora) return;
    viaje.irA(destino, opciones);
  };
  cursor.addEventListener('keydown', alTeclear);
  cursor.setAttribute('aria-valuemin', '0');
  cursor.setAttribute('aria-valuemax', '100');

  // EL VALOR, cacheado: `actualizar` corre en cada evento de scroll y el DOM solo se toca al cambiar.
  let valorPuesto = '';
  let textoPuesto = '';
  let visiblePuesto: boolean | null = null;
  const capitulo = (y: number): string => {
    const tramo = scroller.tramos.find((t) => y <= t.fin) ?? scroller.tramos[scroller.tramos.length - 1];
    return paradas.find((p) => p.X === tramo?.X)?.nombre ?? '';
  };
  // Con el foco dentro Y usando el teclado no se oculta (Inicio y Fin llevan el progreso fuera de
  // `visible`, y el foco se perdería). Solo con teclado: un toque o un clic en el cursor también lo
  // enfocan (es un div con tabindex) y la píldora se quedaba para siempre encima del hero. Se sigue
  // la MODALIDAD a mano y no con `:focus-visible`: Firefox no pasa a :focus-visible un div
  // enfocado con el ratón aunque luego se pulsen teclas.
  let conTeclado = false;
  const alTecla = (): void => {
    conTeclado = true;
  };
  const alPuntero = (): void => {
    conTeclado = false;
  };
  window.addEventListener('keydown', alTecla, { capture: true });
  window.addEventListener('pointerdown', alPuntero, { capture: true });
  const actualizar = (progreso: number): void => {
    const [a, b] = S.visible;
    const visible = (progreso > a && progreso < b) || (conTeclado && nav.matches(':focus-within'));
    if (visible !== visiblePuesto) {
      visiblePuesto = visible;
      nav.classList.toggle('is-visible', visible);
      nav.inert = !visible;
    }
    colocar();
    if (!drag.grabbed) drag.setX(progreso * recorrido(), true);
    const valor = String(Math.round(progreso * 100));
    if (valor !== valorPuesto) {
      valorPuesto = valor;
      cursor.setAttribute('aria-valuenow', valor);
    }
    const nombre = capitulo(window.scrollY);
    const texto = nombre ? `${valor} %, ${nombre}` : `${valor} %`;
    if (texto !== textoPuesto) {
      textoPuesto = texto;
      cursor.setAttribute('aria-valuetext', texto);
    }
  };

  // EL CURSOR SIGUE AL SCROLL CRUDO, NO AL PROXY (fila 26 del informe). El proxy va suavizado y el
  // cursor llegaba ~200 ms tarde. `scroller.progreso()` es scrollY / maxScroll y se pinta en el
  // propio evento `scroll`, o sea antes del siguiente fotograma, sin esperar al tic del suavizado.
  // El callback del scroller también llama a `actualizar` (así el resize y el primer tic la dejan
  // bien aunque no haya evento): pintar dos veces el mismo número no cuesta nada.
  const alScroll = (): void => actualizar(scroller.progreso());
  window.addEventListener('scroll', alScroll, { passive: true });
  // Al entrar o salir el foco se decide otra vez si se ve. En el siguiente fotograma: durante
  // `focusout` el elemento que se va todavía cuenta como enfocado en algunos navegadores.
  let idFoco = 0;
  const alFoco = (): void => {
    cancelAnimationFrame(idFoco);
    idFoco = requestAnimationFrame(alScroll);
  };
  nav.addEventListener('focusin', alFoco);
  nav.addEventListener('focusout', alFoco);
  actualizar(scroller.progreso());

  return {
    actualizar,
    revertir() {
      window.removeEventListener('scroll', alScroll);
      nav.removeEventListener('focusin', alFoco);
      nav.removeEventListener('focusout', alFoco);
      cancelAnimationFrame(idFoco);
      barra.removeEventListener('click', clic);
      cursor.removeEventListener('keydown', alTeclear);
      cursor.removeEventListener('mouseleave', alSalirRaton);
      window.removeEventListener('keydown', alTecla, { capture: true });
      window.removeEventListener('pointerdown', alPuntero, { capture: true });
      barra.removeEventListener('pointerdown', alEmpezarEnBarra, { capture: true });
      nav.removeEventListener('pointercancel', alCancelar, { capture: true });
      cursor.removeEventListener('pointerenter', alEntrar);
      cursor.removeEventListener('pointerleave', alSalir);
      for (const { a } of anclas) a.remove();
      for (const r of rayas) r.remove();
      for (const k of ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext']) cursor.removeAttribute(k);
      nav.inert = false;
      nav.classList.remove('is-visible', 'is-grabbed');
      agarre?.revert();
      if (!marcaHtml) marca.remove();
      drag.revert();
    },
  };
}
