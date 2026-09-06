# yoiber.com

Web personal de [yoiberdev](https://github.com/yoiberdev). Intro animada con el logo y el nombre,
construida con **Vite + React 19 + TypeScript + Tailwind 4 + GSAP**.

## Desarrollo

```bash
npm ci
npm run dev      # servidor local con recarga
npm run lint     # eslint
npm run build    # tsc + vite build -> dist/
npm run preview  # sirve dist/ en local
```

## Estructura

- `src/App.tsx`: página actual (logo animado + texto).
- `src/components/AnimatedLogo.tsx`, `AnimatedText.tsx`: componentes en uso.
- Resto de `src/components/`: secciones preparadas para la versión completa de la web
  (navegación, sobre mí, portfolio, scroll horizontal...). Todavía no se montan.
- `src/fonts/`: Satoshi Variable (woff2/woff), la única fuente que se carga.

## Despliegue

Se sirve como estáticos con nginx dentro de Docker en el servidor de Kip-Up
(`/opt/yoiblog`, dominios yoiber.com y yoiber.dev). Para publicar una nueva versión:

```bash
git push origin main            # desde tu máquina
sudo /opt/yoiblog/actualizar.sh # en el servidor: git pull + docker compose build + up
```

La integración continua (GitHub Actions) ejecuta lint y build en cada push y pull request.
