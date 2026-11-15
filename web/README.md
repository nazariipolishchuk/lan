# Lan web app

The site at https://nazariipolishchuk.github.io/lan/. What it is, how to try it and how it works are
described in the [root README](../README.md).

```bash
npm install
npm run dev     # http://localhost:5173 (data from public/data → ../data/out)
npm test        # vitest: engine, rules, translations, guide layout
npm run lint    # oxlint
npm run build   # tsc + vite → dist/
```

Code layout: `src/screens` (intro and quick guide in `Intro.tsx`, its geometry in `guideLayout.ts`;
field card, comparison, evidence charts), `src/engine` (scoring rules), `src/map` (MapLibre, layers,
search), `src/i18n` (English and Ukrainian strings), `src/state` (zustand store, local persistence).
