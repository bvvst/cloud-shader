import { CLOUDS, CREAM, type CloudEllipse, NIGHT, SKY, WHITE, sigmaOf } from './scene'

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(Math.round(n * 1e5) / 1e5))
const rgb = (c: readonly number[]) => `vec3(${c.map((v) => f(v / 255)).join(', ')})`

// Deterministic per-ellipse randomness so the motion is identical across reloads.
function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const TAU = Math.PI * 2
/** Frame x where the clouds part during the intro (the sun glow). */
const INTRO_PART_X = SKY.center[0]

function cloudLine(c: CloudEllipse, i: number) {
  const sigma = sigmaOf(c)
  const theta = ((c.rotate ?? 0) * Math.PI) / 180
  const drift = 4 + 0.08 * Math.min(c.rx, c.ry)
  // Periods are 30-90 animation seconds (divide by `speed` for wall-clock time).
  const fx = TAU / (35 + rand(i + 1) * 55)
  const fy = TAU / (35 + rand(i + 21) * 55)
  const fr = TAU / (30 + rand(i + 41) * 50)
  const px = rand(i + 61) * TAU
  const py = rand(i + 81) * TAU
  const pr = rand(i + 101) * TAU
  const color = c.color === 'white' ? 'WHITE' : 'CREAM'

  // Intro: every ellipse starts swollen, raised and pulled towards the centre so
  // together they blanket the sky, then sinks and parts into place. Ellipses
  // near the centre release first, opening a gap for the sky to show through.
  const delay = 0.3 * Math.min(1, Math.abs(c.cx - INTRO_PART_X) / 650)
  const startDx = (INTRO_PART_X - c.cx) * 0.45
  const startDy = -(220 + rand(i + 121) * 120)

  return `
  k = introK(${f(delay)});
  col = mix(col, ${color}, ${f(c.opacity)} * cloud(pw,
    vec2(${f(c.cx)}, ${f(c.cy)}) + ${f(drift)} * vec2(sin(t * ${f(fx)} + ${f(px)}), 0.6 * sin(t * ${f(fy)} + ${f(py)}))
      + k * vec2(${f(startDx)}, ${f(startDy)}),
    vec2(${f(c.rx)}, ${f(c.ry)}) * (1.0 + 0.05 * sin(t * ${f(fr)} + ${f(pr)}) + 1.4 * k),
    ${f(Math.cos(theta))}, ${f(Math.sin(theta))}, ${f(sigma)} * (1.0 + 2.0 * k), ${f(c.fluff)} * edge));`
}

const [s0, s1, s2, s3] = SKY.stops

export const VERTEX_SHADER = /* glsl */ `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`

const HEADER = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uResolution;
uniform float uTime;
// xy: canvas px per frame px on each axis, zw: canvas-space offset of the frame origin.
uniform vec4 uView;
// Intro progress, 0 (page-coloured) to 1 (settled).
uniform float uIntro;
// Page colour the scene dissolves into, 0-1 RGB.
uniform vec3 uBackground;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 u = fract(p);
  u = u * u * u * (u * (u * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Two octaves, centred on zero, roughly in [-1, 1].
float fbm(vec2 p) {
  return (0.6667 * noise(p) + 0.3333 * noise(p * 2.03 + vec2(17.1, 9.2))) * 2.0 - 1.0;
}
`

/**
 * Day scene: sky gradient and drifting cloud bank.
 * Uniforms: uResolution, uTime, uView, uIntro, uBackground.
 */
export const DAY_FRAGMENT_SHADER = /* glsl */ `
${HEADER}

const vec3 CREAM = ${rgb(CREAM)};
const vec3 WHITE = ${rgb(WHITE)};

// Remaining intro offset for an ellipse that starts moving at progress
// progress delay. Cubic ease-out, so it decelerates to rest exactly on the layout.
float introK(float delay) {
  float q = 1.0 - clamp((uIntro - delay) / (1.0 - delay), 0.0, 1.0);
  return q * q * q;
}

vec3 sky(vec2 p, float t) {
  vec2 q = (p - vec2(${f(SKY.center[0])}, ${f(SKY.center[1])})) / vec2(${f(SKY.radius[0])}, ${f(SKY.radius[1])});
  float g = length(q) * (1.0 + 0.03 * sin(t * 0.07));
  vec3 c = mix(${rgb(s0.color)}, ${rgb(s1.color)}, clamp(g / ${f(s1.at)}, 0.0, 1.0));
  c = mix(c, ${rgb(s2.color)}, clamp((g - ${f(s1.at)}) / ${f(s2.at - s1.at)}, 0.0, 1.0));
  c = mix(c, ${rgb(s3.color)}, clamp((g - ${f(s2.at)}) / ${f(s3.at - s2.at)}, 0.0, 1.0));
  vec3 fade = mix(${rgb(SKY.fadeFrom)}, uBackground, clamp((p.y - ${f(SKY.fadeTop)}) / ${f(SKY.fadeHeight)}, 0.0, 1.0));
  // The settled clouds hide this edge; while they're raised in the intro it needs feathering.
  float feather = 2.0 + 260.0 * sqrt(introK(0.0));
  return mix(c, fade, smoothstep(${f(SKY.fadeTop)} - feather, ${f(SKY.fadeTop)} + feather, p.y));
}

// Coverage of a Gaussian-blurred ellipse: approximate signed distance pushed
// through a logistic approximation of the normal CDF.
float cloud(vec2 p, vec2 c, vec2 r, float cs, float sn, float sigma, float fluff) {
  vec2 q = p - c;
  q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);
  float k0 = length(q / r);
  float k1 = length(q / (r * r));
  float d = k0 < 1e-3 ? -min(r.x, r.y) : k0 * (k0 - 1.0) / k1;
  d += fluff;
  return 1.0 / (1.0 + exp(clamp(1.702 * d / sigma, -30.0, 30.0)));
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 p = (frag - uView.zw) / uView.xy;
  float t = uTime;

  vec3 col = sky(p, t);

  // Outside the band nothing can reach once settled; during the intro clouds fill the view.
  if (uIntro < 1.0 || (p.y > 100.0 && p.y < 560.0)) {
    float k;
    // Large, slowly evolving domain warp: this is what makes the masses morph.
    vec2 wp = p * 0.0035;
    vec2 pw = p + 22.0 * vec2(
      fbm(wp + vec2(t * 0.011, 0.0)),
      fbm(wp + vec2(5.2, 1.3) - vec2(0.0, t * 0.009))
    );
    pw.x += 8.0 * sin(t * 0.021);
    // Fine turbulence on the edges (Figma's feTurbulence/feDisplacementMap).
    float edge = fbm(pw * 0.045 + vec2(t * 0.05, -t * 0.03));
${CLOUDS.map(cloudLine).join('\n')}
  }

  // Matches the page background so the first intro frame is seamless.
  col = mix(col, uBackground, 1.0 - smoothstep(0.0, 0.45, uIntro));

  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`

const { moonlightSource } = NIGHT

/**
 * Night scene: stars and moonlight. Expects `uTime` in seconds (speed 1).
 * Uniforms: uResolution, uTime, uPxScale, uIntro, uBackground.
 */
export const NIGHT_FRAGMENT_SHADER = /* glsl */ `
${HEADER}

// Canvas px per container CSS px.
uniform float uPxScale;

// One star per occupied grid cell, sized in canvas pixels so it stays a pinpoint at any resolution.
// A higher spread makes most stars in the layer barely there, with only a few catching the eye.
float stars(vec2 p, float pxScale, float cell, float density, float spread, float size, float seed, float t) {
  vec2 id = floor(p / cell);
  if (hash(id + seed) > density) return 0.0;
  vec2 pos = (id + 0.15 + 0.7 * vec2(hash(id + seed + 7.3), hash(id + seed + 13.1))) * cell;
  float d = length(p - pos) * pxScale;
  float b = pow(hash(id + seed + 3.7), spread);
  float twinkle = 0.6 + 0.4 * sin(t * (0.5 + 1.5 * hash(id + seed + 5.9)) + 6.2832 * hash(id + seed + 9.4));
  float appear = smoothstep(0.0, 0.5, uIntro - 0.5 * hash(id + seed + 11.2));
  return b * twinkle * appear * exp(-d * d / size);
}

void main() {
  // p is in container CSS px from the top-left.
  float pxScale = uPxScale;
  vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / pxScale;
  // Vertical stops are designed for the reference height and scale with the container.
  float vs = uResolution.y / pxScale / ${f(NIGHT.referenceHeight)};
  vec2 source = vec2(${f(moonlightSource.x)} * uResolution.x / pxScale, ${f(moonlightSource.y)});
  float t = uTime;

  vec3 col = mix(${rgb(NIGHT.zenith)}, uBackground, smoothstep(${f(NIGHT.fadeTop)} * vs, ${f(NIGHT.fadeBottom)} * vs, p.y));

  float r = length(p - source);
  float below = 1.0 - smoothstep(${f(NIGHT.fadeTop)} * vs, ${f(NIGHT.fadeBottom)} * vs, p.y);

  // Moonlight from off-screen: a broad wash with faint haze drifting through it.
  float haze = max(fbm(p * 0.004 + vec2(t * 0.006, t * 0.002)), 0.0);
  float glow = 0.09 * exp(-r / 360.0) + 0.06 * haze * exp(-r / 520.0);
  col += ${rgb(NIGHT.moonlight)} * glow * below;

  // Rotating the lookup point turns the whole star field around the pole, like the night sky.
  vec2 pole = vec2(${f(NIGHT.pole.x)} * uResolution.x / pxScale, ${f(NIGHT.pole.y)});
  float a = t * ${f(NIGHT.orbitSpeed)};
  vec2 sp = mat2(cos(a), sin(a), -sin(a), cos(a)) * (p - pole) + pole;

  float starMask = 1.0 - smoothstep(${f(NIGHT.starFadeTop)} * vs, ${f(NIGHT.starFadeBottom)} * vs, p.y);
  float s = 0.2 * stars(sp, pxScale, 16.0, 0.45, 3.0, 0.9, 0.0, t)
    + 0.5 * stars(sp, pxScale, 64.0, 0.6, 3.0, 0.9, 41.0, t)
    // A handful of bright stars, slightly larger so they read as the brightest in the sky.
    + 0.95 * stars(sp, pxScale, 180.0, 0.3, 0.5, 1.6, 83.0, t);
  vec3 tint = mix(vec3(0.82, 0.87, 1.0), vec3(1.0, 0.96, 0.88), hash(floor(sp / 64.0) + 3.1));
  col += tint * s * starMask;

  col = mix(uBackground, col, smoothstep(0.0, 1.0, uIntro));

  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`
