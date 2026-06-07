// The body measurements the user enters, all in centimetres.
export type Measurements = {
  height: number
  shoulder: number // breadth across the shoulders
  chest: number
  waist: number
  hip: number
  inseam: number // inside leg length (crotch to floor)
}

// A sensible starting point (roughly an average adult) so the app shows a
// believable figure before the user touches anything.
export const DEFAULT_MEASUREMENTS: Measurements = {
  height: 175,
  shoulder: 45,
  chest: 100,
  waist: 84,
  hip: 100,
  inseam: 80,
}

// Metadata that drives the form UI. Adding a field here (plus to the type and
// to the Avatar mapping) is most of the work needed to support a new input.
export type MeasurementField = {
  key: keyof Measurements
  label: string
  min: number
  max: number
}

export const MEASUREMENT_FIELDS: MeasurementField[] = [
  { key: 'height', label: 'Height', min: 140, max: 210 },
  { key: 'shoulder', label: 'Shoulder width', min: 35, max: 55 },
  { key: 'chest', label: 'Chest', min: 70, max: 140 },
  { key: 'waist', label: 'Waist', min: 55, max: 130 },
  { key: 'hip', label: 'Hip', min: 75, max: 140 },
  { key: 'inseam', label: 'Inseam', min: 60, max: 95 },
]
