"""Convert a SMPL .pkl into web-loadable binaries in public/smpl/. Run once.

Exports the shape data (template, shape blend shapes, faces) AND the skinning data
needed to pose the body in the browser (joint regressor, skin weights, kinematic
tree). Pose-corrective blend shapes (posedirs) are intentionally skipped — they'd be
a ~17 MB asset and barely change a gentle arms-down pose.

Usage (from repo root):
    python tools/smpl/convert_smpl.py [path/to/SMPL_NEUTRAL.pkl]
"""
import json
import sys

import numpy as np

from smpl_common import NUM_BETAS, OUT_DIR, load_raw


def main(pkl_path=None) -> None:
    data, path = load_raw(pkl_path)
    print(f"Loaded SMPL model: {path}")

    v_template = np.asarray(data["v_template"], dtype=np.float64)  # (V, 3)
    shapedirs = np.asarray(data["shapedirs"], dtype=np.float64)[:, :, :NUM_BETAS]  # (V,3,B)
    faces = np.asarray(data["f"], dtype=np.uint32)  # (F, 3)
    weights = np.asarray(data["weights"], dtype=np.float64)  # (V, J) skin weights

    jr = data["J_regressor"]  # (J, V) — scipy sparse in the official .pkl
    j_regressor = np.asarray(jr.todense() if hasattr(jr, "todense") else jr, dtype=np.float64)

    parents = np.asarray(data["kintree_table"])[0].astype(int).tolist()  # parent of each joint
    parents[0] = -1  # root has no parent

    V, B, F, J = v_template.shape[0], shapedirs.shape[2], faces.shape[0], weights.shape[1]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Shape data.
    v_template.astype("<f4").ravel().tofile(OUT_DIR / "v_template.bin")  # [(v*3+c)]
    shapedirs.astype("<f4").reshape(V * 3, B).ravel().tofile(OUT_DIR / "shapedirs.bin")  # [(v*3+c)*B+b]
    faces.astype("<u4").ravel().tofile(OUT_DIR / "faces.bin")  # [(f*3+i)]
    # Skinning data.
    j_regressor.astype("<f4").ravel().tofile(OUT_DIR / "j_regressor.bin")  # (J,V) row-major [k*V+i]
    weights.astype("<f4").ravel().tofile(OUT_DIR / "weights.bin")  # (V,J) row-major [i*J+k]

    (OUT_DIR / "body.json").write_text(
        json.dumps(
            {
                "vertexCount": int(V),
                "betaCount": int(B),
                "faceCount": int(F),
                "jointCount": int(J),
                "parents": parents,
            },
            indent=2,
        )
    )

    print(f"Wrote {V} verts, {F} faces, {B} betas, {J} joints -> {OUT_DIR}")
    print("Next: python tools/smpl/calibrate.py")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
