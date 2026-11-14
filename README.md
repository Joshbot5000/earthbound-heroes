# Earthbound Heroes

An open-world superhero sandbox set on the real planet Earth. It runs in a web browser on a phone or a laptop and keeps working offline once it has been opened once.

- Real coastlines, mountains and 7,300 real cities; tap anywhere on the globe to travel there
- The sun, moon and weather follow the real clock and conditions at the place you are standing
- Four heroes, each with their own way of getting around and three powers
- Cars to drive, a police wanted system, and street crews to fight

Streets and buildings are generated, not copies of the real ones. This is an early prototype.

## Play

The playable game is the single file `docs/index.html`. With GitHub Pages enabled (Settings → Pages → Deploy from a branch → `main` / `/docs`) it is served at `https://joshbot5000.github.io/earthbound-heroes/`.

On a phone, open that link and use **Add to Home Screen** to install it.

## Develop

```
npm install
node build.mjs     # bundles src/ and assets/ into docs/index.html
```

## Data credits

Coastlines and cities: Natural Earth (public domain). Elevation and satellite imagery: NASA Blue Marble / Visible Earth (public domain). Live weather: Open-Meteo.
