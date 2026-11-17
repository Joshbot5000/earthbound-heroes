// What makes a place look like itself: building materials and window types, colours, roofs,
// street furniture, trees, vehicles, police and which side of the road traffic drives on.
// Window styles (used by the facade shader):
//   0 sash/terrace  1 classical stucco/stone  2 glass curtain wall  3 punched modern  4 Indian residential with grilles/balconies
//   5 colonial gothic arched  6 industrial  7 religious tall arched  8 small house  9 Haussmann (Paris)  10 Japanese mid-rise  11 Gulf/desert
// Facade textures: 0 brick 1 stone 2 plaster/stucco 3 concrete 4 glass
const hex = s => parseInt(s.replace('#', ''), 16);
export const REGIONS = {
  uk: { drive: 'left', walls: [[0, 0, ['#8a5a44', '#7a4d3a', '#9b6b4f', '#b8a07a', '#a88a6a', '#6e4434'], 6], [0, 2, ['#efeae0', '#f3efe6', '#e8e1d0'], 3], [1, 1, ['#d9d2c0', '#cfc6b0', '#e2dccb'], 2], [3, 3, ['#9a9a96', '#b0aea8'], 1]],
    tall: [[2, 4, ['#7d8a96', '#5b6b78', '#93a0aa'], 4], [3, 3, ['#bdb8ae', '#a8a49c'], 2]], roofs: ['#4a4f58', '#3d424a', '#5a4a44'], pitched: 0.65,
    trees: 'plane', lamp: 'victorian', bollard: '#16181a', postbox: true, phone: true, cars: ['hatch', 'hatch', 'sedan', 'suv', 'cab_london', 'cab_london', 'van', 'bus_london', 'sport'], police: 'uk',
    ground: '#9a9890', pave: '#a7a59e', grass: '#5f8a3e', yellowLines: true, sky: 1 },
  europe: { drive: 'right', walls: [[1, 2, ['#e8dcc0', '#dccfb0', '#efe5cf', '#e6c9a8', '#d8b890'], 5], [0, 0, ['#8a5a44', '#9b6b4f'], 2], [3, 3, ['#b5b0a6'], 1]],
    tall: [[2, 4, ['#7d8a96', '#8fa0aa'], 3], [3, 3, ['#bdb8ae'], 2]], roofs: ['#9a4a32', '#8a3e2a', '#555a60'], pitched: 0.7,
    trees: 'broadleaf', lamp: 'classic', bollard: '#2a2c2e', cars: ['hatch', 'hatch', 'sedan', 'suv', 'van', 'sport'], police: 'eu', ground: '#a09d94', pave: '#b0aca2', grass: '#5c8a3c', sky: 1 },
  france: { drive: 'right', walls: [[9, 1, ['#e6dcc6', '#ece3cf', '#dfd3b8', '#efe8d6'], 8], [1, 2, ['#e8e0cc'], 2]],
    tall: [[2, 4, ['#7d8a96', '#8fa0aa'], 3]], roofs: ['#4f5866', '#5a6370', '#47505c'], pitched: 0.2, mansard: true,
    trees: 'broadleaf', lamp: 'classic', bollard: '#3a2a1e', cars: ['hatch', 'hatch', 'sedan', 'van', 'sport'], police: 'eu', ground: '#a8a49a', pave: '#b9b3a6', grass: '#5c8a3c', sky: 1 },
  us: { drive: 'right', walls: [[3, 3, ['#b9b3a8', '#a39d92', '#c8c0b2'], 3], [0, 0, ['#8b4a36', '#7a3f2e', '#a0583e'], 3], [1, 1, ['#d6cfc0', '#c9c1b0'], 2]],
    tall: [[2, 4, ['#6f8090', '#5a6a7a', '#8698a8', '#4a5866'], 6], [3, 3, ['#b7b0a4', '#9e988e'], 3], [1, 1, ['#d0c8b4'], 2]], roofs: ['#3a3d42', '#4a4d52'], pitched: 0.05,
    trees: 'broadleaf', lamp: 'cobra', bollard: '#d8b030', hydrant: true, cars: ['sedan', 'sedan', 'suv', 'suv', 'cab_ny', 'cab_ny', 'van', 'sport', 'hatch'], police: 'us', ground: '#9c9a94', pave: '#a9a7a0', grass: '#5e8a3e', sky: 1 },
  india: { drive: 'left', walls: [[4, 2, ['#d8cfae', '#e6d6a4', '#b9c9b4', '#d8b8a6', '#b4c0cc', '#e2c87e', '#cfc8b8', '#a8bca6', '#e2b890', '#c8a0b0', '#9fb4c8', '#d8c090'], 9], [4, 3, ['#a8a294', '#9a9484', '#b8ae98'], 4], [5, 1, ['#b8925e', '#a88a5a', '#c09a68'], 2], [3, 2, ['#e8e2d0', '#d8d0bc'], 2]],
    tall: [[3, 3, ['#e8e2d6', '#d8d2c6', '#f0ece4'], 3], [2, 4, ['#6f8a96', '#5b7480'], 2]], roofs: ['#8a8478', '#7a7468', '#9a9488'], pitched: 0.03,
    trees: 'tropical', lamp: 'tall', bollard: '#e8d040', tanks: true, weathered: true, cars: ['taxi_mumbai', 'taxi_mumbai', 'taxi_mumbai', 'rickshaw', 'rickshaw', 'hatch', 'hatch', 'sedan', 'suv', 'bus_mumbai', 'van'], police: 'india',
    ground: '#9a9284', pave: '#a59c8c', grass: '#6a8a3a', dusty: true, sky: 1.15 },
  eastasia: { drive: 'right', walls: [[10, 3, ['#d8d4cc', '#e4e0d8', '#c8c4bc', '#eceae4'], 6], [3, 3, ['#b8b4ac'], 2]],
    tall: [[2, 4, ['#6f8090', '#7a8c9a', '#5a6a78'], 5], [10, 3, ['#d0ccc4'], 3]], roofs: ['#5a5e64', '#6a6e74'], pitched: 0.05,
    trees: 'broadleaf', lamp: 'cobra', bollard: '#d8d8d8', signs: true, cars: ['hatch', 'hatch', 'sedan', 'van', 'suv', 'sport'], police: 'eu', ground: '#a4a29c', pave: '#b2b0aa', grass: '#5c8a3c', sky: 1 },
  japan: { drive: 'left', walls: [[10, 3, ['#dcd8d0', '#e8e4dc', '#cfcac0', '#f0eee8', '#c8c0b4'], 6], [3, 3, ['#b8b4ac'], 2]],
    tall: [[2, 4, ['#6f8090', '#7a8c9a', '#5a6a78'], 5], [10, 3, ['#d0ccc4'], 3]], roofs: ['#5a5e64', '#4a5058'], pitched: 0.1,
    trees: 'broadleaf', lamp: 'cobra', bollard: '#d8d8d8', signs: true, cars: ['hatch', 'hatch', 'hatch', 'sedan', 'van', 'suv'], police: 'eu', ground: '#a4a29c', pave: '#b2b0aa', grass: '#5c8a3c', sky: 1 },
  gulf: { drive: 'right', walls: [[11, 2, ['#e6d6b6', '#dccaa4', '#efe2c6', '#d8c4a0'], 6], [3, 3, ['#d6d0c4'], 2]],
    tall: [[2, 4, ['#6f8aa0', '#8aa4b8', '#5a7890', '#b0c0cc'], 7], [3, 3, ['#e0d8c8'], 2]], roofs: ['#c8bca4', '#b8ac94'], pitched: 0,
    trees: 'palm', lamp: 'cobra', bollard: '#c8c0b0', cars: ['suv', 'suv', 'sedan', 'sedan', 'sport', 'sport', 'van'], police: 'gulf', ground: '#c8b898', pave: '#d0c4ac', grass: '#6a8a3a', dusty: true, sky: 1.1 },
  latam: { drive: 'right', walls: [[3, 2, ['#e8c8a0', '#d8e0c0', '#e6b8a8', '#c8d8e6', '#f0e0a8', '#e0e0d8'], 6], [3, 3, ['#bcb6aa'], 2]],
    tall: [[2, 4, ['#6f8090', '#7a8c9a'], 3], [3, 3, ['#d4ccc0'], 3]], roofs: ['#9a5a3a', '#8a8478'], pitched: 0.2,
    trees: 'tropical', lamp: 'cobra', bollard: '#d8d8d8', cars: ['hatch', 'hatch', 'sedan', 'suv', 'van'], police: 'us', ground: '#a09a8e', pave: '#aca698', grass: '#5e8a3a', sky: 1.1 },
  africa: { drive: 'right', walls: [[3, 2, ['#e0d0b0', '#d8c8a8', '#e8dcc4', '#c8b898'], 6], [3, 3, ['#bcb6aa'], 2]],
    tall: [[2, 4, ['#6f8090'], 2], [3, 3, ['#d4ccc0'], 3]], roofs: ['#8a8478', '#7a6a58'], pitched: 0.1,
    trees: 'tropical', lamp: 'tall', bollard: '#d8d8d8', cars: ['hatch', 'sedan', 'suv', 'van', 'van'], police: 'us', ground: '#a8987c', pave: '#b0a48c', grass: '#7a8a3a', dusty: true, sky: 1.1 },
  australia: { drive: 'left', walls: [[3, 3, ['#d0c8b8', '#bcb4a4'], 3], [0, 0, ['#9b5a3f', '#a86a4a'], 3], [1, 1, ['#e0d4b8'], 2]],
    tall: [[2, 4, ['#6f8a9a', '#5a7888', '#8aa4b4'], 5], [3, 3, ['#c8c0b0'], 2]], roofs: ['#8a3e2a', '#555a60'], pitched: 0.3,
    trees: 'broadleaf', lamp: 'cobra', bollard: '#d8d8d8', cars: ['hatch', 'sedan', 'suv', 'suv', 'van', 'sport'], police: 'eu', ground: '#a29e94', pave: '#b0aca2', grass: '#6a8a3e', sky: 1.05 },
  russia: { drive: 'right', walls: [[3, 2, ['#e0d8c8', '#e8d0a8', '#d8c8b8'], 4], [3, 3, ['#b4b0a8'], 3]],
    tall: [[3, 3, ['#c8c4bc'], 3], [2, 4, ['#6f8090'], 2]], roofs: ['#5a6a5a', '#555a60'], pitched: 0.2,
    trees: 'conifer', lamp: 'cobra', bollard: '#2a2c2e', cars: ['hatch', 'sedan', 'suv', 'van'], police: 'eu', ground: '#9c9a94', pave: '#aaa8a2', grass: '#5c7a3c', sky: 1 },
};
for (const r of Object.values(REGIONS)) {
  for (const list of [r.walls, r.tall]) for (const w of list) w[2] = w[2].map(hex);
  r.roofs = r.roofs.map(hex); for (const k of ['ground', 'pave', 'grass']) r[k] = hex(r[k]);
}
const C = (list, reg) => { for (const c of list) COUNTRY[c] = reg; }, COUNTRY = {};
C(['United Kingdom', 'Ireland'], 'uk');
C(['France', 'Belgium', 'Luxembourg', 'Monaco'], 'france');
C(['Germany', 'Italy', 'Spain', 'Portugal', 'Netherlands', 'Switzerland', 'Austria', 'Denmark', 'Sweden', 'Norway', 'Finland', 'Poland', 'Czechia', 'Czech Republic', 'Hungary', 'Greece', 'Croatia', 'Romania', 'Bulgaria', 'Serbia', 'Slovakia', 'Slovenia', 'Iceland', 'Estonia', 'Latvia', 'Lithuania', 'Turkey', 'Israel', 'Malta', 'Cyprus'], 'europe');
C(['United States of America', 'Canada'], 'us');
C(['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal'], 'india');
C(['China', 'South Korea', 'Taiwan', 'Hong Kong S.A.R.', 'Macau S.A.R', 'Singapore', 'Malaysia', 'Thailand', 'Vietnam', 'Philippines', 'Indonesia', 'Myanmar', 'Cambodia', 'North Korea', 'Mongolia'], 'eastasia');
C(['Japan'], 'japan');
C(['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Iran', 'Iraq', 'Jordan', 'Egypt', 'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Syria', 'Lebanon', 'Yemen', 'Afghanistan'], 'gulf');
C(['Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Ecuador', 'Bolivia', 'Uruguay', 'Paraguay', 'Cuba', 'Dominican Republic', 'Guatemala', 'Honduras', 'Costa Rica', 'Panama', 'Nicaragua', 'El Salvador', 'Puerto Rico', 'Jamaica', 'Haiti'], 'latam');
C(['Australia', 'New Zealand'], 'australia');
C(['Russia', 'Ukraine', 'Belarus', 'Kazakhstan', 'Uzbekistan', 'Georgia', 'Armenia', 'Azerbaijan', 'Moldova'], 'russia');
export function regionFor(country, lat) {
  if (COUNTRY[country]) return COUNTRY[country];
  if (Math.abs(lat) < 23) return 'africa';
  return 'europe';
}
export const region = key => REGIONS[key] || REGIONS.europe;
