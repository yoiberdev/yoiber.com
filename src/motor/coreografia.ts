import { Color, MathUtils, Quaternion, Vector3, type Material, type MeshToonMaterial, type Object3D } from 'three';
import { PM } from '../params-motor';
import { emisivoDelAcento, M } from './geometria';

import type { Maestro, Tramo } from '../core/maestro';
import type { Rig } from './rig';

const GRA = Math.PI / 180;

// COREOGRAFÍA DEL MOTOR
// ===============================================================================================
// El reloj lo mueve el scroll; aquí no se reproduce nada. Todo lo que se ve es una función del
// tiempo del maestro, y por eso todo es reversible al arrastrar hacia atrás.
//
// DOS CANALES, y una regla: cada propiedad tiene UN SOLO escritor.
//
//   1) CANAL DIRECTO — la timeline maestra escribe en el grafo de Three con el adaptador.
//      Solo geometría: raiz(x, y, rotateX, rotateY, scale), camara(zoom), la posición de cada
//      pieza, la escala X/Z del anillo de aletas (su apertura) y la `z` (radial) de cada tubo.
//
//   2) CANAL DERIVADO — la timeline escribe escalares 0..1 en `estado`; `aplicar(tiempo)` los
//      convierte en matrices de la corona, cuaterniones de la marca, temblor, vueltas de turbina,
//      luces, emisivos y opacidades.
//      Va aquí todo lo que (a) no se puede expresar como un tween independiente por eje (las
//      matrices de la InstancedMesh, el cuaternión de la marca), (b) necesita varios factores
//      multiplicándose sobre la misma propiedad (la luz clave la bajan la galería Y el apagado de
//      la marca), o (c) es función del reloj y no un recorrido (temblor, parpadeo, rpm).
//
// TRAMPAS MEDIDAS EN ESTE SERVIDOR QUE CONDICIONAN ESTE FICHERO
//   · El `from` implícito de un tween se captura EN EL `.add()`, leyendo el objeto vivo; ni en
//     `init()` ni del `.set()` que haya en t=0. Como este módulo se engancha al maestro TARDE
//     (llega en un trozo diferido, con el reloj ya en marcha), TODOS los tweens llevan
//     `[desde, hasta]` explícito. Sin excepción.
//   · El ease por defecto de un hijo de timeline es `out(2)`; el maestro impone `inOut(3)` y
//     `composition: 'none'`. Cuando la curva importa, va escrita.
//   · Nada de `onComplete` / `onBegin` para cambiar de estado: con scrub no son simétricos.
//
// Y UNA EXCEPCIÓN A "TODO ES FUNCIÓN DEL MAESTRO", igual que la capa de vida: el ACENTO VIGENTE.
// Lo decide la página (core/acento.ts) desde el reloj del maestro y avisa con 'yoi:acento' solo
// cuando cambia; aquí se funde hacia él con el reloj del NAVEGADOR (PM.vida.acentoMs), porque un
// cambio de color de 400 ms no es un recorrido que haya que poder deshacer a mitad: el color al
// que se llega sí es función del maestro (lo es la decisión), el camino no. Ver `pintarAcento`.

export interface Estado {
  luz: number;      // 0..1  factor sobre la intensidad de la luz clave
  apagado: number;  // 0..1  el resto del motor se apaga mientras manda la marca
  pulso: number;    // 0..1  latido del inyector (ocho veces, uno por demo de la galería)
  brillo: number;   // 0..1  la garganta al rojo en el encendido
  rpm: number;      // 0..1  vueltas de la turbobomba
  logo: number;     // 0..1  la placa del monograma viene al frente
  aparta: number;   // 0..1  el motor se desvía para dejar hueco en la galería (dirección: aplicar)
  abierto: number;  // 0..1  el despiece está abierto (COMO): en vertical le hace sitio entre las bandas de rótulos
  inclina: number;  // 0..1  la placa de inyectores se inclina hacia la cámara en el despiece
  aletas: number;   // 0..1  apertura del anillo de aletas, escalonada por azimut (aplicar 1b)
  vuelco: number;   // 0..1  el arco del cabeceo manda: el encuadre se calcula de la POSE (aplicar 3d)
  vibra: number;    // 0..1  amplitud del temblor previo al despegue
  penacho: number;  // 0..1  crecimiento del penacho
  estira: number;   // 0..1  estirado del penacho al salir
  salida: number;   // 0..1  fundido final
  rotulos: { t: number }[];
}

export interface Coreografia {
  estado: Estado;
  aplicar(tiempo: number, ahora: number): void;
  revertir(): void;
  /** Todo lo que la timeline ha tocado: la limpieza lo saca de Anime.js con utils.remove(). */
  objetivos: object[];
}

// Orden de MONTAJE (INTRO): primero el esqueleto y el propulsor, y la corona de tubos la última
// porque es la imagen que vende.
const ORDEN_MONTAJE = ['bancada', 'camara', 'inyector', 'cupula', 'turbobomba', 'conductos', 'aletas', 'placa', 'campana'] as const;

// De dónde entra cada pieza, en unidades de motor (el encuadre son 11,2 de alto).
const ENTRADA: Record<string, [number, number, number]> = {
  bancada: [0, 8.5, -4],
  camara: [0, 0, 11],
  inyector: [-11, 0.6, 0],
  cupula: [0, 9, 0],
  turbobomba: [7, 3, 0],
  conductos: [8, 0.8, 0],
  aletas: [-6, -7, 0],
  placa: [4, 7, 0],
  campana: [0, -10, 0],
  refrigeracion: [0, 0, 0],   // la corona no viaja: entran los tubos, uno a uno
};

// El origen local de la placa es la JUNTA donde se tocan las tres formas del monograma, no el
// centro de su caja: al traerla al centro de la pantalla hay que corregir ese desvío. Las dos
// constantes salen de los extremos del propio SVG precocinado (viewBox 439x523, junta en
// 141,84 / 229,35) y se escalan con el alto que fije la geometría.
const K_MARCA = M.placa.alto / 523;
const CENTRO_MARCA = new Vector3(77.5800 * K_MARCA, -32.0905 * K_MARCA, M.placa.espesor / 2);
const ALTO_MARCA = 522.881 * K_MARCA;

export function montarCoreografia(m: Maestro, rig: Rig): Coreografia {
  const { tl } = m;
  const C = PM.coreo;
  const { raiz, camara: cam } = rig;

  // Posición absoluta en el maestro a partir de una fracción del tramo. Devuelve un número: así se
  // puede sumar el escalonado sin pelearse con las cadenas 'COMO+=1234'.
  const en = (X: Tramo, f: number, mas = 0): number => Math.round(m.L[X] + m.duracion(X) * f + mas);
  const dur = (X: Tramo, a: number, b: number): number => Math.max(1, Math.round(m.duracion(X) * (b - a)));

  const estado: Estado = {
    luz: C.heroOut.luz[0], apagado: 0, pulso: 0, brillo: 0, rpm: 0,
    logo: 0, aparta: 0, abierto: 0, inclina: 0, aletas: 0, vuelco: 0, vibra: 0, penacho: 0, estira: 0, salida: 0,
    rotulos: rig.piezas.map(() => ({ t: 0 })),
  };

  // Cada pieza tiene tres sitios: de dónde entra, dónde vive y dónde se aparta en el despiece.
  // `reposo` se lee del objeto UNA vez, al montar: es la que fija el módulo de geometría.
  // `sitios` incluye las piezas rotuladas Y las sueltas, en ese orden: los rótulos indexan sobre
  // las primeras, así que rig.piezas[i] y estado.rotulos[i] siguen alineados.
  const sitios = [...rig.piezas, ...rig.sueltas].map((p) => {
    const reposo = p.obj.position.clone();
    const e = ENTRADA[p.id] ?? [0, 9, 0];
    return {
      p,
      reposo,
      entrada: reposo.clone().add(new Vector3(e[0], e[1], e[2])),
      abierta: reposo.clone().add(p.abierto),
    };
  });
  const porId = new Map(sitios.map((s) => [s.p.id, s]));
  const montaje = ORDEN_MONTAJE.map((id) => porId.get(id)).filter((s): s is (typeof sitios)[number] => !!s);

  // El anillo de aletas, además de subir con las demás, se ABRE: escala X y Z de su grupo (el
  // origen está en el eje), que separa las 29 aletas de la pared a la vez (PM.aletasAbrir). Y la
  // placa de inyectores se INCLINA hacia la cámara con el escalar `inclina` (canal derivado, 3b):
  // el eje del giro depende de la guiñada de `raiz`, que la timeline no conoce. Las dos son piezas
  // de la lista; si la geometría les cambia el nombre, el gesto desaparece y nada revienta.
  const aletas = porId.get('aletas')?.p.obj;
  const inyector = porId.get('inyector')?.p.obj;
  const iInyector = sitios.findIndex((s) => s.p.id === 'inyector');
  const iAletas = sitios.findIndex((s) => s.p.id === 'aletas');

  // ============================================================ t = 0: el estado de partida
  // Con scrub, "el principio" es un sitio al que se vuelve, no un sitio del que se sale.
  const I = C.intro;
  tl.set(raiz, { x: 0, y: 0, rotateX: 0, rotateY: I.rotY[0], rotateZ: 0, scale: I.escala[0] }, 0)
    .set(cam, { zoom: I.zoom }, 0)
    .set(estado, { luz: C.heroOut.luz[0], apagado: 0, pulso: 0, brillo: 0, rpm: 0, logo: 0, aparta: 0, abierto: 0, inclina: 0, aletas: 0, vuelco: 0, vibra: 0, penacho: 0, estira: 0, salida: 0 }, 0)
    .set(estado.rotulos, { t: 0 }, 0);
  for (const s of sitios) tl.set(s.p.obj, { x: s.entrada.x, y: s.entrada.y, z: s.entrada.z }, 0);
  if (aletas) tl.set(aletas, { scaleX: 1, scaleZ: 1 }, 0);
  tl.set(rig.tubos, { z: I.coronaFuera }, 0);

  // ============================================================ HERO_OUT: montaje y centro
  // Se ensambla pieza a pieza desde fuera de cuadro MIENTRAS el título se va hacia arriba. En INTRO
  // el motor no está: el escenario CSS hace de telón hasta que llega el trozo 3D, que se pide
  // después de la intro para no meter el análisis de 610 kB encima de la animación del título.
  montaje.forEach((s, i) => {
    tl.add(s.p.obj, {
      x: [s.entrada.x, s.reposo.x], y: [s.entrada.y, s.reposo.y], z: [s.entrada.z, s.reposo.z],
      duration: I.dur, ease: I.ease,
    }, m.L.HERO_OUT + I.base + i * I.paso);
  });
  // La corona entra la última y tubo a tubo, cerrándose sobre la campana con un pellizco de rebote.
  // Es el gesto que hay que mirar.
  // El rebote sale del EASE (`outBack` se pasa de largo y vuelve), no de dos tramos encadenados:
  // en el instante exacto en que se tocan dos tramos el valor no es idéntico de ida y de vuelta.
  //
  // NINGÚN `stagger(paso, { from })` sirve aquí, y la razón es geométrica, no de gusto: `stagger`
  // reparte por ÍNDICE, y el índice del tubo es (casi) su ángulo. Como la entrada es RADIAL, en
  // pantalla los tubos de los COSTADOS cruzan todo el ancho mientras los del frente y el fondo
  // apenas se mueven (vienen y van en profundidad). Un reparto por índice recorre el anillo en un
  // solo sentido: con 'center' empieza por el fondo y acaba en el frente, con 'first' arranca en un
  // costado y da la vuelta entera. En los dos casos, en cualquier instante media corona está dentro
  // y la otra media fuera, y por el mismo costado; medido en captura al 20 %, al 30 % y al 50 %
  // (img/I-5250, I-5400, I-5700): a un lado los tubos ya aterrizados y al otro un abanico suelto
  // colgando en el vacío.
  //
  // El reparto va por ÁNGULO RESPECTO A LA CÁMARA: cada tubo entra a la vez que su simétrico al
  // otro lado del eje de vista, así que la corona está EQUILIBRADA izquierda-derecha en todos los
  // fotogramas del gesto y la ola avanza en profundidad, del fondo hacia el frente.
  const reparto = (span: number, desde: 'frente' | 'detras') =>
    // (la firma de `FunctionValue` trae los cuatro argumentos opcionales: `i` necesita valor por defecto)
    (_o: unknown, i = 0): number => {
      // el azimut del tubo i NO es i·360/n: lo da el rig, que es quien sabe cómo está construido
      const th = rig.azimutes[i] ?? 0;
      const d = Math.abs(((th - I.coronaAzimut + 540) % 360) - 180);   // 0..180 hasta el eje de vista
      return (desde === 'detras' ? 1 - d / 180 : d / 180) * span;
    };
  const tCorona = m.L.HERO_OUT + I.base + montaje.length * I.paso;
  tl.add(rig.tubos, {
    z: [I.coronaFuera, 0], duration: I.coronaDur, ease: `outBack(${I.coronaRebote})`,
    delay: reparto(I.coronaReparto, I.coronaDesde),
  }, tCorona);
  // El último tubo tiene que estar QUIETO en GALERIA: el gesto acaba en tCorona + reparto + dur, y
  // si eso cae dentro del capítulo la primera vista del motor montado lo pilla a mitad de rebote,
  // con los tubos hundidos en la campana (fila 10, ronda 1: acababa en 7 355 con GALERIA en
  // 7 100). Los números viven en PM.coreo.intro; esto solo avisa en desarrollo si alguien los
  // vuelve a descuadrar.
  if (import.meta.env.DEV && tCorona + I.coronaReparto + I.coronaDur > m.L.GALERIA) {
    console.warn(`[motor] la corona acaba en ${tCorona + I.coronaReparto + I.coronaDur}, después de GALERIA (${m.L.GALERIA})`);
  }

  // ============================================================ HERO_OUT: toma el centro
  const H = C.heroOut;
  const dH = m.duracion('HERO_OUT');
  tl.add(raiz, {
    rotateY: [I.rotY[0], H.rotY[1]], rotateX: [H.rotX[0], H.rotX[1]],
    scale: [I.escala[0], H.escala[1]], duration: dH, ease: H.ease,
  }, 'HERO_OUT')
    .add(cam, { zoom: [H.zoom[0], H.zoom[1]], duration: dH, ease: 'out(2)' }, 'HERO_OUT')
    .add(estado, { luz: [H.luz[0], H.luz[1]], duration: dH, ease: 'linear' }, 'HERO_OUT');

  // ============================================================ GALERIA: plato giratorio de fondo
  // Velocidad angular CONSTANTE (linear) durante todo el tramo. Cualquier otra curva se lee como
  // que el objeto frena, y aquí no frena: gira mientras hablan otros.
  const G = C.galeria;
  const dG = m.duracion('GALERIA');
  const yGal = H.rotY[1] + G.giro;
  // EL DESVÍO NO ES UN TWEEN SOBRE `raiz.x`. Lo era, y ese es el fallo: `apartar` estaba escrito en
  // unidades de motor y la timeline no sabe cuánto mide el encuadre, que en un móvil de pie tiene
  // 7,4 u de ancho y 16 de alto. La timeline mueve un escalar 0..1 y `aplicar()` lo convierte en
  // desplazamiento mirando la cámara de verdad: a un lado si hay sitio, arriba si no lo hay.
  // La ESCALA sí se queda aquí: no depende del encuadre.
  tl.add(raiz, { rotateY: [H.rotY[1], yGal], duration: dG, ease: 'linear' }, 'GALERIA')
    .add(estado, { aparta: [0, 1], duration: dur('GALERIA', 0, G.entra), ease: 'inOut(2)' }, en('GALERIA', G.espera))
    .add(raiz, { scale: [H.escala[1], G.escala], duration: dur('GALERIA', 0, G.entra), ease: 'inOut(2)' }, en('GALERIA', G.espera))
    .add(estado, { luz: [H.luz[1], G.luz], duration: dur('GALERIA', 0, G.entra), ease: 'linear' }, en('GALERIA', G.espera))
    // El regreso al centro —desvío, escala y luz— va PEGADO AL FINAL del capítulo, en
    // 1 − `vuelve` = 0,977, que es justo cuando la quinta tarjeta empieza a irse (la aritmética,
    // en PM.coreo.galeria.vuelve): antes de eso el motor no puede volver al medio sin escribirse
    // encima de ella, y la ronda anterior arrancaba en 0,90, a mitad de su tramo quieto.
    .add(estado, { aparta: [1, 0], duration: dur('GALERIA', 0, G.vuelve), ease: 'inOut(2)' }, en('GALERIA', 1 - G.vuelve))
    .add(raiz, { scale: [G.escala, H.escala[1]], duration: dur('GALERIA', 0, G.vuelve), ease: 'inOut(2)' }, en('GALERIA', 1 - G.vuelve))
    .add(estado, { luz: [G.luz, H.luz[1]], duration: dur('GALERIA', 0, G.vuelve), ease: 'linear' }, en('GALERIA', 1 - G.vuelve));
  // EL VUELCO: el eje entero se pone de cara a la cámara y vuelve (PM.coreo.galeria.vuelco).
  // Cuatro tramos y una pausa: se recuesta montado sobre `aparta`, sube LINEAL mientras hablan las
  // tarjetas 1 y 2, se queda quieto 700 unidades con la corona de frente y se endereza al doble de
  // velocidad para estar de pie en el instante en que la quinta tarjeta se asienta. Entre
  // `meseta[0]` y `meseta[1]` no hay ni un tween sobre `raiz`: eso ES la pausa, igual que `quieto`
  // en COMO. Y el escalar `vuelco` es el que enciende el encuadre por pose (aplicar(), punto 3d):
  // sin él la máquina se sale del cuadro en el bulto de +20° y encoge un cuarto en el ápice.
  const U = G.vuelco;
  tl.add(raiz, { rotateX: [H.rotX[1], U.apoyo], duration: dur('GALERIA', U.recostar[0], U.recostar[1]), ease: 'inOut(2)' }, en('GALERIA', U.recostar[0]))
    .add(estado, { vuelco: [0, 1], duration: dur('GALERIA', U.recostar[0], U.recostar[1]), ease: 'inOut(2)' }, en('GALERIA', U.recostar[0]))
    .add(raiz, { rotateX: [U.apoyo, U.cima], duration: dur('GALERIA', U.subir[0], U.subir[1]), ease: 'linear' }, en('GALERIA', U.subir[0]))
    .add(raiz, { rotateX: [U.cima, H.rotX[1]], duration: dur('GALERIA', U.enderezar[0], U.enderezar[1]), ease: 'linear' }, en('GALERIA', U.enderezar[0]))
    // el escalar se suelta con rotX ya en reposo, donde la corrección vale 1: no se ve apagarse
    .add(estado, { vuelco: [1, 0], duration: dur('GALERIA', U.enderezar[1], U.suelta), ease: 'linear' }, en('GALERIA', U.enderezar[1]));

  // Ocho latidos del inyector, uno por demo, alineados con el contador "n / 8" del rótulo.
  // Cada latido son DOS tweens seguidos y no dos fotogramas clave dentro de uno: medido, con
  // keyframes el valor no era idéntico de ida y de vuelta justo en la junta.
  for (let i = 0; i < G.pulsos; i++) {
    tl.add(estado, { pulso: [0, 1], duration: G.pulsoSube, ease: 'out(3)' }, en('GALERIA', (i + 0.5) / G.pulsos))
      .add(estado, { pulso: [1, 0], duration: G.pulsoBaja, ease: 'in(2)' }, en('GALERIA', (i + 0.5) / G.pulsos, G.pulsoSube));
  }

  // ============================================================ COMO: el despiece
  const K = C.como;
  const yAbre = yGal + K.giroAbre;
  const yPar = yAbre + K.giroParallax;
  const yFin = yPar + K.giroFinal;

  // 1. abrir el plano: se inclina y la cámara retrocede para que quepa el despiece
  tl.add(raiz, {
    rotateY: [yGal, yAbre], rotateX: [H.rotX[1], K.rotX], y: [0, K.bajar], x: [0, K.desplazar],
    duration: dur('COMO', K.abrir[0], K.abrir[1]), ease: 'inOut(2)',
  }, en('COMO', K.abrir[0]))
    .add(cam, { zoom: [H.zoom[1], K.zoom], duration: dur('COMO', K.abrir[0], K.abrir[1]), ease: 'inOut(2)' }, en('COMO', K.abrir[0]))
    // `abierto` va con el zoom, ida y vuelta: es el escalar con el que la composición vertical le
    // hace sitio al despiece entre las dos bandas de rótulos (ver aplicar(), punto 3c).
    .add(estado, { abierto: [0, 1], duration: dur('COMO', K.abrir[0], K.abrir[1]), ease: 'inOut(2)' }, en('COMO', K.abrir[0]));

  // 2. separar: de arriba abajo, 70 ms entre pieza y pieza. `outQuint` sale disparada y aterriza
  //    sin rebote: es el gesto de "esto se desmonta", no el de "esto salta".
  sitios.forEach((s, i) => {
    tl.add(s.p.obj, {
      x: [s.reposo.x, s.abierta.x], y: [s.reposo.y, s.abierta.y], z: [s.reposo.z, s.abierta.z],
      duration: K.dur, ease: 'outQuint',
    }, en('COMO', K.separar[0], i * K.paso));
  });
  // el anillo de aletas se abre y la placa de inyectores se inclina, cada uno en su turno del
  // escalonado (el mismo instante en que esa pieza empieza a separarse)
  if (aletas) {
    tl.add(aletas, {
      scaleX: [1, PM.aletasAbrir], scaleZ: [1, PM.aletasAbrir],
      duration: K.dur, ease: 'outQuint',
    }, en('COMO', K.separar[0], iAletas * K.paso));
    // Y cada aleta gira sobre su propio eje radial, escalonada (ver PM.aletasGiro). Es UN escalar
    // en la timeline y 29 matrices por fotograma: el reparto se calcula en `aplicar`, no con
    // `stagger`, porque el retardo va por AZIMUT y no por índice.
    tl.add(estado, { aletas: [0, 1], duration: K.dur * 1.35, ease: 'out(3)' }, en('COMO', K.separar[0], iAletas * K.paso));
  }
  if (inyector) tl.add(estado, { inclina: [0, 1], duration: K.dur, ease: 'outQuint' }, en('COMO', K.separar[0], iInyector * K.paso));
  // y la corona florece: cada tubo se separa de la campana hacia fuera, desde el centro
  tl.add(rig.tubos, {
    // mismo criterio angular que en la entrada (aquí abre por el frente, que es lo que se ve):
    // con `stagger(..., { from: 'center' })` la corona florecía por un costado, igual que entraba.
    z: [0, K.tuboFuera], duration: K.dur, ease: 'outQuint', delay: reparto(K.repartoTubo, 'frente'),
  }, en('COMO', K.separar[0], 8 * K.paso));

  // 3. rótulos y guías: un escalar por pieza. El DOM lo pinta rotulos.ts leyendo estos escalares.
  rig.piezas.forEach((_, i) => {
    tl.add(estado.rotulos[i], { t: [0, 1], duration: K.durRotulo, ease: 'out(3)' }, en('COMO', K.rotulos[0], i * K.pasoRotulo));
  });

  // 4. parallax: gira con todo abierto. Es lo que hace que el despiece se lea en profundidad y no
  //    como una lista. Los rótulos siguen a sus piezas solos, porque se proyectan cada fotograma.
  tl.add(raiz, { rotateY: [yAbre, yPar], duration: dur('COMO', K.parallax[0], K.parallax[1]), ease: 'inOut(2)' }, en('COMO', K.parallax[0]));

  // 5. la marca: los rótulos se recogen (del último al primero), el motor se apaga y la placa de
  //    identificación viene al frente. El conjunto se queda QUIETO mientras se lee: girando, la
  //    marca deja de reconocerse (es el hallazgo del análisis del logo).
  rig.piezas.forEach((_, i) => {
    const j = rig.piezas.length - 1 - i;
    tl.add(estado.rotulos[j], { t: [1, 0], duration: K.durCierraRotulo, ease: 'in(2)' }, en('COMO', K.cerrar, i * K.pasoCierraRotulo));
  });
  tl.add(estado, { apagado: [0, 1], duration: dur('COMO', K.logo[0], K.quieto[0]), ease: 'inOut(2)' }, en('COMO', K.logo[0]))
    .add(estado, { logo: [0, 1], duration: dur('COMO', K.logo[0], K.quieto[0]), ease: 'inOut(3)' }, en('COMO', K.logo[0]))
    // entre quieto[0] y quieto[1] no hay ni un tween sobre `raiz`: eso ES la pausa.
    .add(estado, { logo: [1, 0], duration: dur('COMO', K.quieto[1], K.recomponer[0] + 0.08), ease: 'inOut(3)' }, en('COMO', K.quieto[1]))
    .add(estado, { apagado: [1, 0], duration: dur('COMO', K.quieto[1], K.recomponer[0] + 0.06), ease: 'out(2)' }, en('COMO', K.quieto[1]));

  // 6. recomponer: vuelve a estar montado, de pie y a tamaño, listo para el cierre.
  sitios.forEach((s, i) => {
    tl.add(s.p.obj, {
      x: [s.abierta.x, s.reposo.x], y: [s.abierta.y, s.reposo.y], z: [s.abierta.z, s.reposo.z],
      // 0,93 y no 0,97: con el escalonado de 40 ms la última pieza aterrizaba 210 unidades
      // DESPUÉS de COMO_END, o sea con CIERRE ya empezado y el motor levantándose.
      duration: dur('COMO', K.recomponer[0], 0.93), ease: 'inOut(3)',
    }, en('COMO', K.recomponer[0], (sitios.length - 1 - i) * 40));
  });
  if (aletas) {
    tl.add(aletas, {
      scaleX: [PM.aletasAbrir, 1], scaleZ: [PM.aletasAbrir, 1],
      duration: dur('COMO', K.recomponer[0], 0.93), ease: 'inOut(3)',
    }, en('COMO', K.recomponer[0], (sitios.length - 1 - iAletas) * 40));
    tl.add(estado, { aletas: [1, 0], duration: dur('COMO', K.recomponer[0], 0.93), ease: 'inOut(3)' }, en('COMO', K.recomponer[0], (sitios.length - 1 - iAletas) * 40));
  }
  if (inyector) {
    tl.add(estado, { inclina: [1, 0], duration: dur('COMO', K.recomponer[0], 0.93), ease: 'inOut(3)' }, en('COMO', K.recomponer[0], (sitios.length - 1 - iInyector) * 40));
  }
  tl.add(rig.tubos, { z: [K.tuboFuera, 0], duration: dur('COMO', K.recomponer[0], 0.93), ease: 'inOut(3)', delay: reparto(K.repartoTubo * 0.6, 'detras') }, en('COMO', K.recomponer[0]))
    // LA CÁMARA VUELVE DESPUÉS QUE LAS PIEZAS, no a la vez. Arrancando las dos juntas, el encuadre
    // ya se había cerrado (zoom 0,58 -> 1) cuando el anillo de bancada todavía estaba en su sitio
    // del despiece, a y = 3,6 por encima del resto: el anillo salía CORTADO por el borde de arriba
    // (captura esc-18). Con 0,06 de retraso las piezas van por delante del encuadre y no hay un
    // solo fotograma con nada tocando el borde.
    .add(raiz, { rotateY: [yPar, yFin], rotateX: [K.rotX, 0], y: [K.bajar, 0], x: [K.desplazar, 0], duration: dur('COMO', K.recomponer[0] + 0.06, 1), ease: 'inOut(2)' }, en('COMO', K.recomponer[0] + 0.06))
    .add(cam, { zoom: [K.zoom, H.zoom[1]], duration: dur('COMO', K.recomponer[0] + 0.06, 1), ease: 'inOut(2)' }, en('COMO', K.recomponer[0] + 0.06))
    .add(estado, { abierto: [1, 0], duration: dur('COMO', K.recomponer[0] + 0.06, 1), ease: 'inOut(2)' }, en('COMO', K.recomponer[0] + 0.06));

  // ============================================================ CIERRE: encendido y salida
  const Z = C.cierre;
  tl.add(estado, { rpm: [0, 1], duration: dur('CIERRE', Z.previo[0], Z.previo[1]), ease: 'in(2)' }, en('CIERRE', Z.previo[0]))
    .add(estado, { vibra: [0, 1], duration: dur('CIERRE', Z.previo[0], Z.previo[1]), ease: 'in(2)' }, en('CIERRE', Z.previo[0]))
    .add(estado, { brillo: [0, 1], duration: dur('CIERRE', Z.brillo[0], Z.brillo[1]), ease: 'in(2)' }, en('CIERRE', Z.brillo[0]))
    .add(estado, { penacho: [0, 1], duration: dur('CIERRE', Z.penacho[0], Z.penacho[1]), ease: 'out(2)' }, en('CIERRE', Z.penacho[0]))
    // se levanta ANTES de encender: el penacho mide 9,5 u y sin este hueco sale cortado por abajo
    // (comprobado en captura: el chorro se salía del cuadro y se leía como una bombilla)
    .add(raiz, { y: [0, Z.subir], duration: dur('CIERRE', 0, Z.salida[0]), ease: 'inOut(2)' }, 'CIERRE')
    // sube: `in(3)` es una aceleración de verdad, que es justo lo que tiene que parecer
    .add(raiz, { y: [Z.subir, Z.alturaSalida], scale: [H.escala[1], Z.escalaSalida], duration: dur('CIERRE', Z.salida[0], Z.salida[1]), ease: 'in(3)' }, en('CIERRE', Z.salida[0]))
    .add(estado, { estira: [0, 1], duration: dur('CIERRE', Z.salida[0], Z.salida[1]), ease: 'in(2)' }, en('CIERRE', Z.salida[0]))
    // ya en el aire, el temblor desaparece: lo que temblaba era el amarre
    .add(estado, { vibra: [1, 0], duration: dur('CIERRE', Z.salida[0], Z.salida[0] + 0.12), ease: 'out(2)' }, en('CIERRE', Z.salida[0]))
    .add(raiz, { rotateY: [yFin, yFin + 8], duration: dur('CIERRE', 0, Z.salida[1]), ease: 'inOut(2)' }, 'CIERRE')
    .add(cam, { zoom: [H.zoom[1], Z.zoom[1]], duration: dur('CIERRE', 0, Z.salida[1]), ease: 'out(2)' }, 'CIERRE')
    .add(estado, { salida: [0, 1], duration: dur('CIERRE', Z.fundido[0], Z.fundido[1]), ease: 'in(2)' }, en('CIERRE', Z.fundido[0]));

  // ============================================================ CANAL DERIVADO
  // Todo lo de aquí abajo es función pura de (`estado`, `tiempo`). Ni un `+=`, ni un `Math.random`,
  // ni un `performance.now()`: si el visitante arrastra hacia atrás, el mismo tiempo da el mismo
  // fotograma.
  const qPadre = new Quaternion();
  const qDestino = new Quaternion();
  const ejeInclina = new Vector3();
  const dirCam = new Vector3();
  const nodoW = new Vector3();
  const desvio = new Vector3();
  const qMarca = rig.marca.quaternion.clone();
  const pMarca = rig.marca.position.clone();
  const eMarca = rig.marca.scale.clone();
  // El tamaño se calcula cada fotograma porque depende del ZOOM: el encuadre efectivo es
  // encuadre/zoom, y en COMO el zoom vale 0,62. Con el encuadre a secas la marca salía a dos
  // tercios del tamaño que le tocaba (comprobado en captura). El alto del cuadro se lee de la
  // cámara y no de PM.motor.encuadre: en un móvil de pie el encuadre se abre (rig.ts) y la marca
  // tiene que seguir siendo un tercio DE LO QUE SE VE. Y se divide por la escala de `desvio`: la
  // placa cuelga del motor, que en vertical va encogido durante el despiece, y la marca no.
  const marcaAlta = (): number => (PM.marca.alto * (cam.top - cam.bottom)) / (cam.zoom * ALTO_MARCA * rig.desvio.scale.x);
  const opacidad = new Map<Material, number>();
  for (const mat of rig.cuerpos) opacidad.set(mat, (mat as MeshToonMaterial).opacity ?? 1);
  const emisivoBase = rig.emisivos.map((mat) => mat.emissiveIntensity);
  const colorFrio = rig.caliente.color.clone();
  const colorCaliente = new Color(0xfff3d6);

  // ============================================================ EL ACENTO VIGENTE (fila 9)
  // El contrato con la página: al montar se lee `--acento` del estilo computado de <html> (así da
  // igual si el motor llega antes o después del primer cambio), y después se escucha 'yoi:acento'
  // en `document`. Lo que sigue al acento: el color y el emisivo de los aros (rig.emisivos), la
  // luz de cámara del encendido y el color frío del inserto de garganta. El emisivo no es el
  // acento tal cual, es su versión saturada y oscura (geometria.ts, emisivoDelAcento) para que el
  // latido no recorte a blanco.
  const acento = new Color();        // el que se pinta AHORA (a mitad de fundido, uno intermedio)
  const acentoDesde = new Color();
  const acentoHasta = new Color();
  let acentoT0 = -1;                 // reloj del navegador en que arrancó el fundido; -1 = quieto
  const acentoOriginal = rig.emisivos.map((mat) => ({ color: mat.color.clone(), emissive: mat.emissive.clone() }));
  const luzCamaraOriginal = rig.luzCamara.color.clone();
  const leerAcento = (): string => getComputedStyle(document.documentElement).getPropertyValue('--acento').trim();
  function pintarAcento(): void {
    for (const mat of rig.emisivos) {
      mat.color.copy(acento);
      emisivoDelAcento(acento, mat.emissive);
    }
    rig.luzCamara.color.copy(acento);
    colorFrio.copy(acento);
  }
  acento.set(leerAcento() || `#${new Color(M.paleta.acento).getHexString()}`);
  pintarAcento();
  const alCambiarAcento = (ev: Event): void => {
    const color = (ev as CustomEvent<{ color?: string }>).detail?.color;
    if (!color) return;
    acentoDesde.copy(acento);
    acentoHasta.set(color);
    acentoT0 = performance.now();
  };
  document.addEventListener('yoi:acento', alCambiarAcento);
  // El rig le clona los materiales a la placa, así que este conjunto NO contiene los del resto
  // del motor y el apagado puede ser total sin tocar a la marca.
  const materialesMarca = new Set<Material>(rig.materialesMarca);
  const chapaMarca = new Set<Material>(rig.chapaMarca);
  let alfa = false;   // ¿están los cuerpos en la pasada transparente ahora mismo?

  function aplicar(tiempo: number, ahora: number): void {
    // 0. El acento, si está a mitad de fundido. `ahora` es el sello del rAF, que puede ir unos ms
    //    por detrás del performance.now() del evento: por eso el clamp por abajo. out(2), como
    //    la transición CSS de los consumidores de la página.
    if (acentoT0 >= 0) {
      const k = MathUtils.clamp((ahora - acentoT0) / PM.vida.acentoMs, 0, 1);
      acento.lerpColors(acentoDesde, acentoHasta, k * (2 - k));
      if (k >= 1) acentoT0 = -1;
      pintarAcento();
    }

    // 1. La corona. Las 36 matrices salen de los 36 escalares que mueve la timeline, más el pulso
    //    de la capa de vida, que es lo único que mueve una PIEZA por su cuenta (ver PM.vida.ondaAmp).
    //    Va con el reloj del NAVEGADOR, como la deriva: con el scroll quieto la corona sigue viva.
    const V = PM.vida;
    for (let i = 0; i < rig.onda.length; i++) {
      const fase = ahora * V.ondaHz - (rig.azimutes[i] * Math.PI) / 180 * V.ondaCrestas;
      const s = Math.sin(fase);
      rig.onda[i] = s > 0 ? V.ondaAmp * s * s : 0;   // solo hacia fuera, y con la cresta estrecha
    }
    rig.escribirTubos();

    // 1b. EL ANILLO DE ALETAS. Cada lama se abre sobre su propio eje radial y el retardo va por
    //     AZIMUT, no por índice: la aleta i no está en i·360/n porque faltan las del hueco de la
    //     turbobomba, así que un `stagger` por índice abriría el anillo a saltos. `from: 'last'`
    //     como en la referencia: la ola arranca por el azimut más alto y da la vuelta.
    if (rig.aletas.length) {
      const R = PM.aletasReparto;
      for (let i = 0; i < rig.aletas.length; i++) {
        const fase = 1 - rig.azimutesAletas[i] / 360;
        const k = Math.min(1, Math.max(0, (estado.aletas - R * fase) / (1 - R)));
        rig.aletas[i] = k * PM.aletasGiro;
      }
      rig.escribirAletas();
    }

    // 2. Temblor. Va en `sacudida`, un grupo que NINGÚN tween toca, y se escribe en absoluto.
    const v = estado.vibra * PM.coreo.cierre.vibra;
    rig.sacudida.position.set(
      v * Math.sin(tiempo * PM.coreo.cierre.vibraHz),
      v * 0.7 * Math.sin(tiempo * PM.coreo.cierre.vibraHz * 1.7 + 1.1),
      0,
    );
    rig.sacudida.rotation.z = v * 0.35 * Math.sin(tiempo * PM.coreo.cierre.vibraHz * 2.3);
    // 2b. LA DERIVA. Balanceo lento con el reloj del NAVEGADOR: es lo único que se mueve cuando el
    //     visitante deja de bajar. Mismo grupo que el temblor y también escrito en absoluto.
    //     Son DOS senos con periodos que no son múltiplos (ver PM.vida): la guiñada sobre el eje
    //     del motor (Y) y un cabeceo a un tercio (X). Solo con la guiñada, un cuerpo de revolución
    //     apenas cambia de silueta y encima se lee como un metrónomo; el cabeceo es lo que mueve
    //     la boca de la campana. `rotation.x` no lo escribe nadie más: el temblor (2a) va en Z.
    rig.sacudida.rotation.y = PM.vida.derivaAmp * Math.sin(ahora * PM.vida.derivaHz);
    rig.sacudida.rotation.x = PM.vida.cabeceoAmp * Math.sin(ahora * PM.vida.cabeceoHz);

    // 3. La turbobomba coge vueltas. Ángulo = f(tiempo), no un contador que se incrementa.
    rig.turbina.rotation.y = estado.rpm * tiempo * PM.coreo.cierre.rpm + ahora * PM.vida.turbinaIdle;

    // 3a. LA PLACA DE INYECTORES SE INCLINA hacia la cámara (fila 22). Un cuaternión, no un
    //     tween de rotateX: el eje del giro es el HORIZONTAL DE LA PANTALLA, y en el marco del
    //     motor ese eje depende de la guiñada de `raiz` (que además cambia durante el parallax).
    //     `raiz` gira Ry(ψ) y luego Rx(rotX) (Euler XYZ), y Rx deja el eje X quieto, así que el
    //     vector local que cae en el X del mundo es Ry(−ψ)·X = (cos ψ, 0, sin ψ). Girar la placa
    //     +θ alrededor de él lleva su cara (+Y) hacia +Z, que es donde está la cámara. El pivote
    //     es el centro de la placa porque el grupo `inyector` tiene ahí su origen (geometria.ts).
    if (inyector) {
      const Iq = estado.inclina;
      if (Iq > 0.0005) {
        const psi = raiz.rotation.y + rig.sacudida.rotation.y;
        ejeInclina.set(Math.cos(psi), 0, Math.sin(psi));
        inyector.quaternion.setFromAxisAngle(ejeInclina, Iq * PM.coreo.como.inclinaInyector * GRA);
      } else {
        inyector.quaternion.identity();
      }
    }

    // 3b. EL DESVÍO DE LA GALERÍA. Se escribe en absoluto sobre un grupo que ningún tween toca, y
    //     se calcula CADA FOTOGRAMA porque depende del encuadre: la cámara ortográfica fija el
    //     alto y el ancho lo pone el aspecto del lienzo, así que el sitio disponible cambia con la
    //     ventana y hasta al girar el teléfono. Reglas:
    //       · en un cuadro apaisado el hueco se hace AL LADO (el objeto se va a la izquierda) y el
    //         desplazamiento se recorta con la holgura de verdad, para que la máquina no se salga
    //         del cuadro pase lo que pase;
    //       · en un cuadro de pie no hay sitio a los lados y no lo habrá nunca: la tarjeta va en
    //         DOS FILAS (base.css) y el motor vive en la BANDA de entre medias, centrado en ella
    //         y encogido lo justo si no cabe (PM.coreo.galeria.vertical, fila 16 del informe).
    //         Antes subía 2,6 u a secas y el título y la captura se escribían encima (medido:
    //         28 y 53 px de solape en un iPhone 13).
    //     La banda se mide en PÍXELES CSS desde los bordes (son filas de texto a tamaño fijo) y se
    //     pasa a unidades con el alto del lienzo que guarda el rig: en un teléfono alto lo que
    //     sobra va al motor. La ESCALA de `desvio` es el otro escritor único de este bloque: la
    //     timeline escala `raiz`, la composición escala `desvio`, y se multiplican.
    //     "De pie" es EXACTAMENTE lo que dice la hoja de estilos (@media (max-aspect-ratio: 1/1)
    //     en base.css), alto >= ancho: era `alto > 1,15 · ancho`, y entre los dos umbrales (una
    //     ventana de 900x1000, por ejemplo) la tarjeta ya iba en dos filas mientras el motor se
    //     apartaba a la izquierda, encima de las dos. Los dos lados tienen que decidir con la
    //     misma regla o el reparto no existe. El aspecto se lee del lienzo (rig.medida), que es
    //     lo que evalúa la media query, no del frustum: el zoom no cambia el aspecto, pero así
    //     no depende de que el encuadre lo respete.
    const A = estado.aparta;
    const B = estado.abierto;
    const anchoVis = (cam.right - cam.left) / cam.zoom;
    const altoVis = (cam.top - cam.bottom) / cam.zoom;
    const vertical = rig.medida.alto >= rig.medida.ancho;
    let dx = 0;
    let dy = 0;
    let escalaDesvio = 1;
    // CUÁNTO ALTO HAY DE VERDAD para el objeto, en unidades de motor. Normalmente es el cuadro con
    // el margen de la casa; mientras la composición vertical lo mete en la banda de la galería, es
    // la banda (y se entra en ella con el mismo `aparta`, para que no haya escalón). Lo usa el
    // encuadre por pose (3d), que es quien vigila que el vuelco no saque la máquina de su sitio.
    let dispoAlto = altoVis * (1 - 2 * PM.motor.margen);
    if (A > 0.0005) {
      const g = PM.coreo.galeria;
      if (vertical) {
        const V = g.vertical;
        const uPorPx = altoVis / rig.medida.alto;
        const bandaIni = altoVis / 2 - V.arriba * uPorPx;            // borde alto de la banda (y hacia arriba)
        const bandaFin = -altoVis / 2 + V.abajo * uPorPx;            // borde bajo
        const bandaAlto = Math.max(0.1, (bandaIni - bandaFin) * (1 - 2 * V.margen));
        const altoMotor = 2 * PM.motor.medioAlto * g.escala;
        const k = Math.min(1, bandaAlto / altoMotor);
        dy += ((bandaIni + bandaFin) / 2) * A;
        escalaDesvio -= (1 - k) * A;
        dispoAlto += (bandaAlto - dispoAlto) * A;
      } else {
        const semiX = PM.motor.medioAncho * g.escala + g.margenApartar;
        dx -= Math.min(g.apartar, Math.max(0, anchoVis / 2 - semiX)) * A;
      }
    }
    // 3c. EL DESPIECE EN VERTICAL. En compacto los rótulos van en dos bandas, arriba y abajo
    //     (rotulos.ts), y con el encuadre abierto de un móvil de pie el despiece a zoom 0,58 se
    //     metía debajo de la banda alta (su anillo de bancada subía hasta los 83 px del iPhone).
    //     Se centra entre las dos bandas y se encoge a lo que quepa (PM.coreo.como.vertical), con
    //     el escalar `abierto` que va y vuelve con el zoom del capítulo. Los rótulos se proyectan
    //     con la cámara cada fotograma, así que siguen a sus piezas sin enterarse.
    //     Solo cuando las bandas EXISTEN: rotulos.ts las monta por debajo de PM.rotulos.anchoCompacto
    //     de ancho, así que aquí se pregunta lo mismo (un cuadro de pie de 950 px de ancho lleva
    //     los rótulos en columnas y no hay nada a lo que hacer sitio).
    const compacto = rig.medida.ancho < PM.rotulos.anchoCompacto;
    if (B > 0.0005 && vertical && compacto) {
      const V = PM.coreo.como.vertical;
      const k = Math.min(1, (V.alto * altoVis) / PM.coreo.como.altoDespiece);
      dy += (0.5 - V.centro) * altoVis * B;
      escalaDesvio -= (1 - k) * B;
    }
    // 3d. EL ENCUADRE POR POSE (el vuelco). El encuadre de rig.ts se calcula con el objeto EN
    //     REPOSO y solo al redimensionar: `medioAlto` (3,35) describe una pose, no un objeto. Al
    //     tumbar la máquina el alto proyectado se va a 7,43 u en el bulto de rotX +20 / -38,6
    //     (+11,2 % sobre las 6,66 del reposo) y baja a 4,96 en el eje (-25,6 %), y además la caja
    //     SE DESCENTRA hasta 0,556 u. Medido en el iPhone 13 sin corregir: a rotX +20, con la
    //     tarjeta 1 viva, el motor se escribe encima de su `.captura`. Es la avería que arregló la
    //     Vuelta 3, por otra puerta.
    //
    //     Se corrige en `desvio` y NO en el frustum a propósito: `pintar()` le pasa a la tinta
    //     `camara.zoom · desvio.scale.x` como escala aparente (effects/motor3d.ts), así que
    //     compensando aquí la pluma se afina y se engorda sola, y la marca también (`marcaAlta()`
    //     divide por esa misma escala). Moviendo el frustum habría que tocar ese fichero.
    //
    //     DOS TÉRMINOS, con alcances distintos a propósito:
    //       (1) SEGURIDAD, siempre encendido: a su escala nominal el objeto tiene que caber en
    //           `dispoAlto`. Es un `min(1, …)`, así que solo puede ENCOGER. Y está encendido
    //           también donde el arco no llega, así que hay que demostrar que ahí no toca nada:
    //           barrido de la línea ENTERA cada 25 unidades (965 muestras, de la INTRO al final
    //           del CIERRE) contra la build aprobada, en las cinco ventanas — difieren 303
    //           muestras y TODAS caen dentro del arco (t 8125 a 15675), en tres canales y solo
    //           tres: `rotX`, la escala del desvío y su `y`. CERO diferencias fuera. Incluye el
    //           CIERRE, que era la duda: allí la coreografía agranda el objeto a propósito
    //           (escala 1 → 1,14) mientras la cámara abre el cuadro (zoom 1 → 0,72), y el
    //           producto de los dos nunca sube lo bastante para que la seguridad recorte.
    //       (2) ESTATURA, solo mientras `vuelco` manda: la misma altura en pantalla que en reposo,
    //           para que la máquina no encoja un cuarto justo en el fotograma en que se enseña.
    //           Puede AGRANDAR (hasta 1,34 en el eje), y por eso lleva su propio techo de ancho:
    //           el ancho proyectado no cambia nunca con rotX, pero sí con esta compensación.
    //     El escalar `vuelco` existe porque el perfil describe el objeto MONTADO: en el despiece
    //     (COMO) la pila mide 17,5 u y esta cuenta no vale, y el sitio se lo hace 3c. Y porque en
    //     CIERRE la coreografía agranda el objeto A PROPÓSITO para que se vaya: eso no es un
    //     desbordamiento que haya que corregir.
    //
    //     El ángulo se lee de `raiz` SIN la sacudida, y esto no es un descuido: el cabeceo de la
    //     capa de vida son ±1,3°, y en la parte inclinada del arco eso mueve el alto proyectado un
    //     1,3 %, así que el objeto respiraría ±0,65 % de tamaño con periodo de 13,1 s. Sigue siendo
    //     función del reloj, pero es un temblor que nadie ha pedido.
    const Vu = estado.vuelco;
    const caja = rig.proyectar(raiz.rotation.x);
    const ref = rig.reposoProyectado;
    const escalaObjeto = raiz.scale.x * escalaDesvio;
    const kSeguro = Math.min(1, dispoAlto / Math.max(1e-6, caja.alto * escalaObjeto));
    const kEstatura = Math.min(
      ref.alto / caja.alto,
      (anchoVis * (1 - 2 * PM.motor.margen)) / Math.max(1e-6, 2 * rig.radioMax * escalaObjeto),
    );
    const kPose = kSeguro + Vu * (kEstatura - kSeguro);
    escalaDesvio *= kPose;
    // Y el DESCENTRADO, siempre relativo al reposo: así la composición que la Vuelta 3 midió a
    // rotX -7 no se mueve. `centro` está en el eje vertical de la PANTALLA y `dy` es una y del
    // mundo, y las dos no son la misma cosa: se dividen por el coseno de la elevación de la cámara.
    dy -= (Vu * (caja.centro * kPose - ref.centro) * escalaObjeto) / Math.cos(rig.elevacion);

    rig.desvio.position.set(dx, dy, 0);
    rig.desvio.scale.setScalar(escalaDesvio);

    // 4. La marca. Se lleva al espacio de la cámara: se toma el centro del conjunto en MUNDO, se
    //    adelanta hacia la cámara y se trae al espacio del padre de la placa. Definida en el
    //    espacio de la placa se descentraba al girar el motor.
    const L = estado.logo;
    if (L > 0.0005) {
      const padre = rig.marca.parent;
      if (padre) {
        padre.updateWorldMatrix(true, false);
        padre.getWorldQuaternion(qPadre).invert();
        const escalaMarca = marcaAlta();
        qDestino.copy(qPadre).multiply(cam.quaternion);
        rig.marca.quaternion.slerpQuaternions(qMarca, qDestino, L);
        rig.marca.scale.set(
          eMarca.x + (escalaMarca - eMarca.x) * L,
          eMarca.y + (escalaMarca - eMarca.y) * L,
          eMarca.z + (escalaMarca - eMarca.z) * L,
        );
        // El nodo es el CENTRO DEL CUADRO, no el del motor. La cámara ortográfica mira al origen
        // del mundo, así que ese es el punto que cae en el centro de la pantalla. Tomándolo de
        // `raiz` la marca salía descentrada a la izquierda, porque en COMO `raiz.x` vale -0,6.
        nodoW.set(0, 0, 0);
        cam.getWorldDirection(dirCam);
        nodoW.addScaledVector(dirCam, -PM.marca.adelante);
        // el origen local de la placa es la junta de las tres formas, no su centro: se corrige
        desvio.copy(CENTRO_MARCA).multiplyScalar(escalaMarca).applyQuaternion(cam.quaternion);
        nodoW.sub(desvio);
        padre.worldToLocal(nodoW);
        rig.marca.position.lerpVectors(pMarca, nodoW, L);
      }
    } else {
      rig.marca.quaternion.copy(qMarca);
      rig.marca.position.copy(pMarca);
      rig.marca.scale.copy(eMarca);
    }

    // 5. Luces. Un solo escritor por propiedad: el producto se hace aquí, no con tweens que se pisan.
    const apaga = 1 - estado.apagado * (1 - PM.coreo.como.apagado);
    const fuera = 1 - estado.salida;
    rig.luzClave.intensity = PM.motor.luzClave * estado.luz * apaga * fuera;
    rig.luzCamara.intensity = estado.brillo * PM.coreo.cierre.luzCamara * fuera;

    // 6. Emisivos: el latido de la galería y el rojo del encendido, sobre la misma propiedad.
    for (let i = 0; i < rig.emisivos.length; i++) {
      const base = emisivoBase[i];
      rig.emisivos[i].emissiveIntensity =
        (base + estado.pulso * (PM.coreo.galeria.emisivo - base) + estado.brillo * (PM.coreo.cierre.emisiva - base)) * fuera;
    }
    // 6b. El ámbar respira, también con el reloj del navegador. Va multiplicando lo que acaba de
    //     escribir la coreografía, no sustituyéndolo: el latido de la galería y el rojo del
    //     encendido siguen mandando, y esto solo les añade un vaivén para que nunca esté quieto.
    const respira = 1 + PM.vida.latidoAmp * Math.sin(ahora * PM.vida.latidoHz);
    for (let i = 0; i < rig.emisivos.length; i++) rig.emisivos[i].emissiveIntensity *= respira;

    // el inserto de garganta es MeshBasicMaterial (sin iluminar): en el encendido se pone al blanco
    rig.caliente.color.lerpColors(colorFrio, colorCaliente, MathUtils.clamp(estado.brillo, 0, 1));
    // La marca se AUTO-ILUMINA a medida que viene al frente: un logotipo no se sombrea, y además
    // en ese momento la luz clave está al 18 % para apagar el resto del motor.
    for (const mat of rig.emisivosMarca) mat.emissiveIntensity = L * PM.marca.emisiva;

    // 7. Opacidades. `transparent` se enciende SOLO en los dos momentos que lo necesitan: fuera de
    //    ellos los cuerpos vuelven a la pasada opaca, que se ordena de delante a atrás y sí tiene
    //    rechazo temprano por profundidad (ver rig.ts, transparentar()). Son dos conmutaciones en
    //    toda la línea de tiempo, y la segunda ya encuentra el programa en caché.
    const quiereAlfa = estado.apagado > 0.001 || estado.salida > 0.001 || L > 0.001;
    if (quiereAlfa !== alfa) {
      alfa = quiereAlfa;
      for (const mat of rig.cuerpos) { mat.transparent = quiereAlfa; mat.needsUpdate = true; }
    }
    for (const mat of rig.cuerpos) {
      const base = opacidad.get(mat) ?? 1;
      // El apagado se hace con OPACIDAD, no solo con luz: bajando la luz clave el resto del motor
      // seguía tapando la marca, y en COMO el tema es CLARO, donde "quitar luz" se lee como
      // "todo un poco más gris".
      // La CHAPA de soporte se desvanece con `logo`: en el motor da al monograma el sitio que
      // necesita para no leerse como una pieza suelta, pero al venir al frente crece con él y se
      // convertiría en un rectángulo gris tapando el motor entero.
      // La chapa se va DE GOLPE, no linealmente. Con `1 - L` seguía al 80 % cuando la placa ya
      // se había escalado 3,5x: en pantalla, una losa gris opaca del tamaño de la cámara de
      // combustión tapando el motor entero (captura esc-16b), y a mitad de gesto una losa
      // translúcida con el canto recto a la vista (esc-16c). El área crece con el CUADRADO de la
      // escala, así que cualquier desvanecido proporcional al recorrido llega tarde. La chapa
      // cumple su función —dar sitio al monograma cuando está atornillado al motor— y desaparece
      // en cuanto el monograma se despega: a L = 0,12 ya no está.
      mat.opacity = chapaMarca.has(mat)
        ? base * Math.max(0, 1 - L * 8) * fuera
        : materialesMarca.has(mat)
          ? base * fuera
          : base * (1 - PM.coreo.como.borrado * estado.apagado) * fuera;
    }
  }

  function revertir(): void {
    document.removeEventListener('yoi:acento', alCambiarAcento);
    acentoT0 = -1;
    rig.emisivos.forEach((mat, i) => { mat.color.copy(acentoOriginal[i].color); mat.emissive.copy(acentoOriginal[i].emissive); });
    rig.luzCamara.color.copy(luzCamaraOriginal);
    colorFrio.copy(luzCamaraOriginal);
    if (alfa) {
      alfa = false;
      for (const mat of rig.cuerpos) { mat.transparent = false; mat.needsUpdate = true; }
    }
    rig.marca.quaternion.copy(qMarca);
    rig.marca.position.copy(pMarca);
    rig.marca.scale.copy(eMarca);
    if (inyector) inyector.quaternion.identity();
    for (const mat of rig.cuerpos) mat.opacity = opacidad.get(mat) ?? 1;
    for (let i = 0; i < rig.emisivos.length; i++) rig.emisivos[i].emissiveIntensity = emisivoBase[i];
    rig.caliente.color.copy(colorFrio);
    rig.sacudida.position.set(0, 0, 0);
    rig.sacudida.rotation.set(0, 0, 0);
    rig.desvio.position.set(0, 0, 0);
    rig.desvio.scale.setScalar(1);
  }

  const objetivos: object[] = [
    raiz, cam, estado, ...estado.rotulos, ...rig.tubos,
    ...sitios.map((s) => s.p.obj as Object3D),
  ];

  return { estado, aplicar, revertir, objetivos };
}

