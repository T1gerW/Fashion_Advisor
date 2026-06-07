// Loads the SMPL model data that the offline scripts (tools/smpl/) emit into
// public/smpl/. If those files don't exist yet (model not downloaded/converted),
// the fetches fail and the caller falls back to the primitive avatar.

// Maps our 6 measurements -> 10 SMPL shape params (betas): betas = A·z + b,
// where z = (measurements - meanX) / stdX. Produced by tools/smpl/calibrate.py.
export type SmplRegressor = {
  meanX: number[] // length 6, cm
  stdX: number[] // length 6, cm
  A: number[][] // betaCount × 6
  b: number[] // length betaCount
}

export type SmplModel = {
  vertexCount: number
  betaCount: number
  jointCount: number
  parents: number[] // parent joint index for each joint (root = -1)
  vTemplate: Float32Array // vertexCount*3 (rest-pose template vertices, metres)
  shapeDirs: Float32Array // (vertexCount*3) * betaCount, row-major [coordIdx*betaCount + b]
  faces: Uint32Array // faceCount*3 triangle indices
  jRegressor: Float32Array // jointCount*vertexCount, row-major [k*V + i] (joints from vertices)
  weights: Float32Array // vertexCount*jointCount, row-major [i*J + k] (skinning weights)
  regressor: SmplRegressor
}

type Manifest = {
  vertexCount: number
  betaCount: number
  faceCount: number
  jointCount: number
  parents: number[]
}

async function fetchBin(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`SMPL asset missing: ${url} (HTTP ${res.status})`)
  return res.arrayBuffer()
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`SMPL asset missing: ${url} (HTTP ${res.status})`)
  return (await res.json()) as T
}

async function load(base: string): Promise<SmplModel> {
  const [manifest, vTemplate, shapeDirs, faces, jRegressor, weights, regressor] =
    await Promise.all([
      fetchJson<Manifest>(`${base}/body.json`),
      fetchBin(`${base}/v_template.bin`),
      fetchBin(`${base}/shapedirs.bin`),
      fetchBin(`${base}/faces.bin`),
      fetchBin(`${base}/j_regressor.bin`),
      fetchBin(`${base}/weights.bin`),
      fetchJson<SmplRegressor>(`${base}/betas_regressor.json`),
    ])
  return {
    vertexCount: manifest.vertexCount,
    betaCount: manifest.betaCount,
    jointCount: manifest.jointCount,
    parents: manifest.parents,
    vTemplate: new Float32Array(vTemplate),
    shapeDirs: new Float32Array(shapeDirs),
    faces: new Uint32Array(faces),
    jRegressor: new Float32Array(jRegressor),
    weights: new Float32Array(weights),
    regressor,
  }
}

let modelPromise: Promise<SmplModel> | null = null

export function loadSmplModel(base = '/smpl'): Promise<SmplModel> {
  if (modelPromise === null) modelPromise = load(base)
  return modelPromise
}

// --- React Suspense adapter -------------------------------------------------
// Throws the pending promise while loading, throws the error if the assets are
// missing (caught by the fallback boundary), or returns the model when ready.
let status: 'pending' | 'success' | 'error' = 'pending'
let model: SmplModel | null = null
let error: unknown = null
let started: Promise<void> | null = null

export function useSmplModel(): SmplModel {
  if (started === null) {
    started = loadSmplModel().then(
      (m) => {
        model = m
        status = 'success'
      },
      (e) => {
        error = e
        status = 'error'
      },
    )
  }
  if (status === 'pending') throw started
  if (status === 'error') throw error
  return model as SmplModel
}
