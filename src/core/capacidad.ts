import { P } from '../params';

// ¿Puede esta máquina con el motor 3D, y con cuánto?
// Este fichero vive en la ENTRADA (no en el trozo diferido): tiene que ser diminuto y no importar
// nada de Three. Son ~40 líneas de comprobaciones síncronas y baratas.

export type Calidad = 'alta' | 'media' | 'baja';

export interface Capacidad {
  /** Si es false, ni se pide el trozo 3D: se queda el escenario CSS. */
  usar3d: boolean;
  calidad: Calidad;
  tactil: boolean;
  /** Por qué se decidió lo que se decidió. Se ve con ?debug. */
  motivo: string;
}

interface NavegadorAmpliado extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}

// Three 0.185 pide 'webgl2' y nada más: su WebGLRenderer lanza si no lo consigue
// (three.module.js:16387 `const contextName = 'webgl2'` y el throw de la línea 16395).
// Por eso la sonda pregunta por webgl2 exactamente, no por 'webgl'.
//
// failIfMajorPerformanceCaveat: true descarta el rasterizado por software (SwiftShader, llvmpipe):
// ahí el contexto se crea pero 40 000 triángulos van a 5 fps. Es justo la máquina en la que
// preferimos el escenario CSS. Se pide solo en la sonda; el renderizador de verdad se crea sin él.
function sondarWebGL2(): { ok: boolean; maxTextura: number } {
  if (typeof WebGL2RenderingContext === 'undefined') return { ok: false, maxTextura: 0 };
  const lienzo = document.createElement('canvas');
  lienzo.width = 1;
  lienzo.height = 1;
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = lienzo.getContext('webgl2', {
      failIfMajorPerformanceCaveat: true,
      alpha: false, depth: false, stencil: false, antialias: false,
      powerPreference: 'low-power',
    });
  } catch {
    gl = null;
  }
  if (!gl) return { ok: false, maxTextura: 0 };
  const maxTextura = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  // Un contexto WebGL es un recurso escaso (los navegadores cortan sobre los 16). Se devuelve.
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  lienzo.width = 0;
  lienzo.height = 0;
  return { ok: true, maxTextura };
}

export function medirCapacidad(reduce: boolean): Capacidad {
  const nav = navigator as NavegadorAmpliado;
  const tactil = window.matchMedia('(pointer: coarse)').matches;
  const no = (motivo: string): Capacidad => ({ usar3d: false, calidad: 'baja', tactil, motivo });

  // 1) Señales que se leen sin tocar la GPU.
  if (reduce) return no('movimiento reducido');
  if (nav.connection?.saveData === true) return no('ahorro de datos');
  const nucleos = nav.hardwareConcurrency ?? 4;
  const memoria = nav.deviceMemory ?? 4; // solo Chromium; en el resto se supone suficiente
  if (nucleos <= P.motor.vetoNucleos) return no(`${nucleos} núcleos`);
  if (memoria <= P.motor.vetoMemoria) return no(`${memoria} GB`);

  // 2) La GPU, ya con contexto de prueba.
  const { ok, maxTextura } = sondarWebGL2();
  if (!ok) return no('sin WebGL 2');
  if (maxTextura < 4096) return no(`textura máx. ${maxTextura}`);

  const automatica: Calidad =
    tactil || nucleos < P.motor.minNucleos || memoria < P.motor.minMemoria ? 'baja'
    : nucleos >= P.motor.altaNucleos ? 'alta'
    : 'media';
  // ?calidad=alta|media|baja fuerza el nivel geométrico sin tocar los vetos. Es la única forma de
  // MEDIR el nivel alto (48 tubos, 128 segmentos) en una máquina cualquiera: es el camino por
  // defecto de casi todo el escritorio y, sin bandera, no se puede comprobar antes de publicar.
  const pedida = new URLSearchParams(location.search).get('calidad');
  const calidad: Calidad = pedida === 'alta' || pedida === 'media' || pedida === 'baja' ? pedida : automatica;
  return { usar3d: true, calidad, tactil, motivo: `${nucleos} núcleos, ${memoria} GB, ${tactil ? 'táctil' : 'ratón'}${pedida ? `, calidad forzada a ${calidad}` : ''}` };
}

// Cuántos píxeles se dibujan de verdad. Dos topes a la vez:
//   - la relación de píxeles del dispositivo, recortada (2 en sobremesa, 1,5 con puntero grueso);
//   - un presupuesto absoluto de píxeles, para que un monitor 4K no pida 33 millones.
// `relleno` es por cuánto se divide el presupuesto: desde la Vuelta 3 el fotograma no es UNA
// pasada de relleno sino dos o tres (la escena a un target de dos texturas, la tinta a pantalla
// completa y el FXAA; motor/tinta.ts), y el trozo diferido lo pasa por calidad (PM.motor.tinta.
// relleno). Los números del presupuesto (params.ts) siguen midiendo píxeles de LIENZO, que es lo
// que la Vuelta 2 midió; el divisor es lo que la tinta añade. En un teléfono manda antes el tope de
// dpr (390x664 a 1,5 son 0,58 MP, un cuarto del presupuesto táctil), así que el divisor solo
// recorta en pantallas táctiles grandes; en un teléfono lo que degrada es el vigilante (motor3d.ts).
export function escalaLienzo(ancho: number, alto: number, tactil: boolean, relleno = 1): number {
  const tope = tactil ? P.motor.dprMaxTactil : P.motor.dprMax;
  const dpr = Math.min(window.devicePixelRatio || 1, tope);
  const px = (tactil ? P.motor.presupuestoPxTactil : P.motor.presupuestoPx) / Math.max(1, relleno);
  const porPresupuesto = Math.sqrt(px / Math.max(1, ancho * alto));
  return Math.max(P.motor.dprMin, Math.min(dpr, porPresupuesto));
}
