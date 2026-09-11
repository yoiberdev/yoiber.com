// Quita de la barra de direcciones los parámetros que pegan las redes al compartir
// un enlace (fbclid de Facebook e Instagram, gclid de Google, la familia utm_*...).
//
// Los añade quien manda el clic, no nosotros, y aquí no los lee nadie: si se dejan,
// la dirección que ve la persona queda sucia y la que copia y pega arrastra su
// identificador. La analítica ya ha registrado el referente antes de que esto corra.
//
// Usa replaceState, no un redirección: no recarga, no añade entrada al historial y
// el botón de atrás sigue llevando a donde tocaba.

const BASURA = [
  'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'twclid', 'ttclid',
  'igshid', 'mc_eid', 'mc_cid', 'vero_id', '_hsenc', '_hsmi', 'yclid',
];

/** Devuelve cuántos parámetros se quitaron; 0 si la dirección ya estaba limpia. */
export function limpiarUrl(): number {
  if (!window.history?.replaceState) return 0;

  const url = new URL(window.location.href);
  const antes = url.search;
  let quitados = 0;

  for (const clave of [...url.searchParams.keys()]) {
    if (BASURA.includes(clave) || clave.startsWith('utm_')) {
      url.searchParams.delete(clave);
      quitados++;
    }
  }
  if (!quitados || url.search === antes) return 0;

  // Sin parámetros no queremos dejar el '?' colgando.
  const limpia = url.pathname + (url.search === '?' ? '' : url.search) + url.hash;
  window.history.replaceState(window.history.state, '', limpia);
  return quitados;
}
