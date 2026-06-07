"""Export the SMPL rest-pose (T-pose) average body as a .glb, for modelling garments on.

Import the result into Blender, model a garment fitted to this body, then export just
the garment as a .glb (see tools/smpl/README.md). Modelling on this exact template (rest
pose, metres, Y-up) is what lets the app transfer the body's skinning to the garment so it
fits any measurements + the pose.

Usage (from repo root):
    python tools/smpl/export_template_glb.py
"""
import json
import struct
import sys

import numpy as np

from smpl_common import ROOT, load_model

OUT = ROOT / "models" / "smpl" / "body_template.glb"


def write_glb(path, vertices: np.ndarray, faces: np.ndarray) -> None:
    verts = np.ascontiguousarray(vertices, dtype="<f4")  # (V,3)
    idx = np.ascontiguousarray(faces.reshape(-1), dtype="<u4")  # (F*3,)
    v_bytes = verts.tobytes()
    i_bytes = idx.tobytes()  # offset len(v_bytes) is V*3*4 -> always 4-aligned
    bin_data = v_bytes + i_bytes
    bin_data += b"\x00" * ((4 - len(bin_data) % 4) % 4)

    gltf = {
        "asset": {"version": "2.0", "generator": "fashion-advisor SMPL template"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "SMPL_template"}],
        "meshes": [{"name": "SMPL_template", "primitives": [{"attributes": {"POSITION": 0}, "indices": 1}]}],
        "buffers": [{"byteLength": len(bin_data)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(v_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(v_bytes), "byteLength": len(i_bytes), "target": 34963},
        ],
        "accessors": [
            {
                "bufferView": 0, "componentType": 5126, "count": len(verts), "type": "VEC3",
                "min": verts.min(0).tolist(), "max": verts.max(0).tolist(),
            },
            {"bufferView": 1, "componentType": 5125, "count": len(idx), "type": "SCALAR"},
        ],
    }

    json_bytes = json.dumps(gltf).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)

    total = 12 + 8 + len(json_bytes) + 8 + len(bin_data)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))  # 'glTF', version 2, total length
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))  # JSON chunk
        f.write(json_bytes)
        f.write(struct.pack("<II", len(bin_data), 0x004E4942))  # BIN chunk
        f.write(bin_data)


def main(pkl_path=None) -> None:
    v_template, _shapedirs, faces = load_model(pkl_path)
    write_glb(OUT, v_template, faces)
    print(f"Wrote template body ({len(v_template)} verts, {len(faces)} faces) -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
