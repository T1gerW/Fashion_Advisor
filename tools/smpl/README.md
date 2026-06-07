# SMPL body pipeline

A one-time offline step that turns the SMPL human body model into the small files
the web app loads at runtime. Until you run this, the app falls back to the
primitive avatar automatically — nothing breaks.

## 1. Get the model (manual, gated)

1. Register at **https://smpl.is.tue.mpg.de/** and download the neutral model
   (`SMPL_python_v.1.1.0` → `SMPL_NEUTRAL.pkl`).
2. Put it at `models/smpl/SMPL_NEUTRAL.pkl` (this folder is gitignored).

> **Licensing:** SMPL is free for research / non-commercial use. **Commercial use
> requires a paid license** (via Meshcapade). This is a product, so sort that out
> before shipping. The model and everything derived from it are gitignored — never
> commit them.

## 2. Install deps

```bash
pip install -r tools/smpl/requirements.txt
```

(If unpickling complains about `chumpy`, you have the old v1.0.0 file — either grab
v1.1.0 or `pip install chumpy`.)

## 3. Run (from the repo root)

```bash
python tools/smpl/convert_smpl.py     # .pkl -> public/smpl/*.bin + body.json
python tools/smpl/calibrate.py        # fit measurements -> betas -> betas_regressor.json
```

`calibrate.py` prints a validation report (mean error in cm between requested and
re-measured body). Reload the app and the realistic SMPL body replaces the primitive one.

## What gets produced (in `public/smpl/`)

| File | Contents |
|------|----------|
| `body.json` | vertex/face/beta counts |
| `v_template.bin` | rest-pose template vertices (Float32) |
| `shapedirs.bin` | shape blend directions (Float32) |
| `faces.bin` | triangle indices (Uint32) |
| `betas_regressor.json` | the measurements → betas linear map |

## Tuning notes

- The measurement heuristics in `calibrate.py` (landmark heights in `FRAC`, crotch
  detection, hull-perimeter circumference) are first approximations. If the
  validation errors are high or a measurement barely responds, adjust `FRAC` or the
  landmark logic. The standard reference is
  [SMPL-Anthropometry](https://github.com/DavidBoja/SMPL-Anthropometry).
- `FEATURES` order here **must** match `FEATURE_ORDER` in `src/smpl/shape.ts`.
- Posing/skinning lives in `src/smpl/pose.ts` (the displayed body uses one relaxed
  arms-down pose). Pose-corrective blend shapes (posedirs) are intentionally not exported.

## Garment authoring (GLB)

Realistic garments must be modelled **on the SMPL body** so the app can transfer the
body's skinning to them (making them fit any measurements + the pose). Workflow:

1. Export the template body to model on:
   `python tools/smpl/export_template_glb.py`  → `models/smpl/body_template.glb`
   (rest-pose / T-pose, metres, Y-up — arms are out on purpose; the app poses the
   garment down with the body at runtime).
2. In Blender: **File ▸ Import ▸ glTF 2.0** → `body_template.glb`. Model the garment
   fitted onto the body. **Do not move / rotate / scale** the scene or the body.
3. Select **only the garment** mesh. **File ▸ Export ▸ glTF 2.0** with:
   - Format: **glTF Binary (.glb)**
   - Include: **Selected Objects** only
   - Transform: **+Y Up** (default); Apply Modifiers; include Normals
4. Save it to **`public/garments/garment.glb`** — the app loads `/garments/garment.glb`.

Keep it a single mesh, reasonable poly count, hugging the body where it touches.
