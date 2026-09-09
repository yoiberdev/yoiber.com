// Motor de cohete procedimental. Toda la geometria se genera aqui: ni un solo asset.
// Eje del motor = Y. y = 0 en la garganta de la tobera. La campana baja (-Y), la camara sube (+Y).
// Unidades de motor: 1 u ~ 0,5 m reales. Campana: 3,30 u de alto y 4,20 u de boca. Motor entero:
// 6,52 u de alto (y de -3,35 en el labio a +3,17 en los tornillos de la brida de empuje) y 4,96 u
// de ancho (la corona de tubos en el labio). Medido sobre los vertices del grafo (sonda19).
// UNA SOLA FORMA (informe BRECHA, fila 20): por encima de la garganta nada cuelga fuera del cuerpo.
// La cabeza es un cilindro de r ~1,2 (camara con su anillo de aletas, brida de empuje r 1,29) con
// la turbobomba atada al costado (eje a r 1,21; lo mas ancho es la carcasa de la turbina, r 1,44) y
// los conductos rodeando la pared con abrazaderas (r <= 1,40). Antes los paneles radiadores
// llegaban a r 2,0 y la bomba a 2,43, y la parte alta se leia como un aspa con accesorios colgados
// (par-reposo.png del informe); en la ronda anterior la bomba seguia sacando 0,40 fuera (1,72).

import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DataTexture, DoubleSide, DynamicDrawUsage,
  ExtrudeGeometry, Float32BufferAttribute, FloatType, Group, InstancedMesh, LatheGeometry,
  Matrix4, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter, NoColorSpace,
  Object3D, Path, Quaternion, RedFormat, Shape, SRGBColorSpace, TorusGeometry, TubeGeometry, Vector2, Vector3,
  CatmullRomCurve3, type Curve, type Material, type WebGLProgramParametersWithUniforms,
} from 'three';
import { PM } from '../params-motor';

// ---------------------------------------------------------------------------
// 1. NUMEROS. Unica fuente. Nada de constantes sueltas mas abajo.
// ---------------------------------------------------------------------------

export const M: Ajustes = {
  // Tobera (perfil de Rao aproximado: arco de garganta + parabola de dos angulos).
  tobera: {
    rGarganta: 0.50,     // Rt
    rSalida: 2.10,       // Re  -> relacion de expansion (Re/Rt)^2 = 17,6
    largo: 3.30,         // Ln, del plano de garganta al plano de salida
    anguloEntrada: 38,   // grados; inclinacion de la pared justo tras la garganta
    anguloSalida: 11,    // grados; inclinacion de la pared en el labio
    arcoGarganta: 0.382, // radio del arco aguas abajo, en multiplos de Rt (valor clasico)
    pasosArco: 6,        // puntos del arco de garganta
    pasosParabola: 22,   // puntos de la parabola
    espesor: 0.05,       // pared
    labio: 0.055,        // radio del toro del borde de salida
    // 0,08 y NO 0,16. Con 0,16 los tubos paraban a 0,16 u del labio y dejaban una franja de pared
    // blanca y lisa entre sus puntas y el aro: la campana se leia como una PANTALLA DE LAMPARA con
    // flecos (informe BRECHA, fila 10f, recorte zoom-tercio-inferior). En un motor de pared tubular
    // los tubos llegan al colector del labio, y el colector bajo (oscuro) traga ahora las puntas.
    // Es la distancia EXACTA del labio al final de los tubos: curvaTubo() interpola el punto final
    // sobre el perfil. Antes filtraba puntos enteros de la parabola (paso 0,15) y con "0,03" los
    // tubos paraban en realidad a 0,144 del labio, con las puntas cortadas al aire por encima del
    // colector (v4-zona-labio: un peine de dientes). 0,08 deja el colector bajo (centro en la punta,
    // grueso 0,72 rt = 0,13) con su fondo en y = -3,35, el mismo fondo que tenia el labio.
    margenSalida: 0.08,
    // FORRO Y PIEL. Dos revoluciones sobre el mismo perfil, una por cara (ver construirCampana).
    // Por DENTRO de la campana, el forro en `oscuro`, retranqueado `retranqueo` hacia el eje, del
    // final del inserto de garganta al labio: quita el interior blanco de la pantalla de lampara.
    // Por FUERA, la piel a `piel` por encima de la pared y DEBAJO de la corona, en `medio` con el
    // tema oscuro y en `blanco` con el claro (ver construirCampana y aplicarTema): en oscuro se
    // asoma en el hueco entre tubo y tubo (holgura 0,88 = 12 % de paso, 2-4 px a 1x) y dibuja la
    // costura de cada tubo. Sin ella los tubos del frente, iluminados igual que sus vecinos, se
    // fundian en una superficie lisa: medido en el perfil de aristas por bandas (umbral 12,
    // 1440x900), las bandas del tercio inferior daban 3,5-9,8 % (fila 14). Eran UNA revolucion en
    // `oscuro` con las dos caras, y en COMO, con la corona separada, la piel entera era un balde
    // negro sobre el crema (fila 10; el porque, en construirCampana).
    forro: { retranqueo: 0.006, piel: 0.003 },
    puntosGarganta: 13,  // puntos del perfil que forman el inserto de garganta (acento)
    segmentos: 96,       // segmentos de revolucion
  },
  // Camara de combustion: cilindro + convergente + arco de garganta aguas arriba.
  camara: {
    rCamara: 0.90,           // Rc -> relacion de contraccion (Rc/Rt)^2 = 3,24
    largoCilindro: 1.35,     // parte recta
    anguloConvergente: 35,   // grados
    arcoGarganta: 1.5,       // radio del arco aguas arriba, en multiplos de Rt
    pasosArco: 6,
    espesor: 0.07,
    segmentos: 96,
    // AROS de refuerzo (ambar) alrededor del cilindro. Ya no se reparten por todo el cilindro: el
    // tercio bajo lo ocupa ahora el anillo de aletas (M.aletas, y 0,98-1,60) y los tres aros van
    // a partes iguales en la banda que queda entre las aletas y la brida del inyector (2,157).
    zunchos: 3,
    rZuncho: 0.05,
    zunchosDesde: 1.66,
    zunchosHasta: 2.10,
    // CANALES DE REFRIGERACION: nervios finos y oscuros a lo largo del cilindro (paso 10 grados,
    // 19 px a 1x). Van en UNA InstancedMesh con los apoyos de los radiadores (misma caja unitaria,
    // mismo material, cada instancia lleva su escala en la matriz): 39 instancias, 1 llamada.
    // Son la "textura de maquina" del cuerpo central que pedia la fila 14 del informe BRECHA.
    canales: { n: 36, ancho: 0.026, fondo: 0.02, margen: 0.07 },
    // ANILLO MOLETEADO en la union cilindro-convergente: es la brida camara-garganta, con su corona
    // de tornillos encima (M.tornillos.nGarganta). Dientes en zigzag: cada cara a un angulo distinto,
    // asi que el sombreado plano alterna claro/oscuro y cada diente es una arista. `rInterior` queda
    // DENTRO de la pared (0,97): el agujero del anillo no se ve.
    moleteado: { dientes: 48, y: 0.78, alto: 0.10, rInterior: 0.955, rDiente: 1.005, profundidad: 0.04 },
    // COLLAR moleteado en la garganta, abrazando el arranque de la corona: su radio interior es el
    // de los CENTROS de los tubos a esa altura (la mitad exterior de cada tubo queda embebida) y el
    // diente sale `holgura` por fuera de la cresta. Va en la misma malla que el anillo de arriba.
    collar: { dientes: 40, y: -0.15, alto: 0.10, holgura: 0.006, profundidad: 0.035 },
  },
  // Corona de tubos de refrigeracion: N tubos que abrazan la campana con giro helicoidal.
  refrigeracion: {
    n: 36,               // numero de tubos (ver tabla de coste)
    holgura: 0.88,       // fraccion del radio de contacto: 1 = tubos tocandose
    torsion: 22,         // grados de giro helicoidal de la garganta a la salida
    subeGarganta: 0.42,  // cuanto suben los tubos por encima de la garganta
    segmentosU: 40,      // pasos a lo largo del tubo
    segmentosV: 8,       // lados de la seccion del tubo
    rColector: 0.06,     // grosor MINIMO de los toros colectores
    // Los colectores, en fracciones del radio del tubo a esa altura: `centro` cuanto se saca el
    // eje del toro hacia fuera de los centros de los tubos, `grueso` su radio. El de arriba es un
    // aro fino (ambar, el acento de la garganta). El de abajo va CENTRADO en las puntas y gordo
    // (0,72 rt): cubre entero el corte final de cada tubo, que si no se ve como un diente abierto.
    colectorAlto: { centro: 0.35, grueso: 0.55 },
    colectorBajo: { centro: 0, grueso: 0.72 },
  },
  // Placa de inyectores: reticula radial de orificios.
  inyector: {
    espesorPlaca: 0.16,
    rebaje: 0.055,        // cuanto sobresale el reborde
    anillos: [0, 0.14, 0.28, 0.42, 0.56, 0.70, 0.84] as number[],
    porAnillo: [1, 6, 12, 18, 24, 30, 36] as number[],
    rOrificio: 0.042,
    hOrificio: 0.10,
    ladosOrificio: 8,
    rCupula: 0.90,        // domo del colector, encima de la placa
    altoCupula: 0.62,
    pasosCupula: 12,
    // CABEZAL en el apice del domo: la toma del colector. El domo era una semiesfera blanca lisa
    // vista desde arriba dentro del anillo de empuje, sin una arista; un cilindro oscuro de 12
    // lados en la cima le da un remate y dos filos. Va UNIDO al cuello del domo (misma malla y
    // material): ninguna llamada de dibujo mas. Entra `hundido` en el domo para no dejar rendija.
    cabezal: { r: 0.20, alto: 0.15, hundido: 0.05 },
  },
  // Turbobomba, DENTRO de la silueta de la cabeza (informe BRECHA, fila 20).
  //
  // LA BANDA RADIAL QUE HAY, que es lo que fija todas las medidas de aqui. Lo de dentro es la
  // pared EXTERIOR de la camara, medida sobre el perfil (exteriorPared): r 0,97 a lo largo del
  // cilindro (y 0,80-2,16) y bajando por el convergente a 0,94 (y 0,75), 0,91 (y 0,71), 0,84
  // (y 0,60), 0,77 (y 0,50) y 0,61 (y 0,25). Lo de fuera es la silueta de la cabeza: aletas 1,195,
  // brida de empuje 1,29, chapa de la placa 1,32; el limite que se puso es 1,45, o sea 0,13 mas
  // que la chapa. Contra el cilindro, pues, la bomba entera tiene que caber entre 0,97 y 1,45:
  // 0,48 de banda, y por eso NINGUNA pieza suya pasa de 0,24 de radio y el eje va a 1,21.
  // (El juez pedia el eje a 1,05: ahi el cuerpo, de cualquier radio util, entra en el cilindro.
  // 1,05 seria el eje si la bomba fuese un tubo de 0,08.) La cabeza ya no crece: la caja de alfa
  // del CONJUNTO la fija la campana, ver la nota del relleno en params-motor.ts.
  //
  // Estaba a r 1,78 y con la voluta llegaba a 2,43 (2,34 en los vertices): un accesorio colgado en
  // el aire. Luego a 1,30 con la carcasa en 1,72, todavia 0,40 fuera de la silueta. Ahora el eje
  // va a 1,21, el cuerpo (r 0,20) arranca en 1,01 contra la pared del cilindro y lo mas ancho es
  // la carcasa de la turbina: 1,44. La bomba baja tambien 0,05 y se acorta un 17 % a lo largo
  // (cuerpo 0,58, turbina 0,36, entrada 0,40) para no quedarse en un lapiz: 1,65 de alto por 0,47
  // de ancho, 3,5:1, donde antes eran 2,4:1. Dos apoyos (`apoyos`) la atan y en el despiece se
  // quedan CON LA CAMARA.
  // El cuerpo cae en el hueco de +-18 grados que dejan las aletas (a 1,21 con r 0,20 la bomba
  // ocupa +-9,5 grados y la aleta mas cercana queda a 0,38 de su eje, 0,18 de su piel).
  turbobomba: {
    azimut: 20,         // grados alrededor del eje
    radio: 1.21,        // distancia del eje del motor al eje de la bomba (cuerpo: 1,01-1,41)
    altura: 1.00,       // y del centro del cuerpo
    // La voluta: espiral de seccion creciente (ver construirTurbobomba). `faseVoluta` gira la
    // espiral para que su extremo ANCHO apunte hacia fuera (local +X = radial): con el eje a
    // r 1,30 el lado ancho hacia la camara se hundia 0,18 en la pared. 1,35 vueltas son 486
    // grados; con -126 el final cae en 360 = 0, o sea en +X. Sale 0,225 del eje por fuera (1,435)
    // y 0,186 por dentro (1,024, con la pared en 0,97): es la pieza que mas justa va por dentro.
    rVoluta: 0.155,
    rTuboVoluta: 0.070,
    faseVoluta: -126,
    rCuerpo: 0.20,
    largoCuerpo: 0.58,
    rTurbina: 0.18,
    largoTurbina: 0.36,
    rEntrada: 0.115,
    largoEntrada: 0.40,
    segmentos: 24,
    // APOYOS (la brida contra la camara): dos tacos radiales en el azimut de la bomba, en el marco
    // del motor. `r0` entra en la pared y `r1` en la bomba: sin rendija por ningun lado. El de
    // arriba une el cuerpo con el cilindro (pared r 0,97, cuerpo desde r 1,01) y cabe entero en el
    // cuerpo (y 0,71-1,29); el de abajo, la carcasa con el convergente (pared r 0,77 a y 0,50,
    // carcasa desde r 0,98, y 0,34-0,72). Van en la InstancedMesh de detalles de la camara
    // (construirCamara): cero llamadas de dibujo mas.
    apoyos: [
      { y: 1.10, alto: 0.30, ancho: 0.15, r0: 0.90, r1: 1.06 },
      { y: 0.50, alto: 0.18, ancho: 0.12, r0: 0.70, r1: 1.00 },
    ],
    // CARCASA DE LA TURBINA. El rotor con sus 18 alabes iba al aire y a 200 px se leia como una
    // PIÑA (fila 10e, zoom-pegotes). Ahora gira dentro de un tambor cerrado con tapas y una VENTANA
    // de `ventana` grados cruzada por `barras` barras verticales; el rotor se ve girar detras.
    // `azimutVentana` es LOCAL a la bomba (mundo = M.turbobomba.azimut + esto): 88 + 20 = 108, que
    // es donde esta la camara en el reposo (rotY 18 => azimut de camara 90 + 18, ver coreografia).
    // r 0,23 y no 0,42: es la pieza mas ancha de la bomba (1,44) y baja a la altura del convergente
    // (y 0,34-0,72), donde la pared exterior esta en 0,91 como mucho: 0,07 de holgura por dentro.
    // Sobresale 0,03 del cuerpo, que es el escalon que hace que se lea como otra pieza.
    carcasa: { r: 0.23, ventana: 100, azimutVentana: 88, barras: 4, barra: 0.03 },
  },
  // Conductos: tubos sobre curvas suaves de la bomba al colector de la campana.
  conductos: {
    // otro 15 % mas finos (0,10 / 0,085 / 0,07): van con una bomba cuyo cuerpo mide r 0,20 y cuya
    // voluta es un tubo de 0,07, y una descarga mas gorda que la voluta se lee al reves de lo que es
    radios: [0.085, 0.072, 0.058] as number[],
    segmentosU: 56,
    segmentosV: 8,
    // DONDE NACEN, medido hacia dentro desde el EJE de la bomba. No en el eje: la brida del arranque
    // (radio 1,7 · r del tubo) es un disco que queda enterrado en la bomba, no se ve nunca y sin
    // embargo contaba en el radio maximo del conjunto (1,51 medido en la ronda anterior, con el
    // limite en 1,40). Naciendo 0,04 hacia dentro el disco de la descarga llega a 1,17 + 0,14 = 1,31
    // y el tubo sigue saliendo por la piel del cuerpo, que es lo que se ve.
    nace: 0.04,
    // BRIDAS en los seis extremos, en vez de bolitas: un tubo tiene que ACABAR EN ALGO (fila 10a,
    // el conducto de escape terminaba en el aire con una bola). Un disco orientado por la tangente
    // del extremo, en multiplos del radio del tubo, todos en UNA InstancedMesh (antes dos).
    brida: { radio: 1.7, alto: 0.5 },
    // ABRAZADERAS (fila 20: "conductos pegados al cuerpo, nada en el aire"): collares oscuros que
    // atan el tubo al cuerpo donde lo roza. Un disco mas ancho y mas largo que la brida, orientado
    // por la tangente, en la MISMA InstancedMesh que las bridas. `abrazaderas[k]` son las
    // fracciones u de la curva del conducto k donde va cada una: en la descarga (0) dos, donde
    // rodea el convergente; en la linea al domo (1) una, a media subida; en el escape (2) una,
    // que pasa de 0,55 a 0,78: con el trazado de antes caia en el tramo que iba por el aire, a
    // 0,40 de la campana, y ahora cae donde el tubo baja pegado a la corona (y -0,60, 0,06 de la
    // cresta). `getPointAt` va por LONGITUD DE ARCO, asi que estas fracciones son de recorrido.
    abrazadera: { radio: 1.45, alto: 0.7 },
    abrazaderas: [[0.45, 0.72], [0.5], [0.78]] as number[][],
  },
  // Estructura de empuje: anillo + tirantes en A.
  // TORNILLERIA. Lo que hace que una maquina se lea como compleja no son mas piezas grandes, sino
  // detalle pequeno repetido. Cabeza hexagonal (un cilindro de 6 segmentos ES un hexagono) y todas
  // las coronas en UNA InstancedMesh: una sola llamada de dibujo para las tres bridas.
  tornillos: {
    r: 0.045,        // radio de la cabeza
    alto: 0.040,     // lo que sobresale de la brida
    nCamara: 18,     // brida de arriba de la camara, donde monta el inyector
    nBancada: 24,    // dos por tirante del anillo de empuje, a 15 grados: uno entre cada dos pies
    nBomba: 8,       // brida de la turbobomba (sobre la tapa de la carcasa de la turbina)
    nGarganta: 18,   // brida camara-garganta, sobre el anillo moleteado
  },

  bancada: {
    rAnillo: 1.15,
    // BRIDA PLANA, no un toro. El anillo de empuje es la pieza mas alta del motor y la unica que
    // se ve entera desde cualquier azimut, y era un toro liso: con sombreado plano un toro es un
    // degradado sin una sola arista, y la banda de arriba del perfil de aristas se quedaba en el
    // 10,1 % (medido a 1440x900, GALERIA 6 %, umbral 12), al filo del minimo. Una seccion
    // rectangular tiene cara de arriba clara y costado en sombra: dos aristas limpias alrededor,
    // y ademas es lo que es un anillo de empuje (una brida atornillada). Ocupa el mismo bulto que
    // el toro (0,16 x 0,15 sobre r 1,15): la placa y el panel siguen apoyando donde apoyaban.
    anillo: { ancho: 0.16, alto: 0.15 },
    // PIES de los tirantes: un taco por tirante en la cara exterior de la brida, a ras de su fondo,
    // donde el tirante llega. Van UNIDOS a la brida (misma malla): doce cajitas son 36 caras vistas
    // y sus aristas, en la banda mas pobre del perfil (la de arriba, 10,3 % con la brida lisa).
    pies: { ancho: 0.11, alto: 0.10, saliente: 0.06, empotrado: 0.05 },
    altura: 3.05,        // y del anillo, por encima del inyector
    tirantes: 12,
    rTirante: 0.045,
    anclaje: 0.86,       // radio donde los tirantes tocan la camara
    yAnclaje: 1.95,
    // PANEL DE LA PLACA. La placa de identificacion colgaba en el hueco en V entre dos pares de
    // tirantes y, casi negra, se leia como un AGUJERO recortado en la celosia (fila 10c). Ahora
    // cuelga del anillo un carenado curvo -sector de corona circular con canto- y la placa va
    // atornillada ENCIMA: una chapa sobre una pared, no un recorte sobre el vacio. Cubre de 108 a
    // 162 grados: la placa ocupa 120-150 y el tirante que la cruzaba por detras (t5, 150 -> 124,5)
    // queda dentro. Radio 1,165-1,205: por fuera de todos los tirantes (r <= 1,15) y justo debajo
    // del dorso de la chapa (1,21).
    panel: { azimut: 135, abertura: 54, rInterior: 1.165, espesor: 0.04, y0: 2.22, y1: 3.0 },
  },
  // ANILLO DE ALETAS (informe BRECHA, fila 20), en el sitio de los tres paneles radiadores. Los
  // paneles colgaban a r 1,05 con el canto a y 2,4 y eran tres accesorios FUERA de la silueta: a
  // 200 px el tercio superior se leia como un aspa (par-reposo.png del informe). Ahora son `n`
  // aletas RADIALES (placas finas con la cara en el plano del eje) pegadas al cilindro de la
  // camara, de r 0,955 (0,015 dentro de la pared) a r 1,195: un radiador de verdad, dentro del
  // radio del cuerpo, y UNA InstancedMesh donde los tres paneles eran tres llamadas. Se saltan las
  // ranuras a menos de `hueco` grados del azimut de la turbobomba: ahi va el cuerpo de la bomba
  // (r 0,30 sobre r 1,30 cubre +-13 grados) y su voluta (a r 1,15 llega a +-16). Con 32 ranuras
  // (11,25 grados) y hueco 18 caen tres: 29 aletas. (Si cambia el numero, cambia la nota del
  // rotulo en PM.piezas.) En el despiece el anillo sale por el eje como una pieza y se abre
  // radialmente (PM.aletasAbrir): las aletas se separan de la pared unos milimetros.
  aletas: {
    n: 32,
    hueco: 18,
    rInterior: 0.955,
    largo: 0.24,        // radial
    alto: 0.62,
    espesor: 0.028,
    y: 1.29,            // centro de la banda (0,98-1,60): entre la brida moleteada y los aros
  },
  // Placa de identificacion: el monograma de Yoiber como chapa recortada.
  // Contornos precocinados del SVG (yoi-icon.svg), sin SVGLoader: ahorra 11 kB comprimidos.
  placa: {
    // UNA CHAPITA, NO UN CARTEL. Con alto 1,05 la chapa medía 0,86 x 1,39 y llegaba a y = 3,68:
    // era la pieza MÁS ALTA del motor, tapaba la cúpula y, al ser casi negra, sobre fondo negro
    // leía como un agujero recortado en el objeto. A la mitad de tamaño y colgada por debajo del
    // anillo se lee por lo que es: una placa de identificación atornillada.
    alto: 0.52,          // altura del monograma en unidades de motor
    espesor: 0.03,
    azimut: 135,         // hueco entre dos radiadores (55 y 175) y fuera del eje de la turbobomba
    radio: 1.26,         // justo por FUERA del anillo (r 1,15 + medio ancho 0,08): la chapa se apoya en él
    y: 2.72,             // cuelga DEL anillo: su borde de arriba queda justo en 3,05
    chapa: 0.05,         // espesor de la chapa de soporte que va DETRÁS del monograma
    margen: 0.18,        // margen de la chapa alrededor del monograma, en fracción de `alto`
  },
  // Los contornos ya no son geometria (ni EdgesGeometry ni cascos de silueta): son un pase de
  // pantalla, motor/tinta.ts, con sus numeros en PM.motor.tinta. Aqui solo queda su COLOR (paleta).
  // Paleta: los grises del logo de Yoiber + el acento del demo. Son ALBEDOS: lo que se ve es el
  // albedo por el escalon del toon (PM.motor.toon), asi que cada gris son hasta tres tonos en
  // pantalla, y por eso los tres grises ya no van "a partes iguales".
  paleta: {
    blanco: 0xf4f4f2,   // --fg del demo. En tema oscuro: claro 215, medio 100, sombra 34 (sRGB)
    // UN ESCALON DE LUZ POR DEBAJO DEL BLANCO, no "el gris medio del logo" (0x9a9a95). Con el toon
    // de tres escalones cada albedo pone tres tonos en pantalla, y con 0x9a el gris medio metia
    // dos tonos NUEVOS (135 iluminado y 60 en sombra) entre los del blanco: cinco grises en vez de
    // tres, que es justo el degradado que se queria quitar. Con 0x737370 (albedo lineal 0,171) la
    // cara iluminada de una pieza `medio` es 100 sRGB, EL MISMO tono que la cara media del blanco:
    // la pieza se lee como "en sombra respecto al cuerpo" y no como otro color.
    medio: 0x737370,
    oscuro: 0x3d3d3a,   // gris oscuro del logo: 52 sRGB iluminado, un acento oscuro, no un cuerpo
    acento: 0xffd166,   // --acento del demo (el vigente lo funde la coreografia; ver coreografia.ts)
    // LA TINTA (el pase de pantalla de motor/tinta.ts la pinta con estos dos; son valores sRGB de
    // 8 bits, no albedos: el compositor trabaja sobre la imagen ya codificada). CASI NEGRO, no
    // gris: con 0x8a8a86 (gris medio sobre cuerpos grises medios) los contornos existian y NO SE
    // VEIAN en ninguna captura, y el objeto se leia como arcilla. Un contorno oscuro sobre el
    // cuerpo es lo que separa "render por defecto" de "ilustracion".
    //
    // Sobre el fondo oscuro (#1f1e1d, luminancia 30) este 20 queda 10 puntos por debajo: dibuja
    // el borde exterior (que sobre el negro puro no existia) y separa la cara en sombra del blanco
    // (34) del fondo, y sobre el cuerpo separa una pieza de la de detras, que era lo que la tinta
    // CLARA (0xc8c8c2, el "contorno de pegatina", probada y descartada en la Vuelta 2) borraba:
    // pieza y pieza son las dos claras. Era 0x141412 para las aristas y 0x050504 para el casco;
    // ahora hay UNA tinta y va con la de las aristas, la que separaba piezas.
    linea: 0x141412,
    // Tema claro, fondo crema #efe9df, el capitulo "como esta hecho": el gris `blanco` del motor
    // (0xf4f4f2) ES el fondo -la campana y la cupula se comen con el papel- y la tinta pasa de
    // adorno a ser lo unico que dibuja el objeto (par-claro.png de la referencia es eso: una
    // lamina). La MISMA tinta que la letra de la pagina (--fg #141414). `aplicarTema()` y
    // tinta.tema() cambian de una a otra cuando el demo cambia de capitulo.
    lineaClaro: 0x141412,
    // La chapa de la placa de identificacion. Casi negra NO: sobre fondo negro la chapa desaparecia
    // y el recorte se leia como un agujero en el motor. Este gris es mas oscuro que el `oscuro` del
    // logo (0x3d3d3a) pero sigue teniendo cuerpo sobre negro, y los tres brazos del monograma
    // (oscuro, medio, blanco) se separan de el.
    chapa: 0x2a2a27,
    // LA PALETA CLARA (informe BRECHA, fila 19f): los tres grises, MAS CLAROS, para el capitulo sobre
    // crema. Con la tinta dibujando cada pieza, el objeto ya no necesita que los grises lo modelen:
    // sobre papel es una lamina y los grises son rellenos, no cuerpos. Medido en COMO 40 % con la
    // tinta puesta (barrido-claro, variantes B/D/E): con los grises del tema oscuro las aletas, la
    // placa de inyectores y la bancada seguian siendo las manchas mas oscuras del despiece
    // (par-claro-v3-B) mientras la referencia es blanca entera con lineas; con estos, medio sale a
    // 151-163 sRGB, oscuro a 108-117 y la chapa a 85 (aritmetica del toon, PM.motor.toon.claro), y
    // el conjunto se lee como lamina (par-claro-v3-D). El blanco no cambia: ya es el papel. Los
    // clones de la marca (rig.ts) siguen a estos al cambiar el tema.
    claro: { medio: 0xaaaaa2, oscuro: 0x7a7a76, chapa: 0x5a5a56 },
  },
};

/** Tipo mutable: `calidad()` reescribe unos pocos numeros antes de construir. */
type Ajustes = {
  tobera: { rGarganta: number; rSalida: number; largo: number; anguloEntrada: number; anguloSalida: number;
    arcoGarganta: number; pasosArco: number; pasosParabola: number; espesor: number; labio: number;
    margenSalida: number; puntosGarganta: number; segmentos: number; forro: { retranqueo: number; piel: number } };
  camara: { rCamara: number; largoCilindro: number; anguloConvergente: number; arcoGarganta: number;
    pasosArco: number; espesor: number; segmentos: number; zunchos: number; rZuncho: number;
    zunchosDesde: number; zunchosHasta: number;
    canales: { n: number; ancho: number; fondo: number; margen: number };
    moleteado: { dientes: number; y: number; alto: number; rInterior: number; rDiente: number; profundidad: number };
    collar: { dientes: number; y: number; alto: number; holgura: number; profundidad: number } };
  refrigeracion: { n: number; holgura: number; torsion: number; subeGarganta: number;
    segmentosU: number; segmentosV: number; rColector: number;
    colectorAlto: { centro: number; grueso: number }; colectorBajo: { centro: number; grueso: number } };
  inyector: { espesorPlaca: number; rebaje: number; anillos: number[]; porAnillo: number[];
    rOrificio: number; hOrificio: number; ladosOrificio: number; rCupula: number; altoCupula: number; pasosCupula: number;
    cabezal: { r: number; alto: number; hundido: number } };
  turbobomba: { azimut: number; radio: number; altura: number; rVoluta: number; rTuboVoluta: number; faseVoluta: number;
    rCuerpo: number; largoCuerpo: number; rTurbina: number; largoTurbina: number; rEntrada: number;
    largoEntrada: number; segmentos: number;
    carcasa: { r: number; ventana: number; azimutVentana: number; barras: number; barra: number };
    apoyos: { y: number; alto: number; ancho: number; r0: number; r1: number }[] };
  tornillos: { r: number; alto: number; nCamara: number; nBancada: number; nBomba: number; nGarganta: number };
  conductos: { radios: number[]; segmentosU: number; segmentosV: number; nace: number; brida: { radio: number; alto: number };
    abrazadera: { radio: number; alto: number }; abrazaderas: number[][] };
  bancada: { rAnillo: number; anillo: { ancho: number; alto: number };
    pies: { ancho: number; alto: number; saliente: number; empotrado: number }; altura: number; tirantes: number; rTirante: number;
    anclaje: number; yAnclaje: number;
    panel: { azimut: number; abertura: number; rInterior: number; espesor: number; y0: number; y1: number } };
  aletas: { n: number; hueco: number; rInterior: number; largo: number; alto: number; espesor: number; y: number };
  placa: { alto: number; espesor: number; azimut: number; radio: number; y: number; chapa: number; margen: number };
  paleta: { blanco: number; medio: number; oscuro: number; acento: number; linea: number;
    lineaClaro: number; chapa: number; claro: { medio: number; oscuro: number; chapa: number } };
};

/** Tres niveles. 'baja' es el que va al movil; 'alta' solo si hay sitio de sobra. */
export type Calidad = 'baja' | 'media' | 'alta';
const NIVELES: Record<Calidad, { tubos: number; segmentos: number; segmentosU: number; conductoU: number }> = {
  baja:  { tubos: 24, segmentos: 48, segmentosU: 26, conductoU: 32 },
  media: { tubos: 36, segmentos: 96, segmentosU: 40, conductoU: 56 },
  alta:  { tubos: 48, segmentos: 128, segmentosU: 52, conductoU: 72 },
};

export function calidad(nivel: Calidad): void {
  const n = NIVELES[nivel];
  M.refrigeracion.n = n.tubos;
  M.refrigeracion.segmentosU = n.segmentosU;
  M.tobera.segmentos = n.segmentos;
  M.camara.segmentos = n.segmentos;
  M.turbobomba.segmentos = Math.max(12, Math.round(n.segmentos / 4));
  M.conductos.segmentosU = n.conductoU;
}

const GRA = Math.PI / 180;

// ---------------------------------------------------------------------------
// 2. PERFILES. Listas de Vector2 (x = radio, y = eje) que luego revolucionan.
// ---------------------------------------------------------------------------

/** Pared interior de la campana, de la garganta al labio. Rao aproximado. */
export function perfilCampana(): Vector2[] {
  const t = M.tobera;
  const Rd = t.arcoGarganta * t.rGarganta;
  const cx = t.rGarganta + Rd;
  const pts: Vector2[] = [];

  // (a) arco de garganta aguas abajo: de 180 grados a 180 + anguloEntrada.
  for (let i = 0; i <= t.pasosArco; i++) {
    const f = (180 + (t.anguloEntrada * i) / t.pasosArco) * GRA;
    pts.push(new Vector2(cx + Rd * Math.cos(f), Rd * Math.sin(f)));
  }

  // (b) parabola (Bezier cuadratica) del final del arco al labio, tangente en ambos extremos.
  const N = pts[pts.length - 1];
  const E = new Vector2(t.rSalida, -t.largo);
  const d1 = new Vector2(Math.sin(t.anguloEntrada * GRA), -Math.cos(t.anguloEntrada * GRA));
  const d2 = new Vector2(Math.sin(t.anguloSalida * GRA), -Math.cos(t.anguloSalida * GRA));
  // N + a*d1 = E - b*d2  ->  sistema 2x2
  const det = d1.x * d2.y - d1.y * d2.x;
  const ex = E.x - N.x;
  const ey = E.y - N.y;
  const a = (ex * d2.y - ey * d2.x) / det;
  const Q = new Vector2(N.x + a * d1.x, N.y + a * d1.y);
  for (let i = 1; i <= t.pasosParabola; i++) {
    const u = i / t.pasosParabola;
    const w = 1 - u;
    pts.push(new Vector2(w * w * N.x + 2 * w * u * Q.x + u * u * E.x, w * w * N.y + 2 * w * u * Q.y + u * u * E.y));
  }
  return pts;
}

/** Pared interior de la camara: del arco de garganta aguas arriba al borde del inyector. */
export function perfilCamara(): Vector2[] {
  const c = M.camara;
  const t = M.tobera;
  const R1 = c.arcoGarganta * t.rGarganta;
  const cx = t.rGarganta + R1;
  const pts: Vector2[] = [];
  // arco de garganta aguas arriba: de 180 grados a 180 - anguloConvergente.
  for (let i = 0; i <= c.pasosArco; i++) {
    const f = (180 - (c.anguloConvergente * i) / c.pasosArco) * GRA;
    pts.push(new Vector2(cx + R1 * Math.cos(f), R1 * Math.sin(f)));
  }
  // tramo conico recto hasta el radio de camara.
  const p = pts[pts.length - 1];
  const dx = c.rCamara - p.x;
  pts.push(new Vector2(c.rCamara, p.y + dx / Math.tan(c.anguloConvergente * GRA)));
  // cilindro.
  pts.push(new Vector2(c.rCamara, pts[pts.length - 1].y + c.largoCilindro));
  return pts;
}

/** Cierra un perfil abierto en una pared con espesor: baja por dentro y sube por fuera. */
function conEspesor(perfil: Vector2[], espesor: number): Vector2[] {
  const fuera: Vector2[] = [];
  for (let i = perfil.length - 1; i >= 0; i--) {
    const a = perfil[Math.max(0, i - 1)];
    const b = perfil[Math.min(perfil.length - 1, i + 1)];
    const n = new Vector2(b.y - a.y, -(b.x - a.x)).normalize();
    if (n.x < 0) n.negate(); // normal siempre alejandose del eje
    fuera.push(new Vector2(perfil[i].x + n.x * espesor, perfil[i].y + n.y * espesor));
  }
  return perfil.concat(fuera);
}

// ---------------------------------------------------------------------------
// 3. TUBO DE RADIO VARIABLE. TubeGeometry no lo permite: se genera a mano
//    con los mismos marcos de Frenet, para que los tubos toquen en la garganta
//    y se abran con la campana igual que en un motor de pared tubular real.
// ---------------------------------------------------------------------------

export function tuboVariable(curva: Curve<Vector3>, radio: (u: number) => number, segU: number, segV: number): BufferGeometry {
  const marcos = curva.computeFrenetFrames(segU, false);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const P = new Vector3();
  const N = new Vector3();
  const B = new Vector3();
  const v = new Vector3();
  const nn = new Vector3();
  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    curva.getPointAt(u, P);
    N.copy(marcos.normals[i]);
    B.copy(marcos.binormals[i]);
    const r = radio(u);
    for (let j = 0; j <= segV; j++) {
      const w = (j / segV) * Math.PI * 2;
      const s = Math.sin(w);
      const c = -Math.cos(w);
      nn.set(N.x * c + B.x * s, N.y * c + B.y * s, N.z * c + B.z * s).normalize();
      v.copy(P).addScaledVector(nn, r);
      pos.push(v.x, v.y, v.z);
      nor.push(nn.x, nn.y, nn.z);
      uv.push(u, j / segV);
    }
  }
  for (let i = 1; i <= segU; i++) {
    for (let j = 1; j <= segV; j++) {
      const a = (segV + 1) * (i - 1) + (j - 1);
      const b = (segV + 1) * i + (j - 1);
      const c = (segV + 1) * i + j;
      const d = (segV + 1) * (i - 1) + j;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

/** Radio de contacto de N tubos apoyados sobre una pared de radio local rPared. */
export function radioTubo(rPared: number, n: number, holgura: number): number {
  const s = Math.sin(Math.PI / n);
  return ((rPared * s) / (1 - s)) * holgura;
}

/** Superficie EXTERIOR real de una pared (la que devuelve conEspesor), en el mismo orden que el
 *  perfil interior. La pared se engrosa por la NORMAL, no por el radio: en un tramo inclinado el
 *  exterior queda mas lejos del eje que `x + espesor` (en el convergente, a 35 grados, 0,085 en vez
 *  de 0,07). Todo lo que se apoya en una pared (tubos, piel del forro, brida de un conducto) lo
 *  mira aqui, no suma el espesor a ojo. */
function exteriorPared(perfil: Vector2[], espesor: number): Vector2[] {
  return conEspesor(perfil, espesor).slice(perfil.length).reverse();
}

/** Punto de la superficie exterior de la camara a la altura `y` y su normal (radial, axial),
 *  interpolando sobre la polilinea exterior. Sirve para que un conducto llegue a la pared
 *  perpendicular a ella y su brida se apoye plana. */
function paredCamaraEn(y: number): { r: number; y: number; nr: number; ny: number } {
  const ext = exteriorPared(perfilCamara(), M.camara.espesor);
  for (let i = 0; i + 1 < ext.length; i++) {
    const a = ext[i];
    const b = ext[i + 1];
    if (y < Math.min(a.y, b.y) || y > Math.max(a.y, b.y)) continue;
    const u = Math.abs(b.y - a.y) < 1e-9 ? 0 : (y - a.y) / (b.y - a.y);
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    // normal del segmento alejandose del eje
    let nr = ty / l;
    let ny = -tx / l;
    if (nr < 0) { nr = -nr; ny = -ny; }
    return { r: a.x + tx * u, y, nr, ny };
  }
  const p = ext[ext.length - 1];
  return { r: p.x, y: p.y, nr: 1, ny: 0 };
}

/** Une varias geometrias en una sola (sin indice, solo posicion y normal): un material, una
 *  llamada de dibujo. Las de entrada se desechan. Nada de uv: ningun material del motor lleva mapa. */
function unirGeometrias(geos: BufferGeometry[]): BufferGeometry {
  const planas = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of planas) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let k = 0;
  for (const g of planas) {
    pos.set(g.attributes.position.array as Float32Array, k * 3);
    nor.set(g.attributes.normal.array as Float32Array, k * 3);
    k += g.attributes.position.count;
  }
  const salida = new BufferGeometry();
  salida.setAttribute('position', new Float32BufferAttribute(pos, 3));
  salida.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  for (const g of planas) g.dispose();
  for (const g of geos) g.dispose();
  return salida;
}

/** Anillo moleteado: corona circular cuyo borde exterior es un zigzag de `dientes` dientes, entre
 *  y0 e y0 + alto. Con sombreado plano cada cara del zigzag coge una luz distinta: un diente = dos
 *  aristas. El agujero interior es un circulo liso que debe quedar escondido dentro de otra pieza. */
function anilloMoleteado(rInterior: number, rValle: number, rDiente: number, dientes: number, y0: number, alto: number): BufferGeometry {
  const s = new Shape();
  for (let i = 0; i < dientes * 2; i++) {
    const a = (i / (dientes * 2)) * Math.PI * 2;
    const r = i % 2 ? rValle : rDiente;
    if (i === 0) s.moveTo(r * Math.cos(a), r * Math.sin(a));
    else s.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  s.closePath();
  const hueco = new Path();
  hueco.absarc(0, 0, rInterior, 0, Math.PI * 2, true);
  s.holes.push(hueco);
  const geo = new ExtrudeGeometry(s, { depth: alto, bevelEnabled: false, curveSegments: 32 });
  // rotateX(+90): la extrusion (+Z) pasa a -Y y el plano del perfil conserva su azimut.
  geo.rotateX(Math.PI / 2);
  geo.translate(0, y0 + alto, 0);
  return geo;
}

// ---------------------------------------------------------------------------
// 4. MATERIALES
// ---------------------------------------------------------------------------

export interface Materiales {
  blanco: Material; medio: Material; oscuro: Material; acento: Material;
  /** Sin iluminar: el unico truco para que la garganta "arda" sin postprocesado. */
  caliente: Material;
  /** La chapa de la placa de identificacion (casi negra: separa los tres grises del monograma). */
  chapa: Material;
  /** El gradiente del toon (UNA textura para todos los materiales iluminados, clones incluidos):
   *  `aplicarTema()` reescribe sus texels en sitio y todos cambian a la vez. Va en la interfaz
   *  para que `dispose()` la suelte con lo demas. */
  degradado: DataTexture;
  /** Mallas cuyo MATERIAL cambia con el tema (hoy solo la piel de la campana; ver
   *  construirCampana). Lo rellena la geometria, lo aplica `aplicarTema()`, y vive aqui y no en
   *  una variable del modulo para que muera con el motor que lo creo. No es un material: el
   *  `dispose()` del motor lo salta. */
  porTema?: { malla: Mesh; claro: Material; oscuro: Material }[];
}

/**
 * El emisivo que corresponde a un acento. NO es el propio acento: el renderizador no tiene mapeo
 * de tonos, asi que "emisivo x N" recorta cada canal a 1, y con un ambar claro (0xffd166 = 1 /
 * 0,82 / 0,40) basta N = 1,3 para que los TRES canales lleguen al tope: los aros salian BLANCOS
 * justo en el latido de la galeria y en el encendido, los dos instantes que mas se miran (esc-06,
 * esc-21, esc-22 del informe). La regla, generalizada para cualquier acento de tarjeta (fila 9):
 * mismo tono, saturacion al maximo y luminosidad 0,45 (en HSL de sRGB). Para el ambar da 0xe6a100
 * (1 / 0,63 / 0), para el azul 0x5c9dff da 0x005ce6 (medido en el material, log-v4): por
 * brillante que se ponga, el canal que arranca en cero se queda en cero y el aro nunca es blanco.
 */
export function emisivoDelAcento(acento: Color, salida = new Color()): Color {
  const hsl = { h: 0, s: 0, l: 0 };
  acento.getHSL(hsl, SRGBColorSpace);
  return salida.setHSL(hsl.h, 1, 0.45, SRGBColorSpace);
}

/** Uniforme COMPARTIDO del filo: `aplicarTema()` lo baja en el tema claro sin recompilar nada. */
const filo = { value: new Color() };

/**
 * LA SALIDA AL TARGET DE LA TINTA (motor/tinta.ts). La escena ya no se dibuja en el lienzo sino
 * en un WebGLRenderTarget con DOS texturas de color (MRT): el color y la normal de vista. Todo
 * material que se dibuje en la escena pasa por aqui, porque en un MRT lo que un programa no
 * escribe en la segunda salida queda INDEFINIDO. Dos cosas:
 *   1. `gNormal`: la normal de vista, ·0,5 + 0,5, en `location = 1` (Three declara la 0,
 *      pc_fragColor, en su prefijo). 'normal' para los toon (existe `normal` tras
 *      normal_fragment_begin, ya volteada en las caras traseras); 'plana' para el inserto de
 *      garganta (MeshBasic, sin normal: se declara mirando a la camara y sus bordes los pone la
 *      profundidad y la normal del vecino); 'nada' para el penacho, vec4(0): con mezcla aditiva
 *      (SRC_ALPHA, ONE) deja la textura de normales como estaba.
 *   2. La CODIFICACION sRGB, a mano. Three fuerza la salida lineal cuando el destino es un target
 *      (WebGLPrograms: outputColorSpace = working) y en 8 bits el tono de sombra del tema oscuro
 *      (34 sRGB = 4/255 lineal) se redondea ±3 puntos: se sustituye <colorspace_fragment> por la
 *      OETF explicita y el target guarda la misma imagen que antes iba al lienzo (y en el lienzo,
 *      si alguien pintara la escena directamente, seguiria siendo UNA codificacion: es la misma
 *      funcion que linearToOutputTexel aplica ahi). Ver el porque entero en tinta.ts.
 */
export function salidaAlTarget(shader: WebGLProgramParametersWithUniforms, normal: 'normal' | 'plana' | 'nada'): void {
  const gNormal = normal === 'normal' ? 'vec4( normal * 0.5 + 0.5, 1.0 )'
    : normal === 'plana' ? 'vec4( 0.5, 0.5, 1.0, 1.0 )' : 'vec4( 0.0 )';
  shader.fragmentShader = 'layout(location = 1) out highp vec4 gNormal;\n' + shader.fragmentShader.replace(
    '#include <colorspace_fragment>',
    `gl_FragColor = sRGBTransferOETF( gl_FragColor );\n\tgNormal = ${gNormal};`,
  );
}

/**
 * La luz de borde (informe BRECHA, fila 12), en dos lineas de GLSL sobre el propio toon:
 * rim = (1 - saturate(dot(normal, vista)))^potencia · color · fuerza, sumado al final. Con la
 * camara ortografica `geometryViewDir` es (0, 0, 1) en el espacio de vista, o sea que el filo solo
 * depende de la normal: constante mientras el motor gira y sin halo en las caras de frente.
 * Va como `onBeforeCompile` y NO como ShaderMaterial: asi el material sigue siendo un
 * MeshToonMaterial de serie (emissive, opacity, polygonOffset, el gradiente) y el unico codigo
 * propio son estas dos lineas. `Material.clone()` no copia `onBeforeCompile`: el rig
 * vuelve a llamar a esto sobre los clones de la marca.
 */
export function ponerFilo(mat: MeshToonMaterial): MeshToonMaterial {
  const potencia = PM.motor.rim.potencia.toFixed(2);
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms): void => {
    shader.uniforms.filo = filo;
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform vec3 emissive;', 'uniform vec3 emissive;\nuniform vec3 filo;')
      .replace(
        'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance'
        + ` + pow( 1.0 - saturate( dot( normal, geometryViewDir ) ), ${potencia} ) * filo;`,
      );
    salidaAlTarget(shader, 'normal');
  };
  // El programa se cachea por esta clave: todos los toon comparten uno (la potencia va en la clave
  // porque va incrustada en el GLSL).
  mat.customProgramCacheKey = () => `toon-filo-mrt-${potencia}`;
  return mat;
}

/**
 * La textura del gradiente: `anchura` texels en RedFormat/FloatType, filtro Nearest en ambos
 * sentidos (un escalon es un escalon: con Linear se degradaria entre texels y volverian los tonos
 * intermedios), sin mipmaps y con NoColorSpace, porque es la RESPUESTA A LA LUZ, no un color:
 * no se decodifica de sRGB. Float y no bytes: el escalon de sombra vale 0,024 y con 8 bits solo
 * habria 6/255 = 0,0235 o 7/255 = 0,0275, que son 33 o 37 sRGB en el blanco (la meta es 34).
 */
function crearDegradado(): DataTexture {
  const n = PM.motor.toon.anchura;
  const tex = new DataTexture(new Float32Array(n), n, 1, RedFormat, FloatType);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = NoColorSpace;
  escribirDegradado(tex, false);
  return tex;
}

/** Reescribe los texels del gradiente con los tres valores del tema. El shader lee el texel en
 *  dot(n, L) · 0,5 + 0,5, asi que el texel j cubre dot(n, L) en [2j/n - 1, 2(j+1)/n - 1). */
function escribirDegradado(tex: DataTexture, claro: boolean): void {
  const valores = claro ? PM.motor.toon.claro : PM.motor.toon.oscuro;
  const [c1, c2] = PM.motor.toon.cortes;
  const datos = tex.image.data as Float32Array;
  const n = datos.length;
  for (let j = 0; j < n; j++) {
    const dotNL = ((j + 0.5) / n) * 2 - 1;
    datos[j] = dotNL < c1 ? valores[0] : dotNL < c2 ? valores[1] : valores[2];
  }
  tex.needsUpdate = true;
}

export function crearMateriales(): Materiales {
  // (Ya sin polygonOffset: lo necesitaban las aristas de pliegue, LineSegments que pasaban
  // EXACTAMENTE por la superficie y empataban en el z-test —puntos negros sueltos en la campana,
  // informe BRECHA fila 5—. La tinta es ahora un pase de pantalla y no compite con nadie.)
  //
  // TOON DE TRES TONOS, NO LAMBERT (informe BRECHA, fila 8). Con Lambert + flatShading el motor era
  // un degradado de 43 niveles a 200 px (medido en HERO_OUT 100 %, 1440x900) y cada faceta de la
  // campana se veía; la referencia son tres luminancias (212 / 64 / 32). MeshToonMaterial con un
  // gradiente de tres valores (PM.motor.toon) da exactamente tres tonos por albedo, y SIN
  // flatShading (MeshToonMaterial no lo tiene siquiera: el renderizador solo lo activa si vale
  // `true`, y aquí no existe): en las piezas de revolución (campana, cámara, cúpula, tubos) las
  // normales suavizadas hacen que el corte entre tonos sea una curva limpia y no una escalera de
  // facetas. Los materiales van compartidos por color, así que el flat no se podría dejar "solo en
  // la celosía" aunque existiera: las geometrías con caras planas (cajas, extrusiones, tirantes)
  // ya llevan normales por cara y salen facetadas igual, que es lo que se quería en ellas.
  const degradado = crearDegradado();
  filo.value.setHex(PM.motor.rim.color).multiplyScalar(PM.motor.rim.fuerza);
  const plano = (color: number, extra: object = {}) =>
    ponerFilo(new MeshToonMaterial({ color: new Color(color), gradientMap: degradado, ...extra }));
  // El inserto de garganta no se ilumina, pero se dibuja en el MRT como todo lo demas: declara la
  // segunda salida (normal plana) y codifica su color (ver salidaAlTarget).
  const caliente = new MeshBasicMaterial({ color: new Color(M.paleta.acento), side: DoubleSide });
  caliente.onBeforeCompile = (shader) => salidaAlTarget(shader, 'plana');
  caliente.customProgramCacheKey = () => 'basico-mrt-plana';
  return {
    blanco: plano(M.paleta.blanco, { side: DoubleSide }),
    medio: plano(M.paleta.medio),
    oscuro: plano(M.paleta.oscuro),
    // El emisivo NO es el propio acento: ver emisivoDelAcento(). La coreografía lo reescribe (color
    // y emisivo) al cambiar el acento vigente.
    acento: plano(M.paleta.acento, { emissive: emisivoDelAcento(new Color(M.paleta.acento)), emissiveIntensity: 0.35 }),
    caliente,
    chapa: plano(M.paleta.chapa),
    degradado,
  };
}

// ---------------------------------------------------------------------------
// 5. PIEZAS
// ---------------------------------------------------------------------------

function nombrar<T extends Object3D>(o: T, nombre: string): T {
  o.name = nombre;
  return o;
}

/** Curva 3D de un tubo de refrigeracion: sigue la campana por fuera, con giro helicoidal. */
export function curvaTubo(): { curva: CatmullRomCurve3; rPared: (u: number) => number } {
  const r = M.refrigeracion;
  const campana = perfilCampana();
  const camara = perfilCamara();
  // LOS TUBOS SE APOYAN EN LA SUPERFICIE EXTERIOR DE VERDAD (exteriorPared), no en `x + 0,05`.
  // Antes se sumaba el espesor de la tobera tambien sobre la camara, que tiene 0,07 de pared, y en
  // los tramos inclinados el exterior real queda aun mas lejos: los tubos de arriba iban
  // ENTERRADOS hasta 0,02 en la pared y entre ellos asomaba el blanco de la camara en vez de la
  // piel del forro.
  const extCampana = exteriorPared(campana, M.tobera.espesor);
  const extCamara = exteriorPared(camara, M.camara.espesor);
  // Tramo de perfil que abrazan los tubos: un poco de convergente + toda la campana.
  const arriba = camara.map((p, i) => ({ p, e: extCamara[i] })).filter(({ p }) => p.y <= r.subeGarganta).reverse().slice(0, -1);
  // El final va EXACTAMENTE a margenSalida del labio, interpolado entre los dos puntos del perfil
  // que lo encierran. Filtrar puntos enteros dejaba el tubo en el ultimo punto de la parabola que
  // cabia (paso 0,15 u): el margen real era el del perfil, no el del numero.
  const yFin0 = -M.tobera.largo + M.tobera.margenSalida;
  const pares = campana.map((p, i) => ({ p, e: extCampana[i] }));
  const abajo = pares.filter(({ p }) => p.y > yFin0);
  const k = abajo.length;   // primer punto del perfil que queda por debajo del final
  if (k > 0 && k < pares.length) {
    const a = pares[k - 1];
    const b = pares[k];
    const f = (yFin0 - a.p.y) / (b.p.y - a.p.y);
    abajo.push({ p: a.p.clone().lerp(b.p, f), e: a.e.clone().lerp(b.e, f) });
  }
  const perfil = arriba.concat(abajo);
  const yIni = perfil[0].p.y;
  const yFin = perfil[perfil.length - 1].p.y;
  const pts: Vector3[] = [];
  const radios: number[] = [];
  for (const { p, e } of perfil) {
    const u = (p.y - yIni) / (yFin - yIni);
    const rPared = e.x;
    const rt = radioTubo(rPared, r.n, r.holgura);
    const rc = rPared + rt;
    const th = r.torsion * GRA * u;
    pts.push(new Vector3(rc * Math.cos(th), p.y, rc * Math.sin(th)));
    radios.push(rt);
  }
  const curva = new CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  // RADIO DEL TUBO EN FUNCION DE u, POR LA ALTURA DEL PUNTO. `u` es fraccion de LONGITUD DE ARCO
  // (getPointAt), y los puntos del perfil no estan repartidos por igual a lo largo del arco: los
  // del arco de garganta van a 0,076 u y los de la parabola a 0,145. Antes se indexaba la lista de
  // radios con u·(n-1) como si lo estuvieran, y a media campana el tubo llevaba el radio de un punto
  // de mucho mas arriba: medido en el grafo, a y = -0,5 el tubo tenia 0,047 de radio con un paso de
  // 0,165 (cubria el 56 % en vez del 88 %) y a y = -1,3, 0,093 para un paso de 0,265. La corona era
  // un abanico de cintas con hueco entre ellas, no una pared tubular. Ahora se busca la y del punto
  // de la curva y se interpola el radio entre los dos puntos del perfil que la encierran.
  const ys = perfil.map(({ p }) => p.y);
  const pTmp = new Vector3();
  const rPared = (u: number): number => {
    const y = curva.getPointAt(Math.min(1, Math.max(0, u)), pTmp).y;
    let i = 0;
    while (i < ys.length - 2 && ys[i + 1] > y) i++;   // ys es decreciente (de arriba abajo)
    const f = Math.min(1, Math.max(0, (ys[i] - y) / Math.max(1e-6, ys[i] - ys[i + 1])));
    return radios[i] + (radios[i + 1] - radios[i]) * f;
  };
  return { curva, rPared };
}

/** La corona a la altura `y`: radio de los centros de los tubos (rc), radio del tubo (rt) y radio
 *  de la cresta (ext = rc + rt). Se muestrea la curva del tubo base; en el marco del motor. */
export function coronaEn(y: number): { rc: number; rt: number; ext: number } {
  const { curva, rPared } = curvaTubo();
  let mejor = 0;
  let dist = Infinity;
  const p = new Vector3();
  const N = 240;
  for (let i = 0; i <= N; i++) {
    curva.getPointAt(i / N, p);
    const d = Math.abs(p.y - y);
    if (d < dist) { dist = d; mejor = i / N; }
  }
  curva.getPointAt(mejor, p);
  const rc = Math.hypot(p.x, p.z);
  const rt = rPared(mejor);
  return { rc, rt, ext: rc + rt };
}

function construirCampana(mat: Materiales): Group {
  const g = nombrar(new Group(), 'campana');
  const perfil = conEspesor(perfilCampana(), M.tobera.espesor);
  const pared = new LatheGeometry(perfil, M.tobera.segmentos);
  pared.computeVertexNormals();
  g.add(nombrar(new Mesh(pared, mat.blanco), 'campana-pared'));

  // Inserto de garganta: se ve al mirar dentro de la campana. Es el unico acento grande.
  const gar = perfilCampana().slice(0, M.tobera.puntosGarganta).map((p) => new Vector2(p.x - 0.006, p.y));
  const garganta = new LatheGeometry(gar, M.tobera.segmentos);
  garganta.computeVertexNormals();
  g.add(nombrar(new Mesh(garganta, mat.caliente), 'campana-garganta'));

  const labio = new TorusGeometry(M.tobera.rSalida + M.tobera.espesor / 2, M.tobera.labio, 6, M.tobera.segmentos);
  labio.rotateX(Math.PI / 2);
  labio.translate(0, -M.tobera.largo, 0);
  g.add(nombrar(new Mesh(labio, mat.medio), 'campana-labio'));

  // FORRO Y PIEL (ver M.tobera.forro): DOS mallas, una por cara, porque no se ven en el mismo
  // capitulo ni piden el mismo tono:
  //   . 'campana-forro', la cara INTERIOR retranqueada hacia el eje, en `oscuro`: se ve al mirar
  //     dentro de la campana y quita el interior blanco de la pantalla de lampara (fila 10);
  //   . 'campana-piel', la cara EXTERIOR por encima de la pared y debajo de la corona. Su
  //     material VA CON EL TEMA (registro `porTema`, lo cambia aplicarTema), porque en cada tema
  //     hace un trabajo distinto y ningun albedo de la paleta sirve para los dos:
  //       - oscuro (reposo, corona cerrada): `medio`. Solo asoma en la costura entre tubo y tubo
  //         y ahi tiene que quedar por debajo del tubo blanco: medido en GALERIA 6 % a 1440x900,
  //         fila 0,82 de la caja, costuras a 47-100 frente a 217 del tubo, y las bandas de
  //         aristas del tercio inferior siguen en 13-18 % (umbral 12). Con `blanco` la costura
  //         seria del tono del tubo (215) y la corona volveria a ser la superficie lisa de la
  //         fila 14; con `oscuro`, en claro pasa lo de abajo.
  //       - claro (COMO, corona separada 1,3 u y florecida 0,6): `blanco`, el mismo de la pared
  //         que asomaba en la Vuelta 1. La piel queda ENTERA a la vista y con `oscuro` la
  //         campana era un balde negro de 48-60 sRGB sobre el crema (234), la mancha mas oscura
  //         de la lamina y justo la que senala el rotulo (ronda 1, esc-como-45-zoom-campana).
  //         `medio` se probo y se quedaba en 68 / 90 / 112 (fila 766 de esc-como-45-solo: tres
  //         tramos de 27, 50 y 135 px): un cubo gris en vez de negro, todavia el cuerpo mas
  //         oscuro del despiece; la meta era la pared blanca de antes (>= 140, el tono de sombra
  //         del blanco en claro es 150). El precio: con la corona aun cerrada en tema claro (del
  //         5 %, que entra el tema, al 21 %, que florecen los tubos, y del 93 al 95 %) la costura
  //         es blanca sobre blanco, como en la Vuelta 1 entera; medido en COMO 8 % la tinta clara
  //         sigue separando los tubos (bandas de aristas 17,5-33 %, umbral 12).
  //     (Eran UNA revolucion en `oscuro` con las dos caras: la piel heredaba el tono del interior.)
  // Sentido de las caras de LatheGeometry, comprobado: un perfil que BAJA en y da caras que miran
  // al eje; uno que SUBE, caras que miran afuera. Asi que el interior se recorre de la garganta al
  // labio (se ve desde dentro de la campana) y la piel del labio hacia arriba (se ve desde fuera,
  // entre los tubos). Los dos materiales son de una sola cara: el sentido no es opcional. Los dos
  // bordes sueltos del labio quedan dentro del toro (r 2,07-2,18): no se ve ningun canto.
  // La piel sigue hacia arriba por la camara hasta donde llegan los tubos (subeGarganta): ese trozo
  // viaja con la campana en el despiece y se lee como un cuello sobre la garganta. Las dos mallas
  // cuelgan del grupo `campana`: despiece, rotulo y marca no se enteran (0 huerfanas), y cuestan
  // UNA llamada de dibujo mas que la revolucion unica (67 -> 68 en reposo).
  // A LA MITAD DE PUNTOS que la pared (uno de cada dos, conservando los extremos): la parabola es
  // suave y el forro se desvia < 0,002 u de ella, y son 4 500 triangulos menos en calidad media.
  const f = M.tobera.forro;
  const ralo = (pts: Vector2[]): Vector2[] => pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1);
  const perfil0 = perfilCampana();
  const interior = ralo(perfil0.slice(M.tobera.puntosGarganta - 1)).map((p) => new Vector2(p.x - f.retranqueo, p.y));
  const forro = new LatheGeometry(interior, M.tobera.segmentos);
  forro.computeVertexNormals();
  g.add(nombrar(new Mesh(forro, mat.oscuro), 'campana-forro'));
  const pielCampana = ralo(exteriorPared(perfil0, M.tobera.espesor).reverse()).map((p) => new Vector2(p.x + f.piel, p.y));
  const pielCamara = exteriorPared(perfilCamara(), M.camara.espesor)
    .filter((p) => p.y > 0 && p.y <= M.refrigeracion.subeGarganta + 0.08)
    .map((p) => new Vector2(p.x + f.piel, p.y));
  const piel = new LatheGeometry(pielCampana.concat(pielCamara), M.tobera.segmentos);
  piel.computeVertexNormals();
  const mallaPiel = nombrar(new Mesh(piel, mat.medio), 'campana-piel');
  (mat.porTema ??= []).push({ malla: mallaPiel, claro: mat.blanco, oscuro: mat.medio });
  g.add(mallaPiel);
  return g;
}

function construirRefrigeracion(mat: Materiales): Group {
  const r = M.refrigeracion;
  const g = nombrar(new Group(), 'refrigeracion');
  const { curva, rPared } = curvaTubo();
  const geo = tuboVariable(curva, rPared, r.segmentosU, r.segmentosV);
  // EN BLANCO, no en `medio`. Eran `medio` porque iban enterrados hasta 0,02 u en la pared blanca
  // (ver curvaTubo) y lo que se veia era la pared con las crestas grises de los tubos encima. Ahora
  // los tubos van apoyados de verdad sobre la piel del forro (`medio`) y son ELLOS la superficie de
  // la campana: en blanco la costura oscura entre dos tubos tiene arista por los dos lados (la cara
  // en sombra de un tubo `medio` era tan oscura como la costura y no se separaba de ella).
  const tubos = new InstancedMesh(geo, mat.blanco, r.n);
  tubos.instanceMatrix.setUsage(DynamicDrawUsage);
  const m = new Matrix4();
  const q = new Quaternion();
  const eje = new Vector3(0, 1, 0);
  for (let i = 0; i < r.n; i++) {
    q.setFromAxisAngle(eje, (i * Math.PI * 2) / r.n);
    tubos.setMatrixAt(i, m.makeRotationFromQuaternion(q));
  }
  tubos.instanceMatrix.needsUpdate = true;
  g.add(nombrar(tubos, 'tubos'));

  // Colectores: toros que atan la corona arriba (garganta) y abajo (salida).
  const pIni = curva.getPointAt(0);
  const pFin = curva.getPointAt(1);
  // EL COLECTOR DE ARRIBA VA EN AMBAR. Es el anillo de la garganta: el punto mas estrecho, el que
  // se ve desde CUALQUIER azimut y a cualquier tamano, y el sitio donde el acento significa algo
  // (ahi es donde arde). Los zunchos de la camara ya daban color, pero quedan tapados por los
  // paneles desde media vuelta; este no lo tapa nada. El de abajo sigue oscuro: hace de zocalo.
  for (const [nombre, p, rt, m, k] of [
    ['colector-alto', pIni, rPared(0), mat.acento, r.colectorAlto],
    ['colector-bajo', pFin, rPared(1), mat.oscuro, r.colectorBajo],
  ] as [string, Vector3, number, Material, { centro: number; grueso: number }][]) {
    const rad = Math.hypot(p.x, p.z) + rt * k.centro;
    const t = new TorusGeometry(rad, Math.max(r.rColector, rt * k.grueso), 6, M.tobera.segmentos);
    t.rotateX(Math.PI / 2);
    t.translate(0, p.y, 0);
    g.add(nombrar(new Mesh(t, m), nombre));
  }
  return g;
}

function construirCamara(mat: Materiales): Group {
  const c = M.camara;
  const g = nombrar(new Group(), 'camara');
  const pared = new LatheGeometry(conEspesor(perfilCamara(), c.espesor), c.segmentos);
  pared.computeVertexNormals();
  g.add(nombrar(new Mesh(pared, mat.blanco), 'camara-pared'));

  // Zunchos de refuerzo, instanciados en la banda alta del cilindro (M.camara.zunchosDesde/Hasta:
  // por encima del anillo de aletas, que ocupa el tercio bajo).
  const perfil = perfilCamara();
  const yA = perfil[perfil.length - 2].y;
  const yB = perfil[perfil.length - 1].y;
  const aro = new TorusGeometry(c.rCamara + c.espesor + c.rZuncho * 0.6, c.rZuncho, 6, 48);
  aro.rotateX(Math.PI / 2);
  // En ambar: en el estado ensamblado no habia un solo pixel de acento y el conjunto era
  // monocromo. Tres aros pequenos y fijos bastan para que el objeto tenga color propio.
  const zunchos = new InstancedMesh(aro, mat.acento, c.zunchos);
  const m = new Matrix4();
  for (let i = 0; i < c.zunchos; i++) {
    const u = (i + 0.5) / c.zunchos;
    zunchos.setMatrixAt(i, m.makeTranslation(0, c.zunchosDesde + (c.zunchosHasta - c.zunchosDesde) * u, 0));
  }
  zunchos.instanceMatrix.needsUpdate = true;
  g.add(nombrar(zunchos, 'camara-zunchos'));

  // CANALES + APOYOS DE LA TURBOBOMBA: una caja unitaria, 36 + 2 instancias, 1 llamada
  // (ver M.camara.canales y M.turbobomba.apoyos). Antes los tres tacos eran los pies de los
  // paneles radiadores; los apoyos de la bomba hacen el mismo papel -la pieza colgada se ata a la
  // camara y en el despiece el taco se queda con la camara- y cuestan lo mismo: nada.
  const k = c.canales;
  const rExt = c.rCamara + c.espesor;
  const caja = new BoxGeometry(1, 1, 1);
  const apoyos = M.turbobomba.apoyos;
  const detalles = new InstancedMesh(caja, mat.oscuro, k.n + apoyos.length);
  const mD = new Matrix4();
  const qD = new Quaternion();
  const pD = new Vector3();
  const eD = new Vector3();
  const ejeY = new Vector3(0, 1, 0);
  const yCanal = (yA + yB) / 2;
  const altoCanal = yB - yA - 2 * k.margen;
  // el nervio entra 0,005 en la pared: sin hueco entre nervio y cilindro visto de canto
  const rCanal = rExt - 0.005 + k.fondo / 2;
  let j = 0;
  for (let i = 0; i < k.n; i++) {
    const th = (i / k.n) * Math.PI * 2;
    // la caja se orienta con su Z local hacia fuera: giro pi/2 - th sobre Y (mismo truco que la placa)
    qD.setFromAxisAngle(ejeY, Math.PI / 2 - th);
    pD.set(rCanal * Math.cos(th), yCanal, rCanal * Math.sin(th));
    detalles.setMatrixAt(j++, mD.compose(pD, qD, eD.set(k.ancho, altoCanal, k.fondo)));
  }
  // Los apoyos: tacos radiales (Z local hacia fuera, como los canales) en el azimut de la bomba,
  // de r0 (dentro de la pared) a r1 (dentro de la bomba).
  const thBomba = M.turbobomba.azimut * GRA;
  for (const a of apoyos) {
    const rc = (a.r0 + a.r1) / 2;
    qD.setFromAxisAngle(ejeY, Math.PI / 2 - thBomba);
    pD.set(rc * Math.cos(thBomba), a.y, rc * Math.sin(thBomba));
    detalles.setMatrixAt(j++, mD.compose(pD, qD, eD.set(a.ancho, a.alto, a.r1 - a.r0)));
  }
  detalles.instanceMatrix.needsUpdate = true;
  g.add(nombrar(detalles, 'camara-detalles'));

  // ANILLO MOLETEADO (brida camara-garganta) + COLLAR de la garganta, una sola malla.
  const mo = c.moleteado;
  const co = c.collar;
  const corona = coronaEn(co.y);
  const rValle = corona.ext + co.holgura;
  const anillos = unirGeometrias([
    anilloMoleteado(mo.rInterior, mo.rDiente, mo.rDiente + mo.profundidad, mo.dientes, mo.y, mo.alto),
    anilloMoleteado(corona.rc, rValle, rValle + co.profundidad, co.dientes, co.y, co.alto),
  ]);
  g.add(nombrar(new Mesh(anillos, mat.medio), 'camara-moleteado'));

  // Tornilleria de las dos bridas de la camara. Van AQUI, con la camara, y no con la bancada: en
  // el despiece cada tornillo viaja con la pieza en la que esta atornillado.
  const t = M.tornillos;
  g.add(construirTornillos(mat, [
    // brida de arriba, donde monta el inyector: las cabezas asoman por el canto del cilindro
    { y: yB + t.alto * 0.5, radio: c.rCamara + c.espesor * 0.5, n: t.nCamara },
    // brida de la garganta: sobre la cara de arriba del anillo moleteado
    { y: mo.y + mo.alto + t.alto * 0.5, radio: mo.rDiente + 0.005, n: t.nGarganta },
  ], 'camara-tornillos'));
  return g;
}

function construirInyector(mat: Materiales): Group {
  const i = M.inyector;
  const c = M.camara;
  const g = nombrar(new Group(), 'inyector');
  const yPlaca = perfilCamara()[perfilCamara().length - 1].y;

  // EL ORIGEN DEL GRUPO ESTA EN EL CENTRO DE LA PLACA, no en el de motor (es la unica pieza asi).
  // En el despiece la placa se INCLINA para que se le vea la cara con los 127 orificios (informe
  // BRECHA, fila 22; coreografia.ts, punto 3b del canal derivado), y un giro alrededor del origen
  // del motor la sacaria de su sitio: el pivote tiene que ser su propio centro. La geometria se
  // construye alrededor de y = 0 y el grupo se sube a `yCentro`; para el despiece y el montaje da
  // igual (leen la posicion de reposo del objeto), pero el ANCLA del rotulo en PM.piezas es LOCAL
  // y va referida a este centro.
  const yCentro = yPlaca + i.espesorPlaca / 2;
  g.position.y = yCentro;
  const placa = new CylinderGeometry(c.rCamara + i.rebaje, c.rCamara + i.rebaje, i.espesorPlaca, c.segmentos, 1);
  g.add(nombrar(new Mesh(placa, mat.medio), 'inyector-placa'));

  // Reticula radial de orificios: anillos concentricos, todos en una InstancedMesh. Van con su
  // centro EN LA CARA de arriba de la placa: asoman hOrificio / 2 = 0,05 como los tetones de un
  // inyector de verdad. Antes iban centrados en el espesor (asomaban 0,05 por... dentro) y con la
  // placa inclinada en el despiece, que es cuando se le ve la cara, la reticula de 127 orificios
  // del rotulo era un disco gris liso (captura v1-esc-como-40 del carril objeto). En el reposo la
  // cupula los tapa: quedan dentro de su radio (0,84 + 0,042 < 0,90) y bajo su cuello.
  const total = i.porAnillo.reduce((a, b) => a + b, 0);
  const orif = new CylinderGeometry(i.rOrificio, i.rOrificio, i.hOrificio, i.ladosOrificio, 1);
  const orificios = new InstancedMesh(orif, mat.acento, total);
  const m = new Matrix4();
  let k = 0;
  for (let a = 0; a < i.anillos.length; a++) {
    const rad = i.anillos[a];
    const n = i.porAnillo[a];
    for (let j = 0; j < n; j++) {
      const th = (j / n) * Math.PI * 2 + (a % 2) * (Math.PI / n);
      orificios.setMatrixAt(k++, m.makeTranslation(rad * Math.cos(th), i.espesorPlaca / 2, rad * Math.sin(th)));
    }
  }
  orificios.instanceMatrix.needsUpdate = true;
  g.add(nombrar(orificios, 'inyector-orificios'));

  return g;
}

/** Cupula del colector, encima de la placa. Pieza propia: al levantarla se ve la reticula. */
function construirCupula(mat: Materiales): Group {
  const i = M.inyector;
  const g = nombrar(new Group(), 'cupula');
  const yBase = perfilCamara()[perfilCamara().length - 1].y + i.espesorPlaca;
  const cup: Vector2[] = [];
  for (let s = 0; s <= i.pasosCupula; s++) {
    const a = (s / i.pasosCupula) * (Math.PI / 2);
    cup.push(new Vector2(i.rCupula * Math.cos(a), yBase + i.altoCupula * Math.sin(a)));
  }
  const cupula = new LatheGeometry(cup, M.camara.segmentos);
  cupula.computeVertexNormals();
  g.add(nombrar(new Mesh(cupula, mat.blanco), 'cupula-domo'));
  const cuello = new TorusGeometry(i.rCupula, 0.05, 6, M.camara.segmentos);
  cuello.rotateX(Math.PI / 2);
  cuello.translate(0, yBase, 0);
  // Cabezal (ver M.inyector.cabezal), en la misma malla que el cuello.
  const cb = i.cabezal;
  const cabezal = new CylinderGeometry(cb.r, cb.r, cb.alto + cb.hundido, 12, 1);
  cabezal.translate(0, yBase + i.altoCupula - cb.hundido + (cb.alto + cb.hundido) / 2, 0);
  g.add(nombrar(new Mesh(unirGeometrias([cuello, cabezal]), mat.oscuro), 'cupula-cuello'));
  return g;
}

function construirTurbobomba(mat: Materiales): Group {
  const t = M.turbobomba;
  const g = nombrar(new Group(), 'turbobomba');
  const yV = t.largoCuerpo * 0.22;

  // Voluta: una ESPIRAL de seccion creciente, no un toro. Un toro es simetrico y se lee como el
  // grifo de un lavabo; una voluta de bomba crece de la lengueta a la descarga, y ese crecimiento
  // es justo lo que la hace reconocible. Se genera con tuboVariable(), el mismo generador de los
  // tubos de refrigeracion (radio variable, que TubeGeometry no permite).
  const vueltas = 1.35;
  const puntosVoluta: Vector3[] = [];
  const pasosVoluta = 26;
  for (let i = 0; i <= pasosVoluta; i++) {
    const u = i / pasosVoluta;
    const a = u * vueltas * Math.PI * 2 + t.faseVoluta * GRA;   // el extremo ancho acaba en +X (fuera)
    const rad = t.rVoluta * (0.52 + 0.48 * u);
    puntosVoluta.push(new Vector3(rad * Math.cos(a), yV + u * t.rTuboVoluta * 0.55, rad * Math.sin(a)));
  }
  const curvaVoluta = new CatmullRomCurve3(puntosVoluta, false, 'centripetal', 0.5);
  const voluta = tuboVariable(curvaVoluta, (u) => t.rTuboVoluta * (0.55 + 0.45 * u), 44, 8);
  g.add(nombrar(new Mesh(voluta, mat.medio), 'turbobomba-voluta'));

  const cuerpo = new CylinderGeometry(t.rCuerpo, t.rCuerpo, t.largoCuerpo, t.segmentos, 1);
  g.add(nombrar(new Mesh(cuerpo, mat.blanco), 'turbobomba-cuerpo'));

  const yT = -(t.largoCuerpo / 2 + t.largoTurbina / 2);
  const turbina = new CylinderGeometry(t.rTurbina * 0.62, t.rTurbina * 0.62, t.largoTurbina, t.segmentos, 1);
  turbina.translate(0, yT, 0);
  const rotor = nombrar(new Mesh(turbina, mat.oscuro), 'turbobomba-turbina');
  // ALABES. El rotor gira en el encendido (coreografia: turbina.rotation.y = f(rpm, tiempo)) y con
  // un cilindro liso el giro NO SE VE. Son hijos del rotor, asi que giran con el, y van en una
  // InstancedMesh: 18 alabes, una sola llamada de dibujo.
  const alabe = new BoxGeometry(t.rTurbina * 0.72, t.largoTurbina * 0.78, 0.022);
  alabe.translate(t.rTurbina * 0.66, 0, 0);
  const alabes = new InstancedMesh(alabe, mat.medio, 18);
  const mAl = new Matrix4();
  const qAl = new Quaternion();
  const ejeAl = new Vector3(0, 1, 0);
  const pAl = new Vector3();
  const eAl = new Vector3(1, 1, 1);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    qAl.setFromAxisAngle(ejeAl, a);
    // no radiales del todo: inclinados 24 grados, que es lo que hace que se lea el sentido de giro
    const qPaso = new Quaternion().setFromAxisAngle(new Vector3(Math.cos(a), 0, Math.sin(a)), 24 * GRA);
    alabes.setMatrixAt(i, mAl.compose(pAl.set(0, yT, 0), qAl.multiply(qPaso), eAl));
  }
  alabes.instanceMatrix.needsUpdate = true;
  rotor.add(nombrar(alabes, 'turbobomba-alabes'));
  g.add(rotor);

  // ESCAPE TRUNCADO, NO UN CONO EN PUNTA. Era un ConeGeometry con la punta hacia abajo y a 6x el
  // conjunto (tuerca + cilindro + corona dentada + punta negra) no leia como una turbobomba: leia
  // como una PEONZA o como la punta de un dardo (recorte zoom-despiece-rotulos-derecha). Un escape
  // de turbina termina en una boquilla, que es un tronco de cono cerrado y un anillo de labio.
  const escape = new CylinderGeometry(t.rTurbina * 0.86, t.rTurbina * 0.40, t.largoTurbina * 0.7, t.segmentos, 1);
  escape.translate(0, yT - t.largoTurbina * 0.85, 0);
  g.add(nombrar(new Mesh(escape, mat.medio), 'turbobomba-escape'));
  const boquilla = new CylinderGeometry(t.rTurbina * 0.46, t.rTurbina * 0.46, t.largoTurbina * 0.16, t.segmentos, 1);
  boquilla.translate(0, yT - t.largoTurbina * 1.28, 0);
  g.add(nombrar(new Mesh(boquilla, mat.oscuro), 'turbobomba-boquilla'));

  const entrada = new CylinderGeometry(t.rEntrada, t.rEntrada, t.largoEntrada, 16, 1);
  entrada.translate(0, t.largoCuerpo / 2 + t.largoEntrada / 2, 0);
  g.add(nombrar(new Mesh(entrada, mat.medio), 'turbobomba-entrada'));

  // CARCASA (ver M.turbobomba.carcasa): tambor cerrado con tapas, abierto en una VENTANA del lado
  // que mira a la camara en el reposo, y `barras` barras verticales cruzandola. Barras y tambor
  // comparten material (blanco, de dos caras: el interior del tambor tambien se pinta) y van
  // UNIDOS en una geometria: 1 llamada. El tambor solapa 0,01 con el cuerpo y con el escape para
  // que no quede rendija.
  // CylinderGeometry mide theta desde +Z hacia +X: theta = 90 grados - azimut local.
  const ca = t.carcasa;
  const largoCarcasa = t.largoTurbina + 0.02;
  const thetaVentana = (90 - ca.azimutVentana) * GRA;
  const tambor = new CylinderGeometry(ca.r, ca.r, largoCarcasa, t.segmentos, 1, false, thetaVentana + (ca.ventana / 2) * GRA, (360 - ca.ventana) * GRA);
  tambor.translate(0, yT, 0);
  const trozosCarcasa: BufferGeometry[] = [tambor];
  for (let i = 0; i < ca.barras; i++) {
    const a = thetaVentana + ((i + 0.5) / ca.barras - 0.5) * ca.ventana * GRA;
    const barra = new BoxGeometry(ca.barra, largoCarcasa, ca.barra);
    barra.translate(0, yT, ca.r - ca.barra / 2);   // en theta 0 (+Z) y luego se gira a su sitio
    barra.rotateY(a);                               // rotateY lleva +Z a (sin a, 0, cos a): theta = a
    trozosCarcasa.push(barra);
  }
  g.add(nombrar(new Mesh(unirGeometrias(trozosCarcasa), mat.blanco), 'turbobomba-carcasa'));
  // La brida de la bomba: sus tornillos, sobre la tapa de ARRIBA del cuerpo, en la corona que
  // queda entre la entrada (r 0,115) y el borde del cuerpo (r 0,20). Antes iban alrededor del EJE
  // DEL MOTOR a r 0,37, o sea enterrados dentro de la camara, y luego sobre la tapa del tambor de
  // la turbina; ahi ya no caben: con la bomba dentro de la silueta el tambor solo sobresale 0,03
  // del cuerpo y una cabeza mide 0,09 de ancho, asi que la corona (r 0,22 + 0,045) se salia a
  // r 1,48, por delante de la propia carcasa. Aqui la corona llega a 0,2025 y no pasa del cuerpo,
  // y ademas es lo que es: la brida de la aspiracion, que se ve entera desde arriba (rotX -7 en el
  // reposo, -20 en el despiece).
  g.add(construirTornillos(mat, [
    { y: t.largoCuerpo / 2 + M.tornillos.alto * 0.5, radio: (t.rEntrada + t.rCuerpo) / 2, n: M.tornillos.nBomba },
  ], 'turbobomba-tornillos'));

  const th = t.azimut * GRA;
  g.position.set(t.radio * Math.cos(th), t.altura, t.radio * Math.sin(th));
  g.rotation.y = -th;
  g.userData.radial = new Vector3(Math.cos(th), 0, Math.sin(th));
  return g;
}

function construirConductos(mat: Materiales): Group {
  const g = nombrar(new Group(), 'conductos');
  const t = M.turbobomba;
  const c = M.conductos;
  const th = t.azimut * GRA;
  const pol = (rad: number, ang: number, y: number) => new Vector3(rad * Math.cos(ang), y, rad * Math.sin(ang));

  // CADA TUBO EMPIEZA Y ACABA EN UNA PIEZA (informe BRECHA, fila 10a y 10b). Los arranques van
  // dentro del cuerpo de la bomba (`c.nace` hacia dentro de su eje: la brida del arranque no se ve
  // y no tiene por que contar en el radio del conjunto); los finales llegan a una pared
  // PERPENDICULARES a ella (los dos ultimos puntos van por la normal de la superficie), asi la
  // brida del extremo se apoya plana.
  // Y PEGADOS AL CUERPO (fila 20): con la bomba a r 1,21 ninguno pasa de r 1,40 (antes 1,51 por las
  // bridas de arranque, y 1,95 en la Vuelta 2) y la descarga rodea el convergente a 0,10 de la
  // pared (medido vertice a vertice, sonda-holguras); las abrazaderas los atan al cuerpo. La linea
  // al domo pasa a 0,28 del tirante mas cercano.
  //
  // Un tramo de CatmullRom entre dos puntos a radio r sobre un arco de A grados se mete hacia el
  // eje una sagita de r·(1 − cos(A/2)): a r 0,98 y 35 grados son 0,045 u. Por eso los puntos de la
  // descarga van cada ~35 grados y no cada 70 (0,18 de sagita: el tubo se hundia en el convergente).

  // 0 - descarga principal: baja del cuerpo de la bomba, rodea el convergente por detras a y 0,58
  //     (la pared exterior esta en r 0,83 ahi; el tubo, de radio 0,085, va con el eje a 0,98) y
  //     entra en la pared justo encima del colector de la garganta (la pared se mide, ver
  //     paredCamaraEn). Por encima de la cresta de la corona (y 0,42, r 0,835) y por debajo de la
  //     brida moleteada (y 0,78, r 0,955-1,045): la parte alta del tubo llega a y 0,67.
  const fin0 = paredCamaraEn(0.60);
  const az0 = th - 3.55;
  const rRodea = 0.98;
  const yRodea = 0.58;
  const c0 = [
    pol(t.radio - c.nace, th, t.altura - t.largoCuerpo * 0.2),
    pol(t.radio - 0.08, th - 0.40, 0.70),
    pol(rRodea + 0.02, th - 0.90, yRodea + 0.02),
    pol(rRodea, th - 1.50, yRodea),
    pol(rRodea, th - 2.10, yRodea),
    pol(rRodea, th - 2.70, yRodea),
    pol(fin0.r + fin0.nr * 0.20, az0, fin0.y + fin0.ny * 0.20),
    pol(fin0.r + fin0.nr * 0.014, az0, fin0.y + fin0.ny * 0.014),
  ];
  // 1 - linea al domo del inyector. Sale de la ENTRADA de la bomba (r 0,115, y 1,29-1,69) y sube
  //     por el hueco en V que dejan los pares de tirantes 0 y 1 de la estructura de empuje. Medido
  //     vertice a eje con la geometria de los tirantes (base 30 grados, tope 30 +- 25,5): a y 2,50
  //     el tirante mas cercano esta a r 1,00 y 42,7 grados, el tubo a r 1,20 y 42 (0,07 de aire
  //     entre superficies); a y 2,68 el tirante esta a r 1,05 y 46,9 grados y el tubo a r 1,09 y
  //     58 (0,08). Llega a la cupula a y = 2,56 casi por su normal.
  //     El primer punto intermedio bajo con la bomba (1,27 y 2,18 -> 1,22 y 2,15): con el arranque
  //     0,22 mas abajo, a 1,27 la curva se abombaba hasta r 1,38 con el tubo, al filo del 1,40.
  const azDomo = 58 * GRA;
  const i = M.inyector;
  const yDomo = 2.56;
  const aDomo = Math.asin(Math.min(1, (yDomo - (perfilCamara()[perfilCamara().length - 1].y + i.espesorPlaca)) / i.altoCupula));
  const c1 = [
    pol(t.radio - c.nace, th, t.altura + t.largoCuerpo / 2 + t.largoEntrada * 0.6),
    pol(1.22, 27 * GRA, 2.15),
    pol(1.20, 42 * GRA, 2.50),
    pol(1.09, 58 * GRA, 2.68),
    pol(i.rCupula * Math.cos(aDomo), azDomo, yDomo),
  ];
  // 2 - escape de la turbina: sale de la BOQUILLA del escape (antes nacia en el rotor y acababa en
  //     el aire, a r 2,02, con una bola: fila 10a) y baja a la corona de tubos, donde descarga en
  //     un colector de la campana como en un motor real. La brida se apoya en la cresta de los
  //     tubos a esa altura (coronaEn). Con la bomba 0,05 mas abajo y mas corta la boquilla queda en
  //     y 0,07, a la altura del arco de garganta.
  //     VA POR LA CINTURA, no en linea recta. La cresta de la corona, medida por franjas de 0,1 en
  //     el grafo (sonda perfil): 0,67 en la garganta, 0,74 en y -0,20, 0,81 en -0,30, 0,95 en
  //     -0,40, 1,01 en -0,50, 1,08 en -0,60, 1,15 en -0,70 y 1,21 en -0,74. El trazado de antes
  //     iba de la boquilla a un punto a `cresta2 + 0,20` (r 1,41) y de ahi a la brida: pasaba por
  //     r 1,47 -por delante de la propia bomba- y su abrazadera se quedaba a 0,40 de la campana,
  //     un collar atando el aire. Ahora el tubo se mete a r 1,04 en la cintura (0,06 de la cresta)
  //     y sube con la campana hasta apoyarse: ninguna franja pasa de 1,37 con el tubo, y el collar
  //     (`abrazaderas[2]`) cae donde el tubo roza de verdad.
  const yEscape = t.altura - (t.largoCuerpo / 2 + t.largoTurbina / 2) - t.largoTurbina * 1.28;
  const yFin2 = -0.74;
  const azFin2 = th - 23 * GRA;
  const cresta2 = coronaEn(yFin2).ext;
  const c2 = [
    pol(t.radio, th, yEscape + 0.02),
    pol(1.13, th - 6 * GRA, -0.14),
    pol(1.04, th - 14 * GRA, -0.38),
    pol(cresta2, th - 20 * GRA, -0.60),
    pol(cresta2 + 0.10, azFin2, yFin2 + 0.035),
    pol(cresta2 + 0.02, azFin2, yFin2),
  ];
  const rutas = [c0, c1, c2];
  // el tercero era `oscuro` y sobre fondo negro desaparecia: los tres van en tonos que se ven
  const materiales = [mat.medio, mat.blanco, mat.medio];
  // BRIDAS Y ABRAZADERAS. `TubeGeometry` con `closed = false` deja los dos extremos ABIERTOS, y un
  // tubo abierto visto de frente es un AGUJERO NEGRO ELIPTICO. Cada extremo lleva un disco del
  // radio de la brida orientado por la tangente del tubo en ese punto; y cada tubo lleva ademas
  // sus abrazaderas (M.conductos.abrazaderas), el mismo disco con otras proporciones, en los u de
  // la curva donde el tubo roza el cuerpo. Todo en UNA InstancedMesh (antes eran dos de bolitas,
  // una por material).
  const br = c.brida;
  const ab = c.abrazadera;
  const disco = new CylinderGeometry(1, 1, 1, 12, 1);
  const nCollares = c.abrazaderas.reduce((a, l) => a + l.length, 0);
  const bridas = new InstancedMesh(disco, mat.oscuro, rutas.length * 2 + nCollares);
  const mBrida = new Matrix4();
  const qBrida = new Quaternion();
  const eBrida = new Vector3();
  const ejeY = new Vector3(0, 1, 0);
  let nBrida = 0;
  rutas.forEach((pts, k) => {
    const curva = new CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    const geo = new TubeGeometry(curva, c.segmentosU, c.radios[k], c.segmentosV, false);
    const tubo = nombrar(new Mesh(geo, materiales[k]), `conducto-${k}`);
    tubo.userData.radio = c.radios[k];   // lo leen las pruebas para medir holguras
    g.add(tubo);
    const collar = (u: number, radio: number, alto: number): void => {
      const p = curva.getPointAt(u);
      const tg = curva.getTangentAt(u).normalize();
      qBrida.setFromUnitVectors(ejeY, tg);
      bridas.setMatrixAt(nBrida++, mBrida.compose(p, qBrida, eBrida.set(c.radios[k] * radio, c.radios[k] * alto, c.radios[k] * radio)));
    };
    for (const u of [0, 1]) collar(u, br.radio, br.alto);
    for (const u of c.abrazaderas[k] ?? []) collar(u, ab.radio, ab.alto);
  });
  bridas.instanceMatrix.needsUpdate = true;
  g.add(nombrar(bridas, 'conducto-bridas'));
  g.userData.radial = new Vector3(Math.cos(th), 0, Math.sin(th));
  return g;
}

// TORNILLERIA. Una corona de cabezas hexagonales por brida (un cilindro de 6 segmentos ES un
// hexagono), y todas las coronas de una misma pieza en UNA InstancedMesh: la camara lleva sus dos
// bridas en una llamada, la bancada la suya, la bomba la suya. Cada corona viaja con la pieza en la
// que esta atornillada, que es lo que se ve en el despiece.
//
// Las cabezas tienen que SOBRESALIR de una superficie visible. Puestas en el eje de la pieza quedan
// enterradas dentro de ella y no se ven: paso con el anillo de empuje, donde el eje del toro estaba
// a medio grosor de la superficie, y con la brida de la bomba, que giraba alrededor del eje del motor.
function construirTornillos(mat: Materiales, anillos: { y: number; radio: number; n: number }[], nombre: string): InstancedMesh {
  const t = M.tornillos;
  const total = anillos.reduce((a, x) => a + x.n, 0);
  const cabeza = new CylinderGeometry(t.r, t.r, t.alto, 6);
  const tornillos = new InstancedMesh(cabeza, mat.oscuro, total);
  const m = new Matrix4();
  let k = 0;
  for (const a of anillos) {
    for (let i = 0; i < a.n; i++) {
      const th = (i / a.n) * Math.PI * 2;
      tornillos.setMatrixAt(k++, m.makeTranslation(a.radio * Math.cos(th), a.y, a.radio * Math.sin(th)));
    }
  }
  tornillos.instanceMatrix.needsUpdate = true;
  return nombrar(tornillos, nombre);
}

function construirBancada(mat: Materiales): Group {
  const b = M.bancada;
  const g = nombrar(new Group(), 'bancada');
  // Seccion rectangular revolucionada (ver M.bancada.anillo). El perfil se recorre subiendo por
  // fuera, hacia dentro por arriba, bajando por dentro y hacia fuera por abajo: LatheGeometry pone
  // la normal a la derecha del sentido de recorrido, asi que las cuatro caras miran hacia fuera.
  const an = b.anillo;
  const r0 = b.rAnillo - an.ancho / 2;
  const r1 = b.rAnillo + an.ancho / 2;
  const y0 = b.altura - an.alto / 2;
  const y1 = b.altura + an.alto / 2;
  const anillo = new LatheGeometry([
    new Vector2(r1, y0), new Vector2(r1, y1), new Vector2(r0, y1), new Vector2(r0, y0), new Vector2(r1, y0),
  ], 72);
  anillo.computeVertexNormals();
  const trozosBrida: BufferGeometry[] = [anillo];

  // Tirantes en A: pares que suben del anclaje al anillo abriendose.
  const tir = new CylinderGeometry(b.rTirante, b.rTirante, 1, 6, 1);
  tir.translate(0, 0.5, 0); // origen en la base, para escalar por la longitud
  const tirantes = new InstancedMesh(tir, mat.oscuro, b.tirantes);
  const m = new Matrix4();
  const q = new Quaternion();
  const eje = new Vector3(0, 1, 0);
  const esc = new Vector3();
  const dir = new Vector3();
  const pos = new Vector3();
  for (let i = 0; i < b.tirantes; i++) {
    const par = Math.floor(i / 2);
    const sgn = i % 2 === 0 ? 1 : -1;
    const base = ((par + 0.5) / (b.tirantes / 2)) * Math.PI * 2;
    const arriba = base + sgn * (Math.PI / (b.tirantes / 2)) * 0.85;
    const a = new Vector3(b.anclaje * Math.cos(base), b.yAnclaje, b.anclaje * Math.sin(base));
    const z = new Vector3(b.rAnillo * Math.cos(arriba), b.altura, b.rAnillo * Math.sin(arriba));
    dir.subVectors(z, a);
    const L = dir.length();
    q.setFromUnitVectors(eje, dir.normalize());
    tirantes.setMatrixAt(i, m.compose(pos.copy(a), q, esc.set(1, L, 1)));
    // El pie de este tirante (ver M.bancada.pies): caja con su Z local hacia fuera, empotrada en
    // la cara exterior de la brida y a ras de su fondo.
    const pie = new BoxGeometry(b.pies.ancho, b.pies.alto, b.pies.saliente + b.pies.empotrado);
    pie.applyMatrix4(m.compose(
      pos.set(
        (b.rAnillo + an.ancho / 2 - b.pies.empotrado + (b.pies.saliente + b.pies.empotrado) / 2) * Math.cos(arriba),
        y0 + b.pies.alto / 2,
        (b.rAnillo + an.ancho / 2 - b.pies.empotrado + (b.pies.saliente + b.pies.empotrado) / 2) * Math.sin(arriba),
      ),
      q.setFromAxisAngle(eje, Math.PI / 2 - arriba),
      esc.set(1, 1, 1),
    ));
    trozosBrida.push(pie);
  }
  tirantes.instanceMatrix.needsUpdate = true;
  g.add(nombrar(tirantes, 'bancada-tirantes'));
  g.add(nombrar(new Mesh(unirGeometrias(trozosBrida), mat.medio), 'bancada-anillo'));

  // PANEL de la placa de identificacion (ver M.bancada.panel): sector de corona circular con canto,
  // extruido a lo alto y colgado del anillo. La placa (periferia) se apoya en su cara exterior.
  const pn = b.panel;
  const a0 = (pn.azimut - pn.abertura / 2) * GRA;
  const a1 = (pn.azimut + pn.abertura / 2) * GRA;
  const sector = new Shape();
  sector.absarc(0, 0, pn.rInterior + pn.espesor, a0, a1, false);
  sector.absarc(0, 0, pn.rInterior, a1, a0, true);
  sector.closePath();
  const panel = new ExtrudeGeometry(sector, { depth: pn.y1 - pn.y0, bevelEnabled: false, curveSegments: 12 });
  panel.rotateX(Math.PI / 2);   // la extrusion (+Z) pasa a -Y; el angulo del plano se conserva como azimut
  panel.translate(0, pn.y1, 0);
  g.add(nombrar(new Mesh(panel, mat.medio), 'bancada-panel'));

  // Los tornillos del anillo: sobre la cara de arriba de la brida, no dentro.
  const tornillos = nombrar(new Group(), 'tornillos');
  tornillos.add(construirTornillos(mat, [
    { y: b.altura + b.anillo.alto / 2 + M.tornillos.alto * 0.5, radio: b.rAnillo, n: M.tornillos.nBancada },
  ], 'tornillos-cabezas'));
  g.add(tornillos);
  return g;
}

/** El anillo de aletas (ver M.aletas): `n` ranuras alrededor del cilindro de la camara menos las
 *  que caen sobre la turbobomba, cada una una placa radial. UNA InstancedMesh de una caja unitaria
 *  (misma idea que los canales: la Z local de la caja mira hacia fuera y la escala pone las
 *  medidas). El grupo tiene su origen EN EL EJE, a la altura del centro de la banda: asi el
 *  despiece lo mueve por el eje como a cualquier otra pieza y la apertura radial es una escala en
 *  X y Z del grupo (coreografia.ts), que separa todas las aletas de la pared a la vez sin tocar
 *  las 29 matrices. En `medio`, como estaban los paneles: sobre la pared blanca la banda se lee
 *  como el anillo nervado oscuro de la referencia. */
function construirAletas(mat: Materiales): Group {
  const a = M.aletas;
  const g = nombrar(new Group(), 'aletas');
  g.position.y = a.y;
  const ranuras: number[] = [];
  for (let i = 0; i < a.n; i++) {
    const az = (i * 360) / a.n;
    const d = Math.abs(((az - M.turbobomba.azimut + 540) % 360) - 180);   // 0..180 hasta la bomba
    if (d >= a.hueco) ranuras.push(az);
  }
  const caja = new BoxGeometry(1, 1, 1);
  const aletas = new InstancedMesh(caja, mat.medio, ranuras.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const e = new Vector3(a.espesor, a.alto, a.largo);
  const ejeY = new Vector3(0, 1, 0);
  const rc = a.rInterior + a.largo / 2;
  ranuras.forEach((az, i) => {
    const th = az * GRA;
    q.setFromAxisAngle(ejeY, Math.PI / 2 - th);
    p.set(rc * Math.cos(th), 0, rc * Math.sin(th));
    aletas.setMatrixAt(i, m.compose(p, q, e));
  });
  aletas.instanceMatrix.needsUpdate = true;
  g.add(nombrar(aletas, 'aletas-placas'));
  return g;
}

/**
 * Monograma de Yoiber, sacado del SVG (yoi-icon.svg, viewBox 439x523) y APLANADO AQUI.
 *
 * La version anterior era el mismo SVG con las curvas TIRADAS A LA BASURA: se quedaba solo con
 * los extremos de cada `C`, o sea puntas afiladas donde el logo tiene esquinas redondeadas y, lo
 * que se veia de verdad, un ESCALON en la junta -el brazo blanco baja mas que el oscuro y los dos
 * se cierran con la misma curva; en recta eso deja un diente-. A 13x en pantalla no leia como
 * logotipo sino como malla rota (captura esc-17 del turno anterior, recorte z-seam).
 *
 * Ahora las cubicas van aplanadas a segmentos de ~14 unidades de viewBox: 27/19/27 puntos, que a
 * la escala a la que se ve (media pantalla de alto) es menos de 1 px de error. Son poligonos
 * rectos: sigue sin hacer falta SVGLoader.
 */
export const MONOGRAMA: [number, number][][] = [
  // gris oscuro (brazo que baja a la izquierda)
  [[218.56, 324.16], [225.89, 331.20], [234.32, 335.98], [243.44, 338.53], [252.82, 338.87], [262.02, 337.05],
   [270.63, 333.10], [278.21, 327.05], [284.33, 318.94], [287.17, 314.00], [287.25, 314.00], [178.51, 502.84],
   [173.53, 509.69], [167.34, 515.25], [160.17, 519.40], [152.26, 521.99], [143.84, 522.88], [41.93, 522.88],
   [30.97, 521.40], [21.37, 517.26], [13.39, 510.94], [7.30, 502.90], [3.37, 493.61], [1.87, 483.53], [3.08,
   473.15], [7.27, 462.91], [141.84, 229.35]],
  // gris medio (brazo que sube a la izquierda)
  [[204.77, 0.00], [215.72, 1.48], [225.33, 5.62], [233.31, 11.94], [239.40, 19.98], [243.33, 29.27], [244.82,
   39.34], [243.62, 49.72], [239.44, 59.96], [141.89, 229.41], [8.98, 65.16], [2.86, 54.85], [0.18, 43.95],
   [0.65, 33.05], [3.98, 22.77], [9.87, 13.72], [18.05, 6.50], [28.21, 1.73], [40.08, 0.00]],
  // blanco (brazo que sube a la derecha)
  [[398.85, 0.04], [402.03, 0.16], [405.12, 0.51], [414.62, 3.28], [422.85, 8.13], [429.58, 14.68], [434.60,
   22.56], [437.70, 31.40], [438.66, 40.83], [437.25, 50.46], [433.28, 59.94], [284.33, 318.94], [278.21,
   327.05], [270.63, 333.10], [262.03, 337.05], [252.82, 338.87], [243.44, 338.53], [234.32, 335.98], [225.89,
   331.20], [218.56, 324.16], [141.84, 229.35], [262.42, 20.07], [267.39, 13.23], [273.58, 7.66], [280.75,
   3.52], [288.67, 0.93], [297.08, 0.04]],
];

function construirPlaca(mat: Materiales): Group {
  const pl = M.placa;
  const g = nombrar(new Group(), 'placa');
  const k = pl.alto / 523;
  const mats = [mat.oscuro, mat.medio, mat.blanco];
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  MONOGRAMA.forEach((poli, i) => {
    const sh = new Shape();
    poli.forEach(([x, y], j) => {
      const px = (x - 141.84) * k;
      const py = -(y - 229.35) * k;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px);
      y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      if (j === 0) sh.moveTo(px, py); else sh.lineTo(px, py);
    });
    sh.closePath();
    const geo = new ExtrudeGeometry(sh, { depth: pl.espesor, bevelEnabled: false, curveSegments: 1 });
    g.add(nombrar(new Mesh(geo, mats[i]), `placa-${i}`));
  });
  // LA CHAPA. Sin ella el monograma era una pieza pequena SUELTA flotando dentro del anillo de
  // bancada y cruzandose con los tirantes: leia como basura poligonal, y una marca mal puesta hace
  // mas dano que ninguna marca. Ahora es lo que promete su nombre: una placa de identificacion,
  // con su borde (lleva contorno) y el monograma en relieve encima.
  const mg = pl.alto * pl.margen;
  const chapa = new BoxGeometry(x1 - x0 + mg * 2, y1 - y0 + mg * 2, pl.chapa);
  chapa.translate((x0 + x1) / 2, (y0 + y1) / 2, -pl.chapa / 2);
  g.add(nombrar(new Mesh(chapa, mat.chapa), 'placa-chapa'));
  const th = pl.azimut * GRA;
  g.position.set(pl.radio * Math.cos(th), pl.y, pl.radio * Math.sin(th));
  g.rotation.y = Math.PI / 2 - th;   // la chapa mira hacia fuera, en su propio plano
  g.userData.radial = new Vector3(Math.cos(th), 0, Math.sin(th));
  return g;
}

// ---------------------------------------------------------------------------
// 6. CONTORNOS: ya no viven aqui.
// ---------------------------------------------------------------------------
// Hasta la Vuelta 2 eran 14 EdgesGeometry (LineSegments de 1 px, umbral 24 grados, solo sobre las
// mallas grandes) y 7 cascos de silueta (copias en BackSide con los vertices empujados 0,028 u por
// su normal soldada): 21 llamadas de dibujo y ~30 000 triangulos repetidos, y nada de lo instanciado
// (tubos, tornillos, tirantes, alabes, canales, bridas) llevaba linea. La tinta es ahora un pase de
// pantalla que sale de la profundidad y las normales del fotograma (motor/tinta.ts, informe BRECHA
// fila 19): le sale a toda arista y a toda silueta sin tocar el grafo, y las piezas ya no llevan
// hijos 'aristas-*' ni 'silueta-*'.

/**
 * El tema en los MATERIALES (el color de la tinta lo cambia tinta.tema(), en el pase de pantalla,
 * con M.paleta.linea / lineaClaro: sobre el crema del capitulo "como esta hecho" la tinta es lo
 * unico que separa la campana blanca (0xf4f4f2) del papel (#efe9df), que son el mismo color).
 */
export function aplicarTema(mat: Materiales, claro: boolean): void {
  // Los tres grises, por tema (M.paleta.claro; el porque, alli). Son escrituras de color en tres
  // materiales compartidos: los clones de la marca los copia el rig.
  const c = M.paleta.claro;
  (mat.medio as MeshToonMaterial).color.setHex(claro ? c.medio : M.paleta.medio);
  (mat.oscuro as MeshToonMaterial).color.setHex(claro ? c.oscuro : M.paleta.oscuro);
  (mat.chapa as MeshToonMaterial).color.setHex(claro ? c.chapa : M.paleta.chapa);
  // Los TRES TONOS del toon, que son por tema (PM.motor.toon): sobre el crema el tono
  // que se funde con el fondo es el iluminado, no la sombra. Se reescriben los texels en sitio:
  // la textura es una para todos los materiales (los clones de la marca incluidos), asi que
  // cambia todo a la vez y sin recompilar ningun programa. Lo mismo con el filo, que va en un
  // uniforme compartido.
  escribirDegradado(mat.degradado, claro);
  filo.value.setHex(PM.motor.rim.color).multiplyScalar(claro ? PM.motor.rim.fuerzaClaro : PM.motor.rim.fuerza);
  // Y las mallas que cambian de MATERIAL con el tema (la piel de la campana: `medio` para la
  // costura entre tubos sobre el fondo oscuro, `blanco` para la pared a la vista en el despiece
  // claro; el porque con medidas, en construirCampana). Los dos materiales ya estan en la lista
  // que el rig atenua, asi que el apagado y el fundido no se enteran del cambio.
  for (const p of mat.porTema ?? []) p.malla.material = claro ? p.claro : p.oscuro;
}

// ---------------------------------------------------------------------------
// 7. MONTAJE
// ---------------------------------------------------------------------------

export interface Motor {
  grupo: Group;
  piezas: Record<string, Object3D>;
  materiales: Materiales;
  /** Orden de las piezas a lo largo del eje, de abajo a arriba: sirve para el despiece axial. */
  ordenAxial: string[];
  /** Piezas que se abren radialmente; cada una lleva userData.radial. */ 
  ordenRadial: string[];
  dispose(): void;
}

export function crearMotor(): Motor {
  const materiales = crearMateriales();
  const grupo = nombrar(new Group(), 'motor');

  const propulsor = nombrar(new Group(), 'propulsor');
  propulsor.add(
    construirCampana(materiales), construirRefrigeracion(materiales),
    construirCamara(materiales), construirAletas(materiales), construirInyector(materiales), construirCupula(materiales),
  );

  const periferia = nombrar(new Group(), 'periferia');
  periferia.add(construirTurbobomba(materiales), construirConductos(materiales), construirPlaca(materiales));

  const bancada = construirBancada(materiales);
  grupo.add(propulsor, periferia, bancada);

  const piezas: Record<string, Object3D> = {};
  grupo.traverse((o) => { if (o.name) piezas[o.name] = o; });
  grupo.traverse((o) => { o.userData.reposo = o.position.clone(); });

  return {
    grupo,
    piezas,
    materiales,
    ordenAxial: ['campana', 'refrigeracion', 'camara', 'aletas', 'inyector', 'cupula', 'bancada'],
    ordenRadial: ['turbobomba', 'conductos', 'placa'],
    dispose() {
      grupo.traverse((o) => {
        const m = o as Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      // `porTema` es un registro, no un material: no tiene dispose().
      for (const m of Object.values(materiales)) if (m && typeof (m as Material).dispose === 'function') (m as Material).dispose();
    },
  };
}
