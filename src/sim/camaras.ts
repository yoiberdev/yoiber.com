import { Escena, envolver, escribir, estado, teclear, tramos, type OpcionesSim, type Sim } from './motor';
import './camaras.css';

// LA SALA DE CONTROL — simulación del sistema de vídeo desde barcos (caso videovigilancia marítima)
// ================================================================================================
// La pantalla real es del cliente y no se enseña: esto es una sala de control DIBUJADA, con una
// flota inventada, que cuenta lo que el caso explica con protocolos. Cada gesto sale del código del
// sistema (ver casos/videovigilancia-maritima/): el vídeo va por SRT sobre un enlace que se degrada y
// se cae, lo que no sale espera en una cola SQLite a bordo y las órdenes van aparte por MQTT, con un
// tema por dispositivo y cámara. Una vuelta de 30 s en seis pasos.

const D = 30000;

const PASOS = [
  { t: 400, texto: 'Elige la embarcación en el mapa' },
  { t: 3000, texto: 'Vídeo en directo por SRT, a 178 km de la costa' },
  { t: 8600, texto: 'Si el enlace empeora, baja la calidad; la sesión sigue' },
  { t: 12600, texto: 'Sin cobertura: todo espera en una cola a bordo' },
  { t: 17600, texto: 'Vuelve la señal y la cola se vacía sola' },
  { t: 21400, texto: 'Las órdenes van aparte, por MQTT' },
];

// Las fases del enlace de la E-03 (clase en .cc): la línea del mapa, el anillo y las barras.
const FASES: [number, number, string][] = [
  [2300, 9400, 'bien'],
  [9400, 12500, 'mal'],
  [12500, 17600, 'caido'],
  [17600, 28800, 'bien'],
];

// La costa y las isobatas se generan: son curvas propias, no calcos de ningún mapa.
function costa(y: number): number {
  return 58 + 24 * Math.sin(y / 61) + 11 * Math.sin(y / 17 + 1.3);
}
function trazoCosta(): string {
  let d = 'M0 -10';
  for (let y = -10; y <= 600; y += 10) d += ` L${costa(y).toFixed(1)} ${y}`;
  return `${d} L0 600 Z`;
}
function isobata(k: number): string {
  let d = '';
  for (let y = -10; y <= 600; y += 12) {
    const x = costa(y) + 70 + k * 92 + 16 * Math.sin(y / 73 + k * 1.7) + 8 * Math.sin(y / 29 + k);
    d += `${d ? ' L' : 'M'}${x.toFixed(1)} ${y}`;
  }
  return d;
}

const BARCOS = [
  { id: 'E-01', x: 190, y: 150, rumbo: 30 },
  { id: 'E-02', x: 250, y: 430, rumbo: 160 },
  { id: 'E-03', x: 470, y: 262, rumbo: 70 },
  { id: 'E-04', x: 345, y: 92, rumbo: 300 },
  { id: 'E-05', x: 392, y: 486, rumbo: 210 },
];
const PUERTO = { x: costa(318) + 8, y: 318 };
const SATELITE = { x: 548, y: 44 };

function plantilla(): string {
  const barcos = BARCOS.map((b) => `
        <g class="cc-barco${b.id === 'E-03' ? ' cc-e03' : ''}" transform="translate(${b.x} ${b.y})">
          ${b.id === 'E-03' ? '<circle class="cc-anillo" r="17" /><circle class="cc-latido" r="17" />' : ''}
          <path class="cc-casco" transform="rotate(${b.rumbo})" d="M0 -9 L5.5 6 L0 3.2 L-5.5 6 Z" />
          <text class="cc-id" x="11" y="4">${b.id}</text>
          ${b.id === 'E-03' ? '<g class="cc-barras" transform="translate(40 -6)"><rect x="0" y="7" width="2.6" height="3" /><rect x="4" y="5" width="2.6" height="5" /><rect x="8" y="3" width="2.6" height="7" /><rect x="12" y="0" width="2.6" height="10" /></g>' : ''}
        </g>`).join('');
  const e3 = BARCOS[2];
  const olas = Array.from({ length: 6 }, (_, k) => {
    const y = 14 + k * 11;
    let d = `M0 ${y}`;
    for (let x = 0; x <= 400; x += 25) d += ` Q${x + 12.5} ${y - 3 - k * 0.4} ${x + 25} ${y}`;
    return `<path d="${d}" />`;
  }).join('');
  const bloques = Array.from({ length: 16 * 9 }, (_, i) => {
    const x = (i % 16) * 10;
    const y = Math.floor(i / 16) * 10;
    const v = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    return `<rect x="${x}" y="${y}" width="10" height="10" opacity="${(0.25 + Math.abs(v) * 0.6).toFixed(2)}" />`;
  }).join('');
  return `
  <div class="sim-camara">
    <div class="cc">
      <header class="cc-barra">
        <span class="cc-marca"><i></i>Centro de control</span>
        <span class="cc-chip">Flota <b>5</b></span>
        <span class="cc-chip">En línea <b class="cc-enlinea">5</b></span>
        <span class="cc-reloj">05:41</span>
      </header>
      <div class="cc-mapa">
        <svg viewBox="0 0 600 581" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <radialGradient id="cc-mar" cx="0.75" cy="0.45" r="0.9">
              <stop offset="0" stop-color="#10213a" /><stop offset="1" stop-color="#0a1424" />
            </radialGradient>
          </defs>
          <rect width="600" height="581" fill="url(#cc-mar)" />
          <g class="cc-reticula">${[100, 200, 300, 400, 500].map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="581" />`).join('')}${[100, 200, 300, 400, 500].map((y) => `<line x1="0" y1="${y}" x2="600" y2="${y}" />`).join('')}</g>
          <g class="cc-isobatas">${[0, 1, 2, 3, 4].map((k) => `<path d="${isobata(k)}" />`).join('')}</g>
          <path class="cc-tierra" d="${trazoCosta()}" />
          <g class="cc-puerto" transform="translate(${PUERTO.x.toFixed(1)} ${PUERTO.y})"><circle r="4.5" /><text x="10" y="4">Puerto</text></g>
          <g class="cc-sat" transform="translate(${SATELITE.x} ${SATELITE.y})"><rect x="-4" y="-4" width="8" height="8" rx="1.5" /><rect x="-17" y="-2.5" width="10" height="5" /><rect x="7" y="-2.5" width="10" height="5" /><text x="0" y="20" text-anchor="middle">Satélite</text></g>
          <path class="cc-enlace" d="M${e3.x} ${e3.y} L${SATELITE.x} ${SATELITE.y + 8} L${PUERTO.x.toFixed(1)} ${PUERTO.y}" />
          <text class="cc-km" x="${(e3.x + PUERTO.x) / 2 - 12}" y="${PUERTO.y + 22}">178 km</text>
          ${barcos}
          <g class="cc-escala" transform="translate(470 548)"><line x1="0" y1="0" x2="80" y2="0" /><line x1="0" y1="-4" x2="0" y2="4" /><line x1="80" y1="-4" x2="80" y2="4" /><text x="40" y="-8" text-anchor="middle">50 km</text></g>
        </svg>
      </div>
      <aside class="cc-panel">
        <p class="cc-vacio"><i></i>Elige una embarcación en el mapa</p>
        <div class="cc-ficha">
          <div class="cc-cab"><b>E-03</b><span class="cc-pill">Faenando</span><span class="cc-lejos">178 km de la costa</span></div>
          <div class="cc-video">
            <div class="cc-escena">
              <div class="cc-cielo"></div>
              <div class="cc-mar"><svg class="cc-olas" viewBox="0 0 400 80" preserveAspectRatio="none">${olas}</svg></div>
            </div>
            <svg class="cc-borda" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 70 L160 64 L160 90 L0 90 Z" /><path class="cc-baranda" d="M0 58 L160 52 M8 58 V71 M40 57 V69 M72 56 V68 M104 55 V67 M136 54 V65" />
            </svg>
            <svg class="cc-bloques" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true">${bloques}</svg>
            <div class="cc-flash"></div>
            <div class="cc-sinsenal"><i></i><span>Sin señal · la sesión sigue abierta</span></div>
            <span class="cc-vivo">EN VIVO</span>
            <span class="cc-hora">CAM 1 · <b>05:41:00</b></span>
          </div>
          <dl class="cc-datos">
            <div><dt>SRT</dt><dd><b class="cc-mbps">2,1</b> Mb/s</dd></div>
            <div><dt>Pérdida</dt><dd><b class="cc-perdida">3</b> %</dd></div>
            <div><dt>Latencia</dt><dd><b class="cc-lat">820</b> ms</dd></div>
          </dl>
          <div class="cc-cola">
            <p class="cc-tit">Cola a bordo <span>SQLite</span><b class="cc-cola-n">0</b></p>
            <ol>
              <li><time>05:42:10</time> captura · CAM 1</li>
              <li><time>05:42:31</time> evento · movimiento en cubierta</li>
              <li><time>05:43:02</time> captura · CAM 2</li>
              <li><time>05:43:40</time> telemetría · posición</li>
            </ol>
          </div>
          <div class="cc-mqtt">
            <p class="cc-tit">Control <span>MQTT</span><span class="cc-boton">Captura</span></p>
            <p class="cc-log"><span class="cc-log1"></span><i class="cc-cursor"></i></p>
            <p class="cc-log cc-log2">← recibido · 212 ms</p>
            <span class="cc-fotos"><i></i><i></i><i class="cc-nueva"></i></span>
          </div>
        </div>
      </aside>
    </div>
  </div>`;
}

export function montarCamaras(raiz: HTMLElement, opciones: OpcionesSim): Sim {
  raiz.classList.add('sim', 'sim-camaras');
  raiz.innerHTML = plantilla();
  const $ = <T extends Element = HTMLElement>(s: string): T => raiz.querySelector<T>(s)!;
  const $$ = (s: string): HTMLElement[] => Array.from(raiz.querySelectorAll<HTMLElement>(s));
  const escena = new Escena(raiz, D, { inicio: { x: 44, y: 88 } });
  const { tl } = escena;
  const cc = $('.cc');
  const e03 = $<SVGGElement>('.cc-e03 .cc-casco');
  const ficha = $('.cc-ficha');
  const vacio = $('.cc-vacio');
  const anillo = $$('.cc-anillo, .cc-latido, .cc-barras');
  const enlace = $$('.cc-enlace, .cc-km');
  const video = $('.cc-video');
  const bloques = $('.cc-bloques');
  const sinsenal = $('.cc-sinsenal');
  const flash = $('.cc-flash');
  const cola = $('.cc-cola');
  const filas = $$('.cc-cola li');
  const mqtt = $('.cc-mqtt');
  const boton = $('.cc-boton');
  const log2 = $('.cc-log2');
  const nueva = $('.cc-nueva');

  escena.guion(PASOS, 28600);

  // 1 · Elegir la E-03.
  escena.ir(e03, 1000, 1100).clic(2250);
  tl.set(anillo, { opacity: 0 }, 0)
    .add(anillo, { opacity: [0, 1], duration: 400, ease: 'out(2)' }, 2300)
    .add(anillo, { opacity: [1, 0], duration: 500 }, 28800)
    .set(enlace, { opacity: 0 }, 0)
    .add(enlace, { opacity: [0, 1], duration: 600, ease: 'out(2)' }, 2600)
    .add(enlace, { opacity: [1, 0], duration: 500 }, 28800)
    .set(vacio, { opacity: 1 }, 0)
    .add(vacio, { opacity: [1, 0], duration: 300 }, 2450)
    .add(vacio, { opacity: [0, 1], duration: 500 }, 29300)
    .set(ficha, { opacity: 0, y: '1em' }, 0)
    .add(ficha, { opacity: [0, 1], y: ['1em', '0em'], duration: 600, ease: 'out(3)' }, 2600)
    .add(ficha, { opacity: [1, 0], y: ['0em', '0em'], duration: 500 }, 28800);

  // 2 · El vídeo, de cerca.
  let cam = escena.enfocar(video, 1.7, 4200, 1100);
  cam = escena.enfocar(null, 1, 7300, 1000, cam);

  // 3 y 4 · Se degrada y se cae: bloques, imagen congelada.
  tl.set([bloques, sinsenal, flash], { opacity: 0 }, 0)
    .add(bloques, { opacity: [0, 0.85], duration: 3000, ease: 'in(2)' }, 9200)
    .add(sinsenal, { opacity: [0, 1], duration: 350 }, 12500)
    .add(sinsenal, { opacity: [1, 0], duration: 400 }, 17600)
    .add(bloques, { opacity: [0.85, 0], duration: 1200, ease: 'out(2)' }, 17800);
  tl.set(filas, { opacity: 0, x: '-0.6em' }, 0);
  filas.forEach((f, i) => {
    tl.add(f, { opacity: [0, 1], x: ['-0.6em', '0em'], duration: 380, ease: 'out(3)' }, 12900 + i * 950)
      .add(f, { opacity: [1, 0], x: ['0em', '0.8em'], duration: 320, ease: 'in(2)' }, 18000 + i * 480);
  });
  cam = escena.enfocar(cola, 1.6, 13000, 950, cam);
  cam = escena.enfocar(null, 1, 16800, 950, cam);

  // 6 · Una orden por MQTT: captura.
  cam = escena.enfocar(mqtt, 1.35, 21700, 950, cam);
  escena.ir(boton, 21700, 1000).clic(22750);
  tl.add(flash, { opacity: [0.75, 0], duration: 500, ease: 'out(2)' }, 23000)
    .set([log2, nueva], { opacity: 0 }, 0)
    .add(log2, { opacity: [0, 1], duration: 300 }, 24300)
    .add(nueva, { opacity: [0, 1], scale: [0.3, 1], duration: 500, ease: 'outBack(2)' }, 24500)
    .add([log2, nueva], { opacity: [1, 0], duration: 500 }, 28800);
  escena.enfocar(null, 1, 26300, 1000, cam);
  escena.ir({ x: 44, y: 88 }, 27400, 1100);

  // Lo discreto: reloj, cifras del enlace, cola, barras y lo tecleado.
  const reloj = $('.cc-reloj');
  const hora = $('.cc-hora b');
  const mbps = $('.cc-mbps');
  const perdida = $('.cc-perdida');
  const lat = $('.cc-lat');
  const colaN = $('.cc-cola-n');
  const enLinea = $('.cc-enlinea');
  const log1 = $('.cc-log1');
  const barras = $$('.cc-barras rect');
  const dos = (n: number): string => String(Math.floor(n)).padStart(2, '0');
  escena.alPintar((t) => {
    const s = 41 * 60 + t / 1000;
    escribir(reloj, `05:${dos(s / 60)}`);
    escribir(hora, `05:${dos(s / 60)}:${dos(s % 60)}`);
    const m = tramos(t, [[9000, 2.1], [12300, 0.5], [12500, 0], [17600, 0], [18800, 1.3], [20200, 2.1]]);
    escribir(mbps, m.toFixed(1).replace('.', ','));
    escribir(perdida, String(Math.round(tramos(t, [[9000, 3], [12300, 21], [12500, 100], [17600, 100], [18400, 9], [20200, 3]]))));
    const l = tramos(t, [[9000, 820], [12300, 2400], [17600, 2400], [18800, 1100], [20200, 820]]);
    escribir(lat, t >= 12500 && t < 17600 ? '—' : String(Math.round(l)));
    escribir(colaN, String(Math.round(tramos(t, [[12600, 0], [16700, 14], [18000, 14], [20100, 0]]))));
    escribir(enLinea, t >= 12500 && t < 17600 ? '4' : '5');
    const nb = t < 9400 || t >= 18400 ? 4 : t < 11000 ? 2 : t < 12500 ? 1 : t < 17600 ? 0 : 2;
    barras.forEach((b, k) => b.classList.toggle('on', k < nb));
    estado(cc, t, FASES, ['bien', 'mal', 'caido']);
    cc.classList.toggle('elegida', t >= 2300 && t < 28800);
    teclear(log1, '→ device/e03/camera/1/snapshot', t < 28800 ? t : 0, 22900, 24000);
    boton.classList.toggle('pulsado', t >= 22750 && t < 23100);
    cc.classList.toggle('tecleando', t >= 22800 && t < 24300);
  });

  // Quieta (movimiento reducido): el enlace ya degradado, con la E-03 elegida y el plano entero.
  return envolver(escena, opciones, 12300);
}
