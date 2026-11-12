import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { createSky, type Sky as SkyInstance, type SkyOptions, type SkyTheme } from './sky'

export interface SkyProps extends Omit<SkyOptions, 'theme' | 'background'> {
  /** `day`, `night`, or `auto` to follow the visitor's `prefers-color-scheme`. Default `day`. */
  theme?: SkyTheme | 'auto'
  /** Page colour the scene dissolves into. Pass one per theme to follow `auto`. */
  background?: SkyOptions['background'] | { day?: SkyOptions['background']; night?: SkyOptions['background'] }
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

function useResolvedTheme(theme: SkyProps['theme']): SkyTheme | null {
  const [systemDark, setSystemDark] = useState<boolean | null>(null)
  useEffect(() => {
    if (theme !== 'auto') return
    const query = window.matchMedia(DARK_QUERY)
    const sync = () => setSystemDark(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [theme])
  if (theme !== 'auto') return theme ?? 'day'
  // Unknown until mounted, so nothing renders on the server or the first client pass.
  return systemDark === null ? null : systemDark ? 'night' : 'day'
}

/**
 * An animated sky behind its children. Size it like any block element; the sky fills it.
 *
 * ```tsx
 * <Sky theme="auto" style={{ height: 600 }}>
 *   <h1>Hello</h1>
 * </Sky>
 * ```
 */
export function Sky({ theme, background, className, style, children, cloudLine, ...options }: SkyProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const skyRef = useRef<SkyInstance | null>(null)
  const cloudLineRef = useRef(cloudLine)
  cloudLineRef.current = cloudLine
  const resolved = useResolvedTheme(theme)

  const color =
    background !== null && typeof background === 'object' && !Array.isArray(background)
      ? resolved && (background as { day?: SkyOptions['background']; night?: SkyOptions['background'] })[resolved]
      : (background as SkyOptions['background'])
  // Options are plain values, so a serialised key recreates the sky only when one actually changes.
  const key = JSON.stringify([resolved, color, options])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` captures every option
  useEffect(() => {
    if (!hostRef.current || !resolved) return
    const sky = createSky(hostRef.current, {
      ...options,
      theme: resolved,
      background: color ?? undefined,
      cloudLine: cloudLineRef.current,
    })
    skyRef.current = sky
    return () => {
      skyRef.current = null
      sky.destroy()
    }
  }, [key])

  useEffect(() => {
    if (cloudLine !== undefined) skyRef.current?.setCloudLine(cloudLine)
  }, [cloudLine])

  return (
    <div className={className} style={{ position: 'relative', isolation: 'isolate', ...style }}>
      {/* The sky mounts into its own element so React never sees nodes it didn't render. */}
      <div ref={hostRef} aria-hidden style={{ position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none' }} />
      {children}
    </div>
  )
}

export type { SkyColor, SkyOptions, SkyTheme } from './sky'
