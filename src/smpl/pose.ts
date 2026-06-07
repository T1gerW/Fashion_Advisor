import type { SmplModel } from './loadSmplModel'

// Linear Blend Skinning for SMPL: take the shaped (rest-pose) vertices and a set of
// per-joint rotations, and deform the mesh so the body takes that pose.
//
// Steps (the standard SMPL/LBS recipe, minus pose-corrective blend shapes):
//   1. joint positions  J = J_regressor · shapedVertices
//   2. local rotation matrix per joint (from axis-angle)
//   3. walk the kinematic tree to get each joint's GLOBAL transform
//   4. strip each joint's rest-pose translation (so vertices aren't double-moved)
//   5. each vertex = weighted blend of its joints' transforms, applied to the vertex

const SMPL_JOINTS = 24

// Axis-angle (a 3-vector whose length is the angle) -> 3x3 rotation matrix (row-major).
function rodrigues(x: number, y: number, z: number): number[] {
  const angle = Math.hypot(x, y, z)
  if (angle < 1e-8) return [1, 0, 0, 0, 1, 0, 0, 0, 1]
  const kx = x / angle
  const ky = y / angle
  const kz = z / angle
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const t = 1 - c
  return [
    c + kx * kx * t, kx * ky * t - kz * s, kx * kz * t + ky * s,
    ky * kx * t + kz * s, c + ky * ky * t, ky * kz * t - kx * s,
    kz * kx * t - ky * s, kz * ky * t + kx * s, c + kz * kz * t,
  ]
}

// Build a 4x4 (row-major) transform from a 3x3 rotation R and a translation t.
function mat4(r: number[], tx: number, ty: number, tz: number): number[] {
  return [
    r[0], r[1], r[2], tx,
    r[3], r[4], r[5], ty,
    r[6], r[7], r[8], tz,
    0, 0, 0, 1,
  ]
}

// 4x4 * 4x4 (row-major).
function mul4(a: number[], b: number[]): number[] {
  const o = new Array<number>(16)
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      o[r * 4 + c] =
        a[r * 4] * b[c] +
        a[r * 4 + 1] * b[4 + c] +
        a[r * 4 + 2] * b[8 + c] +
        a[r * 4 + 3] * b[12 + c]
    }
  }
  return o
}

// shapedVertices: V*3, theta: jointCount*3 axis-angles. Returns posed V*3.
export function poseVertices(model: SmplModel, shaped: Float32Array, theta: Float32Array): Float32Array {
  const V = model.vertexCount
  const J = model.jointCount
  const { jRegressor, weights, parents } = model

  // 1. Joint positions: J_regressor (J×V) · shaped (V×3).
  const joints = new Float32Array(J * 3)
  for (let k = 0; k < J; k++) {
    let jx = 0
    let jy = 0
    let jz = 0
    const base = k * V
    for (let i = 0; i < V; i++) {
      const w = jRegressor[base + i]
      if (w !== 0) {
        const o = i * 3
        jx += w * shaped[o]
        jy += w * shaped[o + 1]
        jz += w * shaped[o + 2]
      }
    }
    joints[k * 3] = jx
    joints[k * 3 + 1] = jy
    joints[k * 3 + 2] = jz
  }

  // 2-3. Global transform per joint, walking down the kinematic tree.
  const global: number[][] = new Array(J)
  global[0] = mat4(rodrigues(theta[0], theta[1], theta[2]), joints[0], joints[1], joints[2])
  for (let k = 1; k < J; k++) {
    const p = parents[k]
    const r = rodrigues(theta[k * 3], theta[k * 3 + 1], theta[k * 3 + 2])
    // local transform carries the offset from the parent joint
    const local = mat4(
      r,
      joints[k * 3] - joints[p * 3],
      joints[k * 3 + 1] - joints[p * 3 + 1],
      joints[k * 3 + 2] - joints[p * 3 + 2],
    )
    global[k] = mul4(global[p], local)
  }

  // 4. Remove the rest-pose joint translation: A = G with its 3x4 part's
  //    translation column reduced by R_global · J_rest. Keep only the 3x4 rows.
  const A: number[][] = new Array(J)
  for (let k = 0; k < J; k++) {
    const g = global[k]
    const jx = joints[k * 3]
    const jy = joints[k * 3 + 1]
    const jz = joints[k * 3 + 2]
    const ox = g[0] * jx + g[1] * jy + g[2] * jz
    const oy = g[4] * jx + g[5] * jy + g[6] * jz
    const oz = g[8] * jx + g[9] * jy + g[10] * jz
    A[k] = [
      g[0], g[1], g[2], g[3] - ox,
      g[4], g[5], g[6], g[7] - oy,
      g[8], g[9], g[10], g[11] - oz,
    ]
  }

  // 5. Skin: each vertex gets the weighted sum of its joints' transforms.
  const out = new Float32Array(V * 3)
  for (let i = 0; i < V; i++) {
    const o = i * 3
    const vx = shaped[o]
    const vy = shaped[o + 1]
    const vz = shaped[o + 2]
    let m0 = 0, m1 = 0, m2 = 0, m3 = 0
    let m4 = 0, m5 = 0, m6 = 0, m7 = 0
    let m8 = 0, m9 = 0, m10 = 0, m11 = 0
    const wb = i * J
    for (let k = 0; k < J; k++) {
      const w = weights[wb + k]
      if (w === 0) continue
      const a = A[k]
      m0 += w * a[0]; m1 += w * a[1]; m2 += w * a[2]; m3 += w * a[3]
      m4 += w * a[4]; m5 += w * a[5]; m6 += w * a[6]; m7 += w * a[7]
      m8 += w * a[8]; m9 += w * a[9]; m10 += w * a[10]; m11 += w * a[11]
    }
    out[o] = m0 * vx + m1 * vy + m2 * vz + m3
    out[o + 1] = m4 * vx + m5 * vy + m6 * vz + m7
    out[o + 2] = m8 * vx + m9 * vy + m10 * vz + m11
  }
  return out
}

// SMPL joint indices we touch.
const L_SHOULDER = 16
const R_SHOULDER = 17

// A relaxed standing pose: rotate the shoulders to bring the arms down from the
// T-pose to the sides. Rotation is about the Z (front-back) axis, with opposite
// signs per side. ~1.2 rad ≈ 69° leaves the arms slightly out so they don't clip
// into the torso. (Tuned by eye.)
export function relaxedPose(): Float32Array {
  const theta = new Float32Array(SMPL_JOINTS * 3)
  theta[L_SHOULDER * 3 + 2] = -1.2
  theta[R_SHOULDER * 3 + 2] = 1.2
  return theta
}
