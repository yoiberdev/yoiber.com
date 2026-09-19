import '../styles/idioma.css';

// «ESTA PÁGINA TAMBIÉN ESTÁ EN…» — la sugerencia de idioma
// ================================================================================================
// yoiber.com está en español y en inglés (/en/). La pregunta es qué hacer cuando llega alguien cuyo
// navegador pide otro idioma. Lo que NO se hace, a propósito:
//
//   · NO se redirige sola. Es lo más invasivo que hay: al visitante se le cambia la página bajo los
//     pies, no puede volver sin pelear, y los rastreadores acaban indexando la versión equivocada
//     (Google recomienda expresamente no redirigir por idioma ni por país).
//   · NO se mira la ubicación por IP. El idioma del navegador es una preferencia que la persona ha
//     elegido; el país donde está no dice nada de qué idioma lee.
//
// Lo que sí: un aviso pequeño, una sola vez, con el enlace a la gemela. Si lo cierra o si pulsa, se
// recuerda la elección y no vuelve a salir. Si no hay `localStorage` (modo privado), simplemente se
// muestra una vez por visita y no pasa nada.
//
// CUÁNTO PESA: kilo y medio con su hoja, y no toca nada hasta que la página está montada; en la
// portada espera además a que termine la intro, para no aparecer encima del logo.

const CLAVE = 'yoi:idioma';

const leer = (): string | null => {
  try { return localStorage.getItem(CLAVE); } catch { return null; }
};
const guardar = (v: string): void => {
  try { localStorage.setItem(CLAVE, v); } catch { /* modo privado: da igual */ }
};

const TEXTOS = {
  // el aviso se escribe SIEMPRE en el idioma al que lleva, que es el que esa persona lee
  en: { aviso: 'This page is also available in English', ir: 'Read it in English', cerrar: 'Dismiss' },
  es: { aviso: 'Esta página también está en español', ir: 'Leerla en español', cerrar: 'Cerrar' },
};

export function sugerirIdioma(): void {
  const actual = (document.documentElement.lang || 'es').slice(0, 2);
  const otro = actual === 'es' ? 'en' : 'es';
  if (leer()) return;                                   // ya eligió antes

  // ¿Qué idiomas pide el navegador? Si entre ellos está el de esta página, no hay nada que sugerir.
  const pedidos = (navigator.languages ?? [navigator.language]).map((l) => (l || '').slice(0, 2).toLowerCase());
  if (!pedidos.length || pedidos.includes(actual)) return;
  if (!pedidos.includes(otro)) return;                  // ni uno ni otro: se queda como está

  // La gemela sale de los hreflang de la propia página; la portada no tiene, y su entrada es /en/.
  const enlace = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${otro}"]`);
  const destino = enlace ? new URL(enlace.href).pathname : otro === 'en' ? '/en/' : '/';

  const t = TEXTOS[otro];
  const caja = document.createElement('div');
  caja.className = 'aviso-idioma';
  caja.lang = otro;
  caja.innerHTML =
    `<span class="aviso-idioma-texto"></span>` +
    `<a class="aviso-idioma-ir" href="${destino}" hreflang="${otro}"></a>` +
    `<button class="aviso-idioma-cerrar" type="button"></button>`;
  const q = (s: string): HTMLElement => caja.querySelector(s) as HTMLElement;
  q('.aviso-idioma-texto').textContent = t.aviso;
  q('.aviso-idioma-ir').textContent = t.ir;
  q('.aviso-idioma-cerrar').textContent = '✕';
  q('.aviso-idioma-cerrar').setAttribute('aria-label', t.cerrar);

  q('.aviso-idioma-ir').addEventListener('click', () => guardar(otro));
  q('.aviso-idioma-cerrar').addEventListener('click', () => {
    guardar(actual);
    caja.remove();
  });

  // En la portada se espera a que acabe la intro del logo (`is-ready` lo pone el script de cabecera).
  const poner = (): void => {
    document.body.append(caja);
    requestAnimationFrame(() => caja.classList.add('visible'));
  };
  if (document.documentElement.classList.contains('is-ready')) window.setTimeout(poner, 600);
  else window.setTimeout(poner, 2600);
}
