import { Escena, envolver, escribir, estado, teclear, tramos, type OpcionesSim, type Sim } from './motor';
import './automatizaciones.css';

// EL ESCRITORIO DE LAS AUTOMATIZACIONES — simulación de Citas (producto de Kip-Up)
// ================================================================================================
// Lo que hacen los flujos de verdad, en tres pantallas a la vez: el teléfono del cliente (la reserva
// y los correos que le llegan), la agenda del negocio en Google Calendar y el grupo de Telegram
// del negocio; en medio, el flujo de n8n que lo mueve todo. Un reloj salta los días: la reserva el
// viernes, el recordatorio el lunes, el resumen y la reseña el martes. Datos inventados (una clínica
// de demostración); los canales son los que usan los flujos hoy: correo al cliente, Telegram al
// negocio. Una vuelta de 30 s en seis pasos.

const D = 30000;

const PASOS = [
  { t: 400, texto: 'El cliente elige día y hora desde el móvil' },
  { t: 4200, texto: 'Solo ve horas libres: salen del calendario real' },
  { t: 10200, texto: 'Reserva, y la cita entra en el calendario' },
  { t: 13400, texto: 'El negocio se entera al momento, por Telegram' },
  { t: 16800, texto: 'Un día antes, el recordatorio por correo' },
  { t: 20600, texto: 'Cada mañana, el resumen; y después, la reseña' },
];

const NODOS = ['Reserva', 'Horas libres', 'Calendar', 'Aviso', 'Recordatorio', 'Reseña'];
// Cuándo se enciende cada nodo del flujo (y se apaga todo al cerrar la vuelta).
const ENCIENDE = [2400, 3300, 11600, 13800, 17400, 24100];
const RELOJ: [number, number, string][] = [
  [16300, 20300, 'Lun 12 · 10:00'],
  [20300, 23400, 'Mar 13 · 07:30'],
  [23400, 28800, 'Mar 13 · 11:30'],
];

function plantilla(): string {
  const dias = ['Lun 12', 'Mar 13', 'Mié 14', 'Jue 15'];
  const horas = ['09:00', '10:00', '10:30', '11:30', '12:00', '12:30'];
  // La agenda: columnas Lun..Vie, filas de 09:00 a 13:00 (media hora = 1 unidad de alto).
  const citas = [
    { d: 0, h: 0, l: 2, n: 'Carlos R.' },
    { d: 1, h: 1, l: 1, n: 'Lucía P.', ocupa: true },
    { d: 1, h: 4, l: 1, n: 'Jorge M.', ocupa: true },
    { d: 2, h: 2, l: 2, n: 'Rosa T.' },
    { d: 3, h: 6, l: 1, n: 'Pedro S.' },
    { d: 4, h: 3, l: 2, n: 'Elena V.' },
  ];
  const bloque = (c: { d: number; h: number; l: number; n: string; ocupa?: boolean }, extra = ''): string =>
    `<span class="au-evento${c.ocupa ? ' ocupa' : ''}${extra}" style="--d:${c.d};--h:${c.h};--l:${c.l}">${c.n}</span>`;
  return `
  <div class="sim-camara">
    <div class="au">
      <div class="au-tel">
        <div class="au-pantalla">
          <div class="au-reserva">
            <p class="au-barra"><span>16:20</span><i></i></p>
            <p class="au-ceja">Clínica Dental Demo</p>
            <p class="au-titulo">Reserva tu cita</p>
            <p class="au-rot">Servicio</p>
            <p class="au-select">Limpieza dental</p>
            <p class="au-rot">Día</p>
            <p class="au-dias">${dias.map((d, i) => `<span class="au-dia" data-i="${i}">${d.replace(' ', '<b>')}</b></span>`).join('')}</p>
            <p class="au-rot">Hora <span class="au-libres">libres</span></p>
            <p class="au-horas"><span class="au-elige">Elige un día</span>${horas.map((h, i) => `<span class="au-hora" data-i="${i}">${h}</span>`).join('')}</p>
            <p class="au-rot">Nombre</p>
            <p class="au-campo"><span class="au-nombre"></span><i class="au-cursor"></i></p>
            <p class="au-reservar">Reservar</p>
            <p class="au-nota">Te llegará la confirmación por correo.</p>
          </div>
          <div class="au-listo">
            <span class="au-tic"><svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17 L19 7.5" /></svg></span>
            <p class="au-titulo">¡Listo, Ana!</p>
            <p>Te esperamos el <b>martes 13 a las 10:00</b>.</p>
            <p class="au-suave">Te enviamos la confirmación al correo.</p>
          </div>
          <div class="au-bloqueo">
            <p class="au-bl-hora">10:00</p>
            <p class="au-bl-fecha">lunes 12</p>
            <div class="au-aviso au-aviso1">
              <p class="au-av-app"><i></i>Correo · Clínica Dental Demo<span>ahora</span></p>
              <p class="au-av-tit">Recordatorio de tu cita</p>
              <p>Mañana martes 13 a las 10:00. Te esperamos.</p>
            </div>
            <div class="au-aviso au-aviso2">
              <p class="au-av-app"><i></i>Correo · Clínica Dental Demo<span>ahora</span></p>
              <p class="au-av-tit">¿Qué tal tu cita, Ana?</p>
              <p>Tu opinión ayuda a otros pacientes.</p>
              <p class="au-estrellas">${'<i></i>'.repeat(5)}</p>
            </div>
          </div>
        </div>
      </div>

      <section class="au-cal">
        <p class="au-cab"><span class="au-g"></span>Agenda del negocio<span class="au-reloj">Vie 9 · 16:20</span></p>
        <div class="au-rejilla">
          <p class="au-cols"><span></span>${['Lun 12', 'Mar 13', 'Mié 14', 'Jue 15', 'Vie 16'].map((d) => `<span>${d}</span>`).join('')}</p>
          <div class="au-cuerpo">
            <p class="au-filas">${['09:00', '10:00', '11:00', '12:00'].map((h) => `<span>${h}</span>`).join('')}</p>
            <div class="au-eventos">${citas.map((c) => bloque(c)).join('')}${bloque({ d: 1, h: 2, l: 1, n: 'Ana Torres · Limpieza' }, ' nueva')}</div>
          </div>
        </div>
      </section>

      <section class="au-flujo">
        <p class="au-cab">Flujo <span>n8n</span></p>
        <div class="au-pista">
          <span class="au-linea"></span>
          ${NODOS.map((n) => `<span class="au-nodo"><i></i><b>${n}</b></span>`).join('')}
          <span class="au-bola"></span>
        </div>
      </section>

      <section class="au-tg">
        <p class="au-tg-cab"><i></i><span><b>Avisos · Clínica</b><small>Telegram · bot</small></span></p>
        <div class="au-chat">
          <div class="au-msj au-msj0">
            <b>Nueva cita</b>
            <span>Pedro S. · Control</span>
            <span>jue 15 · 12:00</span>
            <small>Reservó desde la web · 15:02</small>
          </div>
          <div class="au-msj au-msj1">
            <b>Nueva cita</b>
            <span>Ana Torres · Limpieza dental</span>
            <span>mar 13 · 10:00</span>
            <small>Reservó desde la web · 16:20</small>
          </div>
          <div class="au-msj au-msj2">
            <b>Resumen de hoy · mar 13</b>
            <span>6 citas · la primera a las 09:00</span>
            <span>10:00 Ana Torres · Limpieza</span>
            <small>07:30</small>
          </div>
        </div>
      </section>
      <svg class="au-cables" viewBox="0 0 1000 625" preserveAspectRatio="none" aria-hidden="true">
        <path d="M306 450 C323 450 323 424 340 424" /><path d="M700 424 L724 424" /><path d="M520 344 L520 360" />
      </svg>
      <span class="au-pulso au-pulso1"></span>
      <span class="au-pulso au-pulso2"></span>
    </div>
  </div>`;
}

export function montarAutomatizaciones(raiz: HTMLElement, opciones: OpcionesSim): Sim {
  raiz.classList.add('sim', 'sim-auto');
  raiz.innerHTML = plantilla();
  const $ = (s: string): HTMLElement => raiz.querySelector<HTMLElement>(s)!;
  const $$ = (s: string): HTMLElement[] => Array.from(raiz.querySelectorAll<HTMLElement>(s));
  const inicio = { x: 17.5, y: 97 };
  const escena = new Escena(raiz, D, { inicio, tactil: true });
  const { tl } = escena;
  const au = $('.au');
  const dia = $('.au-dia[data-i="1"]');
  const horas = $$('.au-hora');
  const hora10 = $('.au-hora[data-i="1"]');
  const campo = $('.au-campo');
  const reservar = $('.au-reservar');
  const reserva = $('.au-reserva');
  const listo = $('.au-listo');
  const bloqueo = $('.au-bloqueo');
  const aviso1 = $('.au-aviso1');
  const aviso2 = $('.au-aviso2');
  const nueva = $('.au-evento.nueva');
  const msj1 = $('.au-msj1');
  const msj2 = $('.au-msj2');
  const reloj = $('.au-reloj');
  const pulso1 = $('.au-pulso1');
  const pulso2 = $('.au-pulso2');

  escena.guion(PASOS, 28600);

  // 1 · Día y 2 · horas libres.
  escena.ir(dia, 1100, 1000).clic(2250);
  tl.set(horas, { opacity: 0, y: '0.5em' }, 0);
  horas.forEach((h, i) => {
    tl.add(h, { opacity: [0, 1], y: ['0.5em', '0em'], duration: 340, ease: 'out(3)' }, 3900 + i * 110)
      .add(h, { opacity: [1, 0], y: ['0em', '0em'], duration: 200 }, 28900);
  });
  escena.ir(hora10, 5600, 900).clic(6600);
  escena.ir(campo, 7200, 800).clic(8100);
  escena.ir(reservar, 9700, 700).clic(10500);

  // 3 · Pantallas del teléfono y la cita en la agenda.
  tl.set(reserva, { opacity: 1 }, 0)
    .add(reserva, { opacity: [1, 0], duration: 300 }, 10850)
    .add(reserva, { opacity: [0, 1], duration: 500 }, 29300)
    .set(listo, { opacity: 0, scale: 0.96 }, 0)
    .add(listo, { opacity: [0, 1], scale: [0.96, 1], duration: 420, ease: 'out(3)' }, 10950)
    .add(listo, { opacity: [1, 0], scale: [1, 1], duration: 400 }, 16400)
    .set(bloqueo, { opacity: 0 }, 0)
    .add(bloqueo, { opacity: [0, 1], duration: 500 }, 16450)
    .add(bloqueo, { opacity: [1, 0], duration: 500 }, 28800)
    .set(nueva, { opacity: 0, y: '-1.2em' }, 0)
    .add(nueva, { opacity: [0, 1], y: ['-1.2em', '0em'], duration: 600, ease: 'outBack(2)' }, 11500)
    .add(nueva, { opacity: [1, 0], y: ['0em', '0em'], duration: 500 }, 28800);

  // 4 · El aviso al negocio; 5 · el recordatorio; 6 · el resumen y la reseña.
  tl.set([msj1, msj2], { opacity: 0, y: '0.8em' }, 0)
    .add(msj1, { opacity: [0, 1], y: ['0.8em', '0em'], duration: 450, ease: 'out(3)' }, 13950)
    .add(msj2, { opacity: [0, 1], y: ['0.8em', '0em'], duration: 450, ease: 'out(3)' }, 20950)
    .add([msj1, msj2], { opacity: [1, 0], y: ['0em', '0em'], duration: 500 }, 28800)
    .set([aviso1, aviso2], { opacity: 0, y: '-1em' }, 0)
    .add(aviso1, { opacity: [0, 1], y: ['-1em', '0em'], duration: 500, ease: 'out(3)' }, 17500)
    .add(aviso2, { opacity: [0, 1], y: ['-1em', '0em'], duration: 500, ease: 'out(3)' }, 24300);
  // Los pulsos por los cables: del teléfono al flujo al reservar, y del flujo a Telegram al avisar.
  const p1a = { x: 30.6, y: 72 };
  const p1b = { x: 34, y: 67.8 };
  const p2a = { x: 70, y: 67.8 };
  const p2b = { x: 72.4, y: 67.8 };
  tl.set([pulso1, pulso2], { opacity: 0 }, 0)
    .set(pulso1, { left: `${p1a.x}%`, top: `${p1a.y}%` }, 0)
    .add(pulso1, { left: [`${p1a.x}%`, `${p1b.x}%`], top: [`${p1a.y}%`, `${p1b.y}%`], opacity: [1, 0], duration: 450, ease: 'in(2)' }, 2300)
    .add(pulso1, { left: [`${p1a.x}%`, `${p1b.x}%`], top: [`${p1a.y}%`, `${p1b.y}%`], opacity: [1, 0], duration: 450, ease: 'in(2)' }, 10600)
    .set(pulso2, { left: `${p2a.x}%`, top: `${p2a.y}%` }, 0)
    .add(pulso2, { left: [`${p2a.x}%`, `${p2b.x}%`], opacity: [1, 0], duration: 400, ease: 'in(2)' }, 13700)
    .add(pulso2, { left: [`${p2a.x}%`, `${p2b.x}%`], opacity: [1, 0], duration: 400, ease: 'in(2)' }, 20700);
  tl.add(reloj, { scale: [0.8, 1], duration: 380, ease: 'outBack(2)' }, 16300)
    .add(reloj, { scale: [0.8, 1], duration: 380, ease: 'outBack(2)' }, 20300)
    .add(reloj, { scale: [0.8, 1], duration: 380, ease: 'outBack(2)' }, 23400);
  escena.ir(inicio, 27300, 1000);

  // Lo discreto.
  const nombre = $('.au-nombre');
  const blHora = $('.au-bl-hora');
  const blFecha = $('.au-bl-fecha');
  const nodos = $$('.au-nodo');
  const bola = $('.au-bola');
  const estrellas = $$('.au-estrellas i');
  const centros = NODOS.map((_, i) => ((i + 0.5) / NODOS.length) * 100);
  escena.alPintar((t) => {
    const vivo = t < 28800;
    dia.classList.toggle('elegido', vivo && t >= 2250);
    au.classList.toggle('con-horas', vivo && t >= 3800);
    hora10.classList.toggle('elegida', vivo && t >= 6600);
    campo.classList.toggle('foco', t >= 8100 && t < 9900);
    teclear(nombre, 'Ana Torres', vivo ? t : 0, 8300, 9500);
    reservar.classList.toggle('pulsado', t >= 10500 && t < 10850);
    au.classList.toggle('mira-agenda', t >= 3300 && t < 6200);
    escribir(reloj, RELOJ.find(([a, b]) => t >= a && t < b)?.[2] ?? 'Vie 9 · 16:20');
    escribir(blHora, t < 20300 ? '10:00' : t < 23400 ? '07:30' : '11:30');
    escribir(blFecha, t < 20300 ? 'lunes 12' : 'martes 13');
    nodos.forEach((n, i) => n.classList.toggle('hecho', vivo && t >= ENCIENDE[i]));
    estado(au, t, [[20700, 21500, 'repite-aviso']], ['repite-aviso']);
    const x = tramos(t, [[2400, centros[0]], [2600, centros[0]], [3300, centros[1]], [11000, centros[1]], [11600, centros[2]], [13200, centros[2]], [13800, centros[3]], [16800, centros[3]], [17400, centros[4]], [23500, centros[4]], [24100, centros[5]]]);
    bola.style.left = `${vivo ? x : centros[0]}%`;
    bola.classList.toggle('encendida', vivo && t >= 2400);
    const n = vivo ? Math.round(tramos(t, [[24900, 0], [26100, 5]])) : 0;
    estrellas.forEach((e, k) => e.classList.toggle('on', k < n));
  });

  return envolver(escena, opciones, 14800);
}
