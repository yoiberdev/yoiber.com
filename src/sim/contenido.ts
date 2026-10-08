import '@fontsource-variable/instrument-sans';
import '@fontsource/anton/latin-400.css';
import monogramaOscuro from './marcas/kipup-monograma-oscuro.svg?raw';
import { Escena, envolver, escribir, estado, teclear, type OpcionesSim, type Sim } from './motor';
import './contenido.css';

// KIP-UP CONTENIDO POR DENTRO — del vídeo a la venta, en el panel del equipo
// ================================================================================================
// RECREACIÓN del panel real (kip-up-agency/contenido, apps/app, 27/09/2026): la entrada con «Del
// vídeo a la venta», la barra lateral navy, el taller con la pieza y su lista de revisión, la bandeja
// con la ventana de 48 horas de TikTok, la ficha del interesado con su origen y el tablero del mes. Con
// el kit de Kip-Up que usa el producto: Instrument Sans y Anton para las cifras grandes. Datos de
// ejemplo: la misma cevichería inventada de la simulación de Comandas (un negocio puede tener los dos
// productos) y una persona que escribe por el anuncio del combo familiar. Una vuelta de 40 s en seis
// pasos, que siguen la cadena del producto: pieza → mensaje → interesado → venta → número del mes.

const D = 40000;

const PASOS = [
  { t: 400, texto: 'Entra el equipo que lleva el TikTok del negocio' },
  { t: 5400, texto: 'Cada vídeo nace en el taller con su código; lo aprueba el dueño' },
  { t: 11200, texto: 'Alguien escribe por ese anuncio: se sabe qué vídeo lo trajo' },
  { t: 14000, texto: 'Se contesta a tiempo, dentro de la ventana de TikTok' },
  { t: 19600, texto: 'Un toque y es un interesado; la cita y la venta, con otro' },
  { t: 28400, texto: 'Al mes, lo que vendió cada vídeo, en soles' },
];

// Iconos de línea propios, 24x24 (los mismos gestos que los del panel).
const ICO: Record<string, string> = {
  inicio: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />',
  bandeja: '<path d="M4 5h16v11H9l-5 4z M8 9h8 M8 12h5" />',
  persona: '<circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.8 3.6-5.8 7-5.8s6.2 2 7 5.8" />',
  taller: '<path d="M4 6h16v13H4z M4 10h16 M8 3v4 M16 3v4" />',
  tablero: '<path d="M5 20V11 M10 20V6 M15 20v-6 M20 20H3" />',
  salir: '<path d="M14 5h5v14h-5 M10 8l-4 4 4 4 M6 12h9" />',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5" />',
  enviar: '<path d="M4 12 20 4l-6 16-3-7z M11 13l9-9" />',
  reloj: '<circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />',
  flecha: '<path d="M5 12h14 M13 6l6 6-6 6" />',
  atras: '<path d="M19 12H5 M11 6l-6 6 6 6" />',
  candado: '<path d="M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />',
  play: '<path d="M8 5v14l11-7z" />',
};
const ico = (n: string, clase = 'ct-ico'): string => `<svg class="${clase}" viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;

function plantilla(): string {
  const monogramaClaro = monogramaOscuro.replace(/#F8F5F0/g, '#1A1A2E');
  const cadena = [['Vídeo', 'Lo que publicas en TikTok'], ['Mensaje', 'Quien te escribe por ese vídeo'], ['Cita', 'Quien reserva'], ['Visita', 'Quien llega'], ['Venta', 'Lo que deja, en soles']]
    .map(([p, d], i) => `<li${i === 4 ? ' class="rojo"' : ''}><b>${p}</b><small>${d}</small></li>`).join('');
  const nav = [['inicio', 'Inicio'], ['bandeja', 'Bandeja'], ['persona', 'Interesados'], ['taller', 'Taller'], ['tablero', 'Tablero']]
    .map(([i, n]) => `<span class="ct-nav ct-nav-${i}">${ico(i)}${n}${i === 'bandeja' ? '<b class="ct-insignia">3</b>' : ''}</span>`).join('');
  const piezas = [
    ['P1612', 'Lo que trae el combo', 'Publicada', 'publicada', 'ct-pz-1'],
    ['P3300', 'El combo que pide todo Lima', 'Borrador', '', 'ct-pz-2'],
    ['P7892', '¿Cuánto cuesta alimentar a 5?', 'Borrador', '', 'ct-pz-3'],
  ].map(([c, n, e, cl, k]) => `<li class="ct-pz ${k}"><code>${c}</code><span>${n}</span><i class="ct-estado ${cl}">${e}</i></li>`).join('');
  const revision = [
    'El gancho está en los primeros 3 a 6 segundos.',
    'Lleva subtítulos o texto en pantalla.',
    'El código de la pieza sale en pantalla y en el enlace.',
    'El precio es el mismo que en el local.',
  ].map((t, i) => `<li class="ct-rv ct-rv${i}"><i></i>${t}</li>`).join('');
  const conversaciones = [
    ['ct-cv-nueva', '@diego.quispe18', 'ahora', 'Anuncio: Combo familiar · v2', '¿El combo alcanza para 5 personas?', '<i class="ct-chip naranja ct-sinresp">Sin responder</i>', '<span class="ct-cv-ventana">se cierra en 47 h 59 min · quedan 10 mensajes</span>'],
    ['', '@camila.ramirez41', '12 min', 'Anuncio: Ceviche del día · v1', '¿Hacen delivery a Surco?', '<i class="ct-chip verde">Interesado</i>', '<span>se cierra en 47 h 48 min · sin límite</span>'],
    ['', '@luis.paredes20', '1 h', 'Enlace · P1612', 'Perfecto, ahí nos vemos el sábado', '', '<span>se cierra en 46 h 51 min · sin límite</span>'],
    ['', '@piero.rojas86', '3 h', 'Anuncio: Almuerzo ejecutivo · v1', '¿Aceptan Yape?', '<i class="ct-chip">Respondida</i>', '<span>se cierra en 44 h 57 min · sin límite</span>'],
  ].map(([k, u, h, o, t, c, v]) => `<li class="ct-cv ${k}"><p class="ct-cv-cab"><b>${u}</b><small>${h}</small></p><p class="ct-origen">${o}</p><p class="ct-cv-t">${t}</p><p class="ct-cv-pie">${c}${v}</p></li>`).join('');
  const filas = [
    ['ct-f-3300', '<code>P3300</code> · El combo que pide todo Lima', 'S/ 833.70', '4', '3', '3', '<span class="ct-f-ventas">1 · S/ 89.90</span>', '<span class="ct-f-porventa">S/ 833.70</span>'],
    ['', '<code>P1612</code> · Lo que trae el combo', 'S/ 773.10', '2', '3', '2', '1 · S/ 89.90', 'S/ 773.10'],
    ['', '<code>P7892</code> · ¿Cuánto cuesta alimentar a 5?', 'S/ 0.00', '0', '0', '0', '0', '—'],
    ['ct-f-anuncio', 'Anuncio: Ceviche del día · v1', 'S/ 757.20', '1', '0', '0', '0', '—'],
  ].map(([k, ...c]) => `<tr class="ct-f ${k}">${c.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('');

  return `
  <div class="sim-camara">
    <div class="ct-app">
      <aside class="ct-lat">
        <p class="ct-marca"><span class="ct-mono">${monogramaOscuro}</span><span><b>Contenido</b><small>de Kip-Up</small></span></p>
        <p class="ct-negocio"><b>La Cevichería de Carmen</b><small>Restaurante · Kip-Up</small><span>Cambiar de negocio</span></p>
        <nav class="ct-navs">${nav}</nav>
        <p class="ct-yo"><small>Equipo Kip-Up</small><span class="ct-nav">${ico('salir')}Salir</span></p>
      </aside>
      <div class="ct-main">

        <section class="ct-taller">
          <div class="ct-cab"><h3>Taller</h3><span class="ct-boton">Nueva tanda</span></div>
          <div class="ct-taller-cuerpo">
            <div class="ct-tarjeta ct-tanda">
              <p class="ct-tanda-cab"><b>Combo familiar de octubre</b><small>3 piezas · 25 s · 27/09/2026</small></p>
              <ol class="ct-piezas">${piezas}</ol>
              <p class="ct-nota">Una tanda son 3 a 5 variantes del mismo tema: gancho, formato y oferta.</p>
            </div>
            <div class="ct-tarjeta ct-pieza">
              <p class="ct-pieza-cab"><b><code>P3300</code> · El combo que pide todo Lima</b><i class="ct-estado ct-pieza-estado">Borrador</i></p>
              <p class="ct-pieza-sub">Detrás de cámaras · Combo familiar para 5 · 25 s</p>
              <div class="ct-pieza-cuerpo">
                <div class="ct-video">
                  <span class="ct-video-luz"></span>
                  <span class="ct-video-codigo">P3300</span>
                  <p class="ct-video-gancho">El combo<br />que pide<br />todo Lima</p>
                  <span class="ct-video-ia">Hecho con IA</span>
                  <span class="ct-video-barra"><i class="ct-video-avance"></i></span>
                </div>
                <div class="ct-pieza-der">
                  <p class="ct-rot">Guion</p>
                  <ul class="ct-guion">
                    <li><small>0 a 6 s</small>El combo que pide todo Lima, dicho y en pantalla.</li>
                    <li><small>6 a 21 s</small>Detrás de cámaras: el combo para 5, con subtítulos.</li>
                    <li><small>21 a 25 s</small>«Escríbenos con el código P3300».</li>
                  </ul>
                  <p class="ct-rot">Revisión antes de pedir la aprobación</p>
                  <ul class="ct-revision">${revision}</ul>
                  <div class="ct-acciones">
                    <span class="ct-boton ct-aprob"><span class="ct-aprob-t">Pedir la aprobación</span></span>
                    <span class="ct-boton ct-borde ct-publicar">Marcar publicada como anuncio</span>
                    <p class="ct-publicada">${ico('ok')}Publicada · anuncio «Combo familiar · v2»</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p class="ct-toast ct-toast-dueno">${ico('ok')}<span><b>Carmen</b>, la dueña, la aprobó desde su celular</span></p>
        </section>

        <section class="ct-bandeja">
          <div class="ct-cab"><h3>Bandeja</h3><span class="ct-segm"><i class="on">Mensajes <b class="ct-n-msj">3</b></i><i>Comentarios <b>5</b></i></span><small class="ct-medida">Hoy: 6 respuestas, la mitad en menos de 2 min.</small></div>
          <div class="ct-bandeja-cuerpo">
            <div class="ct-tarjeta ct-lista">
              <p class="ct-filtros"><i class="on">Todas</i><i>Sin responder</i><i>Por cerrar</i></p>
              <ul class="ct-cvs">${conversaciones}</ul>
            </div>
            <div class="ct-tarjeta ct-conv">
              <p class="ct-conv-vacia">Elige una conversación.</p>
              <div class="ct-conv-llena">
                <div class="ct-conv-cab"><span><b>@diego.quispe18</b><i class="ct-origen">Anuncio: Combo familiar · v2</i></span><span class="ct-pasar">Pasar a interesado ${ico('flecha')}</span></div>
                <p class="ct-ventana"><b class="ct-ventana-e">Primer contacto</b> · <span class="ct-ventana-t">se cierra en 47 h 59 min · quedan 10 mensajes</span><small class="ct-ventana-n">TikTok deja 10 mensajes en 48 h hasta que la persona conteste. Nunca se escribe primero.</small></p>
                <div class="ct-msjs">
                  <p class="ct-m ct-m-el">¿El combo alcanza para 5 personas?<small>20:14</small></p>
                  <div class="ct-m ct-m-yo"><p>¡Hola! Sí, alcanza para 5. ¿Para hoy o para mañana?</p><span class="ct-m-boton">Para hoy</span><span class="ct-m-boton">Para mañana</span><small>20:15 · respondido en 41 s</small></div>
                  <p class="ct-m ct-m-el ct-m-el2"><span class="ct-m-toco">Para hoy</span>A las 8, somos 5<small>20:16</small></p>
                </div>
                <div class="ct-escribir">
                  <p class="ct-rapidas"><i class="ct-rapida1">¡Hola! Sí, alcanza para 5…</i><i>Hacemos delivery. ¿A qué distrito?</i><i>Nuestra carta está en el enlace</i></p>
                  <p class="ct-caja"><span class="ct-caja-t"></span><span class="ct-caja-ph">Escribe tu respuesta…</span></p>
                  <p class="ct-escribir-pie"><span class="ct-botones-previa"><i>Para hoy</i><i>Para mañana</i></span><span class="ct-boton ct-enviar">${ico('enviar')}Enviar</span></p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="ct-ficha">
          <p class="ct-volver">${ico('atras')}Interesados</p>
          <div class="ct-cab"><h3>@diego.quispe18</h3><i class="ct-chip ct-etapa">Interesado</i></div>
          <ol class="ct-etapas"><li class="hecho">Conversación</li><li class="hecho">Interesado</li><li class="ct-et-cita">Cita</li><li class="ct-et-visita">Visita</li><li class="ct-et-venta">Venta<small class="ct-et-soles">S/ 89.90</small></li></ol>
          <div class="ct-ficha-cuerpo">
            <div class="ct-col">
              <div class="ct-tarjeta ct-bloque">
                <p class="ct-rot">De dónde vino</p>
                <p class="ct-de"><b>Anuncio de TikTok</b>: Combo familiar · v2</p>
                <p class="ct-de-pieza">Pieza <code>P3300</code> · El combo que pide todo Lima</p>
                <p class="ct-nota">TikTok avisó de qué anuncio llegó la conversación.</p>
              </div>
              <div class="ct-tarjeta ct-bloque ct-marcar">
                <p class="ct-rot">Marcar</p>
                <p class="ct-marcas"><i class="ct-mc-cita">Cita</i><i>Vino</i><i class="ct-mc-venta">Venta</i><i>Perdido</i></p>
                <p class="ct-importe"><span class="ct-imp-campo"><small>S/</small><span class="ct-imp-t"></span></span><span class="ct-boton ct-guardar">Guardar la venta</span></p>
              </div>
            </div>
            <div class="ct-col">
              <div class="ct-tarjeta ct-bloque">
                <p class="ct-rot">Recorrido</p>
                <ol class="ct-recorrido">
                  <li><b>Llegó</b> hoy 20:14 · por mensaje</li>
                  <li class="ct-rc-cita"><b>Cita</b> hoy 20:00 · con un botón</li>
                  <li class="ct-rc-venta"><b>Venta</b> S/ 89.90 · con un botón</li>
                </ol>
              </div>
              <div class="ct-tarjeta ct-bloque ct-vuelve">
                <p class="ct-rot">Qué vuelve a TikTok</p>
                <div class="ct-vuelve-caja">
                  <p class="ct-vuelve-t">Nada todavía. Solo vuelven las ventas, para que TikTok sepa qué anuncio funcionó.</p>
                  <p class="ct-vuelve-si">${ico('ok')}<span>La venta de <b>S/ 89.90</b>, con el teléfono y el correo cifrados. Nunca datos de salud.</span></p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="ct-tablero">
          <div class="ct-cab"><h3>Tablero</h3><span class="ct-boton ct-borde">Leer el gasto ahora</span><span class="ct-boton ct-informe">Informe del mes</span></div>
          <p class="ct-meses"><i class="on">setiembre de 2026</i><i>agosto de 2026</i><i>julio de 2026</i><i>junio de 2026</i></p>
          <div class="ct-metrica">
            <small>El número de setiembre de 2026</small>
            <p class="ct-metrica-cifra"><b class="ct-cifra">2</b> ventas que trajo TikTok</p>
            <p class="ct-metrica-l">Costó <b class="ct-coste">S/ 1,182.00</b> cada una · gastado en TikTok: S/ 2,364.00 · vendido: <b class="ct-vendido">S/ 179.80</b></p>
          </div>
          <div class="ct-tarjeta ct-tabla">
            <p class="ct-rot">Por pieza</p>
            <table><thead><tr><th>Pieza</th><th>Gasto</th><th>Conversaciones</th><th>Interesados</th><th>Citas</th><th>Ventas</th><th>Por venta</th></tr></thead><tbody>${filas}</tbody></table>
          </div>
        </section>
      </div>
    </div>

    <div class="ct-login">
      <div class="ct-form">
        <p class="ct-marca ct-marca-clara"><span class="ct-mono">${monogramaClaro}</span><span><b>Contenido</b><small>de Kip-Up</small></span></p>
        <h2>Entra a tu panel</h2>
        <p class="ct-form-sub">Con el correo con el que te dieron acceso.</p>
        <label><small>Correo</small><span class="ct-campo ct-email"><span class="ct-email-t"></span></span></label>
        <label><small>Contraseña</small><span class="ct-campo ct-clave"><span class="ct-clave-t"></span><em>Mostrar</em></span></label>
        <span class="ct-boton ct-entrar">Entrar</span>
        <p class="ct-form-ayuda">¿No recuerdas la contraseña? Pide una nueva a quien te dio acceso.</p>
      </div>
      <div class="ct-marca-panel">
        <span class="ct-mono ct-mono-grande">${monogramaOscuro}</span>
        <h2 class="ct-lema">Del vídeo<br />a la <span>venta</span></h2>
        <ol class="ct-cadena">${cadena}</ol>
        <small>Cada mes, cuánto vendió lo que publicaste.</small>
      </div>
    </div>
  </div>`;
}

export function montarContenido(raiz: HTMLElement, opciones: OpcionesSim): Sim {
  raiz.classList.add('sim', 'sim-contenido');
  raiz.innerHTML = plantilla();
  const $ = (s: string): HTMLElement => raiz.querySelector<HTMLElement>(s)!;
  const $$ = (s: string): HTMLElement[] => Array.from(raiz.querySelectorAll<HTMLElement>(s));
  const inicio = { x: 70, y: 90 };
  const escena = new Escena(raiz, D, { inicio });
  const { tl } = escena;
  const login = $('.ct-login');
  const app = $('.ct-app');
  const vTaller = $('.ct-taller');
  const vBandeja = $('.ct-bandeja');
  const vFicha = $('.ct-ficha');
  const vTablero = $('.ct-tablero');
  const vista = (el: HTMLElement, ini: number, fin: number): void => {
    tl.set(el, { opacity: 0 }, 0)
      .add(el, { opacity: [0, 1], duration: 350 }, ini)
      .add(el, { opacity: [1, 0], duration: 300 }, fin);
  };
  const entra = (el: HTMLElement, t: number, desde = '-0.8em', dur = 380): void => {
    tl.set(el, { opacity: 0, y: desde }, 0).add(el, { opacity: [0, 1], y: [desde, '0em'], duration: dur, ease: 'out(3)' }, t);
  };

  escena.guion(PASOS, 38400);

  // 1 · La entrada.
  escena.ir($('.ct-email'), 900, 700).clic(1700);
  escena.ir($('.ct-clave'), 3000, 500).clic(3600);
  escena.ir($('.ct-entrar'), 4300, 500).clic(4850);
  tl.set(login, { opacity: 1 }, 0)
    .add(login, { opacity: [1, 0], duration: 450, ease: 'in(2)' }, 5050)
    .add(login, { opacity: [0, 1], duration: 600 }, 38900)
    .set(app, { opacity: 0 }, 0)
    .add(app, { opacity: [0, 1], duration: 450 }, 5100)
    .add(app, { opacity: [1, 0], duration: 500 }, 38400);

  // 2 · El taller: la pieza, su revisión y la aprobación del dueño desde su celular.
  vista(vTaller, 5100, 10700);
  $$('.ct-pz').forEach((p, i) => entra(p, 5250 + i * 80, '0.6em', 320));
  const pieza = $('.ct-pieza');
  tl.set(pieza, { opacity: 0.35 }, 0).add(pieza, { opacity: [0.35, 1], duration: 350 }, 6450);
  escena.ir($('.ct-pz-2'), 5600, 700).clic(6400);
  tl.add($('.ct-video-avance'), { width: ['0%', '100%'], duration: 4200, ease: 'linear' }, 6500);
  tl.set($('.ct-video-gancho'), { opacity: 0, scale: 0.9 }, 0)
    .add($('.ct-video-gancho'), { opacity: [0, 1], scale: [0.9, 1], duration: 450, ease: 'outBack(1.6)' }, 6800);
  let cam = escena.enfocar($('.ct-pieza-der'), 1.3, 6700, 700);
  escena.ir($('.ct-rv3'), 7000, 600).clic(7700);
  escena.ir($('.ct-aprob'), 7900, 500).clic(8500);
  cam = escena.enfocar(null, 1, 8700, 600, cam);
  const toast = $('.ct-toast-dueno');
  tl.set(toast, { opacity: 0, y: '-1em' }, 0)
    .add(toast, { opacity: [0, 1], y: ['-1em', '0em'], duration: 380, ease: 'out(3)' }, 9150)
    .add(toast, { opacity: [1, 0], y: ['0em', '0em'], duration: 300 }, 10400);
  escena.ir($('.ct-publicar'), 9500, 500).clic(10100);

  // 3 y 4 · La bandeja: llega el mensaje del anuncio, se contesta dentro de la ventana.
  vista(vBandeja, 10800, 19600);
  const nueva = $('.ct-cv-nueva');
  tl.set(nueva, { opacity: 0, x: '-1em' }, 0)
    .add(nueva, { opacity: [0, 1], x: ['-1em', '0em'], duration: 450, ease: 'outBack(1.4)' }, 11500);
  escena.ir(nueva, 11900, 700).clic(12700);
  const llena = $('.ct-conv-llena');
  const vacia = $('.ct-conv-vacia');
  tl.set(llena, { opacity: 0 }, 0).add(llena, { opacity: [0, 1], duration: 350 }, 12800)
    .set(vacia, { opacity: 1 }, 0).add(vacia, { opacity: [1, 0], duration: 250 }, 12750);
  escena.ir($('.ct-rapida1'), 13600, 700).clic(14400);
  escena.ir($('.ct-enviar'), 15500, 500).clic(16100);
  entra($('.ct-m-yo'), 16200, '0.8em');
  entra($('.ct-m-el2'), 17300, '0.8em');
  escena.ir($('.ct-pasar'), 18200, 700).clic(19000);

  // 5 · La ficha: origen, cita y venta con un botón, y lo que vuelve a TikTok.
  vista(vFicha, 19700, 28200);
  escena.ir($('.ct-mc-cita'), 20400, 700).clic(21200);
  escena.ir($('.ct-mc-venta'), 22000, 600).clic(22700);
  entra($('.ct-rc-cita'), 21250, '0.5em', 320);
  entra($('.ct-rc-venta'), 24450, '0.5em', 320);
  escena.ir($('.ct-guardar'), 23800, 500).clic(24400);
  cam = escena.enfocar($('.ct-vuelve'), 1.3, 24900, 800, cam);
  cam = escena.enfocar(null, 1, 26900, 700, cam);

  // 6 · El tablero: la venta de hoy ya cuenta en el número del mes y en la fila de su vídeo.
  vista(vTablero, 28300, 38300);
  const metrica = $('.ct-metrica');
  entra(metrica, 28450, '0.6em', 420);
  $$('.ct-f').forEach((f, i) => entra(f, 28700 + i * 90, '0.5em', 320));
  tl.add($('.ct-cifra'), { scale: [1, 1.18], duration: 180, ease: 'out(2)' }, 29800)
    .add($('.ct-cifra'), { scale: [1.18, 1], duration: 420, ease: 'out(3)' }, 29980);
  escena.ir($('.ct-f-3300 .ct-f-ventas'), 30300, 800);
  cam = escena.enfocar($('.ct-tabla'), 1.3, 31200, 900, cam);
  cam = escena.enfocar(null, 1, 34300, 700, cam);
  escena.ir($('.ct-informe'), 34900, 700);
  escena.ir(inicio, 36300, 900);

  // Lo discreto.
  const email = $('.ct-email-t');
  const clave = $('.ct-clave-t');
  const cvNueva = nueva;
  const sinResp = $('.ct-sinresp');
  const cvVentana = $('.ct-cv-ventana');
  const nMsj = $('.ct-n-msj');
  const insignia = $('.ct-insignia');
  const cajaT = $('.ct-caja-t');
  const cajaPh = $('.ct-caja-ph');
  const previa = $('.ct-botones-previa');
  const ventana = $('.ct-ventana');
  const ventanaE = $('.ct-ventana-e');
  const ventanaT = $('.ct-ventana-t');
  const ventanaN = $('.ct-ventana-n');
  const piezaEstado = $('.ct-pieza-estado');
  const pz2Estado = $('.ct-pz-2 .ct-estado');
  const aprobT = $('.ct-aprob-t');
  const aprob = $('.ct-aprob');
  const publicar = $('.ct-publicar');
  const publicada = $('.ct-publicada');
  const rvs = $$('.ct-rv');
  const etapa = $('.ct-etapa');
  const mcCita = $('.ct-mc-cita');
  const mcVenta = $('.ct-mc-venta');
  const importe = $('.ct-importe');
  const impT = $('.ct-imp-t');
  const vuelve = $('.ct-vuelve');
  const etCita = $('.ct-et-cita');
  const etVenta = $('.ct-et-venta');
  const cifra = $('.ct-cifra');
  const coste = $('.ct-coste');
  const vendido = $('.ct-vendido');
  const f3300 = $('.ct-f-3300');
  const fVentas = $('.ct-f-3300 .ct-f-ventas');
  const fPorVenta = $('.ct-f-3300 .ct-f-porventa');
  const navs = { taller: $('.ct-nav-taller'), bandeja: $('.ct-nav-bandeja'), persona: $('.ct-nav-persona'), tablero: $('.ct-nav-tablero') };
  const ESTADOS = ['borrador', 'espera', 'aprobada', 'publicada'];
  const TEXTO_ESTADO: Record<string, string> = { borrador: 'Borrador', espera: 'Esperando al dueño', aprobada: 'Aprobada', publicada: 'Publicada' };
  escena.alPintar((t) => {
    const vivo = t < 38400;
    teclear(email, 'yoiber@kipups.com', vivo ? t : 0, 1800, 2900);
    teclear(clave, '••••••••••', vivo ? t : 0, 3700, 4200);
    $('.ct-email').classList.toggle('foco', t >= 1700 && t < 3000);
    $('.ct-clave').classList.toggle('foco', t >= 3600 && t < 4300);
    navs.taller.classList.toggle('on', t < 10800);
    navs.bandeja.classList.toggle('on', t >= 10800 && t < 19700);
    navs.persona.classList.toggle('on', t >= 19700 && t < 28300);
    navs.tablero.classList.toggle('on', t >= 28300);
    // El taller: la pieza pasa de borrador a publicada.
    const ep = !vivo || t < 8500 ? 'borrador' : t < 9200 ? 'espera' : t < 10100 ? 'aprobada' : 'publicada';
    for (const el of [piezaEstado, pz2Estado]) {
      escribir(el, TEXTO_ESTADO[ep]);
      for (const c of ESTADOS) el.classList.toggle(c, c === ep && c !== 'borrador');
    }
    $('.ct-pz-2').classList.toggle('elegida', t >= 6400 && vivo);
    rvs.forEach((r, k) => r.classList.toggle('hecho', k < 3 || (t >= 7700 && vivo)));
    escribir(aprobT, t >= 8500 && vivo ? 'Enlace enviado a Carmen, la dueña' : 'Pedir la aprobación');
    aprob.classList.toggle('enviado', t >= 8500 && vivo);
    aprob.classList.toggle('fuera', t >= 9200 && vivo);
    publicar.classList.toggle('dentro', t >= 9200 && t < 10100 && vivo);
    publicada.classList.toggle('dentro', t >= 10100 && vivo);
    // La bandeja.
    const llego = t >= 11500 && vivo;
    escribir(nMsj, llego ? '4' : '3');
    escribir(insignia, llego ? '4' : '3');
    cvNueva.classList.toggle('elegida', t >= 12700 && vivo);
    const escrito = '¡Hola! Sí, alcanza para 5. ¿Para hoy o para mañana?';
    const enviado = t >= 16100 && vivo;
    teclear(cajaT, escrito, vivo && !enviado ? t : 0, 14450, 15200);
    cajaPh.style.display = t >= 14450 && !enviado && vivo ? 'none' : '';
    previa.classList.toggle('dentro', t >= 15200 && !enviado && vivo);
    const contesto = t >= 17300 && vivo;
    sinResp.style.display = enviado ? 'none' : '';
    escribir(cvVentana, contesto ? 'se cierra en 48 h 0 min · sin límite' : enviado ? 'se cierra en 47 h 58 min · quedan 9 mensajes' : 'se cierra en 47 h 59 min · quedan 10 mensajes');
    escribir(ventanaE, contesto ? 'Ventana abierta' : 'Primer contacto');
    escribir(ventanaT, contesto ? 'se cierra en 48 h 0 min · sin límite de mensajes' : enviado ? 'se cierra en 47 h 58 min · quedan 9 mensajes' : 'se cierra en 47 h 59 min · quedan 10 mensajes');
    escribir(ventanaN, contesto ? 'La persona contestó: mensajes sin límite mientras dure la ventana.' : 'TikTok deja 10 mensajes en 48 h hasta que la persona conteste. Nunca se escribe primero.');
    ventana.classList.toggle('abierta', contesto);
    $('.ct-pasar').classList.toggle('pulsado', t >= 19000 && vivo);
    // La ficha.
    estado(etapa, t, [[21200, 24400, 'cita'], [24400, 38400, 'venta']], ['cita', 'venta']);
    escribir(etapa, t >= 24400 && vivo ? 'Venta · S/ 89.90' : t >= 21200 && vivo ? 'Cita' : 'Interesado');
    mcCita.classList.toggle('on', t >= 21200 && vivo);
    mcVenta.classList.toggle('on', t >= 22700 && vivo);
    importe.classList.toggle('abierto', t >= 22700 && t < 24400 && vivo);
    teclear(impT, '89.90', vivo ? t : 0, 22900, 23500);
    vuelve.classList.toggle('con-venta', t >= 24500 && vivo);
    etCita.classList.toggle('hecho', t >= 21200 && vivo);
    etVenta.classList.toggle('hecho', t >= 24400 && vivo);
    // El tablero: la venta de la ficha entra en el número del mes.
    const tres = t >= 29800 && vivo;
    escribir(cifra, tres ? '3' : '2');
    escribir(coste, tres ? 'S/ 788.00' : 'S/ 1,182.00');
    escribir(vendido, tres ? 'S/ 269.70' : 'S/ 179.80');
    escribir(fVentas, tres ? '2 · S/ 179.80' : '1 · S/ 89.90');
    escribir(fPorVenta, tres ? 'S/ 416.85' : 'S/ 833.70');
    f3300.classList.toggle('nueva', tres);
  });

  // Quieta (movimiento reducido): el tablero con la venta de hoy ya contada, sin acercar.
  return envolver(escena, opciones, 30400);
}
