import type { AppConfig } from '../shared/types'

export type ThemeMode = AppConfig['theme']
type EffectiveTheme = Exclude<ThemeMode, 'system'>

interface ThemeRoot {
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

type FrameScheduler = (callback: () => void) => void

const themeChangeVersions = new WeakMap<object, number>()

export function updateThemeRoot(
  root: ThemeRoot,
  theme: EffectiveTheme,
  scheduleFrame: FrameScheduler
) {
  const version = (themeChangeVersions.get(root) || 0) + 1
  themeChangeVersions.set(root, version)
  root.setAttribute('data-theme-changing', '')
  root.setAttribute('data-theme', theme)

  scheduleFrame(() => {
    scheduleFrame(() => {
      if (themeChangeVersions.get(root) === version) {
        root.removeAttribute('data-theme-changing')
      }
    })
  })
}

export function applyTheme(theme: ThemeMode) {
  const effectiveTheme = theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : theme

  updateThemeRoot(
    document.documentElement,
    effectiveTheme,
    callback => window.requestAnimationFrame(callback)
  )
  window.electronAPI.setNativeTheme(theme)
}

export function installSystemThemeListener(getTheme: () => ThemeMode) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = () => {
    if (getTheme() === 'system') applyTheme('system')
  }
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
