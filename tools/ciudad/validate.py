import city
from data import B, ORDER
from shapely.geometry import Point
from shapely.ops import nearest_points
g = city.build()
P = {k: D['poly'] for k, D in g['D'].items()}
bad = 0
for k, d in B.items():
    poly = P[k]
    items = [('zona', n, at) for n, at in d['zones']] + [('secreto', n, at) for n, at, t in d['secrets']] + \
            [('bloq', n, at) for n, at, r in d['blocked']] + [('torre', 'torre', d['tower'])] + [('metro', 'metro', m) for m in d['metro']] + \
            [('ancla', d['anchor']['name'], d['anchor']['at'])]
    if d['incarnation']:
        items.append(('enc', d['incarnation']['name'], d['incarnation']['at']))
    for kind, name, at in items:
        p = Point(at)
        if not poly.buffer(5).contains(p):
            q = nearest_points(poly, p)[0]
            where = [kk for kk, pp in P.items() if pp.contains(p)]
            print(f'{k:10s} {kind:7s} {name[:36]:36s} {at} fuera (en {where}) -> {round(q.x)},{round(q.y)} d={round(p.distance(q))}')
            bad += 1
    if d.get('exit'):
        e = d['exit']; p = Point(e['at'])
        da, db = poly.distance(p), P[e['to']].distance(p)
        if max(da, db) > 60:
            print(k, 'salida lejos', e['at'], round(da), round(db))
for name, l, c, a, b in g['bridges']:
    p0, p1 = Point(l.coords[0]), Point(l.coords[-1])
    print('puente', name, a, round(P[a].distance(p0)), b, round(P[b].distance(p1)))
print('fuera', bad)
