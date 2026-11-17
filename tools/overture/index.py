# Build a bbox index of every row group in an Overture theme so city extracts only download what they need.
import sys, json, time, concurrent.futures as cf
sys.path.insert(0, '.')
from s3 import *
theme = sys.argv[1]; out = sys.argv[2]
ks = keys(REL + theme)
def one(kz):
    k, z = kz
    for a in range(4):
        try:
            md = pfile(k, z).metadata; names = [md.row_group(0).column(i).path_in_schema for i in range(md.row_group(0).num_columns)]
            ix = {n: names.index('bbox.' + n) for n in ('xmin', 'xmax', 'ymin', 'ymax')}; rgs = []
            for r in range(md.num_row_groups):
                g = md.row_group(r); s = {n: g.column(i).statistics for n, i in ix.items()}
                rgs.append([s['xmin'].min, s['xmax'].max, s['ymin'].min, s['ymax'].max, g.num_rows])
            return [k, z, md.serialized_size, rgs]
        except Exception as e:
            err = e
    return [k, z, 0, None, str(err)]
t = time.time()
with cf.ThreadPoolExecutor(24) as ex: res = list(ex.map(one, ks))
json.dump(res, open(out, 'w')); print(len(res), 'files', sum(r[2] for r in res) / 1e6, 'MB footers', time.time() - t, 's', sum(1 for r in res if r[3] is None), 'failed')
