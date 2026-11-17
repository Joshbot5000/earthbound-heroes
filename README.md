# Earthbound Heroes

An open-world superhero sandbox set on the real planet Earth. It runs in a web browser on a phone or a laptop and keeps working offline once it has been opened once.

- **Seven real cities built from map data**: London, Mumbai, New York, Paris, Tokyo, Dubai and Sydney. Every building footprint and height, every street, the rivers and coastline, parks, mapped trees and street furniture come from OpenStreetMap (via Overture Maps).
- **Landmarks modelled by hand at their real positions**: Big Ben (showing the real time in London), the London Eye, Tower Bridge, the Shard, St Paul's, the Gherkin, Nelson's Column, the Victoria Memorial; the Gateway of India, the Taj, CSMT, the Rajabai Tower and Haji Ali; the Eiffel Tower, Statue of Liberty, Sydney Opera House, Burj Khalifa, Taj Mahal, the pyramids of Giza, the Colosseum and more.
- **Everywhere else**: 7,300 real cities generated in the architecture of their region (terraced perimeter blocks in Europe, dense mid-rise in India, towers in the Americas and the Gulf), on real coastlines and terrain.
- **Regional detail**: traffic drives on the correct side, with local vehicles (London black cabs and red buses, Mumbai Padmini taxis, auto-rickshaws and BEST buses, New York yellow cabs) and local police (Met officers in hi-vis, Mumbai police in khaki).
- **Physics**: lampposts, traffic lights, bins, benches, bollards, post boxes, phone boxes and trees are solid. Hit hard enough, they break free and topple as rigid bodies; cars lose momentum by mass, spin when clipped off-centre and dent where they are hit.
- The sun, moon and weather follow the real clock and conditions where you are standing; tap anywhere on the globe to travel there.
- Four heroes, each with their own way of getting around and three powers.

## Play

The playable game is `docs/index.html` plus `docs/cities/`. With GitHub Pages enabled (Settings → Pages → Deploy from a branch → `main` / `/docs`) it is served at `https://joshbot5000.github.io/earthbound-heroes/`.

On a phone, open that link and use **Add to Home Screen** to install it. Everything, including all seven city maps (about 9 MB), is cached for offline play on the first visit.

## Develop

```
npm install
node build.mjs     # bundles src/ and assets/ into docs/
```

### Regenerating or adding a real city

`tools/overture/` reads the public Overture Maps release straight from its S3 bucket (no account or key needed).

```
cd tools/overture
pip install pyarrow shapely numpy pillow requests
python3 index.py 'theme=buildings/type=building/' idx_building.json      # and the other themes used in extract.py
python3 extract.py london                                                # writes london.bin.gz
```

Add the city's bounding box to `CITIES` in `extract.py` and to `ZONES` in `src/city.js`, copy the `.bin.gz` into `assets/cities/`, and rebuild.

## Data credits

Map data © OpenStreetMap contributors, available under the Open Database Licence (ODbL), via the Overture Maps Foundation. Coastlines and cities: Natural Earth (public domain). Elevation and satellite imagery: NASA Blue Marble / Visible Earth (public domain). Live weather: Open-Meteo.
