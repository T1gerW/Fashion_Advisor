import { useState, Suspense, Component, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Avatar } from './Avatar'
import { SmplAvatar } from './SmplAvatar'
import { MeasurementsForm } from './MeasurementsForm'
import { DEFAULT_MEASUREMENTS, type Measurements } from './measurements'

// If the SMPL model assets aren't present yet (not downloaded/converted), the
// loader throws and this boundary falls back to the primitive avatar — so the
// app always renders a body.
class SmplFallback extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export default function App() {
  // The committed measurements the avatar is built from. Updated ONLY when the
  // form's Generate button is pressed.
  const [measurements, setMeasurements] = useState<Measurements>(DEFAULT_MEASUREMENTS)
  const [rotating, setRotating] = useState(true)

  return (
    <div className="app">
      <MeasurementsForm onGenerate={setMeasurements} />

      <div className="canvas-wrap">
        <Canvas camera={{ position: [0, 1.1, 3.6], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1.5} />

          {/* Realistic SMPL body when its assets exist; the primitive avatar is
              shown both while loading and if the assets are missing. */}
          <SmplFallback fallback={<Avatar measurements={measurements} rotating={rotating} />}>
            <Suspense fallback={<Avatar measurements={measurements} rotating={rotating} />}>
              <SmplAvatar measurements={measurements} rotating={rotating} />
            </Suspense>
          </SmplFallback>

          <OrbitControls target={[0, 1.0, 0]} />
        </Canvas>

        {/* Overlay control: toggle the turntable auto-rotation. Manual drag-to-
            orbit still works while paused. */}
        <button
          className="rotate-toggle"
          onClick={() => setRotating((r) => !r)}
          aria-pressed={!rotating}
        >
          {rotating ? '⏸ Pause' : '▶ Play'}
        </button>
      </div>
    </div>
  )
}
