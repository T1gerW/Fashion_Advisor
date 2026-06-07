"""Fit a measurements -> betas regressor for the browser. Run after convert_smpl.py.

Samples random SMPL bodies, measures the same 6 features the app collects, and fits a
ridge linear map measurements -> betas. Writes public/smpl/betas_regressor.json.

The measurement heuristics below (landmark heights, crotch detection) are first
approximations and may need tuning against the real model — see tools/smpl/README.md.

Usage (from repo root):
    python tools/smpl/calibrate.py [path/to/SMPL_NEUTRAL.pkl]
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.spatial import ConvexHull

from smpl_common import NUM_BETAS, OUT_DIR, load_model

# MUST match FEATURE_ORDER in src/smpl/shape.ts.
FEATURES = ["height", "shoulder", "chest", "waist", "hip", "inseam"]

# Landmark heights as a fraction of stature, measured from the feet up.
FRAC = {"hip": 0.52, "waist": 0.62, "chest": 0.72}
# Shoulder breadth is sampled just BELOW the arms (in a T-pose the shoulder-height
# slice is full of outstretched arms, which would measure arm span, not breadth).
SHOULDER_FRACS = (0.70, 0.73, 0.76)


def shaped(v_template, shapedirs_flat, betas):
    """v_template (V,3) + shapedirs (V*3,B) . betas (B,) -> vertices (V,3)."""
    V = v_template.shape[0]
    return v_template + (shapedirs_flat @ betas).reshape(V, 3)


def vertical_axis(verts):
    """SMPL is defined Y-up, so the vertical axis is always Y (index 1). We do NOT
    pick the largest-extent axis: in a T-pose the arm span can match/exceed the
    height and mis-identify it — the same trap that tipped the rendered mesh over."""
    return 1


def _slice(verts, axis, y, band):
    mask = np.abs(verts[:, axis] - y) < band
    if mask.sum() < 8:
        return None
    return np.delete(verts[mask], axis, axis=1)  # the two horizontal coords


def slice_perimeter(verts, axis, y, band):
    """Circumference ~ convex-hull perimeter of a thin horizontal slice."""
    plane = _slice(verts, axis, y, band)
    if plane is None:
        return 0.0
    try:
        pts = plane[ConvexHull(plane).vertices]
    except Exception:
        return 0.0
    d = np.diff(np.vstack([pts, pts[0]]), axis=0)
    return float(np.sqrt((d ** 2).sum(1)).sum())


def breadth(verts, axis, y, band):
    """Shoulder breadth ~ widest horizontal extent of a slice."""
    plane = _slice(verts, axis, y, band)
    if plane is None:
        return 0.0
    return float((plane.max(0) - plane.min(0)).max())


def find_crotch_index(verts):
    """Index of the crotch vertex = the lowest vertex on the body's mid-sagittal
    centre line, in the pelvis region. SMPL topology is fixed, so this index is
    valid for EVERY shaped body — which makes inseam (crotch height above the
    floor) robust even when the thighs touch (a gap-based search fails then)."""
    axis = vertical_axis(verts)
    side = [a for a in range(3) if a != axis][0]  # left-right axis
    lo = verts[:, axis].min()
    H = verts[:, axis].max() - lo
    cx = verts[:, side].mean()
    on_centre = np.abs(verts[:, side] - cx) < 0.01  # within 1 cm of the centre line
    in_pelvis = (verts[:, axis] > lo + 0.40 * H) & (verts[:, axis] < lo + 0.58 * H)
    cand = np.where(on_centre & in_pelvis)[0]
    if len(cand) == 0:
        return int(np.argmin(verts[:, axis]))
    return int(cand[np.argmin(verts[cand, axis])])


def measure(verts, crotch_idx):
    """Measure the 6 features, returned in centimetres to match the app's inputs."""
    axis = vertical_axis(verts)
    lo = float(verts[:, axis].min())
    hi = float(verts[:, axis].max())
    H = hi - lo
    band = 0.01 * H
    chest = slice_perimeter(verts, axis, lo + FRAC["chest"] * H, band)
    waist = slice_perimeter(verts, axis, lo + FRAC["waist"] * H, band)
    hip = slice_perimeter(verts, axis, lo + FRAC["hip"] * H, band)
    shoulder = max(breadth(verts, axis, lo + f * H, band) for f in SHOULDER_FRACS)
    inseam = verts[crotch_idx, axis] - lo  # crotch height above the floor = leg length
    return np.array([H, shoulder, chest, waist, hip, inseam]) * 100.0


def main(pkl_path=None, n_samples: int = 4000, seed: int = 0, ridge: float = 1.0) -> None:
    v_template, shapedirs, _ = load_model(pkl_path, NUM_BETAS)
    V, _, B = shapedirs.shape
    shapedirs_flat = shapedirs.reshape(V * 3, B)
    crotch_idx = find_crotch_index(v_template)  # fixed landmark; reused for every body

    rng = np.random.default_rng(seed)
    betas = np.clip(rng.normal(0.0, 1.8, size=(n_samples, B)), -3.5, 3.5)

    X = np.zeros((n_samples, len(FEATURES)))
    for i in range(n_samples):
        X[i] = measure(shaped(v_template, shapedirs_flat, betas[i]), crotch_idx)
        if (i + 1) % 500 == 0:
            print(f"  measured {i + 1}/{n_samples}")

    # Standardise measurements so the regularisation below is well-scaled.
    meanX = X.mean(0)
    stdX = X.std(0)
    stdX[stdX < 1e-6] = 1.0
    Z = (X - meanX) / stdX

    # Forward map betas -> standardised measurements (well-posed, 10 -> 6): Z ≈ betas @ Wz.
    Wz, *_ = np.linalg.lstsq(betas, Z, rcond=None)  # (B, 6)
    M = Wz.T  # (6, B): z ≈ M @ betas

    # Regularised inverse: betas = (MᵀM + λI)⁻¹ Mᵀ z. λ trades measurement accuracy
    # against how far betas roam from the mean body. Sweep λ and pick the most
    # accurate value that keeps betas plausible (SMPL betas are ~N(0,1)); this avoids
    # the distorted bodies an unregularised inverse produces.
    # Pick the ridge λ that best reproduces a spread of REALISTIC full-body inputs,
    # evaluated the way the app will (clamp betas, then re-measure). Training-set MAE
    # alone favours a tiny λ that overfits and extrapolates to giant bodies for the
    # off-manifold combinations users actually type.
    anchors = np.array(
        [
            [170, 44, 96, 82, 98, 78],
            [188, 47, 98, 80, 96, 88],
            [158, 42, 104, 92, 106, 70],
            [156, 38, 84, 68, 92, 70],
            [186, 50, 118, 104, 116, 86],
        ],
        dtype=float,
    )
    Za = (anchors - meanX) / stdX
    best = None
    for lam in (0.1, 0.3, 1.0, 2.0, 4.0, 8.0):
        Ai = np.linalg.solve(M.T @ M + lam * np.eye(M.shape[1]), M.T)  # (B, 6)
        preds = np.clip(Za @ Ai.T, -4.0, 4.0)  # mirror the browser's beta clamp
        bodies = np.array(
            [measure(shaped(v_template, shapedirs_flat, p), crotch_idx) for p in preds]
        )
        mae = float(np.abs(bodies - anchors).mean())
        if best is None or mae < best[0]:
            best = (mae, lam, Ai)
    _, lam, A = best
    print(f"\nchosen ridge lambda = {lam} (realistic-input MAE {best[0]:.2f} cm)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "betas_regressor.json").write_text(
        json.dumps(
            {
                "features": FEATURES,
                "meanX": meanX.tolist(),
                "stdX": stdX.tolist(),
                "A": A.tolist(),
                "b": [0.0] * betas.shape[1],
            },
            indent=2,
        )
    )

    # Validation: measurements -> betas -> body -> re-measure, report mean abs error.
    n_val = min(n_samples, 500)
    pred = Z[:n_val] @ A.T
    err = np.abs(
        np.array([measure(shaped(v_template, shapedirs_flat, pred[i]), crotch_idx) for i in range(n_val)])
        - X[:n_val]
    )
    print("\nValidation mean abs error (cm):")
    for k, name in enumerate(FEATURES):
        print(f"  {name:9s}: {err[:, k].mean():.2f}")
    print(f"\nWrote {OUT_DIR / 'betas_regressor.json'}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
