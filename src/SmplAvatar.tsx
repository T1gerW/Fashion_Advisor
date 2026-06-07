import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, type Group } from 'three'
import type { Measurements } from './measurements'
import { useSmplModel } from './smpl/loadSmplModel'
import { betasFromMeasurements, shapeVertices, buildBodyGeometry } from './smpl/shape'
import { poseVertices, relaxedPose } from './smpl/pose'

const BODY_COLOR = '#9aa7b5'

// One fixed relaxed (arms-down) pose, computed once.
const RELAXED_POSE = relaxedPose()

type Props = {
  measurements: Measurements
  rotating: boolean
}

// Realistic body: a single SMPL mesh shaped from the measurements. Same spinning
// <group> pattern as the primitive Avatar, so it slots into the scene the same way.
export function SmplAvatar({ measurements, rotating }: Props) {
  const model = useSmplModel() // suspends until loaded; throws if assets are missing
  const groupRef = useRef<Group>(null!)

  useFrame((_state, delta) => {
    if (rotating) groupRef.current.rotation.y += delta * 0.5
  })

  // Rebuild the body geometry only when the committed measurements change.
  const geometry = useMemo(() => {
    const betas = betasFromMeasurements(measurements, model.regressor)
    const shaped = shapeVertices(model, betas)
    const posed = poseVertices(model, shaped, RELAXED_POSE)
    return buildBodyGeometry(model, posed)
  }, [measurements, model])

  // Free the old geometry's GPU buffers when it's replaced or unmounted.
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>
        {/* DoubleSide guards against inside-out rendering if face winding differs. */}
        <meshStandardMaterial color={BODY_COLOR} side={DoubleSide} />
      </mesh>
    </group>
  )
}
