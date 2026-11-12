# cloud-shader

An animated WebGL sky for hero sections. By day, a bank of soft clouds drifts and morphs under a warm gradient. By night, stars twinkle and slowly wheel around an off-screen pole under a wash of moonlight. Both themes open with a short intro: the clouds part, or the stars fade in.

- **Zero dependencies.** Plain WebGL 1, one full-screen triangle and one fragment shader.
- **Light on the GPU.** Renders at half resolution by default (the scene is all soft blur), caps at 30 fps once settled, and pauses when off-screen or in a background tab.
- **Graceful.** Respects `prefers-reduced-motion`, falls back to a static CSS/SVG rendition without WebGL, recovers from context loss, and compiles the shader off the main thread where `KHR_parallel_shader_compile` is available.
- **Framework-agnostic**, with an optional React component.

## Install

```sh
npm install cloud-shader
```

## Usage

### Vanilla

```ts
import { createSky } from 'cloud-shader'

const sky = createSky(document.querySelector('.hero')!, { theme: 'day' })

// Later:
sky.destroy()
```

The sky fills the container, so size the container with your own CSS. Its content stays on top. If the container is `position: static`, cloud-shader makes it `relative`. It also gives the container `isolation: isolate`, so the sky can sit behind your content without you adding `z-index` anywhere.

### React

```tsx
import { Sky } from 'cloud-shader/react'

export function Hero() {
  return (
    <Sky theme="auto" style={{ height: 600 }}>
      <h1>Hello</h1>
    </Sky>
  )
}
```

`theme="auto"` follows the visitor's `prefers-color-scheme`. If your site has its own theme toggle, pass the resolved theme instead. For example, with `next-themes`:

```tsx
const { resolvedTheme } = useTheme()
return <Sky theme={resolvedTheme === 'dark' ? 'night' : 'day'} />
```

The component is marked `'use client'`, so it works in the Next.js App Router. Changing any prop other than `cloudLine` recreates the sky, which replays the intro.

### Just the shader

The GLSL sources are exported as strings if you want to drive them yourself, for example in three.js or another WebGL setup:

```ts
import { DAY_FRAGMENT_SHADER, NIGHT_FRAGMENT_SHADER, VERTEX_SHADER } from 'cloud-shader'
```

| Uniform | Type | Shader | Meaning |
| --- | --- | --- | --- |
| `uResolution` | `vec2` | both | Canvas size in pixels |
| `uTime` | `float` | both | Animation time in seconds |
| `uIntro` | `float` | both | Intro progress, 0 (solid background) to 1 (settled) |
| `uBackground` | `vec3` | both | Page colour the scene fades into, 0–1 RGB |
| `uView` | `vec4` | day | `xy`: canvas px per frame px; `zw`: canvas-space offset of the 1183×657 design frame |
| `uPxScale` | `float` | night | Canvas px per CSS px |

The vertex shader expects a `vec2 aPosition` attribute in clip space.

## Options

Every option works with both `createSky` and the `<Sky>` component's props. Most defaults depend on the theme.

| Option | Default (day / night) | Description |
| --- | --- | --- |
| `theme` | `'day'` | `'day'` or `'night'`. `<Sky>` also takes `'auto'`. |
| `background` | `#f5f3f2` / `#0a0a0a` | Page colour the sky dissolves into at its lower edge and fades in from on load. Set it to your page background. Takes `#rgb`, `#rrggbb` or `[r, g, b]`. `<Sky>` also takes `{ day, night }`. |
| `resolution` | `0.5` / `1` | Canvas pixels per CSS pixel. |
| `maxCanvasPixels` | `1_000_000` / `2_000_000` | Cap on canvas pixel count for very large displays. |
| `maxFps` | `30` | Frame cap once settled. The intro runs at full refresh rate. |
| `speed` | `10` / `1` | Animation speed multiplier. |
| `introDuration` | `4` / `2.5` | Intro length in seconds. `0` disables it. |
| `startTime` | `0` | Animation time the intro lands on. Change it to start from a different arrangement. |
| `minVisibleWidth` | `760` | Day only. Never crop the scene narrower than this many frame pixels, so phones still see clouds. |
| `anchorY` | `0.5` | Day only. Vertical alignment when the container's aspect ratio differs from the scene's: `0` top, `1` bottom. |
| `cloudLine` | none | Day only. CSS px from the container's top to place the cloud bank, for example the top edge of your first card. Overrides `anchorY`. |

`createSky` returns:

- `setCloudLine(y)` moves the cloud bank. It eases there while animating, so you can call it on every layout change.
- `destroy()` stops rendering, releases the WebGL context and removes everything cloud-shader added.

## Browser support

cloud-shader works in any browser with WebGL 1, `ResizeObserver` and `IntersectionObserver`, which covers every current browser. Without WebGL it shows a static rendition of the same scene.

## Development

```sh
pnpm install
pnpm dev        # demo at http://localhost:5173
pnpm typecheck
pnpm build
```

## License

[MIT](./LICENSE)
