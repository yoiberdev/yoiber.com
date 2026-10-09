// AHORA MISMO — #ahora, arriba del muro (10/10/2026)
// ================================================================================================
// Lo que está pasando mientras alguien mira la página, con datos de verdad:
//   · el último sismo del Perú, tal como lo tiene Remezón (sismos.yoiber.dev/api/sismos);
//   · mis apps respondiendo en este momento: una petición a cada una (sin leer la respuesta, que es
//     de otro sitio; basta con que conteste);
//   · lo que estoy viendo y oyendo: a mano aquí abajo, o el anime desde mi lista de AniList.
// Cada dominio que se consulta va en el connect-src de la CSP (nginx.conf). Si algo no responde,
// su celda se queda como está o no aparece: la página nunca espera por esto.

const AHORA = {
  // Mi usuario de AniList. Si está, «viendo» sale solo de lo último que actualicé en mi lista.
  anilist: '',
  // A mano, mientras tanto. Vacío no se muestra.
  viendo: '',
  oyendo: '',
};

const SISMOS = 'https://sismos.yoiber.dev/api/sismos';
const relativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

function hace(t: number): string {
  const s = Math.round((t - Date.now()) / 1000);
  const a = Math.abs(s);
  if (a < 60) return 'hace un momento';
  if (a < 3600) return relativo.format(Math.round(s / 60), 'minute');
  if (a < 86400) return relativo.format(Math.round(s / 3600), 'hour');
  return relativo.format(Math.round(s / 86400), 'day');
}

/** «33 km al sureste de Aplao, Castilla - Arequipa» → «33 km al sureste de Aplao (Arequipa)». */
function lugarCorto(lugar: string): string {
  const i = lugar.indexOf(', ');
  if (i < 0) return lugar;
  const region = lugar.slice(i + 2).split(' - ').pop();
  return `${lugar.slice(0, i)} (${region})`;
}

const texto = (el: Element, partes: (string | [string])[]): void => {
  // [x] va en negrita; lo demás es texto plano (nada de innerHTML con datos de afuera).
  el.replaceChildren(...partes.map((p) => (Array.isArray(p) ? Object.assign(document.createElement('b'), { textContent: p[0] }) : document.createTextNode(p))));
};

async function conTiempo(url: string, op: RequestInit = {}, ms = 7000): Promise<Response> {
  const c = new AbortController();
  const reloj = window.setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...op, signal: c.signal });
  } finally {
    window.clearTimeout(reloj);
  }
}

interface Sismo { mag: number; lugar: string; t: number }

async function sismo(celda: HTMLElement): Promise<void> {
  for (const periodo of ['dia', 'semana']) {
    const r = await conTiempo(`${SISMOS}?periodo=${periodo}`);
    if (!r.ok) return;
    const d = (await r.json()) as { sismos?: Sismo[] };
    const s = d.sismos?.[0];
    if (!s) continue;
    const dato = celda.querySelector('.ahora-dato');
    if (!dato) return;
    texto(dato, [[`M ${s.mag.toFixed(1)}`], `, ${lugarCorto(s.lugar)}, ${hace(s.t)}`]);
    celda.hidden = false;
    return;
  }
}

async function apps(lista: HTMLElement): Promise<void> {
  await Promise.all(
    Array.from(lista.querySelectorAll<HTMLElement>('[data-ping]')).map(async (li) => {
      try {
        await conTiempo(li.dataset.ping ?? '', { mode: 'no-cors', cache: 'no-store' });
        li.classList.add('arriba');
      } catch {
        li.classList.add('abajo');
      }
    }),
  );
}

async function viendo(): Promise<string | null> {
  if (!AHORA.anilist) return AHORA.viendo || null;
  const consulta = `query ($u: String) { MediaListCollection(userName: $u, type: ANIME, status: CURRENT, sort: UPDATED_TIME_DESC) { lists { entries { progress media { title { romaji english } } } } } }`;
  try {
    const r = await conTiempo('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: consulta, variables: { u: AHORA.anilist } }),
    });
    const d = await r.json();
    const e = d?.data?.MediaListCollection?.lists?.[0]?.entries?.[0];
    if (!e) return AHORA.viendo || null;
    const titulo = e.media.title.english || e.media.title.romaji;
    return e.progress ? `${titulo}, episodio ${e.progress}` : titulo;
  } catch {
    return AHORA.viendo || null;
  }
}

async function yo(celda: HTMLElement): Promise<void> {
  const v = await viendo();
  const pv = celda.querySelector<HTMLElement>('.ahora-viendo');
  const po = celda.querySelector<HTMLElement>('.ahora-oyendo');
  if (v && pv) {
    texto(pv, ['Viendo ', [v]]);
    pv.hidden = false;
  }
  if (AHORA.oyendo && po) {
    texto(po, ['Oyendo ', [AHORA.oyendo]]);
    po.hidden = false;
  }
  celda.hidden = !(v || AHORA.oyendo);
}

export function montarAhora(): () => void {
  const seccion = document.querySelector<HTMLElement>('#ahora');
  if (!seccion) return () => undefined;
  const celdaSismo = seccion.querySelector<HTMLElement>('.ahora-sismo');
  const lista = seccion.querySelector<HTMLElement>('.ahora-lista');
  const celdaYo = seccion.querySelector<HTMLElement>('.ahora-yo');
  let reloj = 0;

  const refrescar = (): void => {
    if (document.visibilityState !== 'visible') return;
    if (celdaSismo) sismo(celdaSismo).catch(() => undefined);
  };
  // Se pide la primera vez que la franja se acerca a la pantalla, no durante la intro del logo.
  const cerca = new IntersectionObserver(
    (entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      cerca.disconnect();
      refrescar();
      if (lista) apps(lista).catch(() => undefined);
      if (celdaYo) yo(celdaYo).catch(() => undefined);
      reloj = window.setInterval(refrescar, 5 * 60_000);
    },
    { rootMargin: '600px 0px' },
  );
  cerca.observe(seccion);

  return () => {
    cerca.disconnect();
    window.clearInterval(reloj);
  };
}
