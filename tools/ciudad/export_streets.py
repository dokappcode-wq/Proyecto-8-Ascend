"""Red de calles de un barrio para el juego (misiones: rutas, persecuciones,
el tranvía y colocar cosas en la calle, nunca dentro de un edificio).

Uso: python export_streets.py cero  →  src/city/data/streets-cero.js

Las calles del barrio y las vías grandes que lo tocan se cortan en sus
cruces; cada tramo simplificado es una arista. Coordenadas del juego
(X = x − 4500, Z = y − 3500) y ancho de la calzada en metros.
"""
import sys
import json
from shapely.geometry import LineString, MultiLineString
from shapely.ops import unary_union
import city
from fabric import ROAD_W, lines

key = sys.argv[1] if len(sys.argv) > 1 else 'cero'
g = city.build()
D = g['D'][key]
poly = D['poly']
area = poly.buffer(80)
segs = []
for l, c in D['roads']:
    if c in ('st', 'ave', 'hwy', 'alley'):
        segs.append((l, c))
for l, c, n in g['groads']:
    if l.intersects(area) and c in ('ave', 'hwy'):
        for p in lines(l.intersection(area)):
            segs.append((p, c))

# Cortar en los cruces y conservar la clase de cada tramo
noded = unary_union([l for l, c in segs])
cls_of = lambda piece: max((c for l, c in segs if l.buffer(0.6).contains(piece.interpolate(0.5, normalized=True))), key=lambda c: ROAD_W[c], default='st')
nodes = {}
xy = []
def nid(p):
    k = (round(p[0] - 4500, 1), round(p[1] - 3500, 1))
    if k not in nodes:
        nodes[k] = len(xy)
        xy.append(k)
    return nodes[k]
edges = []
for piece in lines(noded):
    if piece.length < 0.5:
        continue
    c = cls_of(piece)
    s = piece.simplify(1.5)
    pts = list(s.coords)
    for a, b in zip(pts, pts[1:]):
        ia, ib = nid(a), nid(b)
        if ia != ib:
            edges.append((ia, ib, ROAD_W[c]))
flat_n = [v for p in xy for v in p]
flat_e = [v for e in edges for v in e]
out = f'''/**
 * Red de calles de {D.get('name', key)} (generado por tools/ciudad/export_streets.py; no editar).
 * nodes: x, z, x, z… (metros, coordenadas del juego) · edges: a, b, ancho, a, b, ancho…
 */
export const STREETS = {{ district: '{key}', nodes: {json.dumps(flat_n, separators=(',', ':'))}, edges: {json.dumps(flat_e, separators=(',', ':'))} }};
'''
import os
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'city', 'data', f'streets-{key}.js')
os.makedirs(os.path.dirname(dst), exist_ok=True)
open(dst, 'w').write(out)
print(key, 'nodos', len(xy), 'aristas', len(edges), len(out) // 1024, 'KB')
