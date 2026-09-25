# RAP CITY: NIGHT RUN

A mobile-first browser FPS prototype for Rap Digital Marketing.

## Stack

- Vite
- Three.js
- Postprocessing
- NippleJS mobile controls
- PWA/offline shell
- GitHub Pages deployment
- Rapier, Yuka, Howler, Tween.js installed for the next gameplay/AI/audio expansion phase

## Local development

```bash
npm install
npm run dev
```

## Production

```bash
npm run build
npm run preview
```

Every push to `main` runs the GitHub Pages deployment workflow.

## Controls

Desktop: WASD, mouse, Shift sprint, R reload, Q swap, 1–3 weapon select.

Mobile: left joystick moves, drag the world to aim, Fire / Reload / Swap / Run buttons.

## Planned production route

The GitHub Pages build can run at the repository Pages URL immediately. For RapDM branding, configure `play.rapdigitalmarketing.com` as the Pages custom domain and point the DNS record to the GitHub Pages host.
