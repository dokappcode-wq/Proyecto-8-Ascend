from city import build
from data import B
from shapely.geometry import Point
from shapely.ops import nearest_points
c, P, wat, out, br = build()
bad = 0
for bid, d in B.items():
    poly = P[bid]; land = out[bid]['land']
    items = []
    items += [('zona', z[0], z[1]) for z in d['zones']]
    items += [('secreto', s[0], s[1]) for s in d['secrets']]
    items += [('bloq', s[0], s[1]) for s in d['blocked']]
    items += [('pdc', s[0], s[1]) for s in d['posts']]
    items += [('tel', 'tel', s) for s in d['phones']]
    if d['incarnation']: items.append(('enc', d['incarnation']['name'], d['incarnation']['at']))
    for kind, name, at in items:
        p = Point(at)
        if not land.contains(p):
            q = nearest_points(land, p)[0]
            where = [k for k, pp in P.items() if pp.contains(p)]
            print(f'{bid} {kind:7s} {name[:34]:34s} {at} -> fuera (en {where}, agua={wat["water"].contains(p)}) cercano {round(q.x)},{round(q.y)} d={round(p.distance(q))}')
            bad += 1
    if d.get('exit'):
        e = d['exit']; p = Point(e['at']); nb = P[e['to']]
        dd = max(poly.distance(p), nb.distance(p))
        if dd > 40:
            print(bid, 'salida lejos del borde', e['at'], round(dd))
print('fuera:', bad)
