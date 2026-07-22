import type { AppConfig } from '../shared/types'

export type ThemeMode = AppConfig['theme']

export function applyTheme(theme: ThemeMode) {
  const effectiveTheme = theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : theme

  document.documentElement.setAttribute('data-theme', effectiveTheme)
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
