import type { ITheme } from '@xterm/xterm'

/**
 * 终端配色：浅色用清爽的米白底（不是纯白，减少视觉刺激），深色用深蓝黑（不是纯黑，更舒服）。
 * 调色板对齐 ANSI 16 色，方便各种 CLI 工具的彩色输出。
 */
export function getTerminalTheme(theme: 'light' | 'dark'): ITheme {
  if (theme === 'light') {
    return {
      background: '#f4f1ec',
      foreground: '#3a4252',
      cursor: '#2f6fed',
      cursorAccent: '#f4f1ec',
      selectionBackground: 'rgba(47, 111, 237, 0.22)',
      selectionForeground: undefined,
      // ANSI 标准 16 色：参考 iTerm2 Light、VS Code Light+ 调色板
      black: '#1f2937',
      red: '#d23a4a',
      green: '#1a8754',
      yellow: '#a06b00',
      blue: '#2f6fed',
      magenta: '#9b51e0',
      cyan: '#0a7c7c',
      white: '#dfe5ed',
      brightBlack: '#7b8799',
      brightRed: '#e0525f',
      brightGreen: '#1ea468',
      brightYellow: '#b87c0c',
      brightBlue: '#3a7ef5',
      brightMagenta: '#ad6ce8',
      brightCyan: '#149393',
      brightWhite: '#ffffff'
    }
  }

  return {
    background: '#0e1525',
    foreground: '#c9d1d9',
    cursor: '#7ca2ff',
    cursorAccent: '#0e1525',
    selectionBackground: 'rgba(124, 162, 255, 0.28)',
    selectionForeground: undefined,
    // 深色调色板：参考 One Dark、Dracula 风格
    black: '#1c2433',
    red: '#f87171',
    green: '#5ee6a8',
    yellow: '#fbbf24',
    blue: '#7ca2ff',
    magenta: '#c79bf2',
    cyan: '#7dd3d3',
    white: '#dce4ef',
    brightBlack: '#637186',
    brightRed: '#ff9999',
    brightGreen: '#7eeab9',
    brightYellow: '#ffd166',
    brightBlue: '#9bb6ff',
    brightMagenta: '#d4acf5',
    brightCyan: '#9adcdc',
    brightWhite: '#f6f8fb'
  }
}

export function currentTerminalTheme(): ITheme {
  return getTerminalTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark')
}
