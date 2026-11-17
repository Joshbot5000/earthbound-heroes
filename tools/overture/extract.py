# Extracts one hero city from Overture Maps into a compact gzipped binary the game streams.
# Data: Overture Maps Foundation (buildings, transportation, base). Most of it is OpenStreetMap, ODbL.
import sys, json, math, struct, gzip, io, hashlib, re, collections
sys.path.insert(0, '.')
from fetch import fetch
import shapely, numpy as np
from shapely import wkb
from shapely.geometry import Polygon, MultiPolygon, LineString, Point, box
from shapely.ops import unary_union
from PIL import Image, ImageDraw

CITIES = {
    'london': dict(name='London', bbox=(-0.163, 51.488, -0.062, 51.523), region='uk', drive='left'),
    'mumbai': dict(name='Mumbai', bbox=(72.800, 18.893, 72.862, 19.030), region='india', drive='left'),
    'newyork': dict(name='New York', bbox=(-74.020, 40.700, -73.965, 40.770), region='us', drive='right'),
    'paris': dict(name='Paris', bbox=(2.280, 48.845, 2.365, 48.875), region='france', drive='right'),
    'tokyo': dict(name='Tokyo', bbox=(139.735, 35.650, 139.790, 35.700), region='japan', drive='left'),
    'dubai': dict(name='Dubai', bbox=(55.250, 25.175, 55.300, 25.215), region='gulf', drive='right'),
    'sydney': dict(name='Sydney', bbox=(151.195, -33.880, 151.225, -33.850), region='australia', drive='left'),
}
key = sys.argv[1]; C = CITIES[key]; x0, y0, x1, y1 = C['bbox']
lat0, lon0 = (y0 + y1) / 2, (x0 + x1) / 2; M = 111320.0; cos0 = math.cos(math.radians(lat0)); Q = 4  # 0.25 m units
def P(lon, lat): return ((lon - lon0) * M * cos0, -(lat - lat0) * M)
def proj(g): return shapely.transform(g, lambda a: np.column_stack(((a[:, 0] - lon0) * M * cos0, -(a[:, 1] - lat0) * M)))
W, H = (x1 - x0) * M * cos0, (y1 - y0) * M
zone = box(-W / 2, -H / 2, W / 2, H / 2)
print(key, f'{W/1000:.1f} x {H/1000:.1f} km', file=sys.stderr)

names, nameIx = [''], {'': 0}
def nm(s):
    if not s: return 0
    if s not in nameIx:
        if len(names) >= 65535: return 0
        nameIx[s] = len(names); names.append(s)
    return nameIx[s]
def h8(s): return int(hashlib.md5(s.encode()).hexdigest()[:8], 16) / 2**32

# ---------------- buildings ----------------
cols = ['id', 'names', 'height', 'min_height', 'num_floors', 'min_floor', 'roof_shape', 'roof_height', 'facade_color', 'facade_material', 'roof_color', 'class', 'is_underground', 'geometry']
B = fetch('idx_building.json', C['bbox'], cols + ['has_parts']).to_pylist()
Pt = fetch('idx_part.json', C['bbox'], cols + ['building_id'])
parts = collections.defaultdict(list)
for p in (Pt.to_pylist() if Pt is not None else []): parts[p['building_id']].append(p)
recs = []
for b in B:
    if b['is_underground']: continue
    ps = parts.get(b['id']) if b['has_parts'] else None
    if ps:
        # keep the outline as a low base only where parts do not cover it
        items = [p for p in ps if not p['is_underground']]
        for p in items: p['_name'] = (b['names'] or {}).get('primary'); p['_cls'] = b['class']
        recs += items
    else:
        b['_name'] = (b['names'] or {}).get('primary'); b['_cls'] = b['class']; recs.append(b)
ROOF = {None: 0, 'flat': 0, 'gabled': 1, 'hipped': 2, 'half_hipped': 2, 'pyramidal': 3, 'dome': 4, 'onion': 4, 'round': 4, 'mansard': 5, 'gambrel': 5, 'saltbox': 1, 'skillion': 0, 'spherical': 4}
MAT = {None: 0, 'brick': 1, 'stone': 2, 'plaster': 3, 'concrete': 4, 'glass': 5, 'metal': 6, 'wood': 7, 'timber_framing': 7, 'cement_block': 4, 'sandstone': 2, 'marble': 2}
CLS = {'house': 1, 'detached': 1, 'semidetached_house': 1, 'terrace': 1, 'residential': 2, 'apartments': 2, 'dormitory': 2, 'commercial': 3, 'retail': 3, 'office': 4, 'hotel': 4,
       'church': 5, 'cathedral': 5, 'chapel': 5, 'mosque': 5, 'temple': 5, 'synagogue': 5, 'shrine': 5, 'religious': 5, 'civic': 6, 'government': 6, 'public': 6, 'school': 6, 'university': 6, 'college': 6,
       'hospital': 6, 'museum': 6, 'train_station': 6, 'transportation': 6, 'industrial': 7, 'warehouse': 7, 'storage_tank': 7, 'garage': 7, 'garages': 7, 'shed': 8, 'hut': 8, 'roof': 8, 'kiosk': 8}
CSS = {'white': 'ffffff', 'black': '222222', 'grey': '888888', 'gray': '888888', 'red': 'aa3322', 'brown': '7a5230', 'yellow': 'd8c070', 'beige': 'd8c8a0', 'cream': 'efe6c8', 'blue': '4a6a9a', 'green': '557755', 'orange': 'd07a30', 'pink': 'e0a0a0', 'tan': 'c8a878', 'silver': 'b8bcc0', 'maroon': '6a2020'}
def col565(s):
    if not s: return 0
    s = s.strip().lower(); s = CSS.get(s, s).lstrip('#')
    if not re.fullmatch(r'[0-9a-f]{6}|[0-9a-f]{3}', s): return 0
    if len(s) == 3: s = ''.join(c * 2 for c in s)
    r, g, b = int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)
    return max(1, ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3))
polys = []
for r in recs:
    try: g = proj(wkb.loads(r['geometry']))
    except Exception: continue
    if not g.is_valid: g = g.buffer(0)
    g = g.intersection(zone)
    if g.is_empty: continue
    g = g.simplify(0.35, preserve_topology=True)
    for p in (g.geoms if hasattr(g, 'geoms') else [g]):
        if p.geom_type == 'Polygon' and p.area >= 5: polys.append((r, p))
# height: real where known, otherwise borrowed from neighbours, otherwise a regional rule
known = []
for r, p in polys:
    h = r['height'] or (r['num_floors'] * 3.3 + (1.5 if (r['num_floors'] or 0) > 2 else 0.5) if r['num_floors'] else None)
    r['_h'] = h
    if h: known.append((p.centroid.x, p.centroid.y, h))
grid = collections.defaultdict(list)
for x, y, h in known: grid[(int(x // 100), int(y // 100))].append((x, y, h))
region = C['region']
def guess(r, p):
    a = p.area; c = p.centroid; near = []
    gx, gy = int(c.x // 100), int(c.y // 100)
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for x, y, h in grid.get((gx + i, gy + j), ()):
                if (x - c.x) ** 2 + (y - c.y) ** 2 < 110 ** 2: near.append(h)
    rnd = h8(str(r.get('id')) + 'h')
    cls = CLS.get(r['_cls'], 0)
    if region == 'india':
        base = 3.6 if a < 35 else 6.5 if a < 90 else 13 + rnd * 8 if a < 300 else 18 + rnd * 12 if a < 1200 else 22 + rnd * 20
        if a < 60 and cls == 0: return base * (0.8 + 0.4 * rnd)
    elif region == 'uk':
        base = 11 + rnd * 4 if a < 160 else 15 + rnd * 6 if a < 900 else 20 + rnd * 9
    elif region in ('us', 'gulf'):
        base = 12 + rnd * 10 if a < 400 else 20 + rnd * 30
    else:
        base = 12 + rnd * 8 if a < 400 else 18 + rnd * 12
    if cls == 8: return 3 + rnd
    if cls == 1: base = min(base, 12)
    if len(near) >= 3:
        near.sort(); m = near[len(near) // 2]
        if a < 25: return min(m, 5)
        return m * (0.85 + 0.3 * rnd) if region != 'india' else 0.5 * m + 0.5 * base
    return base
out_b = bytearray(); nb = 0; est = 0
for r, p in polys:
    h = r['_h']
    if not h: h = guess(r, p); est += 1
    mh = r.get('min_height') or 0
    if h - mh < 1.5: continue
    p = shapely.geometry.polygon.orient(p, 1.0)
    rings = [p.exterior] + [i for i in p.interiors if Polygon(i).area > 12]
    roof = ROOF.get(r['roof_shape'], 0)
    if roof == 0 and not r['roof_shape'] and region == 'uk' and CLS.get(r['_cls'], 0) in (0, 1, 2) and h < 18 and p.area < 400 and len(p.exterior.coords) <= 9: roof = 1 if h8(str(r.get('id'))) < 0.7 else 2
    out_b += struct.pack('<BBHHHBBH', roof, CLS.get(r['_cls'], 0), min(65535, int(h * 10)), min(65535, int(mh * 10)), col565(r['facade_color']), MAT.get(r['facade_material'], 0), len(rings), nm(r['_name'] if p.area > 150 else None))
    for ring in rings:
        cs = list(ring.coords)[:-1]
        out_b += struct.pack('<H', len(cs))
        for x, y in cs: out_b += struct.pack('<hh', int(round(x * Q)), int(round(y * Q)))
    nb += 1
print(f'  buildings {nb} ({est} heights estimated)', file=sys.stderr)

# ---------------- roads ----------------
DRIVE = {'motorway': 1, 'trunk': 2, 'primary': 3, 'secondary': 4, 'tertiary': 5, 'residential': 6, 'unclassified': 6, 'unknown': 6, 'living_street': 7, 'service': 8}
WALK = {'pedestrian': 10, 'footway': 11, 'path': 11, 'steps': 12, 'cycleway': 11, 'bridleway': 11, 'track': 11, 'sidewalk': 11, 'crosswalk': 11}
S = fetch('idx_segment.json', C['bbox'], ['id', 'subtype', 'class', 'connectors', 'road_flags', 'level_rules', 'names', 'geometry'])
nodes, nodeIx = [], {}
def node(cid, x, y):
    if cid not in nodeIx: nodeIx[cid] = len(nodes); nodes.append((x, y))
    return nodeIx[cid]
out_r = bytearray(); ne = 0; zoneBig = zone.buffer(150)
for s in S.to_pylist():
    if s['subtype'] != 'road': continue
    cls = DRIVE.get(s['class']) or WALK.get(s['class'])
    if not cls: continue
    g = proj(wkb.loads(s['geometry']))
    if not g.intersects(zoneBig) or g.geom_type != 'LineString': continue
    L = g.length
    if L < 0.5: continue
    flags = []
    for f in s['road_flags'] or []:
        a, b2 = (f['between'] or [0, 1])
        if 'is_bridge' in f['values']: flags.append(('b', a, b2))
        if 'is_tunnel' in f['values']: flags.append(('t', a, b2))
        if 'is_under_construction' in f['values']: flags.append(('t', a, b2))
    for f in s['level_rules'] or []:
        if (f.get('value') or 0) < 0: flags.append(('t', *(f.get('between') or [0, 1])))
    con = sorted(s['connectors'] or [], key=lambda c: c['at'])
    if len(con) < 2: continue
    name = nm((s['names'] or {}).get('primary'))
    for c0, c1 in zip(con, con[1:]):
        a, b2 = c0['at'], c1['at']
        if b2 - a < 1e-9: continue
        sub = shapely.ops.substring(g, a * L, b2 * L)
        if sub.geom_type != 'LineString' or not sub.intersects(zoneBig): continue
        sub = sub.simplify(0.4)
        mid = (a + b2) / 2; fl = 0
        for k, fa, fb in flags:
            if fa <= mid <= fb: fl |= 1 if k == 'b' else 2
        cs = list(sub.coords)
        na, nb2 = node(c0['connector_id'], *cs[0]), node(c1['connector_id'], *cs[-1])
        if len(cs) > 65000 or any(abs(v) > 8150 for xy in cs for v in xy): continue
        out_r += struct.pack('<BBHIIH', cls, fl, name, na, nb2, len(cs))
        for x, y in cs: out_r += struct.pack('<hh', int(round(x * Q)), int(round(y * Q)))
        ne += 1
print(f'  road edges {ne}, nodes {len(nodes)}', file=sys.stderr)

# ---------------- ground mask (4 m) ----------------
R = 4.0; MW, MH = int(math.ceil(W / R)), int(math.ceil(H / R))
def px(x, y): return ((x + W / 2) / R, (y + H / 2) / R)
coastal = False
LAND = fetch('idx_land.json', C['bbox'], ['subtype', 'class', 'geometry'])
WATER = fetch('idx_water.json', C['bbox'], ['subtype', 'class', 'geometry'])
LU = fetch('idx_landuse.json', C['bbox'], ['subtype', 'class', 'geometry'])
landpolys = [g for r in LAND.to_pylist() if r['subtype'] == 'land' for g in [proj(wkb.loads(r['geometry']))] if g.geom_type in ('Polygon', 'MultiPolygon') and g.intersects(zone)]
ocean = [r for r in WATER.to_pylist() if r['subtype'] == 'ocean']
coastal = bool(landpolys) and (bool(ocean) or unary_union(landpolys).intersection(zone).area < zone.area * 0.98)
im = Image.new('L', (MW, MH), 0 if coastal else 1); d = ImageDraw.Draw(im)
def fillg(g, v):
    for p in (g.geoms if hasattr(g, 'geoms') else [g]):
        if p.geom_type != 'Polygon' or p.is_empty: continue
        d.polygon([px(*c) for c in p.exterior.coords], fill=v)
        for i in p.interiors: d.polygon([px(*c) for c in i.coords], fill=0 if v else 1)
if coastal:
    for g in landpolys: fillg(g, 1)
GREEN = {'park': 2, 'garden': 2, 'grass': 2, 'recreation_ground': 2, 'village_green': 2, 'cemetery': 2, 'grave_yard': 2, 'meadow': 2, 'golf_course': 2, 'fairway': 2, 'pitch': 4, 'playground': 2, 'zoo': 2, 'nature_reserve': 2, 'allotments': 2, 'wood': 5, 'forest': 5, 'scrub': 2, 'beach': 3, 'sand': 3, 'bunker': 3, 'pedestrian': 6, 'plaza': 6, 'square': 6}
for r in LU.to_pylist():
    v = GREEN.get(r['class'])
    if v: fillg(proj(wkb.loads(r['geometry'])), v)
for r in LAND.to_pylist():
    v = GREEN.get(r['class']) if r['subtype'] in ('grass', 'forest', 'sand', 'wetland') else None
    if v: fillg(proj(wkb.loads(r['geometry'])), v)
WSUB = {'river', 'canal', 'lake', 'pond', 'reservoir', 'water', 'ocean', 'lagoon', 'basin'}
for r in WATER.to_pylist():
    if r['subtype'] in WSUB and r['class'] not in ('drain', 'ditch', 'swimming_pool', 'fountain'):
        g = proj(wkb.loads(r['geometry']))
        if g.geom_type in ('Polygon', 'MultiPolygon'): fillg(g, 0)
buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True); maskpng = buf.getvalue()
hist = np.bincount(np.asarray(im).ravel(), minlength=7); print('  mask', MW, MH, 'coastal' if coastal else 'inland', 'water %.0f%% green %.0f%%' % (hist[0] / hist.sum() * 100, (hist[2] + hist[5]) / hist.sum() * 100), len(maskpng) // 1024, 'KB', file=sys.stderr)
im.convert('P').resize((MW // 2, MH // 2)).point(lambda v: v * 40).save(f'mask_{key}.png')

# ---------------- street furniture and trees ----------------
PROP = {'street_lamp': 1, 'bench': 2, 'bollard': 3, 'post_box': 4, 'bus_stop': 5, 'traffic_signals': 6, 'fire_hydrant': 7, 'waste_basket': 8, 'telephone': 9, 'atm': 0, 'fountain': 10}
I = fetch('idx_infra.json', C['bbox'], ['subtype', 'class', 'geometry'])
out_p = bytearray(); cnt = collections.Counter()
def addp(t, x, y):
    global out_p
    if abs(x) < W / 2 and abs(y) < H / 2: out_p += struct.pack('<Bhh', t, int(round(x * Q)), int(round(y * Q))); cnt[t] += 1
for r in I.to_pylist():
    t = PROP.get(r['class'])
    if not t: continue
    g = proj(wkb.loads(r['geometry']))
    if g.geom_type == 'Point': addp(t, g.x, g.y)
for r in LAND.to_pylist():
    if r['subtype'] != 'tree': continue
    g = proj(wkb.loads(r['geometry']))
    if g.geom_type == 'Point': addp(20, g.x, g.y)
    elif g.geom_type == 'LineString':
        for k in range(0, int(g.length // 9) + 1): q = g.interpolate(k * 9); addp(20, q.x, q.y)
print('  props', dict(cnt), file=sys.stderr)

hdr = dict(v=1, key=key, name=C['name'], lat0=lat0, lon0=lon0, w=W, h=H, q=Q, region=region, drive=C['drive'], mask=dict(w=MW, h=MH, r=R),
           counts=dict(b=nb, e=ne, n=len(nodes)), names=names,
           sizes=[len(out_b), len(out_r), len(out_p), len(maskpng)],
           credit='Map data © OpenStreetMap contributors (ODbL) and Overture Maps Foundation')
hj = json.dumps(hdr, ensure_ascii=False, separators=(',', ':')).encode()
blob = b'EHC1' + struct.pack('<I', len(hj)) + hj
for sec in (out_b, out_r, out_p, maskpng):
    blob += b'\0' * ((-len(blob)) % 4) + bytes(sec)
gz = gzip.compress(blob, 9)
open(f'{key}.bin.gz', 'wb').write(gz)
print(f'  wrote {key}.bin.gz {len(gz)/1e6:.2f} MB (raw {len(blob)/1e6:.2f} MB)', file=sys.stderr)
