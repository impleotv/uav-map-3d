"""Generate Impleo's original, redistributable glTF 2.0 platform presets.

Dimensions are metres. glTF axes are +X nose, +Y up, +Z starboard.
Run from any directory; output is assets/models.
"""
import base64
import json
import math
from pathlib import Path
import struct

OUTPUT = Path(__file__).resolve().parents[1] / "assets/models"
COLORS = [[0.78, 0.84, 0.90, 1], [0.10, 0.20, 0.27, 1], [0.06, 0.55, 0.85, 1]]


class Model:
    def __init__(self):
        self.vertices = [[], [], []]

    def triangle(self, a, b, c, material=0):
        u, v = [b[i]-a[i] for i in range(3)], [c[i]-a[i] for i in range(3)]
        normal = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        length = math.sqrt(sum(x*x for x in normal)) or 1
        normal = [x/length for x in normal]
        for point in (a, b, c):
            self.vertices[material].append((*point, *normal))

    def box(self, center, size, material=0):
        x, y, z = center
        a, b, c = [d/2 for d in size]
        points = [(x+sx*a, y+sy*b, z+sz*c) for sx, sy, sz in
                  [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(1,2,6,5),(0,4,7,3)]:
            self.triangle(*(points[i] for i in face[:3]), material)
            self.triangle(*(points[i] for i in (face[0],face[2],face[3])), material)

    def ellipsoid(self, center, radii, material=0):
        def point(lat, lon):
            return [center[0]+radii[0]*math.cos(lat)*math.cos(lon),
                    center[1]+radii[1]*math.sin(lat), center[2]+radii[2]*math.cos(lat)*math.sin(lon)]
        for row in range(12):
            lo, hi = -math.pi/2+row*math.pi/12, -math.pi/2+(row+1)*math.pi/12
            for col in range(24):
                a, b = col*math.tau/24, (col+1)*math.tau/24
                self.triangle(point(lo,a), point(hi,a), point(hi,b), material)
                self.triangle(point(lo,a), point(hi,b), point(lo,b), material)

    def save(self, name):
        data = bytearray()
        views, accessors, primitives = [], [], []
        for material, vertices in enumerate(self.vertices):
            if not vertices:
                continue
            attributes = {}
            for attribute, offset in [("POSITION",0),("NORMAL",3)]:
                values = [v[offset:offset+3] for v in vertices]
                start = len(data)
                for value in values:
                    data.extend(struct.pack("<3f",*value))
                views.append({"buffer":0,"byteOffset":start,"byteLength":len(data)-start,"target":34962})
                accessor = {"bufferView":len(views)-1,"componentType":5126,"count":len(vertices),"type":"VEC3"}
                if attribute == "POSITION":
                    accessor.update(min=[min(v[i] for v in values) for i in range(3)],
                                    max=[max(v[i] for v in values) for i in range(3)])
                attributes[attribute] = len(accessors)
                accessors.append(accessor)
            primitives.append({"attributes":attributes,"material":material})
        doc = {"asset":{"version":"2.0","generator":"STView original platform presets"},
               "scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"mesh":0}],"meshes":[{"primitives":primitives}],
               "materials":[{"pbrMetallicRoughness":{"baseColorFactor":color,"metallicFactor":0.15,"roughnessFactor":0.7},"doubleSided":True} for color in COLORS],
               "buffers":[{"byteLength":len(data),"uri":"data:application/octet-stream;base64,"+base64.b64encode(data).decode()}],
               "bufferViews":views,"accessors":accessors}
        OUTPUT.mkdir(parents=True,exist_ok=True)
        (OUTPUT/f"{name}.gltf").write_text(json.dumps(doc,separators=(",",":"))+"\n",encoding="utf-8")


uav = Model()
uav.ellipsoid((0,0,0),(3.5,0.45,0.5))
uav.box((-0.4,0,0),(1.2,0.10,10))
uav.box((-2.7,0.25,0),(0.7,0.08,2.8))
uav.box((-2.7,0.65,0),(0.8,1.0,0.10),2)
uav.ellipsoid((1.7,0.32,0),(0.75,0.30,0.36),1)
uav.ellipsoid((1.2,-0.5,0),(0.24,0.24,0.24),1)
uav.save("uav")

helicopter = Model()
helicopter.ellipsoid((1,0,0),(2.2,0.9,0.8))
helicopter.ellipsoid((2.1,0.25,0),(1.0,0.65,0.7),1)
helicopter.box((-2.2,0.15,0),(4,0.25,0.25))
helicopter.box((-4.1,0.75,0),(0.5,1.6,0.12),2)
helicopter.box((0.5,1.4,0),(0.16,1.2,0.16),1)
helicopter.box((0.5,2,0),(10,0.08,0.23),1)
helicopter.box((0.5,2,0),(0.23,0.08,10),1)
for z in [-0.9,0.9]:
    helicopter.box((0.8,-1.05,z),(4.2,0.12,0.12),1)
    helicopter.box((0,-0.7,z),(0.12,0.7,0.12),1)
helicopter.save("helicopter")

quad = Model()
quad.box((0,0,0),(0.5,0.18,0.4))
quad.box((0,0,0),(1.6,0.06,0.10),1)
quad.box((-0.7,0,0),(0.10,0.06,1.5),1)
quad.box((0.7,0,0),(0.10,0.06,1.5),1)
for x in [-0.7,0.7]:
    for z in [-0.7,0.7]:
        quad.ellipsoid((x,0.04,z),(0.10,0.12,0.10),1)
        quad.box((x,0.18,z),(0.68,0.02,0.08),2 if x>0 else 1)
quad.ellipsoid((0.22,-0.18,0),(0.12,0.12,0.12),1)
quad.save("quadcopter")

camera = Model()
camera.box((0,0,0),(0.45,0.26,0.28))
camera.ellipsoid((0.26,0,0),(0.10,0.10,0.10),1)
camera.box((-0.08,-0.36,0),(0.06,0.6,0.06),1)
camera.box((-0.08,-0.65,0),(0.55,0.04,0.55),1)
camera.save("camera")
