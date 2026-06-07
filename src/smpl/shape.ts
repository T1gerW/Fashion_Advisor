import * as THREE from 'three'
import type { Measurements } from '../measurements'
import type { SmplModel, SmplRegressor } from './loadSmplModel'

// The order of measurement columns. MUST match the order used by
// tools/smpl/calibrate.py when it fits the regressor.
const FEATURE_ORDER: (keyof Measurements)[] = [
  'height',
  'shoulder',
  'chest',
  'waist',
  'hip',
  'inseam',
]

// measurements (cm) -> SMPL shape params. betas = A·z + b, z = (m - mean) / std.
export function betasFromMeasurements(m: Measurements, reg: SmplRegressor): Float32Array {
  const z = FEATURE_ORDER.map((key, j) => (m[key] - reg.meanX[j]) / reg.stdX[j])
  const betas = new Float32Array(reg.b.length)
  for (let i = 0; i < betas.length; i++) {
    let sum = reg.b[i]
    for (let j = 0; j < z.length; j++) sum += reg.A[i][j] * z[j]
    // Clamp to a plausible SMPL shape range as a safety net against extreme inputs.
    betas[i] = Math.max(-4, Math.min(4, sum))
  }
  return betas
}

// Apply the SMPL shape blend shapes: vertices = v_template + shapedirs·betas.
export function shapeVertices(model: SmplModel, betas: Float32Array): Float32Array {
  const { vTemplate, shapeDirs, betaCount } = model
  const out = new Float32Array(vTemplate.length)
  for (let idx = 0; idx < vTemplate.length; idx++) {
    let v = vTemplate[idx]
    const base = idx * betaCount
    for (let b = 0; b < betaCount; b++) v += shapeDirs[base + b] * betas[b]
    out[idx] = v
  }
  return out
}

// Build a Three.js geometry from the shaped vertices, oriented so the figure is
// Y-up with feet at y≈0 and centred on x/z (so the existing camera frames it).
export function buildBodyGeometry(model: SmplModel, vertices: Float32Array): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geo.setIndex(new THREE.BufferAttribute(model.faces, 1))

  // SMPL is defined Y-up. Just drop the figure to the floor (feet at y≈0) and
  // centre it on x/z so the existing camera frames it. (We deliberately DON'T
  // auto-detect the "up" axis: in a T-pose the arm span can match the height and
  // fool that heuristic into tipping the body on its side.)
  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2)

  geo.computeVertexNormals()
  return geo
}
