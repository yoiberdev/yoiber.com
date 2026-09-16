import {
  BufferGeometry, Camera, Color, DepthTexture, Float32BufferAttribute, LinearFilter, LinearSRGBColorSpace, Mesh,
  NoBlending, ShaderMaterial, Vector2, WebGLRenderTarget, type OrthographicCamera, type PerspectiveCamera,
  type Scene, type WebGLRenderer,
} from 'three';
import { PM } from '../params-motor';
import { M } from './geometria';

// LA TINTA COMO PASE DE PANTALLA (informe BRECHA, filas 19 y 25)
// ===============================================================================================
// Antes la tinta eran 14 EdgesGeometry (LineSegments de 1 px sobre las mallas grandes, umbral 24°)
// y 7 cascos de silueta (copias en BackSide empujadas 0,028 u): 21 llamadas de dibujo y ~30 000
// triángulos repetidos para perfilar SOLO las piezas grandes. Nada de lo instanciado —los 36 tubos,
// los tornillos, los tirantes, los álabes, los canales, las bridas— llevaba línea, y la referencia
// lleva 1 px de tinta en TODAS las aristas (par-claro.png: 28,3 % de píxeles de arista en su pila
// de módulos; el demo, 8-10 %). Ahora la tinta se calcula en PANTALLA, a partir de lo que de verdad
// se ve, y le sale a todo lo que tenga una arista o una silueta, cueste lo que cueste en piezas.
//
// TRES PASADAS, y la escena solo se dibuja UNA vez:
//   1. Geometría -> `g` (WebGLRenderTarget con DOS texturas de color y una de profundidad):
//        · textures[0]: el color de siempre (los toon, el penacho aditivo), ya CODIFICADO en sRGB;
//        · textures[1]: la NORMAL de vista de cada píxel (·0,5 + 0,5), escrita por los propios
//          materiales desde `onBeforeCompile` (geometria.ts, salidaAlTarget);
//        · depthTexture: la profundidad, DEPTH_COMPONENT24.
//      Es un MRT (`count: 2`): una sola pasada de los ~87 000 triángulos. La alternativa era un
//      segundo render de la escena con `overrideMaterial = MeshNormalMaterial`, que dobla el
//      trabajo de vértices y las llamadas de dibujo (y en un móvil por baldosas, el relleno). El
//      precio del MRT es que TODO material que se dibuje en la escena tiene que declarar la
//      segunda salida (si no, lo que cae en esa textura es indefinido): el toon, el inserto de
//      garganta y las capas del penacho lo hacen; el penacho escribe vec4(0) con mezcla aditiva,
//      que deja la normal de lo que tenga detrás tal cual (SRC_ALPHA · 0 + DST · 1).
//   2. Tinta -> `c` (o el lienzo si no hay FXAA): un triángulo a pantalla completa lee las tres
//      texturas, hace la cruz de Roberts sobre la profundidad y sobre las normales y pinta la línea
//      del color del tema (M.paleta.linea / lineaClaro) ENCIMA del color. Ver el GLSL de abajo.
//   3. Al lienzo, de una de dos maneras:
//      · REDUCCIÓN (lo normal desde el 2026-09-16): `g` y `c` se dibujan a MÁS densidad que el
//        lienzo (`densidad` píxeles por píxel CSS, 2 en calidad alta) y la última pasada los
//        reduce con un filtro de caja. Es lo que hace animejs.com (composer a x2/x3 con
//        pixelRatio 1, y su FXAA se quedó sin usar): la línea de tinta de 1 px sale con el borde
//        suavizado de verdad, no con la escalera que el FXAA solo disimula. Antes se descartó por
//        presupuesto (5,2 MP a 1440x900), pero un portátil de densidad 2 ya dibujaba 4 MP, y la
//        queja era justo esa: "detalles muy pequeños que se ven pixelados" en pantallas de 1x.
//      · FXAA (el camino de antes, y el respaldo): si la densidad no supera la del lienzo —calidad
//        baja, o el vigilante de fotogramas ha quitado la reducción—, el suavizado lo hace el FXAA
//        de "consola" de NVIDIA (3.11, variante corta), escrito aquí a mano.
//      El renderizador va con `antialias: false`: el MSAA del lienzo no se aplica a los targets y
//      en el lienzo solo se dibuja un triángulo.
//
// EL COLOR VA CODIFICADO EN sRGB DENTRO DE LOS TARGETS, a propósito. Three no codifica al escribir
// en un target (WebGLPrograms fuerza la salida lineal, `outputColorSpace = working`), y guardar
// lineal en 8 bits rompe las sombras: el tono de sombra del tema oscuro es 34 sRGB = 0,0159 lineal
// = 4/255, y el redondeo lo movía ±3 puntos de sRGB, justo en el tono que va a 4 puntos del fondo.
// Así que cada material codifica ÉL MISMO al final (sRGBTransferOETF, en salidaAlTarget) y los
// targets son la misma imagen de 8 bits que antes iba al lienzo: la mezcla aditiva del penacho
// ocurre en el mismo espacio que antes (con SRGB8_ALPHA8 la GPU mezclaría en lineal y el chorro
// cambiaría de brillo), y estas dos pasadas de pantalla son un compositor 2D: mezclan valores ya
// codificados y los escriben tal cual, sin `colorspace_fragment`. El lienzo es `alpha: true` y
// premultiplicado: el alfa del target es la COBERTURA del objeto (1 en los cuerpos, 0 en el fondo,
// menos en el apagado de la marca y el fundido final) y la tinta se compone "over" con él.

const VERTICE = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

// LA CRUZ DE ROBERTS, con cinco muestras: el centro y las cuatro diagonales a `radio` texels.
//   · Profundidad: la SEGUNDA diferencia a lo largo de cada diagonal, |z1 + z2 - 2·z0|, en
//     unidades de motor. La primera diferencia (|z1 - z2|, la cruz clásica) marca también toda
//     superficie inclinada respecto a la cámara —en un plano la profundidad cambia a ritmo
//     constante—; la segunda vale cero en un plano y solo salta donde la profundidad SALTA: el
//     borde de un tubo contra la pared, la silueta contra el fondo, un tornillo sobre la brida.
//     En una superficie curva vista de canto también crece, pero solo a < 2 texels de la propia
//     silueta (z'' ~ R² / (2Rδ)^1,5 con R = 2 de la campana: > 0,025 u solo si δ < 0,014 u a
//     zoom 1 y dpr 1), o sea que se funde con la línea de silueta que ya se quería.
//   · Normales: |n1 - n2|² + |n3 - n4|², raíz. El umbral NO puede ser el de un pliegue de 24°
//     (0,42), y menos el 0,25 (14°) con el que se empezó: medido en el reposo a 1440x900, los
//     aros ámbar (toro de 6,6 px de alto) y los 36 tubos (11 px) salían ENTEROS de tinta, porque
//     en una superficie curva pequeña la normal gira 180° en unos pocos texels y dos muestras a
//     ±0,7 texels ya distan más que eso en toda su anchura (ascii de barrido.mjs: las tres
//     bandas de los aros desaparecidas). Con 0,55 (32°) el detector solo salta donde la normal
//     gira > 32° en 2·radio texels: en un tubo de 11 px eso es el 3 % exterior (|y| > 0,97 r), en
//     un aro de 6,6 px el 8 %, o sea la propia silueta, que la profundidad ya marca. Los pliegues
//     del objeto (cajas, bridas, cantos de aleta, tapas de cilindro) son de 90°: 1,41, plenos.
// La línea es la suma suave (smoothstep del umbral a su doble) de las dos, multiplicada por la
// COBERTURA máxima de las cinco muestras: así la tinta se desvanece con el objeto en el apagado
// de la marca y en el fundido final, y en la silueta exterior se pinta a los dos lados del borde
// (la mitad que cae en el fondo lleva alfa propio, que es lo que la hace visible sobre el tema).
const TINTA = /* glsl */`
uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float radio;
uniform float cerca;
uniform float lejos;
uniform float perspectiva;
uniform float umbralZ;
uniform float umbralN;
uniform vec3 tinta;
uniform float fuerza;
uniform vec3 papel;
uniform float lamina;
uniform float revela;
varying vec2 vUv;
#include <packing>
float z( vec2 uv ) {
  float d = texture2D( tDepth, uv ).x;
  return perspectiva > 0.5 ? perspectiveDepthToViewZ( d, cerca, lejos ) : orthographicDepthToViewZ( d, cerca, lejos );
}
vec3 n( vec2 uv ) { return texture2D( tNormal, uv ).xyz * 2.0 - 1.0; }
void main() {
  vec2 o = texel * radio;
  vec2 u1 = vUv + o;
  vec2 u2 = vUv - o;
  vec2 u3 = vUv + vec2( o.x, -o.y );
  vec2 u4 = vUv + vec2( -o.x, o.y );
  float z0 = z( vUv );
  float dz = max( abs( z( u1 ) + z( u2 ) - 2.0 * z0 ), abs( z( u3 ) + z( u4 ) - 2.0 * z0 ) );
  vec3 d1 = n( u1 ) - n( u2 );
  vec3 d2 = n( u3 ) - n( u4 );
  float dn = sqrt( dot( d1, d1 ) + dot( d2, d2 ) );
  float e = max( smoothstep( umbralZ, umbralZ * 2.0, dz ), smoothstep( umbralN, umbralN * 2.0, dn ) );
  vec4 c0 = texture2D( tColor, vUv );
  // LA LÁMINA (tema claro). Lo que es GRIS pasa a ser papel y el objeto lo dibuja solo la tinta,
  // como en la sección clara de animejs.com (relleno beige, contorno oscuro, sin sombrear). Lo que
  // tiene COLOR —los aros del acento, el penacho, el filo— se respeta: se mide la saturación del
  // color real (des-premultiplicado) y solo se aplana lo que está por debajo de 0,10.
  float alto = max( c0.r, max( c0.g, c0.b ) );
  float bajo = min( c0.r, min( c0.g, c0.b ) );
  float sat = c0.a > 0.001 ? ( alto - bajo ) / c0.a : 0.0;
  float plano = lamina * ( 1.0 - smoothstep( 0.10, 0.28, sat ) );
  c0.rgb = mix( c0.rgb, papel * c0.a, plano );
  float cobertura = max( max( c0.a, texture2D( tColor, u1 ).a ), max( max( texture2D( tColor, u2 ).a, texture2D( tColor, u3 ).a ), texture2D( tColor, u4 ).a ) );
  e *= fuerza * revela * cobertura;
  gl_FragColor = vec4( c0.rgb * ( 1.0 - e ) + tinta * e, c0.a * ( 1.0 - e ) + e );
}
`;

// FXAA 3.11, variante de consola (NVIDIA, Timothy Lottes), reducida a mano. Sobre el COMPUESTO ya
// codificado y premultiplicado, con la luminancia calculada como se VE: rgb + (1 - alfa) · fondo
// del tema, porque el lienzo va sobre el fondo de la página y el borde exterior del objeto es un
// borde de ALFA, no de color (un objeto oscuro sobre alfa 0 no tiene contraste de rgb). Los cuatro
// canales se filtran con los mismos pesos, así que el alfa se suaviza igual que el color.
//   · Sin contraste local (< umbral) no se toca el píxel: las superficies planas del toon quedan
//     intactas (el filtro no emborrona el interior de las caras, solo los bordes).
//   · Con contraste, se estima la dirección del borde por las lumas de las cuatro esquinas y se
//     promedian dos y cuatro muestras a lo largo de ella; si la de cuatro se sale del rango local
//     (cruzó otro borde), se usa la de dos.
const FXAA = /* glsl */`
uniform sampler2D tImagen;
uniform vec2 texel;
uniform vec3 fondo;
varying vec2 vUv;
#define UMBRAL 0.125
#define UMBRAL_MIN 0.0312
#define REDUCE_MIN ( 1.0 / 128.0 )
#define REDUCE_MUL ( 1.0 / 8.0 )
#define SPAN_MAX 8.0
float luma( vec4 c ) { return dot( c.rgb + ( 1.0 - c.a ) * fondo, vec3( 0.299, 0.587, 0.114 ) ); }
void main() {
  vec4 cM = texture2D( tImagen, vUv );
  float lNW = luma( texture2D( tImagen, vUv + texel * vec2( -1.0, -1.0 ) ) );
  float lNE = luma( texture2D( tImagen, vUv + texel * vec2( 1.0, -1.0 ) ) );
  float lSW = luma( texture2D( tImagen, vUv + texel * vec2( -1.0, 1.0 ) ) );
  float lSE = luma( texture2D( tImagen, vUv + texel * vec2( 1.0, 1.0 ) ) );
  float lM = luma( cM );
  float lMin = min( lM, min( min( lNW, lNE ), min( lSW, lSE ) ) );
  float lMax = max( lM, max( max( lNW, lNE ), max( lSW, lSE ) ) );
  if ( lMax - lMin < max( UMBRAL_MIN, lMax * UMBRAL ) ) { gl_FragColor = cM; return; }
  vec2 dir = vec2( -( ( lNW + lNE ) - ( lSW + lSE ) ), ( lNW + lSW ) - ( lNE + lSE ) );
  float reduce = max( ( lNW + lNE + lSW + lSE ) * ( 0.25 * REDUCE_MUL ), REDUCE_MIN );
  float rcp = 1.0 / ( min( abs( dir.x ), abs( dir.y ) ) + reduce );
  dir = clamp( dir * rcp, vec2( -SPAN_MAX ), vec2( SPAN_MAX ) ) * texel;
  vec4 a = 0.5 * ( texture2D( tImagen, vUv + dir * ( 1.0 / 3.0 - 0.5 ) ) + texture2D( tImagen, vUv + dir * ( 2.0 / 3.0 - 0.5 ) ) );
  vec4 b = a * 0.5 + 0.25 * ( texture2D( tImagen, vUv - dir * 0.5 ) + texture2D( tImagen, vUv + dir * 0.5 ) );
  float lB = luma( b );
  gl_FragColor = ( lB < lMin || lB > lMax ) ? a : b;
}
`;

// LA REDUCCIÓN: cuatro tomas bilineales a ±1/4 de píxel de LIENZO alrededor del centro de cada
// píxel. Con densidad doble el centro del píxel cae en la esquina común de cuatro texels, así que
// cada toma, desplazada medio texel, cae exactamente en el centro de uno de ellos: las cuatro son el
// bloque 2x2 entero, un filtro de caja exacto. Con otras densidades (1,5; 3) es una aproximación
// buena de lo mismo. Promediar valores premultiplicados es lo correcto para el alfa del lienzo.
const REDUCIR = /* glsl */`
uniform sampler2D tImagen;
uniform vec2 paso;
varying vec2 vUv;
void main() {
  gl_FragColor = 0.25 * (
    texture2D( tImagen, vUv + vec2( -paso.x, -paso.y ) ) + texture2D( tImagen, vUv + vec2( paso.x, -paso.y ) ) +
    texture2D( tImagen, vUv + vec2( -paso.x, paso.y ) ) + texture2D( tImagen, vUv + vec2( paso.x, paso.y ) ) );
}
`;

export interface Tinta {
  /** Pinta el fotograma ENTERO: escena -> g -> tinta -> (FXAA ->) lienzo. Sustituye a
   *  `render.render(escena, camara)`: la escena ya no se dibuja nunca directamente en el lienzo.
   *  `escala` es la escala APARENTE del objeto (zoom de la cámara por la escala del desvío, 1 en
   *  el reposo): la pluma se afina con su raíz cuando el dibujo es pequeño (PM.motor.tinta). */
  pintar(escena: Scene, camara: OrthographicCamera | PerspectiveCamera, escala?: number): void;
  /** Ajusta los targets. `densidad` son los píxeles de dibujo por píxel CSS de los targets; si no
   *  supera la del lienzo (render.getPixelRatio()) se dibuja a la del lienzo y suaviza el FXAA.
   *  Llamar tras setSize / setPixelRatio; también recalcula el radio de la cruz. */
  dimensionar(densidad?: number): void;
  /** Enciende o apaga la última pasada (el vigilante de fotogramas la apaga en el segundo peldaño). */
  fxaa(on: boolean): void;
  /** Color y fuerza de la tinta, y el fondo que ve el FXAA, por tema. `mezcla` es 0 en el oscuro y
   *  1 en el claro; los intermedios son el fundido de PM.motor.temaMs (lo lleva effects/motor3d.ts). */
  tema(mezcla: number): void;
  /** Cuánta tinta hay, de 0 a 1: el entintado del montaje (coreografia.ts, `estado.entinta`). */
  revelar(k: number): void;
  /** Los números del pase en caliente (solo desde ?debug: para MEDIR umbrales sin recompilar). Los
   *  que valen viven en PM.motor.tinta; esto no los cambia ahí. */
  ajustar(a: Partial<{ grosor: number; umbralProfundidad: number; umbralNormal: number; fuerza: number }>): void;
  estado(): { fxaa: boolean; reduce: boolean; densidad: number; ancho: number; alto: number; radio: number; grosor: number; umbralProfundidad: number; umbralNormal: number };
  liberar(): void;
}

export function crearTinta(render: WebGLRenderer, fxaaInicial: boolean): Tinta {
  const T = PM.motor.tinta;

  // Los targets. `g` es el MRT; `c` solo se usa mientras hay FXAA (si no, la tinta va al lienzo).
  const profundidad = new DepthTexture(1, 1);
  const g = new WebGLRenderTarget(1, 1, { count: 2, depthTexture: profundidad, depthBuffer: true, stencilBuffer: false });
  g.textures[0].name = 'tinta-color';
  g.textures[1].name = 'tinta-normal';
  for (const t of g.textures) { t.minFilter = LinearFilter; t.magFilter = LinearFilter; t.generateMipmaps = false; }
  const c = new WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
  c.texture.name = 'tinta-compuesto';
  c.texture.minFilter = LinearFilter;
  c.texture.magFilter = LinearFilter;
  c.texture.generateMipmaps = false;

  // UN triángulo que cubre el cuadro ((-1,-1) (3,-1) (-1,3) en clip), no un plano de dos: con un
  // plano la diagonal se rasteriza dos veces en el borde de los dos triángulos. La cámara no
  // interviene (el vértice escribe gl_Position directamente), así que sirve cualquiera.
  const triangulo = new BufferGeometry();
  triangulo.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  triangulo.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const camaraPlana = new Camera();

  const texel = new Vector2(1, 1);
  const matTinta = new ShaderMaterial({
    vertexShader: VERTICE,
    fragmentShader: TINTA,
    uniforms: {
      tColor: { value: g.textures[0] },
      tNormal: { value: g.textures[1] },
      tDepth: { value: profundidad },
      texel: { value: texel },
      radio: { value: 1 },
      cerca: { value: 1 },
      lejos: { value: 100 },
      perspectiva: { value: 0 },
      umbralZ: { value: T.umbralProfundidad },
      umbralN: { value: T.umbralNormal },
      tinta: { value: new Color() },
      fuerza: { value: T.fuerza },
      papel: { value: new Color().setHex(T.fondoClaro, LinearSRGBColorSpace).multiplyScalar(T.laminaTono) },
      lamina: { value: 0 },
      revela: { value: 1 },
    },
    blending: NoBlending, depthTest: false, depthWrite: false, transparent: false,
  });
  const matFxaa = new ShaderMaterial({
    vertexShader: VERTICE,
    fragmentShader: FXAA,
    uniforms: { tImagen: { value: c.texture }, texel: { value: texel }, fondo: { value: new Color() } },
    blending: NoBlending, depthTest: false, depthWrite: false, transparent: false,
  });
  const paso = new Vector2(1, 1);
  const matReducir = new ShaderMaterial({
    vertexShader: VERTICE,
    fragmentShader: REDUCIR,
    uniforms: { tImagen: { value: c.texture }, paso: { value: paso } },
    blending: NoBlending, depthTest: false, depthWrite: false, transparent: false,
  });
  const mallaReducir = new Mesh(triangulo, matReducir);
  mallaReducir.frustumCulled = false;
  const mallaTinta = new Mesh(triangulo, matTinta);
  const mallaFxaa = new Mesh(triangulo, matFxaa);
  mallaTinta.frustumCulled = false;
  mallaFxaa.frustumCulled = false;

  let conFxaa = fxaaInicial;
  // Densidad de los targets (px de dibujo por px CSS) y si hay reducción al lienzo. Hay reducción
  // solo si la densidad supera a la del lienzo en más de un 15 %: por debajo, el coste de las
  // pasadas extra no compra nada que se vea.
  let densidad = 1;
  let reduce = false;
  const tamCss = new Vector2();
  let grosor = T.grosor;
  let escalaAparente = 1;
  const tam = new Vector2();
  // Radio de la cruz en texels: grosor efectivo (px CSS) · dpr / 2, con el grosor afinado por la
  // raíz de la escala aparente y acotado por abajo (PM.motor.tinta.grosorMin y 0,6 texels: con
  // menos, las cuatro muestras caen en el texel del centro y no hay diferencia que detectar).
  function radio(): number {
    const g = Math.max(T.grosorMin, grosor * Math.sqrt(Math.max(0.01, escalaAparente)));
    return Math.max(0.6, (g * densidad) / 2);
  }
  // Los contadores de render.info se reinician en CADA render(): con tres por fotograma, `info`
  // solo contaba el triángulo de la última pasada. Se reinician aquí, una vez por fotograma, y así
  // `llamadas` y `triangulos` son los del fotograma entero (escena + pasadas de pantalla).
  render.info.autoReset = false;

  function dimensionar(pedida = 0): void {
    render.getSize(tamCss);
    render.getDrawingBufferSize(tam);
    const lienzo = render.getPixelRatio();
    // Tope por el tamaño máximo de textura de la GPU: un target mayor no da error, sale EN BLANCO
    // (visto en el renderizador por software de las pruebas, con 5760x3600). El presupuesto de
    // motor3d.ts ya lo evita en la práctica; esto es la red.
    const maxTex = render.capabilities.maxTextureSize || 4096;
    const tope = Math.min(maxTex / Math.max(1, tamCss.x), maxTex / Math.max(1, tamCss.y));
    const deseada = Math.min(pedida, tope);
    reduce = deseada > lienzo * 1.15;
    densidad = reduce ? deseada : lienzo;
    const w = reduce ? Math.max(1, Math.round(tamCss.x * densidad)) : Math.max(1, Math.floor(tam.x));
    const h = reduce ? Math.max(1, Math.round(tamCss.y * densidad)) : Math.max(1, Math.floor(tam.y));
    g.setSize(w, h);
    c.setSize(w, h);
    texel.set(1 / w, 1 / h);
    // Un cuarto de píxel de LIENZO, en coordenadas de textura (ver REDUCIR).
    paso.set(0.25 / Math.max(1, tam.x), 0.25 / Math.max(1, tam.y));
    // El grosor se pide en píxeles CSS y la cruz trabaja en texels de los targets: con muestras a
    // ±radio la línea mide ~2·radio texels, así que radio = grosor · densidad / 2.
    matTinta.uniforms.radio.value = radio();
  }

  function ajustar(a: Partial<{ grosor: number; umbralProfundidad: number; umbralNormal: number; fuerza: number }>): void {
    if (a.grosor !== undefined) { grosor = a.grosor; matTinta.uniforms.radio.value = radio(); }
    if (a.umbralProfundidad !== undefined) matTinta.uniforms.umbralZ.value = a.umbralProfundidad;
    if (a.umbralNormal !== undefined) matTinta.uniforms.umbralN.value = a.umbralNormal;
    if (a.fuerza !== undefined) matTinta.uniforms.fuerza.value = a.fuerza;
  }

  // Colores de trabajo del fundido de tema: se reutilizan en cada fotograma del cambio para no
  // crear basura en el bucle.
  const tintaOscura = new Color().setHex(M.paleta.linea, LinearSRGBColorSpace);
  const tintaClara = new Color().setHex(M.paleta.lineaClaro, LinearSRGBColorSpace);
  const fondoOscuro = new Color().setHex(T.fondo, LinearSRGBColorSpace);
  const fondoClaro = new Color().setHex(T.fondoClaro, LinearSRGBColorSpace);

  function tema(mezcla: number): void {
    // Sin conversión de espacio de color (LinearSRGBColorSpace = "déjalo como está"): el compositor
    // trabaja sobre la imagen ya codificada y estos son valores sRGB de 8 bits, no albedos. Por eso
    // la mezcla también se hace aquí y no en el espacio de trabajo de three.
    (matTinta.uniforms.tinta.value as Color).lerpColors(tintaOscura, tintaClara, mezcla);
    matTinta.uniforms.fuerza.value = T.fuerza + (T.fuerzaClaro - T.fuerza) * mezcla;
    matTinta.uniforms.lamina.value = T.lamina * mezcla;
    (matFxaa.uniforms.fondo.value as Color).lerpColors(fondoOscuro, fondoClaro, mezcla);
  }
  tema(0);

  function pintar(escena: Scene, camara: OrthographicCamera | PerspectiveCamera, escala = 1): void {
    render.info.reset();
    if (escala !== escalaAparente) { escalaAparente = escala; matTinta.uniforms.radio.value = radio(); }
    matTinta.uniforms.cerca.value = camara.near;
    matTinta.uniforms.lejos.value = camara.far;
    matTinta.uniforms.perspectiva.value = (camara as PerspectiveCamera).isPerspectiveCamera ? 1 : 0;
    render.setRenderTarget(g);
    render.render(escena, camara);
    if (reduce) {
      // escena -> g -> tinta -> c -> reducción -> lienzo. El FXAA sobra: la escalera ya no existe.
      render.setRenderTarget(c);
      render.render(mallaTinta, camaraPlana);
      render.setRenderTarget(null);
      render.render(mallaReducir, camaraPlana);
      return;
    }
    render.setRenderTarget(conFxaa ? c : null);
    render.render(mallaTinta, camaraPlana);
    if (conFxaa) {
      render.setRenderTarget(null);
      render.render(mallaFxaa, camaraPlana);
    }
  }

  function fxaa(on: boolean): void {
    conFxaa = on;
  }

  function liberar(): void {
    render.info.autoReset = true;
    g.dispose();
    c.dispose();
    profundidad.dispose();
    triangulo.dispose();
    matTinta.dispose();
    matFxaa.dispose();
    matReducir.dispose();
  }

  return {
    pintar, dimensionar, fxaa, tema, ajustar, liberar,
    revelar: (k: number) => { matTinta.uniforms.revela.value = k; },
    estado: () => ({
      fxaa: conFxaa && !reduce, reduce, densidad, ancho: g.width, alto: g.height, radio: matTinta.uniforms.radio.value as number, grosor,
      umbralProfundidad: matTinta.uniforms.umbralZ.value as number, umbralNormal: matTinta.uniforms.umbralN.value as number,
    }),
  };
}
