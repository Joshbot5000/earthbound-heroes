# Minimal anonymous HTTP range reader for Overture's public S3 bucket (goes through the proxy via requests).
import requests, io, re, os, json, concurrent.futures as cf
import pyarrow.parquet as pq
B = 'https://overturemaps-us-west-2.s3.amazonaws.com/'
REL = 'release/2026-10-21.0/'
S = requests.Session()
def keys(prefix):
    out, tok = [], None
    while True:
        u = B + '?list-type=2&prefix=' + prefix + ('&continuation-token=' + requests.utils.quote(tok) if tok else '')
        s = S.get(u, timeout=60).text
        out += [(k, int(z)) for k, z in re.findall(r'<Key>([^<]*)</Key>.*?<Size>(\d+)</Size>', s)]
        m = re.search(r'<NextContinuationToken>([^<]*)</NextContinuationToken>', s)
        if not m: return out
        tok = m.group(1)
class RangeFile(io.RawIOBase):
    def __init__(self, key, size): self.key, self.size, self.pos = key, size, 0; self.cache = {}
    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, o, w=0):
        self.pos = o if w == 0 else self.pos + o if w == 1 else self.size + o; return self.pos
    def read(self, n=-1):
        if n < 0: n = self.size - self.pos
        if n == 0 or self.pos >= self.size: return b''
        end = min(self.size, self.pos + n) - 1
        for i in range(5):
            try:
                r = S.get(B + self.key, headers={'Range': f'bytes={self.pos}-{end}'}, timeout=120); r.raise_for_status(); d = r.content; break
            except Exception as e:
                if i == 4: raise
        self.pos += len(d); return d
    def readinto(self, b):
        d = self.read(len(b)); b[:len(d)] = d; return len(d)
def pfile(key, size): return pq.ParquetFile(io.BufferedReader(RangeFile(key, size), buffer_size=1 << 20))
