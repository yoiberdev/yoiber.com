import { createDrawable, stagger, utils, type AnimationParams, type TargetsParam } from 'animejs';
import { P } from '../params';
import type { Maestro } from '../core/maestro';
import { montarEsquema } from './esquemas';

// LA GALERÍA. Cinco proyectos con demo viva, uno por tramo de GALERIA.
//
// Las tarjetas se animan DENTRO del maestro, igual que el motor: el scroll mueve el reloj y ellas
// hacen seek. Así al subir se deshacen exactas, sin estados que solo vayan hacia delante.
//
// Lo único que no puede vivir en la timeline es `pointer-events`: los enlaces tienen que ser
// pinchables solo mientras su tarjeta está delante, y eso se decide mirando el reloj cada
// fotograma. De ahí `actualizar()`, que main.ts llama junto al titular de capítulo.
//
// LA MINI-SECUENCIA (fila 13 del informe). Antes cada tarjeta era UN tween: opacidad y 26 px para
// el bloque entero. Ahora cada pieza entra por su turno dentro del mismo cruce: el título, la
// captura destapándose de arriba abajo (clip-path), los tres párrafos escalonados, y el acceso y
// el aviso al final; la salida es más corta y va al revés. Los tiempos son FRACCIONES del cruce
// (P.galeria.secuencia): el cruce, el paso y `indice()` no han cambiado, así que el contador, el
// acento por proyecto y "Ver los proyectos" siguen cayendo donde caían.
//
// FROM EXPLÍCITO en las dos puntas de TODOS los tweens. Con `composition: 'none'` (defaults del
// maestro) Anime.js no busca el tween anterior sobre la misma propiedad: lee el "desde" del estilo
// computado EN EL MOMENTO DE CREAR el tween, y ahí las piezas están a opacity 0 por CSS y sin
// transform inline (el `set` de abajo aún no ha pintado nada: los hijos no escriben hasta
// tl.init()). Con un solo `to`, medido en producción: la salida era opacity 0 -> 0 y la entrada
// translateY 0 -> 0. Hacia delante la tarjeta se apagaba de golpe sin deslizar, y al volver desde
// CIERRE con un salto grande el maestro cruzaba la salida de una vez y la tarjeta se quedaba a 0
// con el contador diciendo "1 / 5" sobre la pantalla vacía.
//
// EL ARCO DE PROGRESO (#capitulo-arco, junto al contador): un círculo que se dibuja de '0 0' a
// '0 1' a lo largo del tramo de cada tarjeta y se reinicia con la siguiente. TRAMPA que ya mordió
// una vez (diagrama DSS): `draw` SOLO funciona sobre el PROXY que devuelve createDrawable; sobre el
// nodo, la animación se crea, no avisa y no hace nada.
//
// EL ESQUEMA VIVO (fila 21; effects/esquemas.ts). Entre la pila y el detalle cada tarjeta lleva un
// <svg class="esquema"> que el scroll traza en el TRAMO QUIETO de la tarjeta: de `desde + cruce`
// (la entrada ha terminado) a `fin` (empieza la salida). Aquí solo se le da su entrada y su salida
// como a un párrafo más (S.esquema, con tweens propios para no mover el stagger de los párrafos) y
// se le pasa el tramo; qué se traza y cuándo lo decide el módulo con P.galeria.esquemas.

export interface Galeria {
  actualizar(tiempo: number): void;
  /** Tarjeta cuyo tramo toca en ese instante (0..total-1), o -1 antes de la primera y fuera del capítulo. */
  indice(tiempo: number): number;
  revertir(): void;
  total: number;
}

const S = P.galeria.secuencia;
// El clip de la captura: cerrado (todo recortado por abajo) y abierto. `round` conserva las
// esquinas redondeadas de la imagen mientras se destapa. Las dos cadenas llevan los mismos números
// en el mismo orden y con la misma unidad: es lo que Anime.js necesita para interpolar un valor
// compuesto sin sorpresas.
const CLIP = { cerrado: 'inset(0px 0px 100% 0px round 6px)', abierto: 'inset(0px 0px 0% 0px round 6px)' };

export function montarGaleria(m: Maestro, reduce: boolean): Galeria {
  const { tl } = m;
  const tarjetas = Array.from(document.querySelectorAll<HTMLElement>('#galeria-tarjetas .tarjeta'));
  if (!tarjetas.length) return { actualizar: () => undefined, indice: () => -1, revertir: () => undefined, total: 0 };

  // El motor necesita apartarse antes de que entre nada: ese margen es `arranque`.
  const margen = m.duracion('GALERIA') * P.galeria.arranque;
  const ini = m.L.GALERIA + margen;
  const dur = m.duracion('GALERIA') - margen;
  const paso = dur / tarjetas.length;
  // La tarjeta ocupa su tramo entero menos los cruces: entra, se queda quieta y se va.
  // Cruce corto respecto al tramo: la tarjeta entra, se queda MUCHO rato quieta y se va.
  // Con un cruce largo el texto pasa media vida a media opacidad y no se puede leer.
  const cruce = Math.min(500, paso * 0.14);
  const u = (fraccion: number): number => cruce * fraccion; // fracción del cruce -> unidades del maestro

  const busca = (el: HTMLElement, sels: string[]): HTMLElement[] =>
    sels.map((s) => el.querySelector<HTMLElement>(s)).filter((e): e is HTMLElement => e !== null);
  // Un tween por pieza, y ninguno si la pieza no está en el marcado (un `add` sin targets no falla,
  // pero tampoco aporta nada y ensucia la timeline).
  const tramo = (targets: TargetsParam[], params: AnimationParams, pos: number): void => {
    if (targets.length) tl.add(targets, params, pos);
  };
  // El desplazamiento vertical de cada gesto, o nada con reduce (solo opacidad).
  const y = (desde: number, hasta: number): AnimationParams => (reduce ? {} : { y: [desde, hasta] });

  const piezas: HTMLElement[] = [];
  tarjetas.forEach((el, i) => {
    const desde = ini + paso * i;         // empieza a entrar
    const fin = desde + paso - cruce;     // empieza a salir
    const titulo = busca(el, ['h2']);
    // La BARRA DE AVANCE (.avance) entra y sale con la captura: es su barra, va pegada a su borde
    // superior y en la misma celda del grid. Aquí solo se le da la opacidad y el destape; cuánto
    // ha avanzado lo escribe esquemas.ts en el tramo quieto, con scaleX (otra propiedad: no se
    // pisan). Donde el esquema se ve, base.css la deja en display:none y esto no pinta nada.
    const captura = busca(el, ['.captura', '.avance']);
    const parrafos = busca(el, ['.que', '.pila', '.detalle']);
    const esquema = busca(el, ['.esquema']);
    const acceso = busca(el, ['.acceso', '.aviso']);
    const todas = [...titulo, ...captura, ...parrafos, ...esquema, ...acceso];
    piezas.push(...todas);
    const E = S.entrada;
    const X = S.salida;

    // El estado de partida de todo, pintado por init(): apagado y, sin reduce, desplazado y la
    // captura tapada.
    tl.set(todas, { opacity: 0 }, 0);
    // EL CONTENEDOR TAMBIÉN. Las cinco tarjetas ocupan el mismo sitio y en vertical cada una pinta
    // un fondo opaco (base.css): si el contenedor estuviera siempre a 1, las cuatro que van después
    // en el DOM taparían a la que manda (medido en el iPhone). Se enciende en el primer 5 % del
    // cruce, antes de que el título llegue a verse, y se apaga en el último 5 % de la salida,
    // cuando el título ya se ha ido: para el ojo es la secuencia de las piezas, no la del bloque.
    const salidaFin = fin + u(X.titulo.ini + X.titulo.dur);
    tl.set(el, { opacity: 0 }, 0)
      .add(el, { opacity: [0, 1], duration: u(S.contenedor), ease: 'linear' }, desde)
      .add(el, { opacity: [1, 0], duration: u(S.contenedor), ease: 'linear' }, salidaFin - u(S.contenedor));
    if (!reduce) {
      tl.set(titulo, { y: E.titulo.y }, 0)
        .set(parrafos, { y: E.parrafos.y }, 0)
        .set(esquema, { y: S.esquema.entrada.y }, 0)
        .set(acceso, { y: E.acceso.y }, 0)
        .set(captura, { clipPath: CLIP.cerrado }, 0);
    }

    // ENTRADA: título, captura, párrafos escalonados, acceso y aviso.
    tramo(titulo, { opacity: [0, 1], ...y(E.titulo.y, 0), duration: u(E.titulo.dur), ease: E.titulo.ease }, desde + u(E.titulo.ini));
    tramo(captura, { opacity: [0, 1], ...(reduce ? {} : { clipPath: [CLIP.cerrado, CLIP.abierto] }), duration: u(E.captura.dur), ease: E.captura.ease }, desde + u(E.captura.ini));
    tramo(parrafos, { opacity: [0, 1], ...y(E.parrafos.y, 0), duration: u(E.parrafos.dur), ease: E.parrafos.ease, delay: stagger(u(E.parrafos.stagger)) }, desde + u(E.parrafos.ini));
    tramo(acceso, { opacity: [0, 1], ...y(E.acceso.y, 0), duration: u(E.acceso.dur), ease: E.acceso.ease, delay: stagger(u(E.acceso.stagger)) }, desde + u(E.acceso.ini));
    tramo(esquema, { opacity: [0, 1], ...y(S.esquema.entrada.y, 0), duration: u(S.esquema.entrada.dur), ease: S.esquema.entrada.ease }, desde + u(S.esquema.entrada.ini));

    // SALIDA, al revés y más corta: aviso y acceso, los párrafos de abajo arriba, la captura
    // volviéndose a tapar, y el título el último.
    tramo(acceso, { opacity: [1, 0], ...y(0, -X.acceso.y), duration: u(X.acceso.dur), ease: X.acceso.ease, delay: stagger(u(X.acceso.stagger), { reversed: true }) }, fin + u(X.acceso.ini));
    tramo(parrafos, { opacity: [1, 0], ...y(0, -X.parrafos.y), duration: u(X.parrafos.dur), ease: X.parrafos.ease, delay: stagger(u(X.parrafos.stagger), { reversed: true }) }, fin + u(X.parrafos.ini));
    tramo(captura, { opacity: [1, 0], ...(reduce ? {} : { clipPath: [CLIP.abierto, CLIP.cerrado] }), duration: u(X.captura.dur), ease: X.captura.ease }, fin + u(X.captura.ini));
    tramo(titulo, { opacity: [1, 0], ...y(0, -X.titulo.y), duration: u(X.titulo.dur), ease: X.titulo.ease }, fin + u(X.titulo.ini));
    tramo(esquema, { opacity: [1, 0], ...y(0, -S.esquema.salida.y), duration: u(S.esquema.salida.dur), ease: S.esquema.salida.ease }, fin + u(S.esquema.salida.ini));

    // EL DIBUJO DEL ESQUEMA, en el tramo quieto: de que la entrada acaba a que la salida empieza.
    montarEsquema(tl, el, desde + cruce, fin - (desde + cruce), reduce);
  });

  // EL ARCO: un tween lineal por tarjeta sobre el mismo proxy. Los tweens son contiguos y con
  // `composition: 'none'` el que empieza escribe el último en la frontera: cada tarjeta lo reinicia.
  const circulo = document.querySelector<SVGCircleElement>('#capitulo-arco circle');
  if (circulo) {
    const [arco] = createDrawable(circulo);
    tl.set(arco, { draw: '0 0' }, 0);
    tarjetas.forEach((_, i) => tl.add(arco, { draw: ['0 0', '0 1'], duration: paso, ease: 'linear' }, ini + paso * i));
  }

  // EL MISMO REPARTO PARA TODOS. Antes el contador de main.ts hacía floor(progreso * total) sobre
  // el tramo ENTERO de GALERIA, sin restar `margen`: con la primera tarjeta a la vista decía
  // "2 / 5". Ahora el único que sabe dónde empieza cada tarjeta es este módulo, y lo expone.
  const indice = (tiempo: number): number => {
    const rel = tiempo - ini;
    if (rel < 0 || rel >= dur) return -1;
    return Math.min(tarjetas.length - 1, Math.floor(rel / paso));
  };

  let viva = -1;
  return {
    total: tarjetas.length,
    indice,
    actualizar(tiempo: number): void {
      // Qué tarjeta manda ahora. Fuera del capítulo, ninguna.
      // La ventana de `viva` es la de VISIBILIDAD, no la del tramo: durante el cruce de salida la
      // tarjeta ya se ha desvanecido y sus enlaces no deben seguir siendo pinchables. El contador,
      // en cambio, usa el tramo entero (`indice`): si se vaciara en cada cruce parpadearía.
      const rel = tiempo - ini;
      const k = (rel % paso) >= paso - cruce ? -1 : indice(tiempo);
      if (k === viva) return;
      if (viva >= 0) tarjetas[viva].classList.remove('viva');
      if (k >= 0) tarjetas[k].classList.add('viva');
      viva = k;
    },
    revertir(): void {
      for (const el of tarjetas) el.classList.remove('viva');
      utils.set([...tarjetas, ...piezas], { opacity: 0 });
    },
  };
}
