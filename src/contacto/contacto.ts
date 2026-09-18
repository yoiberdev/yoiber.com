import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import '../styles/pagina.css';

// EL FORMULARIO DE CONTACTO (contacto/index.html)
// ================================================================================================
// Manda lo escrito a `/contacto/enviar`, que es el PROPIO dominio: nginx lo pasa al flujo de n8n
// que avisa por correo (ver nginx.conf). Va al propio dominio a propósito, porque la CSP lleva
// `connect-src 'self'` y porque así la dirección del webhook no queda a la vista.
//
// SIN JAVASCRIPT no hay envío, y por eso el correo de Yoiber está escrito en la página como enlace
// `mailto:`: quien no pueda usar el formulario tiene la otra vía delante, no escondida.
//
// LO QUE FRENA A LOS ROBOTS, por orden: un campo señuelo que las personas no ven (`trampa`, lo
// rechaza el flujo si viene relleno), el límite por IP de nginx (429), y la comprobación de que el
// mensaje tiene pies y cabeza, que se hace en el servidor y no aquí: lo de aquí es comodidad.

const form = document.querySelector<HTMLFormElement>('#formulario-contacto');
const estado = document.querySelector<HTMLElement>('#estado-envio');
const gracias = document.querySelector<HTMLElement>('#gracias');

if (form && estado && gracias) {
  const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const decir = (texto: string, clase: '' | 'mal' | 'bien' = ''): void => {
    estado.textContent = texto;
    estado.className = `estado ${clase}`.trim();
  };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const datos = new FormData(form);
    const campo = (n: string): string => String(datos.get(n) ?? '').trim();
    const nombre = campo('nombre');
    const correo = campo('correo');
    const mensaje = campo('mensaje');

    if (nombre.length < 2) return decir('Falta tu nombre.', 'mal');
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(correo)) return decir('Ese correo no parece válido; sin él no puedo contestarte.', 'mal');
    if (mensaje.length < 10) return decir('Cuéntame un poco más, aunque sean dos líneas.', 'mal');

    if (boton) boton.disabled = true;
    decir('Enviando…');
    try {
      const r = await fetch('/contacto/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, correo, mensaje, trampa: campo('trampa') }),
      });
      if (r.ok) {
        form.hidden = true;
        gracias.hidden = false;
        gracias.focus();
        return;
      }
      // 429: el freno por IP de nginx. El resto: el flujo dijo que no, o está caído.
      decir(
        r.status === 429
          ? 'Has enviado varios seguidos. Espera un minuto y vuelve a intentarlo.'
          : 'No he podido enviarlo. Escríbeme a yoiberdev@gmail.com y llega igual.',
        'mal',
      );
    } catch {
      decir('No he podido enviarlo, parece que se cayó la conexión. Escríbeme a yoiberdev@gmail.com.', 'mal');
    } finally {
      if (boton) boton.disabled = false;
    }
  });
}
