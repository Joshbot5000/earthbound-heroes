// Bundles the game, its data and three.js into ONE self-contained index.html so it can be
// installed to a home screen and played with no network at all.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
const out = new URL('./docs/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false,
  loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.json': 'json' }, legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const html = readFileSync('src/index.html', 'utf8').replace('/*BUNDLE*/', () => js).replaceAll('/*BUILD*/', stamp);
writeFileSync(out + 'index.html', html);
const cities = readdirSync('assets/cities').filter(f => f.endsWith('.bin.gz'));
mkdirSync(out + 'cities', { recursive: true });
for (const f of cities) copyFileSync('assets/cities/' + f, out + 'cities/' + f);
for (const f of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png']) copyFileSync('static/' + f, out + f);
// the service worker precaches every real city so the whole game works offline after one visit
writeFileSync(out + 'sw.js', readFileSync('static/sw.js', 'utf8').replace('/*CITIES*/', cities.map(f => `"cities/${f}"`).join(', ')).replace('/*VERSION*/', Date.now().toString(36)));
console.log('built', (html.length / 1e6).toFixed(2) + ' MB');
