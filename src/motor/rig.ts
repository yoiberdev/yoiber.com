import {
  AmbientLight, Color, DirectionalLight, DoubleSide, Group, InstancedMesh, Matrix4,
  MeshBasicMaterial, MeshToonMaterial, Object3D, OrthographicCamera, PointLight,
  Quaternion, Scene, Vector3, type Material,
} from 'three';
import { PM } from '../params-motor';
import { aplicarTema, crearMotor, calidad as calidadGeometria, M, ponerFilo, type Calidad, type Motor } from './geometria';

// EL CONTRATO ENTRE LA GEOMETRÍA Y LA COREOGRAFÍA
// ===============================================================================================
// La coreografía no sabe cómo está hecha ninguna pieza: solo conoce este Rig. Aquí se construye el
// motor de verdad (geometria.ts, geometría procedimental pura) y se envuelve en la forma que la
// coreografía necesita.
//
// Jerarquía, y el porqué de cada nivel:
//   escena
//     └ desvio      <- SOLO la composición de ENCUADRE (posición y escala), escrita en absoluto
//                      desde aplicar(): el desvío de la galería y, en un cuadro de pie, el sitio
//                      que el motor deja a la tarjeta y a las bandas de rótulos. Va por ENCIMA de
//                      `raiz` porque es un ajuste de pantalla, ajeno a la escala del objeto, y
//                      porque su valor depende del tamaño del lienzo, que la timeline no conoce:
//                      en un móvil de pie no hay 3,2 u de sitio a los lados y el hueco hay que
//                      hacerlo arriba.
//         └ raiz        <- lo ÚNICO que anima la timeline maestra (x, y, rotateX, rotateY, scale)
//             └ sacudida <- SOLO el temblor del encendido, escrito en absoluto desde aplicar()
//             └ centrado <- offset fijo: el motor está construido con la garganta en y=0 y su
//                           centro geométrico en y=-0,11; esto lo sube para que quede encuadrado
//                 └ motor.grupo  (las piezas, tal cual las deja geometria.ts)
// Separar `sacudida` de `raiz` es lo que hace el temblor reversible: sumado a `raiz.position` se
// acumularía en los fotogramas en que la timeline no reescribe esa propiedad, y al arrastrar hacia
// atrás el motor no volvería a su sitio.

export interface PiezaRig {
  id: string;
  obj: Object3D;      // el grupo que se aparta en el despiece
  abierto: Vector3;   // desplazamiento del despiece, en el espacio del padre
  ancla: Vector3;     // punto LOCAL de la pieza donde engancha el rótulo
  anclaMovil?: Vector3;   // el mismo punto para las bandas de compacto, si difiere (ver PM.piezas)
  lado: -1 | 1;
  /** Conserva rótulo en pantalla estrecha. */
  movil: boolean;
  titulo: string;
  nota: string;
}

/** Un tubo de la corona. NO es un Object3D: la corona entera es UNA InstancedMesh (1 llamada de
 *  dibujo para 36 tubos). La timeline anima `z` (desplazamiento RADIAL, por el azimut del propio
 *  tubo) de estos objetos planos y `escribirTubos()` compone las matrices. Anime.js anima
 *  cualquier objeto plano, así que el retardo por tubo se reparte igual; eso sí, NO con
 *  `stagger(..., { from })`, que reparte por índice (ver `azimutes` y coreografia.ts). */
export interface TuboRig { z: number }

export interface Rig {
  escena: Scene;
  camara: OrthographicCamera;
  /** Composición de encuadre (desvío de la galería, sitio en vertical): posición y escala las
   *  escribe `aplicar()` en absoluto, nunca la timeline. */
  desvio: Group;
  /** Tamaño CSS del lienzo, el de la última llamada a `disponer()`: la composición vertical mide
   *  sus filas de texto en píxeles y necesita pasarlos a unidades de motor. */
  medida: { ancho: number; alto: number };
  raiz: Group;
  sacudida: Group;
  motor: Motor;
  /** Las piezas con rótulo. Su orden es el de las ranuras de cada columna. */
  piezas: PiezaRig[];
  /** Piezas que se despiezan sin rótulo (la placa de identificación). */
  sueltas: PiezaRig[];
  tubos: TuboRig[];
  /** Azimut de cada tubo en el marco del motor, en GRADOS (0 = +X, 90 = +Z). La coreografía
   *  reparte por AQUÍ el retardo de entrada de la corona: el índice del tubo no vale, porque el
   *  ángulo del tubo i no es i·360/n (ver escribirTubos). */
  azimutes: number[];
  /** La marca: la placa de identificación con el monograma. Ver PM.marca. */
  marca: Object3D;
  /** Materiales PROPIOS de la marca (clones): así el apagado del resto no la toca. */
  materialesMarca: Material[];
  /** Los tres del monograma, que además se auto-iluminan cuando la marca manda. */
  emisivosMarca: MeshToonMaterial[];
  /** La chapa de soporte del monograma: se desvanece cuando la marca viene al frente (si no, al
   *  escalarse ocupa media pantalla y tapa el motor: sería una marca de agua). */
  chapaMarca: Material[];
  /** Rotor de la turbobomba: coge vueltas en el encendido. */
  turbina: Object3D;
  luzClave: DirectionalLight;
  luzCamara: PointLight;
  /** Materiales que laten en la galería y se ponen al rojo en el encendido. La coreografía les
   *  funde `color` y `emissive` hacia el acento vigente (ver coreografia.ts, el acento). */
  emisivos: MeshToonMaterial[];
  /** El inserto de garganta, sin iluminar: es el único modo de que la garganta "arda" sin postpro. */
  caliente: MeshBasicMaterial;
  /** Plano de salida de la campana, en unidades de motor: de ahí cuelga el penacho. */
  yLabio: number;
  /** Todo lo que se atenúa (apagado de la marca y fundido final). */
  cuerpos: Material[];
  /** Desplazamiento radial EXTRA por tubo, en unidades de motor. Lo escribe SOLO la capa de vida
   *  (el pulso de la corona, ver PM.vida.ondaAmp); la timeline no lo toca nunca. Existe para que
   *  `tubos[i].z` siga teniendo un único escritor: la timeline pone dónde va el tubo y esto le
   *  suma el temblor. */
  onda: number[];
  /** Escribe las matrices de la corona a partir de `tubos[i].z` + `onda[i]`. Función pura de esos
   *  valores. */
  escribirTubos(): void;
  /** Apertura de cada aleta en RADIANES, sobre su propio eje radial (como una lama de persiana).
   *  Lo escribe la coreografía en `aplicar()`; la timeline solo mueve el escalar `estado.aletas`. */
  aletas: number[];
  /** Recompone las matrices del anillo de aletas a partir de `aletas[i]`. Función pura de eso. */
  escribirAletas(): void;
  /** Azimut de cada aleta en GRADOS. El retardo del gesto se reparte por AQUÍ y no por el índice:
   *  faltan las aletas del hueco de la turbobomba, así que la aleta i no está en i·360/n. */
  azimutesAletas: number[];
  /** El tema en los materiales (tonos del toon, filo, piel de la campana). El color de la TINTA
   *  lo cambia el pase de pantalla (motor/tinta.ts, tema()): effects/motor3d.ts llama a los dos. */
  tema(claro: boolean): void;
  disponer(ancho: number, alto: number): void;
  /** La caja PROYECTADA del objeto montado para un cabeceo dado, sobre el eje VERTICAL de la
   *  pantalla y en unidades de motor a escala 1: `alto` y `centro` (+ = hacia arriba). Función pura
   *  de `rotX` (ver PM.motor.perfil). Devuelve SIEMPRE el mismo objeto: se llama cada fotograma. */
  proyectar(rotX: number): CajaPose;
  /** Lo que devuelve `proyectar` en la pose de reposo (PM.coreo.heroOut.rotX[1]), ya copiado. */
  reposoProyectado: CajaPose;
  /** Elevación de la cámara sobre la horizontal, en radianes: atan(camara.y / camara.z). Es el
   *  desfase entre `raiz.rotateX` y el ángulo que de verdad ve la cámara. */
  elevacion: number;
  /** Radio máximo REAL del grafo montado, en unidades de motor: es el SEMIANCHO proyectado con
   *  cualquier pose (rotX no toca el eje horizontal de la cámara). Vale `PM.motor.medioAncho` con
   *  los 36 tubos y 2,68 con los 24 de móvil, que son más gordos. */
  radioMax: number;
  liberar(): void;
}

/** Alto y centro de la caja proyectada, en unidades de motor (ver Rig.proyectar). */
export interface CajaPose { alto: number; centro: number }

export function construirRig(nivel: Calidad): Rig {
  calidadGeometria(nivel);   // menos tubos y menos segmentos de revolución en móvil

  const escena = new Scene();
  const camara = new OrthographicCamera(-1, 1, 1, -1, PM.motor.cerca, PM.motor.lejos);
  camara.position.set(...PM.motor.camara);
  camara.lookAt(0, 0, 0);

  const desvio = new Group();
  desvio.name = 'desvio';
  const raiz = new Group();
  raiz.name = 'raiz';
  const sacudida = new Group();
  sacudida.name = 'sacudida';
  const centrado = new Group();
  centrado.name = 'centrado';
  centrado.position.y = PM.motor.centro;
  raiz.add(sacudida);
  sacudida.add(centrado);
  desvio.add(raiz);
  escena.add(desvio);

  const motor = crearMotor();
  centrado.add(motor.grupo);

  // -------------------------------------------------------------------------------------------
  // MATERIALES. La geometría los crea opacos; la coreografía necesita atenuarlos (el apagado de la
  // marca y el fundido final), así que aquí se marcan transparentes UNA vez. Es el único cambio
  // que este adaptador hace sobre lo que devuelve geometria.ts.
  // -------------------------------------------------------------------------------------------
  const cuerpos: Material[] = [];
  // (La tinta ya no esta en esta lista: es un pase de pantalla que se desvanece SOLO con la
  // cobertura del objeto, ver tinta.ts. Antes el casco de silueta tenia que atenuarse aqui o al
  // fundirse el motor quedaba una silueta de tinta flotando sobre el fondo.)
  for (const clave of ['blanco', 'medio', 'oscuro', 'acento', 'caliente'] as const) {
    cuerpos.push(transparentar(motor.materiales[clave] as Material));
  }
  const emisivos = [motor.materiales.acento as MeshToonMaterial];
  const caliente = motor.materiales.caliente as MeshBasicMaterial;

  // -------------------------------------------------------------------------------------------
  // LUCES. UNA clave direccional, y nada más (informe BRECHA, fila 8): el toon de tres tonos solo
  // sabe de una dirección de luz, y cada luz de más (el contraluz, el hemisferio y el ambiente de
  // antes) sumaba su propio degradado encima de los tres escalones. El filo cálido del lado en
  // sombra va en el shader (geometria.ts, ponerFilo), no en una luz. No va dentro de `raiz`: si
  // girara con el motor, el sombreado no cambiaría al girar y el objeto se leería como un dibujo.
  // -------------------------------------------------------------------------------------------
  const luzClave = new DirectionalLight(0xffffff, PM.motor.luzClave);
  luzClave.position.set(...PM.motor.luzDesde);
  escena.add(luzClave);
  // Solo si el número no es cero: con el toon, el escalón de sombra ya evita el negro.
  if (PM.motor.ambiente > 0) escena.add(new AmbientLight(0xffffff, PM.motor.ambiente));

  // La luz del encendido va DENTRO de sacudida: tiembla y sube con el motor.
  const luzCamara = new PointLight(new Color(M.paleta.acento), 0, 14, 2);
  luzCamara.position.set(0, -0.4, 0);
  centrado.add(luzCamara);

  // -------------------------------------------------------------------------------------------
  // PIEZAS DEL DESPIECE. Los números están en params-motor.ts; aquí solo se resuelven contra el
  // grafo real y se calcula el vector radial de cada una a partir de dónde está de verdad.
  // -------------------------------------------------------------------------------------------
  const resolver = (lista: typeof PM.piezas): PiezaRig[] => {
    const salida: PiezaRig[] = [];
    for (const p of lista) {
      const obj = motor.piezas[p.id];
      if (!obj) continue;   // si la geometría cambia de nombres, la pieza desaparece y nada revienta
      const radial = radialDe(obj);
      salida.push({
        id: p.id,
        obj,
        abierto: new Vector3(radial.x * p.r, p.y, radial.z * p.r),
        ancla: new Vector3(...p.ancla),
        anclaMovil: p.anclaMovil ? new Vector3(...p.anclaMovil) : undefined,
        lado: p.lado,
        movil: p.movil === true,
        titulo: p.titulo,
        nota: p.nota,
      });
    }
    return salida;
  };
  // El anillo de aletas y la placa de inyectores son piezas de esta lista: la coreografía las
  // busca por su id para abrir el anillo (escala) e inclinar la placa (cuaternión).
  const piezas = resolver(PM.piezas);
  const sueltas = resolver(PM.sueltas);

  // -------------------------------------------------------------------------------------------
  // LA CORONA. Una InstancedMesh, un objeto plano por tubo, y una función que compone matrices.
  // -------------------------------------------------------------------------------------------
  const malla = motor.piezas.tubos as InstancedMesh;
  // La esfera envolvente se calculó con los tubos en su sitio; al florecer se saldrían de ella y
  // el recorte por frustum los haría desaparecer de golpe.
  malla.frustumCulled = false;
  const n = malla.count;
  const tubos: TuboRig[] = Array.from({ length: n }, () => ({ z: 0 }));
  const mTubo = new Matrix4();
  const qTubo = new Quaternion();
  const pTubo = new Vector3();
  const eTubo = new Vector3(1, 1, 1);
  const ejeY = new Vector3(0, 1, 0);

  // POR DÓNDE SALE CADA TUBO. Tiene que ser SU PROPIO radio, y no lo era.
  //
  // La instancia i se coloca girando el tubo base con Ry(θ), θ = i·2π/n. Un giro de Three sobre Y
  // lleva el azimut φ a φ−θ, y el tubo base NO está en azimut 0: su centro está en +18,8°
  // (medido sobre `boundingSphere` de la geometría; la curva del tubo es helicoidal). O sea que la
  // instancia i acaba en el azimut 18,8°−θ mientras el desplazamiento se escribía en +θ. Los dos
  // ángulos giran en SENTIDOS CONTRARIOS: solo coinciden en dos tubos de los 36 y en los de la
  // mitad del anillo el tubo salía disparado hacia el otro lado del motor, cruzándose con sus
  // vecinos. Se veía: en el abanico de la entrada los tubos se montaban unos sobre otros formando
  // aspas (captura img/D-5250.png, antes de este arreglo), en vez de abrirse como una corona.
  //
  // Arreglo: el desplazamiento se define en el espacio del TUBO BASE y se gira con él. Así cada
  // tubo va y viene por su propio radio, hagan lo que hagan la geometría o el número de tubos.
  const geoTubo = malla.geometry;
  if (!geoTubo.boundingSphere) geoTubo.computeBoundingSphere();
  const c = geoTubo.boundingSphere?.center;
  const dirBase = new Vector3(c?.x ?? 1, 0, c?.z ?? 0);
  if (dirBase.lengthSq() < 1e-8) dirBase.set(1, 0, 0);
  dirBase.normalize();
  const azimutes: number[] = [];
  for (let i = 0; i < n; i++) {
    const th = (i * 360) / n;
    azimutes.push((((Math.atan2(dirBase.z, dirBase.x) * 180) / Math.PI - th) % 360 + 360) % 360);
  }
  const onda: number[] = new Array(n).fill(0);
  function escribirTubos(): void {
    for (let i = 0; i < n; i++) {
      const th = (i * Math.PI * 2) / n;
      const d = tubos[i].z + onda[i];
      qTubo.setFromAxisAngle(ejeY, th);
      pTubo.copy(dirBase).multiplyScalar(d).applyQuaternion(qTubo);
      malla.setMatrixAt(i, mTubo.compose(pTubo, qTubo, eTubo));
    }
    malla.instanceMatrix.needsUpdate = true;
  }
  escribirTubos();

  // ------------------------------------------------------------------------------------------
  // EL ANILLO DE ALETAS. Mismo patrón que la corona: un escalar por aleta y una función que
  // recompone las matrices. Los azimutes y las medidas los deja la geometría en `userData` y NO se
  // recalculan aquí: el filtro del hueco de la turbobomba vive allí y duplicarlo se rompería solo
  // el día que cambie. Si la malla no existe (calidad baja que la quite, o un renombrado), el
  // gesto desaparece y nada revienta.
  const mallaAletas = motor.piezas['aletas-placas'] as InstancedMesh | undefined;
  const azAletas = (mallaAletas?.userData.azimutes as number[] | undefined) ?? [];
  const aletas: number[] = new Array(azAletas.length).fill(0);
  const mAleta = new Matrix4();
  const qAleta = new Quaternion();
  const qLama = new Quaternion();
  const pAleta = new Vector3();
  const eAleta = new Vector3(1, 1, 1);
  const ejeZ = new Vector3(0, 0, 1);
  if (mallaAletas) mallaAletas.frustumCulled = false;
  function escribirAletas(): void {
    if (!mallaAletas) return;
    const rc = mallaAletas.userData.radio as number;
    const [ex, ey, ez] = mallaAletas.userData.escala as [number, number, number];
    for (let i = 0; i < azAletas.length; i++) {
      const th = azAletas[i] * Math.PI / 180;
      // La orientación base es la que puso la geometría; el giro de lama se compone DESPUÉS, así
      // que es sobre el eje LOCAL Z, que tras esa base apunta radialmente hacia fuera.
      qAleta.setFromAxisAngle(ejeY, Math.PI / 2 - th);
      qLama.setFromAxisAngle(ejeZ, aletas[i]);
      qAleta.multiply(qLama);
      pAleta.set(rc * Math.cos(th), 0, rc * Math.sin(th));
      mallaAletas.setMatrixAt(i, mAleta.compose(pAleta, qAleta, eAleta.set(ex, ey, ez)));
    }
    mallaAletas.instanceMatrix.needsUpdate = true;
  }

  // -------------------------------------------------------------------------------------------
  // LA MARCA. La placa comparte materiales con el resto del motor (blanco, medio, oscuro, chapa),
  // así que bajarle la opacidad al motor se la bajaba también a ella y el momento de la marca no
  // se leía: en la captura el brazo blanco salía gris. Se le CLONAN sus materiales. Además se les
  // pone `emissive` = su propio color, apagado, para que la coreografía pueda auto-iluminarla:
  // un logotipo no se sombrea. (Su tinta ya no es un material: la pone el pase de pantalla, que no
  // distingue clones.)
  const marca = motor.piezas.placa ?? new Group();
  const materialesMarca: Material[] = [];
  const emisivosMarca: MeshToonMaterial[] = [];
  const chapaMarca: Material[] = [];
  // Clon -> material del que salió: los grises cambian con el tema (geometria.ts, M.paleta.claro)
  // y un clon no se entera; `tema()` le copia el color (y el emisivo, que es su propio color).
  const clonesDe: { clon: MeshToonMaterial; base: MeshToonMaterial }[] = [];
  marca.traverse((o) => {
    const con = o as { material?: Material };
    if (!con.material) return;
    const clon = transparentar(con.material.clone());
    if (o.name === 'placa-chapa') chapaMarca.push(clon);
    const toon = clon as MeshToonMaterial;
    if (toon.isMeshToonMaterial) {
      // `clone()` copia el gradiente (la misma textura: el tema le llega igual) pero NO el
      // `onBeforeCompile`: sin esto la placa saldría sin filo y con otro programa.
      ponerFilo(toon);
      toon.emissive = toon.color.clone();
      toon.emissiveIntensity = 0;
      emisivosMarca.push(toon);
      clonesDe.push({ clon: toon, base: con.material as MeshToonMaterial });
    }
    con.material = clon;
    materialesMarca.push(clon);
    cuerpos.push(clon);
  });

  const turbina = motor.piezas['turbobomba-turbina'] ?? new Group();

  function tema(claro: boolean): void {
    aplicarTema(motor.materiales, claro);
    for (const { clon, base } of clonesDe) { clon.color.copy(base.color); clon.emissive.copy(base.color); }
  }

  // -------------------------------------------------------------------------------------------
  // LA CAJA PROYECTADA CUANDO EL OBJETO SE TUMBA
  // -------------------------------------------------------------------------------------------
  // El encuadre de `disponer` se calcula con el objeto EN REPOSO y solo al redimensionar: no sabe
  // nada de `rotX`. En cuanto el vuelco tumba la máquina esas medidas se intercambian y el objeto
  // se sale del cuadro o encoge de golpe. Esto es lo que hace falta para que no pase, y es una
  // función PURA de `rotX`: la coreografía la llama cada fotograma (aplicar(), punto 3d) y con lo
  // que devuelve compone la escala y la posición de `desvio`.
  //
  // Por qué no se toca el frustum: `pintar()` (effects/motor3d.ts) le pasa a la tinta
  // `camara.zoom · desvio.scale.x` como escala aparente para afinar la pluma. Compensando en
  // `desvio` la pluma se entera sola; moviendo el frustum, no, y ese fichero no se toca.
  //
  // Y EL PERFIL HAY QUE REESCALARLO EN MÓVIL. `PM.motor.perfil` (y `medioAncho`) están medidos con
  // los 36 tubos de la calidad alta; en móvil la corona baja a 24 y, como el anillo reparte el
  // mismo hueco entre menos tubos, cada uno es más GORDO y el radio del conjunto sube. Medido en un
  // Pixel 5: la silueta mide 5,366 u de ancho en vez de 4,956, o sea un 8,3 % más. Sin corregirlo,
  // la ley de estatura creería que el objeto tumbado es más estrecho de lo que es y lo agrandaría
  // de más justo en el ápice. El radio de verdad sale de la geometría del TUBO BASE (unos cientos
  // de vértices, una sola vez al montar): las instancias son giros sobre Y, así que hypot(x, z) es
  // el mismo en las 36. El resto del perfil se escala con esa razón, que por el lado de la cabeza
  // sobreestima un poco —la brida de empuje no engorda— y eso deja la cuenta del lado seguro.
  const radioPerfil = PM.motor.perfil.reduce((mx, [, r]) => Math.max(mx, r), 0);
  const radioMax = radioDeLaCorona(malla, raiz) || radioPerfil;
  const razonRadio = radioMax / radioPerfil;
  const PERFIL: [number, number][] = PM.motor.perfil.map(([y, r]) => [y, r * razonRadio]);

  const ELEVACION = Math.atan2(PM.motor.camara[1], PM.motor.camara[2]);
  const cajaPose: CajaPose = { alto: 0, centro: 0 };
  function proyectar(rotX: number): CajaPose {
    const phi = rotX + ELEVACION;
    const co = Math.cos(phi);
    const se = Math.abs(Math.sin(phi));
    let arriba = -Infinity;
    let abajo = Infinity;
    for (const [y, r] of PERFIL) {
      const eje = y * co;
      const radio = r * se;
      if (eje + radio > arriba) arriba = eje + radio;
      if (eje - radio < abajo) abajo = eje - radio;
    }
    cajaPose.alto = arriba - abajo;
    cajaPose.centro = (arriba + abajo) / 2;
    return cajaPose;
  }
  const enReposo = proyectar(PM.coreo.heroOut.rotX[1] * (Math.PI / 180));
  const reposoProyectado: CajaPose = { alto: enReposo.alto, centro: enReposo.centro };

  const medida = { ancho: 1, alto: 1 };
  function disponer(ancho: number, alto: number): void {
    medida.ancho = Math.max(1, ancho);
    medida.alto = Math.max(1, alto);
    // EL ENCUADRE. `encuadre` es el alto nominal, y el objeto entero (PM.motor.medioAncho /
    // medioAlto) tiene que caber con `margen` de aire a cada lado EN LOS DOS EJES, sea cual sea el
    // aspecto. Una ortográfica fija el alto y el ancho lo pone el aspecto: en apaisado sobra ancho
    // y manda `encuadre` (4,1 > 3,35 / 0,88: aquí no cambia nada); en un móvil de pie el ancho no
    // llega y el encuadre se abre lo JUSTO para que el motor quepa con su aire —no hasta un ancho
    // fijo, que en un iPhone 13 dejaba el motor en el 70 % del ancho con el 47 % del alto vacío—.
    // En la galería y en el despiece, en vertical, el sitio para la tarjeta y los rótulos no sale
    // de aquí sino de la composición (coreografia.ts, `desvio`): el encuadre es el de HERO_OUT.
    const aspecto = medida.ancho / medida.alto;
    const util = 1 - 2 * PM.motor.margen;   // 0,88: lo que el objeto puede ocupar de cada eje
    let h = Math.max(PM.motor.encuadre / 2, PM.motor.medioAlto / util);
    let w = h * aspecto;
    const wMin = PM.motor.medioAncho / util;
    if (w < wMin) {
      w = wMin;
      h = w / aspecto;
    }
    camara.left = -w;
    camara.right = w;
    camara.top = h;
    camara.bottom = -h;
    camara.updateProjectionMatrix();
  }

  function liberar(): void {
    motor.dispose();
    for (const mat of materialesMarca) mat.dispose();
  }

  return {
    escena, camara, desvio, medida, raiz, sacudida, motor, piezas, sueltas, tubos, azimutes, marca, materialesMarca,
    emisivosMarca, chapaMarca, turbina, luzClave, luzCamara, emisivos, caliente, cuerpos,
    yLabio: -M.tobera.largo,
    onda, escribirTubos, aletas, escribirAletas, azimutesAletas: azAletas, tema, disponer, proyectar, reposoProyectado, elevacion: ELEVACION, radioMax, liberar,
  };
}

/**
 * Prepara un material para que la coreografía pueda atenuarlo, SIN encender `transparent` aquí.
 *
 * Marcarlo transparente de por vida mueve las 43 llamadas de la lista opaca a la transparente, y
 * las dos listas se ordenan al revés: la opaca de delante a atrás (rechazo temprano por
 * profundidad) y la transparente de atrás a delante (sobredibujo máximo, cada fragmento se sombrea
 * y se mezcla). En un motor donde la campana, los 36 tubos y la cámara se solapan casi por
 * completo, eso multiplica el relleno por el número de capas que hay en cada píxel, y el relleno
 * —no los triángulos— es lo que decide el rendimiento en un móvil. La coreografía enciende
 * `transparent` en los dos únicos momentos que lo necesitan (el apagado de la marca y el fundido
 * final) y lo vuelve a apagar; son dos recompilaciones en toda la línea de tiempo, no una por
 * fotograma.
 *
 * `forceSinglePass` sí se deja puesto: con `transparent` encendido y `side: DoubleSide` el
 * renderizador dibuja la malla DOS VECES (traseras y luego delanteras, para ordenarlas). Las cinco
 * piezas DoubleSide se llevaban 18 840 triángulos y 5 llamadas de más por fotograma. Con sombreado
 * plano y opacidad uniforme la pasada doble no aporta nada.
 */
function transparentar(mat: Material): Material {
  if (mat.side === DoubleSide) mat.forceSinglePass = true;
  return mat;
}

/** Radio máximo (hypot(x, z), marco de `raiz`) del tubo base de la corona, que es la pieza más
 *  ancha del motor. Se recorre UNA vez, al montar: las 36 instancias son giros sobre Y y no cambian
 *  ese radio. Devuelve 0 si la malla no tiene posiciones, y entonces se usa el número de PM. */
function radioDeLaCorona(malla: InstancedMesh, raiz: Object3D): number {
  const pos = malla.geometry?.attributes?.position;
  if (!pos) return 0;
  raiz.updateWorldMatrix(true, true);
  const aRaiz = raiz.matrixWorld.clone().invert().multiply(malla.matrixWorld);
  const v = new Vector3();
  let mx = 0;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(aRaiz);
    const r = Math.hypot(v.x, v.z);
    if (r > mx) mx = r;
  }
  return mx;
}

/** Vector unitario radial de una pieza: por dónde sale en el despiece. Si la pieza está en el eje
 *  (todo el propulsor lo está) el vector no se usa, porque su `r` vale 0. */
function radialDe(obj: Object3D): Vector3 {
  const guardado = obj.userData.radial as Vector3 | undefined;
  if (guardado) return guardado.clone().normalize();
  const p = obj.position;
  const l = Math.hypot(p.x, p.z);
  return l > 1e-4 ? new Vector3(p.x / l, 0, p.z / l) : new Vector3(1, 0, 0);
}
