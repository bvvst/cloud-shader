import {
  CLOUD_LINE,
  CLOUDS,
  CREAM,
  DAY_BACKGROUND,
  FRAME,
  NIGHT,
  NIGHT_BACKGROUND,
  type RGB,
  SKY,
  sigmaOf,
  WHITE,
} from './scene'
import { DAY_FRAGMENT_SHADER, NIGHT_FRAGMENT_SHADER, VERTEX_SHADER } from './shader'

export type SkyTheme = 'day' | 'night'

/** `#rgb`, `#rrggbb`, or an `[r, g, b]` tuple in 0-255. */
export type SkyColor = string | readonly [number, number, number]

export interface SkyOptions {
  /** `day` is the cloud scene, `night` is stars and moonlight. Default `day`. */
  theme?: SkyTheme
  /**
   * Page colour the scene dissolves into at its lower edge and fades in from on load.
   * Match it to the background behind the container. Defaults: day `#f5f3f2`, night `#0a0a0a`.
   */
  background?: SkyColor
  /**
   * Canvas pixels per CSS pixel. The day scene is all soft blur, so 0.5 is visually lossless;
   * night stars are pinpoints and need 1. Defaults: day 0.5, night 1.
   */
  resolution?: number
  /** Hard cap on canvas pixel count, protects very large displays. Defaults: day 1M, night 2M. */
  maxCanvasPixels?: number
  /** Frame cap once settled. The intro always runs at the display's refresh rate. Default 30. */
  maxFps?: number
  /** Multiplier on animation speed. Defaults: day 10, night 1. */
  speed?: number
  /** Wall-clock seconds for the on-load intro. 0 disables it. Defaults: day 4, night 2.5. */
  introDuration?: number
  /** Day only. Never crop the scene narrower than this many frame pixels, keeping clouds visible on phones. Default 760. */
  minVisibleWidth?: number
  /** Day only. 0 pins the scene to the top, 0.5 centres it, 1 pins it to the bottom. Default 0.5. */
  anchorY?: number
  /**
   * Day only. CSS px from the container's top where the cloud bank should sit. Overrides `anchorY`,
   * and stops the scene growing taller on wide screens so the sky above the clouds stays in view.
   */
  cloudLine?: number
  /** Animation time (seconds) of the settled frame the intro lands on. Default 0. */
  startTime?: number
}

export interface Sky {
  /** Day only. Moves the cloud bank to this many CSS px from the container's top, easing there while animating. */
  setCloudLine(y: number): void
  /** Stops rendering, releases the WebGL context and removes everything the sky added. */
  destroy(): void
}

const DEFAULTS = {
  day: { resolution: 0.5, maxCanvasPixels: 1_000_000, speed: 10, introDuration: 4, background: DAY_BACKGROUND },
  night: { resolution: 1, maxCanvasPixels: 2_000_000, speed: 1, introDuration: 2.5, background: NIGHT_BACKGROUND },
} satisfies Record<SkyTheme, object>

interface View {
  scaleX: number
  scaleY: number
  x: number
  y: number
}

interface Layout {
  minVisibleWidth: number
  anchorY: number
  cloudLine: number | undefined
}

/** `w`, `h` and the result are in target pixels; `px` is target pixels per CSS pixel. */
function computeView(w: number, h: number, px: number, layout: Layout): View {
  const { minVisibleWidth, anchorY, cloudLine } = layout
  if (cloudLine === undefined) {
    const cover = Math.max(w / FRAME.width, h / FRAME.height)
    const scale = Math.min(cover, w / minVisibleWidth)
    return { scaleX: scale, scaleY: scale, x: (w - FRAME.width * scale) / 2, y: (h - FRAME.height * scale) * anchorY }
  }
  // Wide enough to span the container, cropping the sides on phones rather than shrinking the clouds away.
  const scaleX = Math.max(w / FRAME.width, Math.min(px, w / minVisibleWidth))
  // Past the height that keeps the sky above the clouds in view, stretch sideways instead of growing taller.
  const line = cloudLine * px
  const fitsSky = line / (CLOUD_LINE.frameY - CLOUD_LINE.skyTop)
  const scaleY = Math.max(Math.min(scaleX, fitsSky), scaleX / CLOUD_LINE.maxStretch)
  return { scaleX, scaleY, x: (w - FRAME.width * scaleX) / 2, y: line - CLOUD_LINE.frameY * scaleY }
}

function parseColor(c: SkyColor): RGB {
  if (typeof c !== 'string') return [c[0], c[1], c[2]]
  let hex = c.trim().replace(/^#/, '')
  if (hex.length === 3) hex = [...hex].map((ch) => ch + ch).join('')
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error(`cloud-shader: unsupported colour "${c}", use #rgb, #rrggbb or [r, g, b]`)
  const n = Number.parseInt(hex, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const css = (c: readonly number[]) => `rgb(${c.join(',')})`
const hex = (c: RGB) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`

/** The cloud bank as static SVG in frame coordinates, for the poster and the no-WebGL fallback. */
function cloudsSvg() {
  const sigmas = [...new Set(CLOUDS.map(sigmaOf))]
  const filters = sigmas
    .map(
      (s, i) =>
        `<filter id="b${i}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${s.toFixed(2)}"/></filter>`,
    )
    .join('')
  const ellipses = CLOUDS.map((c) => {
    const fill = hex(c.color === 'white' ? WHITE : CREAM)
    const rotate = c.rotate ? ` transform="rotate(${c.rotate} ${c.cx} ${c.cy})"` : ''
    return `<ellipse cx="${c.cx}" cy="${c.cy}" rx="${c.rx}" ry="${c.ry}" fill="${fill}" fill-opacity="${c.opacity}" filter="url(#b${sigmas.indexOf(sigmaOf(c))})"${rotate}/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME.width}" height="${FRAME.height}" viewBox="0 0 ${FRAME.width} ${FRAME.height}" overflow="visible" style="position:absolute;inset:0;overflow:visible"><defs>${filters}</defs>${ellipses}</svg>`
}

/** Static DOM rendition of the scene. Used as the poster and as the no-WebGL fallback. */
function createStaticLayer(theme: SkyTheme, background: RGB) {
  const root = document.createElement('div')
  root.setAttribute('aria-hidden', 'true')
  Object.assign(root.style, { position: 'absolute', inset: '0', overflow: 'hidden' })

  if (theme === 'night') {
    const { moonlightSource } = NIGHT
    const vs = (h: number) => (h / NIGHT.referenceHeight) * 100
    root.style.background = [
      `radial-gradient(circle at ${moonlightSource.x * 100}% ${moonlightSource.y}px, rgb(${NIGHT.moonlight.join(' ')} / 0.09), transparent 700px)`,
      `linear-gradient(${css(NIGHT.zenith)} ${vs(NIGHT.fadeTop)}%, ${css(background)} ${vs(NIGHT.fadeBottom)}%)`,
    ].join(', ')
    return { root, layout(_v: View) {} }
  }

  const frame = document.createElement('div')
  Object.assign(frame.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${FRAME.width}px`,
    height: `${FRAME.height}px`,
    transformOrigin: '0 0',
  })

  // Sky and fade extend far beyond the frame so non-matching aspect ratios never show an edge.
  const pad = 2000
  const sky = document.createElement('div')
  const stops = SKY.stops.map((s) => `${css(s.color)} ${s.at * 100}%`).join(', ')
  Object.assign(sky.style, {
    position: 'absolute',
    left: `${-pad}px`,
    top: `${-pad}px`,
    width: `${FRAME.width + pad * 2}px`,
    height: `${SKY.fadeTop + 40 + pad}px`,
    background: `radial-gradient(${SKY.radius[0]}px ${SKY.radius[1]}px at ${SKY.center[0] + pad}px ${SKY.center[1] + pad}px, ${stops})`,
  })

  const fade = document.createElement('div')
  Object.assign(fade.style, {
    position: 'absolute',
    left: `${-pad}px`,
    top: `${SKY.fadeTop}px`,
    width: `${FRAME.width + pad * 2}px`,
    height: `${SKY.fadeHeight + pad}px`,
    background: `linear-gradient(${css(SKY.fadeFrom)}, ${css(background)} ${SKY.fadeHeight}px)`,
  })

  frame.append(sky, fade)
  frame.insertAdjacentHTML('beforeend', cloudsSvg())
  root.append(frame)

  return {
    root,
    layout(v: View) {
      frame.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scaleX}, ${v.scaleY})`
    },
  }
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

/** Kicks off compilation. Status isn't queried here, since that would block on the driver. */
function startProgram(gl: WebGLRenderingContext, fragmentShader: string) {
  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentShader))
  gl.bindAttribLocation(program, 0, 'aPosition')
  gl.linkProgram(program)
  return program
}

function finishProgram(gl: WebGLRenderingContext, program: WebGLProgram) {
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    const logs = gl
      .getAttachedShaders(program)
      ?.map((s) => gl.getShaderInfoLog(s))
      .join('\n')
    throw new Error(`cloud-shader: shader failed: ${gl.getProgramInfoLog(program)}\n${logs}`)
  }
  gl.useProgram(program)

  // One oversized triangle covers the viewport with no diagonal seam.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  return {
    uResolution: gl.getUniformLocation(program, 'uResolution'),
    uTime: gl.getUniformLocation(program, 'uTime'),
    uView: gl.getUniformLocation(program, 'uView'),
    uPxScale: gl.getUniformLocation(program, 'uPxScale'),
    uIntro: gl.getUniformLocation(program, 'uIntro'),
    uBackground: gl.getUniformLocation(program, 'uBackground'),
  }
}

/**
 * Mounts an animated sky behind the content of `container`. Size and position the
 * container with your layout; the sky fills it. Content inside stays on top.
 */
export function createSky(container: HTMLElement, options: SkyOptions = {}): Sky {
  const theme = options.theme ?? 'day'
  const defaults = DEFAULTS[theme]
  const {
    resolution = defaults.resolution,
    maxCanvasPixels = defaults.maxCanvasPixels,
    maxFps = 30,
    speed = defaults.speed,
    introDuration = defaults.introDuration,
    minVisibleWidth = 760,
    anchorY = 0.5,
    cloudLine,
    startTime = 0,
  } = options
  const background = parseColor(options.background ?? defaults.background)
  const layout: Layout = { minVisibleWidth, anchorY, cloudLine }
  // Where the cloud line is drawn now, chasing `layout.cloudLine` so measured layout shifts don't jump.
  let drawnLine = cloudLine

  // The sky sits at z-index -1 inside the container's own stacking context, so
  // in-flow content paints above it without needing its own positioning.
  const previousStyle = { position: container.style.position, isolation: container.style.isolation }
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative'
  container.style.isolation = 'isolate'

  // The layer's own colour matches the page and the first intro frame, so
  // nothing flashes while the shader compiles.
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '-1',
    background: css(background),
  })

  const canvas = document.createElement('canvas')
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block',
    opacity: '0',
    transition: 'opacity 600ms ease',
  })
  layer.append(canvas)
  container.prepend(layer)

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'low-power',
  })

  let uniforms: ReturnType<typeof finishProgram> | null = null
  let staticLayer: ReturnType<typeof createStaticLayer> | null = null
  let view: View = { scaleX: 1, scaleY: 1, x: 0, y: 0 }
  let canvasRatio = resolution
  let cssSize = { w: 0, h: 0 }
  let time = startTime
  let intro = 1
  let introElapsed = 0
  let lastFrame = 0
  let raf = 0
  let compileRaf = 0
  let inViewport = true
  let revealed = false
  let started = false
  let destroyed = false

  const showStatic = () => {
    if (staticLayer) return
    staticLayer = createStaticLayer(theme, background)
    layer.prepend(staticLayer.root)
    staticLayer.layout(computeView(cssSize.w, cssSize.h, 1, layout))
  }

  const onReady = () => {
    if (destroyed) return
    if (!started) {
      started = true
      if (!uniforms) {
        showStatic()
      } else if (introDuration > 0 && !reducedMotion.matches) {
        // The first intro frame is solid page colour, so show the canvas without a fade.
        intro = 0
        time = startTime - introDuration * speed
        canvas.style.transition = 'none'
        revealed = true
        canvas.style.opacity = '1'
      } else {
        showStatic()
      }
    }
    resize()
    update()
  }

  // Compiles off the main thread where KHR_parallel_shader_compile exists. The
  // page-coloured layer covers the wait, which reads as the start of the intro.
  const init = () => {
    if (!gl) return onReady()
    const program = startProgram(gl, theme === 'night' ? NIGHT_FRAGMENT_SHADER : DAY_FRAGMENT_SHADER)
    const finish = () => {
      try {
        uniforms = finishProgram(gl, program)
      } catch (error) {
        console.error(error)
        uniforms = null
      }
      onReady()
    }
    const ext = gl.getExtension('KHR_parallel_shader_compile')
    if (!ext) return finish()
    const poll = () => {
      if (destroyed || gl.isContextLost()) return
      if (gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR)) finish()
      else compileRaf = requestAnimationFrame(poll)
    }
    poll()
  }

  const resize = () => {
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    cssSize = { w, h }
    staticLayer?.layout(computeView(w, h, 1, layout))

    let ratio = resolution
    if (w * h * ratio * ratio > maxCanvasPixels) ratio = Math.sqrt(maxCanvasPixels / (w * h))
    const cw = Math.max(1, Math.round(w * ratio))
    const ch = Math.max(1, Math.round(h * ratio))
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw
      canvas.height = ch
    }
    canvasRatio = cw / w
    updateView()
    // Resizing the canvas clears it, so redraw before the next paint rather than waiting on the throttled tick.
    draw()
  }

  const updateView = () => {
    view = computeView(canvas.width, canvas.height, canvasRatio, { ...layout, cloudLine: drawnLine })
  }

  const draw = () => {
    if (!gl || !uniforms || gl.isContextLost()) return
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height)
    gl.uniform4f(uniforms.uView, view.scaleX, view.scaleY, view.x, view.y)
    gl.uniform1f(uniforms.uPxScale, canvasRatio)
    gl.uniform1f(uniforms.uTime, time)
    gl.uniform1f(uniforms.uIntro, intro)
    gl.uniform3f(uniforms.uBackground, background[0] / 255, background[1] / 255, background[2] / 255)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    if (!revealed) {
      revealed = true
      canvas.style.opacity = '1'
      canvas.addEventListener('transitionend', () => staticLayer?.root.remove(), { once: true })
    }
  }

  const skipIntro = () => {
    intro = 1
    time = startTime
  }

  const isAnimating = () => raf !== 0
  const shouldAnimate = () =>
    !!uniforms && inViewport && document.visibilityState === 'visible' && !reducedMotion.matches

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    const delta = now - lastFrame
    if (intro >= 1 && delta < 1000 / maxFps - 2) return
    // Clamp so returning from a long pause doesn't jump the scene.
    const dt = Math.min(delta, 100) / 1000
    lastFrame = now
    if (drawnLine !== undefined && layout.cloudLine !== undefined && drawnLine !== layout.cloudLine) {
      const gap = layout.cloudLine - drawnLine
      drawnLine = Math.abs(gap) < 0.5 ? layout.cloudLine : drawnLine + gap * (1 - Math.exp(-dt * 5))
      updateView()
    }
    if (intro < 1) {
      // Time is derived from intro progress so the intro lands exactly on startTime.
      introElapsed = Math.min(introElapsed + dt, introDuration)
      intro = introElapsed / introDuration
      time = startTime - (introDuration - introElapsed) * speed
    } else {
      time += dt * speed
    }
    draw()
  }

  const update = () => {
    if (reducedMotion.matches && intro < 1) skipIntro()
    if (shouldAnimate()) {
      if (!isAnimating()) {
        lastFrame = performance.now()
        raf = requestAnimationFrame(tick)
      }
    } else {
      cancelAnimationFrame(raf)
      raf = 0
      draw()
    }
  }

  const onContextLost = (e: Event) => {
    e.preventDefault()
    uniforms = null
    update()
  }
  const onContextRestored = () => init()

  const resizeObserver = new ResizeObserver(resize)
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    inViewport = entry.isIntersecting
    update()
  })

  resize()
  resizeObserver.observe(container)
  intersectionObserver.observe(container)
  document.addEventListener('visibilitychange', update)
  reducedMotion.addEventListener('change', update)
  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('webglcontextrestored', onContextRestored)
  init()

  return {
    setCloudLine(y) {
      if (theme !== 'day' || y === layout.cloudLine) return
      layout.cloudLine = y
      staticLayer?.layout(computeView(cssSize.w, cssSize.h, 1, layout))
      // Ease only while frames are already being drawn; otherwise land straight on it.
      if (!isAnimating() || drawnLine === undefined) {
        drawnLine = y
        updateView()
        draw()
      }
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      cancelAnimationFrame(compileRaf)
      cancelAnimationFrame(raf)
      raf = 0
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      document.removeEventListener('visibilitychange', update)
      reducedMotion.removeEventListener('change', update)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
      layer.remove()
      container.style.position = previousStyle.position
      container.style.isolation = previousStyle.isolation
    },
  }
}
