import type { LogEntry } from '../../../shared/types'

export type LogFilter = 'all' | LogEntry['type']

const ANSI_HIGHLIGHT_START = '\x1b[43;30m'
const ANSI_HIGHLIGHT_END = '\x1b[0m'
const ANSI_RESET = '\x1b[0m'
// 按日志类型着色：错误红色，stderr 警告黄色，其余保持原样
const ANSI_TYPE_COLOR: Partial<Record<LogEntry['type'], string>> = {
  error: '\x1b[91m',
  stderr: '\x1b[93m'
}

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/

export function colorizeLogByType(data: string, type: LogEntry['type']): string {
  const color = ANSI_TYPE_COLOR[type]
  if (!color) return data
  // 进程已自带颜色时不覆盖，避免破坏原有配色
  if (ANSI_PATTERN.test(data)) return data

  return data
    .split(/(\r?\n)/)
    .map(part => (part === '' || /^\r?\n$/.test(part) ? part : color + part + ANSI_RESET))
    .join('')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function logMatchesFilter(log: Pick<LogEntry, 'type' | 'data'>, filter: LogFilter, query: string): boolean {
  if (filter !== 'all' && log.type !== filter) return false

  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return true

  return log.data.toLocaleLowerCase().includes(normalized)
}

export function highlightLogQuery(data: string, query: string, restoreColor = ''): string {
  const normalized = query.trim()
  if (!normalized) return data

  return data.replace(new RegExp(escapeRegExp(normalized), 'gi'), match =>
    `${ANSI_HIGHLIGHT_START}${match}${ANSI_HIGHLIGHT_END}${restoreColor}`
  )
}

export function formatLogForView(log: Pick<LogEntry, 'type' | 'data'>, filter: LogFilter, query: string): string | null {
  if (!logMatchesFilter(log, filter, query)) return null
  return highlightLogQuery(
    colorizeLogByType(log.data, log.type),
    query,
    ANSI_TYPE_COLOR[log.type] ?? ''
  )
}

export function formatLogsForExport(logs: Pick<LogEntry, 'data'>[]): string {
  return logs
    .map(log => stripLogAnsi(log.data).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd())
    .filter(Boolean)
    .join('\n')
}

function stripLogAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
}
