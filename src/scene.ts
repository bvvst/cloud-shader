export type RGB = readonly [number, number, number]

/**
 * The day scene is laid out on a fixed design frame (y down, in frame pixels),
 * then scaled to cover the container.
 */
export const FRAME = { width: 1183, height: 657 }

export const SKY = {
  // Radial gradient anchored at the bottom-centre of the sky rect.
  center: [592, 344] as const,
  radius: [1076.1, 446.64] as const,
  stops: [
    { at: 0, color: [255, 255, 255] as RGB },
    { at: 0.13018, color: [250, 240, 232] as RGB },
    { at: 0.56509, color: [192, 222, 243] as RGB },
    { at: 1, color: [134, 204, 255] as RGB },
  ],
  // Lower fade rect covering the sky from this y downwards. It fades into the page colour.
  fadeTop: 304,
  fadeHeight: 353,
  fadeFrom: [250, 249, 249] as RGB,
}

/** Default page colour the day scene dissolves into. */
export const DAY_BACKGROUND: RGB = [245, 243, 242]

/** Placement of the cloud bank when `cloudLine` positions the scene, in frame pixels. */
export const CLOUD_LINE = {
  /** The frame y pinned to `cloudLine`: the sky's lower edge, which the cloud bank sits on. */
  frameY: SKY.fadeTop,
  /** The highest frame y that should still reach the top of the container. */
  skyTop: 150,
  /** Most the scene stretches sideways once growing taller would crop the sky. */
  maxStretch: 2,
}

/**
 * The night scene hangs from the top edge rather than a frame, so it is laid out
 * in container CSS pixels. Vertical gradient stops are designed for a container
 * of `referenceHeight` and scale with the actual height; stars stay pinpoints.
 */
export const NIGHT = {
  referenceHeight: 660,
  zenith: [15, 20, 33] as RGB,
  // The sky reaches the page colour between these y values.
  fadeTop: 40,
  fadeBottom: 600,
  /** Where the moonlight comes from, off-screen. x is a fraction of the container width, y is CSS px from the top. */
  moonlightSource: { x: 0.86, y: -120 },
  moonlight: [150, 168, 205] as RGB,
  /** The stars wheel around this point, off-screen above the top edge. Same units as `moonlightSource`. */
  pole: { x: 0.3, y: -500 },
  /** Radians per second. Roughly one revolution every 35 minutes. */
  orbitSpeed: 0.003,
  // Stars thin out towards the bottom so they never compete with content.
  starFadeTop: 180,
  starFadeBottom: 440,
}

/** Default page colour the night scene dissolves into. */
export const NIGHT_BACKGROUND: RGB = [10, 10, 10]

/** Blur applied to the whole cloud group, combined into each ellipse's sigma. */
export const GROUP_BLUR = 3.75

export const CREAM: RGB = [250, 249, 249]
export const WHITE: RGB = [255, 255, 255]

export interface CloudEllipse {
  cx: number
  cy: number
  rx: number
  ry: number
  /** Degrees, SVG convention (positive = clockwise on screen). */
  rotate?: number
  /** Gaussian blur standard deviation in frame pixels. */
  blur: number
  color: 'cream' | 'white'
  opacity: number
  /** Edge turbulence amplitude in px. */
  fluff: number
}

/** Combined blur of an ellipse and the group it sits in. */
export const sigmaOf = (c: CloudEllipse) => Math.sqrt(c.blur * c.blur + GROUP_BLUR * GROUP_BLUR)

// Paint order: later entries draw on top.
export const CLOUDS: CloudEllipse[] = [
  { cx: 959.5, cy: 300.5, rx: 113.5, ry: 113.5, blur: 13.95, color: 'cream', opacity: 1, fluff: 3 },
  { cx: 140.5, cy: 300.5, rx: 113.5, ry: 113.5, blur: 13.95, color: 'cream', opacity: 1, fluff: 3 },
  { cx: 1019, cy: 259, rx: 72, ry: 72, blur: 13.95, color: 'cream', opacity: 1, fluff: 3 },
  { cx: 1091, cy: 291, rx: 72, ry: 72, blur: 13.95, color: 'cream', opacity: 1, fluff: 3 },
  { cx: 46, cy: 259, rx: 107, ry: 72, blur: 13.95, color: 'cream', opacity: 1, fluff: 3 },
  { cx: 1145, cy: 314, rx: 72, ry: 72, blur: 13.95, color: 'cream', opacity: 1, fluff: 3 },
  { cx: -45, cy: 314, rx: 72, ry: 72, blur: 13.95, color: 'cream', opacity: 1, fluff: 3 },
  { cx: 702.756, cy: 323.154, rx: 110.5, ry: 43, rotate: -31.3041, blur: 5.75, color: 'cream', opacity: 1, fluff: 3 },
  { cx: 840.5, cy: 291, rx: 110.5, ry: 86, blur: 5.75, color: 'cream', opacity: 1, fluff: 11 },
  { cx: 252.5, cy: 331, rx: 179.5, ry: 86, blur: 5.75, color: 'cream', opacity: 1, fluff: 3 },
  { cx: 703, cy: 339, rx: 153, ry: 62, blur: 19.5, color: 'white', opacity: 0.5, fluff: 2 },
  { cx: 622, cy: 291, rx: 88, ry: 36, blur: 19.5, color: 'white', opacity: 0.5, fluff: 2 },
  { cx: 339.5, cy: 305, rx: 97.5, ry: 66, blur: 19.5, color: 'white', opacity: 0.5, fluff: 2 },
  { cx: 458, cy: 355.5, rx: 86, ry: 58.5, blur: 5.75, color: 'cream', opacity: 1, fluff: 3 },
  { cx: 550, cy: 353.5, rx: 113, ry: 76.5, blur: 5.75, color: 'cream', opacity: 1, fluff: 3 },
  { cx: 630, cy: 371.5, rx: 86, ry: 58.5, blur: 5.75, color: 'cream', opacity: 1, fluff: 3 },
  { cx: 550, cy: 371.5, rx: 86, ry: 58.5, blur: 2, color: 'cream', opacity: 1, fluff: 3 },
  { cx: 448, cy: 327.5, rx: 86, ry: 58.5, blur: 2, color: 'cream', opacity: 1, fluff: 3 },
]
