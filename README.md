# Affittacamere Il Focolare · demo homepage

Demo concept della homepage scroll-driven per Affittacamere Il Focolare (Voc. Torrececcocinella 72, Collevalenza di Todi).

- Vite + WebGL puro (hero: parallasse, fumo del camino, sera, luci di Todi, lucciole 3D, ~4 kB gzip) + GSAP ScrollTrigger + Lenis
- Lighthouse performance: mobile 95, desktop 100
- Foto della casa e dei dintorni reali (dagli annunci), valle in hero generata con Higgsfield
- Prenotazione diretta con prezzo calcolato (`src/booking.js`, prezzi d'esempio da confermare)

```bash
npm install
npm run dev              # http://localhost:5173
node src/booking.test.js
npm run build            # output in dist/
```
