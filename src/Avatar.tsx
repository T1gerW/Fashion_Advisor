import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { Measurements } from './measurements'

const BODY_COLOR = '#9aa7b5' // neutral "mannequin" tone; garments sit on top later

// A circumference (cm) is the perimeter of a circle, so the matching radius (in
// metres) is circumference / (2*pi). This turns a "chest = 100 cm" input into a
// torso thickness in the 3D scene.
function radiusFromCircumference(circumferenceCm: number) {
  return circumferenceCm / 100 / (2 * Math.PI)
}

type Props = {
  measurements: Measurements
  rotating: boolean
}

export function Avatar({ measurements, rotating }: Props) {
  // Ref to the whole figure so we can spin every part as a single unit.
  const groupRef = useRef<Group>(null!)

  // Rotate horizontally (around the vertical Y axis) like a turntable — only
  // while auto-rotation is enabled (the Play/Pause toggle in App).
  useFrame((_state, delta) => {
    if (rotating) groupRef.current.rotation.y += delta * 0.5
  })

  // --- Turn measurements (cm) into 3D dimensions (everything below is metres) ---
  const H = measurements.height / 100 // total height: feet at y=0, head top at y=H

  // Trunk radii come straight from the circumference inputs.
  const rChest = radiusFromCircumference(measurements.chest)
  const rWaist = radiusFromCircumference(measurements.waist)
  const rHip = radiusFromCircumference(measurements.hip)

  // Head / neck / shoulder are placed from the TOP down so they stay consistent
  // no matter what the inseam does to the lower body.
  const headR = 0.07 * H
  const headCenterY = H - headR
  const neckTop = headCenterY - headR
  const shoulderY = neckTop - 0.04 * H

  // Inseam sets the crotch/hip line directly (i.e. the leg length). Clamp so a
  // very long inseam can't eat the whole torso.
  const hipY = Math.min(measurements.inseam / 100, shoulderY - 0.2)
  const waistY = hipY + 0.45 * (shoulderY - hipY)

  // Shoulder width: half-span drives where the arms sit and how wide the yoke is.
  const shoulderHalf = measurements.shoulder / 100 / 2

  // Limbs. Thighs + leg spacing scale with hips (0.45 + 0.55 = legs fill the hip
  // width exactly). Arms hang from the ends of the shoulder yoke.
  const legR = rHip * 0.55
  const legX = rHip * 0.45
  const legHeight = Math.max(hipY - 2 * legR, 0.05)
  const armR = 0.045 * H
  const armLength = 0.36 * H
  const armX = Math.max(shoulderHalf - armR, 0.05)
  const armCenterY = shoulderY - (armLength / 2 + armR)
  const yokeLength = Math.max(2 * shoulderHalf - 2 * armR, 0.02)

  return (
    <group ref={groupRef}>
      {/* Head */}
      <mesh position={[0, headCenterY, 0]}>
        <sphereGeometry args={[headR, 32, 32]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>

      {/* Neck — bridges shoulders to head */}
      <mesh position={[0, (shoulderY + neckTop) / 2, 0]}>
        <cylinderGeometry args={[headR * 0.5, headR * 0.5, neckTop - shoulderY, 16]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>

      {/* Shoulder yoke — a horizontal capsule spanning the shoulder width.
          Rotated 90° about Z so its long axis lies along X (left↔right). */}
      <mesh position={[0, shoulderY, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[armR, yokeLength, 8, 16]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>

      {/* Upper trunk: a cone-like cylinder tapering from the waist (bottom) up to
          the chest (top). cylinderGeometry(radiusTop, radiusBottom, height, segments). */}
      <mesh position={[0, (waistY + shoulderY) / 2, 0]}>
        <cylinderGeometry args={[rChest, rWaist, shoulderY - waistY, 24]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>

      {/* Lower trunk: tapers from the hip (bottom) up to the waist (top). */}
      <mesh position={[0, (hipY + waistY) / 2, 0]}>
        <cylinderGeometry args={[rWaist, rHip, waistY - hipY, 24]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>

      {/* Arms — hang straight down from the ends of the shoulder yoke. */}
      <mesh position={[-armX, armCenterY, 0]}>
        <capsuleGeometry args={[armR, armLength, 8, 16]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>
      <mesh position={[armX, armCenterY, 0]}>
        <capsuleGeometry args={[armR, armLength, 8, 16]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>

      {/* Legs — reach from the ground up to the hip line (= inseam height). */}
      <mesh position={[-legX, hipY / 2, 0]}>
        <capsuleGeometry args={[legR, legHeight, 8, 16]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>
      <mesh position={[legX, hipY / 2, 0]}>
        <capsuleGeometry args={[legR, legHeight, 8, 16]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>
    </group>
  )
}
