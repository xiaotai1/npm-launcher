import type { ITheme } from '@xterm/xterm'

export function getTerminalTheme(theme: 'light' | 'dark'): ITheme {
  if (theme === 'light') {
    return {
      background: '#fbfcfe', foreground: '#526176', cursor: '#346de5',
      selectionBackground: 'rgba(52, 109, 229, .16)', black: '#263449',
      red: '#c8424a', green: '#128158', yellow: '#8a6400', blue: '#285fc7',
      magenta: '#8155b7', cyan: '#087c8c', white: '#dfe5ed', brightBlack: '#7b8799',
      brightRed: '#d75d63', brightGreen: '#20ae76', brightYellow: '#a77b08',
      brightBlue: '#346de5', brightMagenta: '#9668cc', brightCyan: '#1593a5', brightWhite: '#ffffff'
    }
  }

  return {
    background: '#0b1018', foreground: '#a5b1c2', cursor: '#5688ff',
    selectionBackground: 'rgba(86, 136, 255, .22)', black: '#121a26',
    red: '#ee8585', green: '#47cc8f', yellow: '#d8b45f', blue: '#7ca2ff',
    magenta: '#bf8ee6', cyan: '#69b9cf', white: '#dce4ef', brightBlack: '#637186',
    brightRed: '#f29a9a', brightGreen: '#65d9a3', brightYellow: '#e6c779',
    brightBlue: '#91b0ff', brightMagenta: '#cda5eb', brightCyan: '#82cada', brightWhite: '#f6f8fb'
  }
}

export function currentTerminalTheme(): ITheme {
  return getTerminalTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark')
}
