# Presidenten 🃏

Webversie van het Nederlandse kaartspel [Presidenten](https://nl.wikipedia.org/wiki/Presidenten_(kaartspel)) — speel multiplayer via een kamercode of solo tegen computerspelers.

De volledige spelregels staan in [SPELREGELS.md](SPELREGELS.md).

## Runnen met Docker (aanbevolen)

```bash
git clone git@github.com:reinder83/presidenten-kaartspel.git
cd presidenten-kaartspel
docker compose up --build
```

Open daarna <http://localhost:3000>.

Zonder compose kan het ook direct:

```bash
docker build -t presidenten .
docker run -d -p 3000:3000 --name presidenten presidenten
```

### Multiplayer

- Maak een kamer aan en deel de **4-cijferige kamercode** met vrienden (3–6 spelers).
- Spelers op hetzelfde netwerk bereiken het spel via `http://<jouw-ip>:3000`.
- Lege plekken vul je met bots; je kunt ook helemaal solo tegen 3 bots spelen.
- Valt je verbinding weg (of verlaat je per ongeluk het spel)? Een bot speelt door op jouw stoel; join binnen 5 minuten opnieuw met de kamercode en je zit weer op je eigen plek.

## Lokaal ontwikkelen

```bash
# Terminal 1 — server (poort 3000)
cd server && npm install && npm run dev

# Terminal 2 — client met hot reload (poort 5173, proxied naar de server)
cd client && npm install && npm run dev
```

Tests voor de spelregels-engine:

```bash
cd server && npm test
```

## Techniek

- **server/** — Node.js + TypeScript met Express en Socket.IO. De server is autoritair: alle spelregels en de bot-AI draaien hier en spelers krijgen alleen hun eigen hand te zien.
- **client/** — React + Vite.
- **Dockerfile** — multi-stage build (client → server → slanke productie-image), draait als non-root op poort 3000 met een healthcheck op `/healthz`.

## Credits

De kaartafbeeldingen komen uit [SVG-cards](https://svg-cards.sourceforge.net/) van David Bellot (LGPL).
