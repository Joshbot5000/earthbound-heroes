# fetch(theme_index, bbox, columns) -> pyarrow table of rows whose bbox intersects
import sys, json, concurrent.futures as cf
sys.path.insert(0, '.')
from s3 import *
import pyarrow as pa, pyarrow.compute as pc
def fetch(idx, bb, cols):
    x0, y0, x1, y1 = bb; jobs = []
    for k, z, _, rgs in json.load(open(idx)):
        for r, g in enumerate(rgs or []):
            if g[0] <= x1 and g[1] >= x0 and g[2] <= y1 and g[3] >= y0: jobs.append((k, z, r))
    def rd(j):
        k, z, r = j
        for a in range(4):
            try:
                t = pfile(k, z).read_row_group(r, columns=cols + ['bbox'])
                b = t['bbox']; m = pc.and_(pc.and_(pc.less_equal(pc.struct_field(b, 'xmin'), x1), pc.greater_equal(pc.struct_field(b, 'xmax'), x0)), pc.and_(pc.less_equal(pc.struct_field(b, 'ymin'), y1), pc.greater_equal(pc.struct_field(b, 'ymax'), y0)))
                return t.filter(m)
            except Exception as e: err = e
        raise err
    with cf.ThreadPoolExecutor(16) as ex: ts = list(ex.map(rd, jobs))
    ts = [t for t in ts if t.num_rows]
    print(f'  {idx}: {len(jobs)} row groups -> {sum(t.num_rows for t in ts)} rows', file=sys.stderr)
    return pa.concat_tables(ts) if ts else None
