"""Shared SMPL loading helpers (numpy only — no chumpy install needed)."""
from pathlib import Path
import pickle

import numpy as np

# Repo root = two levels up from this file (tools/smpl/ -> repo root).
ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "smpl"
NUM_BETAS = 10


class _Ch:
    """Stand-in for chumpy.Ch so SMPL .pkl files load without the chumpy library.

    SMPL's pickles store arrays as chumpy objects; chumpy doesn't run on modern
    Python/numpy. A chumpy leaf keeps its values in the `x` attribute, so we just
    capture the unpickled state and expose `x` as a numpy array.
    """

    def __new__(cls, *args, **kwargs):
        return object.__new__(cls)

    def __setstate__(self, state):
        self.__dict__.update(state)

    def __array__(self, dtype=None):
        return np.asarray(self.__dict__.get("x"), dtype=dtype)


class _SmplUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if module.startswith("chumpy"):
            return _Ch
        return super().find_class(module, name)


def resolve_model_path(explicit=None) -> Path:
    """Find the SMPL .pkl. Prefers an explicit arg, then models/smpl/, then the
    official `SMPL_python_v.1.1.0` download folder (neutral model first)."""
    if explicit:
        return Path(explicit)
    models_dir = ROOT / "models" / "smpl"
    candidates = [models_dir / "SMPL_NEUTRAL.pkl"]
    if models_dir.exists():
        candidates += sorted(models_dir.glob("*.pkl"))
    candidates += sorted(ROOT.glob("SMPL_python*/smpl/models/basicmodel_neutral_*.pkl"))
    candidates += sorted(ROOT.glob("SMPL_python*/smpl/models/basicmodel_*.pkl"))
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError(
        "No SMPL .pkl found. Put SMPL_NEUTRAL.pkl in models/smpl/ (or leave the official "
        "SMPL_python_v.1.1.0 download folder in the repo root), or pass a path:\n"
        "  python tools/smpl/convert_smpl.py path/to/model.pkl"
    )


def load_raw(pkl_path=None):
    """Load and return the raw SMPL model dict (chumpy-free) plus its resolved path."""
    path = resolve_model_path(pkl_path)
    with open(path, "rb") as f:
        return _SmplUnpickler(f, encoding="latin1").load(), path


def load_model(pkl_path=None, num_betas: int = NUM_BETAS):
    """Return (v_template (V,3), shapedirs (V,3,num_betas), faces (F,3)) from a SMPL .pkl."""
    data, path = load_raw(pkl_path)
    v_template = np.asarray(data["v_template"], dtype=np.float64)
    shapedirs = np.asarray(data["shapedirs"], dtype=np.float64)[:, :, :num_betas]
    faces = np.asarray(data["f"], dtype=np.uint32)
    print(f"Loaded SMPL model: {path}")
    return v_template, shapedirs, faces
