import {
  AdditiveBlending, BufferAttribute, Color, DoubleSide, FrontSide, Group, LatheGeometry, MathUtils, Mesh,
  MeshBasicMaterial, OctahedronGeometry, Vector2, Vector3, type BufferGeometry, type Material,
} from 'three';
import { PM } from '../params-motor';
import { salidaAlTarget } from './geometria';
import type { Estado } from './coreografia';

// EL PENACHO DEL ENCENDIDO
// ===============================================================================================
// Sin postprocesado (ni EffectComposer, ni bloom, ni un solo shader nuestro) y sin partículas (que
// habría que sembrar con azar, que es lo contrario de un scrub reversible).
//
// TÉCNICA: GEOMETRÍA. Cuatro husos de revolución encajados (LatheGeometry) pintados con color por
// vértice del blanco al negro y dibujados con mezcla ADITIVA y sin escribir en el z-buffer. Más
// tres octaedros en el eje, en los cuellos, que hacen de diamantes de Mach.
//
// QUÉ SE ARREGLÓ AQUÍ, porque el resultado anterior "se leía como una llama de vela" y era verdad:
// el perfil se ENSANCHABA a media altura por encima del radio de la boca y luego se cerraba, o sea
// una gota; con el núcleo blanco dentro y la envolvente naranja apagada (marrón, con mezcla
// aditiva) alrededor, el conjunto era exactamente una bombilla encendida (img/P0-20250.png). Las
// tres cosas que lo convierten en un escape, por orden de peso:
//   1) FORMA: el perfil ya no ensancha nunca, y lleva celdas de choque (ver `perfil`).
//   2) PROPORCIÓN: 9,5 de largo por 2,15 de radio, y el final se sale del cuadro. Un chorro no
//      termina en punta: se va.
//   3) DEGRADADO: el borde de cada capa es un escalón duro y no hay forma de evitarlo sin shader,
//      así que el degradado radial se hace con cuatro capas que se apagan a ritmos distintos
//      (ver `pintaColores`), y la de fuera se apaga la primera.
//
// Se probó también con "cortinas" (planos girados con una textura de degradado) y FALLA POR
// GEOMETRÍA, no por gusto: los planos son cuadriláteros que salen de la garganta, que está DENTRO
// de la campana, así que atraviesan la pared de la tobera y se ven como bandas rectangulares
// luminosas cruzándola. Una pluma de tobera acampanada es un sólido de revolución; hecha con un
// sólido de revolución, nunca cruza la pared.
//
// Es función pura de (estado, tiempo): el parpadeo son senos del reloj del maestro, no ruido.
//
// Y EL PASE DE TINTA NO LO TOCA (motor/tinta.ts). Un chorro de gas no lleva contorno, y no lo
// lleva por construcción, no por una máscara: las capas van con `depthWrite: false` (así que no
// están en la textura de profundidad) y escriben vec4(0) en la textura de normales con mezcla
// aditiva (SRC_ALPHA · 0 + DST · 1: la normal de lo que haya detrás se queda como estaba; ver
// salidaAlTarget). Al pase no le llega ninguna arista del penacho que detectar. No hacen falta
// `layers`: la escena se dibuja UNA vez (MRT), no hay un pase de normales del que excluirlo.

export interface Penacho {
  obj: Group;
  aplicar(estado: Estado, tiempo: number): void;
  /** Deja solo las dos capas del núcleo. Es el primer peldaño del vigilante de fotogramas: el
   *  penacho ocupa la pantalla entera y son varias pasadas mezcladas a pantalla completa. */
  ligero(on: boolean): void;
  liberar(): void;
}

const CALIENTE = new Color(0xfff3d6);
// El ámbar de la marca (M.paleta.acento es 0xffd166): el escape es el único sitio del demo donde
// el acento ocupa área, y tiene que ser EL MISMO ámbar que los zunchos y el anillo de garganta.
const MEDIO = new Color(0xffc25e);
// El FRIO era 0xd2510e (y antes 0x8a3410). Con mezcla aditiva sobre negro, el color que se ve es
// exactamente color x opacidad: un naranja oscuro al 18 % da (0,24 · 0,09 · 0,02), o sea MARRÓN.
// La capa ancha salía como un huevo marrón con borde duro. Se arregla por los dos lados: naranja
// mucho más vivo aquí, y la capa ancha bajada al 6 % (ver `opacidadCapa`).
const FRIO = new Color(0xff7a1e);

/**
 * Perfil de media pluma de gases, MEDIDO DESDE EL LABIO DE LA CAMPANA (no desde la garganta).
 *
 * ESTO ES LO QUE SEPARA UN ESCAPE DE UNA LLAMA, y es forma, no color. El perfil anterior tenía un
 * término `abre` (0,82 -> 1,00) que ensanchaba la pluma a media altura por encima del radio de la
 * boca y luego la cerraba: una gota. Con la cola llegando a cero y el núcleo blanco en el centro,
 * el resultado era literalmente una bombilla encendida (captura img/P0-20250.png).
 *
 * El perfil nuevo tiene dos términos y ninguno de los dos ensancha nunca:
 *   · `afila`: el chorro nace con el radio de la boca y se estrecha sin parar. Monótono.
 *   · `celdas`: los estrangulamientos de las celdas de choque. Un chorro que sale sobreexpandido
 *     se comprime, se vuelve a hinchar y así varias veces, amortiguándose (`exp(-3,2u)`). Es un
 *     COSENO RECTIFICADO, entre 0 y 1: solo puede cerrar, nunca abrir por encima de la boca.
 * Las dos cosas juntas dan la silueta arrosariada de un escape a presión, y a la vez respetan lo
 * que ya estaba comprobado: nace pegado al labio, con el radio de la boca, y no toca la campana.
 */
function perfil(radio: number, largo: number, ondas: number): Vector2[] {
  const p: Vector2[] = [];
  const n = 40;   // 26 puntos se comían los estrangulamientos: quedaban facetas, no cuellos
  const P = PM.penacho;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const afila = 0.06 + 0.94 * (1 - u) ** 1.45;
    const celdas = 1 - P.celda * 0.5 * (1 - Math.cos(u * Math.PI * 2 * P.celdas)) * Math.exp(-u * 3.2);
    const r = radio * afila * celdas * (1 - ondas * Math.sin(u * Math.PI * 2.5) * 0.06);
    p.push(new Vector2(Math.max(0.003, r), -u * largo));
  }
  return p;
}

/**
 * Color por vértice de una capa: temperatura por la altura, y un DESVANECIDO propio por capa.
 *
 * Aquí está el arreglo del faldón marrón, y no es bajarle la opacidad a la capa ancha sin más.
 * Con mezcla aditiva lo que se ve es color x opacidad, así que una capa tenue de naranja apagado
 * es literalmente marrón oscuro, y con `DoubleSide` su borde es un ESCALÓN (dos caras dentro,
 * ninguna fuera). Bajarle la opacidad a secas arreglaba el faldón y rompía otra cosa: la capa
 * ancha es la que llena la BOCA de la campana, y al apagarla quedaba un anillo negro entre el
 * labio y el chorro —el fallo de la "lámpara de sobremesa" que ya estaba anotado en este fichero—.
 *
 * Solución: la capa conserva opacidad suficiente para llenar la boca, y el degradado va en el
 * COLOR, con un exponente distinto por capa (`caida`). Las de fuera se apagan deprisa: pintan el
 * halo justo donde el gas está blanco, junto al labio, y a media pluma ya son negras (o sea,
 * invisibles con mezcla aditiva). Las de dentro aguantan. El resultado es un degradado radial
 * hecho con cuatro superficies opacas, que es lo más parecido a un shader que se puede hacer sin
 * escribir uno.
 *
 * @param caida exponente del desvanecido: 3,6 en la capa ancha, 0,8 en el núcleo.
 */
function pintaColores(geo: BufferGeometry, largo: number, caida: number, calor: number): void {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const u = MathUtils.clamp(-pos.getY(i) / largo, 0, 1);
    // temperatura: blanco en la boca, ámbar de la marca enseguida, naranja después.
    // El NARANJA es solo del núcleo (`calor` = 1). Las capas de fuera se quedan en ámbar, y no por
    // gusto: con mezcla aditiva lo que se ve es color x opacidad, así que un naranja al 12 % da un
    // marrón oliva —medido en el recorte a 6x: RGB (42, 32, 15)— y esa era la "funda de plástico
    // color café" que rodeaba el chorro. El mismo brillo en ámbar da un halo cálido.
    if (u < 0.16) c.copy(CALIENTE).lerp(MEDIO, u / 0.16);
    else c.copy(MEDIO).lerp(FRIO, MathUtils.clamp((u - 0.16) / 0.46, 0, 1) * calor);
    // Y el desvanecido. Tiene que llegar a NEGRO dentro de la geometría: con mezcla aditiva negro
    // es invisible, y así el chorro se apaga en vez de cortarse cuando cruza el borde del cuadro.
    //
    // `cola` es el arreglo del PICO. Con solo (1-u)^caida el núcleo seguía al 16 % de brillo en
    // u = 0,9, o sea claramente visible sobre negro justo donde el perfil se cierra en aguja: el
    // chorro TERMINABA EN PUNTA dentro del cuadro y eso es una vela, no un motor (esc-23). Al
    // cuadrado, la rampa llega a cero con pendiente cero: no hay vértice final que se vea, el
    // chorro se deshace.
    const cola = MathUtils.clamp((1 - u) / 0.3, 0, 1);
    c.multiplyScalar((1 - u) ** caida * cola * cola);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
}

/** Opacidad de la capa i de n: la ancha tenue, el núcleo casi opaco. La curva del degradado
 *  radial la pone `pintaColores`; esto solo reparte cuánto pesa cada superficie. */
function opacidadCapa(i: number, n: number): number {
  // El 4/n mantiene la SUMA de opacidades igual que con las cuatro capas de antes: con mezcla
  // aditiva, más capas al mismo peso es un chorro más brillante, y el núcleo ya se satura a blanco.
  return Math.min(0.9, (0.1 + 0.75 * (n > 1 ? i / (n - 1) : 1) ** 1.3) * (4 / n));
}

/** Radio de la capa i (f = 0 la ancha, f = 1 el núcleo) como fracción del radio del chorro.
 *  Los radios NO se reparten a partes iguales: con el reparto lineal (1 / 0,81 / 0,62 / 0,43) la
 *  banda entre la envolvente y la siguiente medía el 19 % del radio, y esa franja de naranja
 *  apagado —o sea marrón— era el faldón que rodeaba el chorro. Las dos de fuera van casi pegadas
 *  y el salto grande se lo lleva el núcleo, que es donde hay brillo para taparlo. */
function radioCapa(f: number): number {
  return 1 - 0.57 * f ** 1.55;
}

/**
 * @param yLabio     altura del plano de salida de la campana (el penacho cuelga de ahí)
 * @param pocasCapas movil: la mitad de capas y una sola cara. El penacho mide 9,5 u en un encuadre
 *                   de 8,8: OCUPA LA PANTALLA ENTERA, y son hasta 8 pasadas mezcladas a pantalla
 *                   completa. En una GPU por baldosas el relleno es lo que decide, no los
 *                   triangulos, asi que es lo PRIMERO que hay que degradar.
 */
export function crearPenacho(yLabio: number, pocasCapas = false): Penacho {
  const obj = new Group();
  obj.name = 'penacho';
  obj.position.y = yLabio;
  obj.visible = false;
  const materiales: Material[] = [];
  const geometrias: BufferGeometry[] = [];
  const capas: Mesh[] = [];
  const opacidadBase: number[] = [];
  const escalaBase: Vector3[] = [];
  const diamantes: Mesh[] = [];

  // CUATRO en móvil, no dos. Con dos capas el reparto de radios deja al descubierto media anchura del
  // chorro cubierta SOLO por la envolvente, y la envolvente a solas es casi negra: en las capturas
  // de móvil el penacho leía como humo sucio o como una estaca de madera (mov-20, mov-21). La
  // tercera capa es una llamada de dibujo más y es lo que hace que se lea como gas caliente.
  const nCapas = pocasCapas ? 4 : PM.penacho.capas;
  for (let i = 0; i < nCapas; i++) {
    const f = nCapas > 1 ? i / (nCapas - 1) : 1;
    const k = radioCapa(f);
    const largo = PM.penacho.largo * (0.7 + 0.3 * k);
    const geo = new LatheGeometry(perfil(PM.penacho.radio * k, largo, i === 0 ? 0 : 1), 28);
    pintaColores(geo, largo, 3.6 - 2.8 * f, f);
    // La capa MÁS ANCHA es la más tenue y la del núcleo la más intensa: al revés se ve un trapecio
    // recortado, no un chorro. El reparto NO es lineal, ver opacidadCapa().
    const op = opacidadCapa(i, nCapas);
    const mat = new MeshBasicMaterial({
      vertexColors: true, blending: AdditiveBlending, depthWrite: false,
      transparent: true, side: pocasCapas && i > 0 ? FrontSide : DoubleSide, opacity: op,
    });
    // `transparent` + `DoubleSide` hace que Three dibuje la malla DOS VECES (traseras y luego
    // delanteras, para ordenarlas). Con mezcla ADITIVA el orden da exactamente igual —la suma es
    // conmutativa—, así que la pasada doble no aporta nada y cuesta una llamada por capa: medido,
    // 8 llamadas del penacho en vez de 4 (68 contra 64 en el fotograma del encendido).
    mat.forceSinglePass = true;
    mat.onBeforeCompile = (shader) => salidaAlTarget(shader, 'nada');
    mat.customProgramCacheKey = () => 'penacho-mrt';
    const malla = new Mesh(geo, mat);
    malla.frustumCulled = false;
    obj.add(malla);
    capas.push(malla);
    opacidadBase.push(op);
    escalaBase.push(malla.scale.clone());
    materiales.push(mat);
    geometrias.push(geo);
  }

  const geoD = new OctahedronGeometry(1, 0);
  geometrias.push(geoD);
  // Los diamantes de Mach son un DETALLE dentro del chorro, no una figura.
  const matDiamante = new MeshBasicMaterial({
    color: 0xfff1d2, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3,
  });
  matDiamante.onBeforeCompile = (shader) => salidaAlTarget(shader, 'nada');
  matDiamante.customProgramCacheKey = () => 'penacho-mrt';
  materiales.push(matDiamante);
  // VAN EN LOS CUELLOS, no repartidos a ojo. El perfil estrangula donde el coseno de `celdas` vale
  // -1, o sea en u = (2m-1) / (2·celdas): ahí es donde el gas se comprime y donde brilla. Antes
  // eran siete rombos diminutos (0,075 del radio) colocados por interpolación y no se veía ni uno.
  for (let i = 0; i < PM.penacho.diamantes; i++) {
    const d = new Mesh(geoD, matDiamante);
    const u = (2 * i + 1) / (2 * PM.penacho.celdas);
    // Ancho del cuello en ese punto, con la misma fórmula del perfil, y ceñido al RADIO DEL
    // NÚCLEO: el rombo tiene que caber dentro de la capa más brillante. Iba a 0,62 del radio del
    // chorro y el núcleo está en 0,43, así que sobresalía y caía sobre las capas de fuera, que son
    // casi negras: en vez de un destello se veía un LOSANGE GRIS. En el móvil, donde solo quedan
    // dos capas y no hay medios tonos, era descarado (img/z-baja.png, antes del arreglo).
    const afila = 0.06 + 0.94 * (1 - u) ** 1.45;
    const s = PM.penacho.radio * afila * (1 - PM.penacho.celda * Math.exp(-u * 3.2)) * radioCapa(1);
    d.position.y = -u * PM.penacho.largo;
    d.scale.set(s * 0.85, s * 2.1, s * 0.85);
    d.frustumCulled = false;
    obj.add(d);
    diamantes.push(d);
  }

  const [hz1, hz2] = PM.penacho.parpadeoHz;
  const [a1, a2] = PM.penacho.parpadeo;

  function aplicar(estado: Estado, tiempo: number): void {
    const a = estado.penacho * (1 - estado.salida * 0.7);
    obj.visible = a > 0.002;
    if (!obj.visible) {
      // Apagado NO es "dejar de mirar": si se sale sin escribir, la escala se queda con el valor
      // del fotograma anterior y el objeto conserva estado entre pasadas. Medido con la prueba de
      // reversibilidad: con el `return` a secas, 386 de 421 paradas daban un grafo distinto al
      // volver aunque en pantalla no se viera nada.
      //
      // Y hay que reponer TODO lo que escribe la rama de abajo, no solo la escala del grupo: la
      // escala y la opacidad de cada capa y los rombos. Con solo el grupo, la prueba seguía dando
      // 155 paradas de 169 distintas al volver (la primera, en t=19250: una capa con escala
      // 1,048903 de ida y 1 de vuelta, el bamboleo del último fotograma encendido que se quedaba
      // pegado). El estado del grafo no puede depender de POR DÓNDE se ha llegado a este instante.
      obj.scale.set(0, 0, 0);
      for (let i = 0; i < capas.length; i++) {
        capas[i].scale.copy(escalaBase[i]);
        (capas[i].material as MeshBasicMaterial).opacity = 0;
      }
      matDiamante.opacity = 0;
      for (const d of diamantes) d.visible = false;
      return;
    }
    const largo = a * (1 + estado.estira * PM.penacho.estira);
    const grueso = Math.pow(a, 0.55);
    // parpadeo: dos senos del RELOJ DEL MAESTRO (no de performance.now())
    const p = 1 + a1 * Math.sin(tiempo * hz1) + a2 * Math.sin(tiempo * hz2 + 2.1);
    obj.scale.set(grueso * p, largo, grueso * p);
    for (let i = 0; i < capas.length; i++) {
      const d = 1 + 0.05 * Math.sin(tiempo * (0.17 + i * 0.06) + i);
      const b = escalaBase[i];
      capas[i].scale.set(b.x * d, b.y * (1 + (1 - d) * 0.4), b.z * d);
      (capas[i].material as MeshBasicMaterial).opacity = opacidadBase[i] * a;
    }
    const vis = Math.max(0, (a - 0.45) / 0.55);   // los diamantes solo con el chorro ya formado
    matDiamante.opacity = 0.22 * vis;
    for (let i = 0; i < diamantes.length; i++) diamantes[i].visible = vis > 0.01;
  }

  function ligero(on: boolean): void {
    // Se queda la ENVOLVENTE y las dos del núcleo, no "las dos últimas". Quitando la envolvente,
    // la boca de la campana deja de estar llena y queda un anillo negro entre el labio y el chorro:
    // es el fallo de la "lámpara de sobremesa" que ya está anotado arriba en este fichero.
    const n = capas.length;
    for (let i = 0; i < n; i++) capas[i].visible = !on || i === 0 || i >= n - 2;
  }

  function liberar(): void {
    for (const g of geometrias) g.dispose();
    for (const m of materiales) m.dispose();
  }

  return { obj, aplicar, ligero, liberar };
}
