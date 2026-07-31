import type { LogEntry } from '../../../shared/types'

export type LogFilter = 'all' | LogEntry['type']

const ANSI_HIGHLIGHT_START = '\x1b[43;30m'
const ANSI_HIGHLIGHT_END = '\x1b[0m'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function logMatchesFilter(log: Pick<LogEntry, 'type' | 'data'>, filter: LogFilter, query: string): boolean {
  if (filter !== 'all' && log.type !== filter) return false

  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return true

  return log.data.toLocaleLowerCase().includes(normalized)
}

export function highlightLogQuery(data: string, query: string): string {
  const normalized = query.trim()
  if (!normalized) return data

  return data.replace(new RegExp(escapeRegExp(normalized), 'gi'), match =>
    `${ANSI_HIGHLIGHT_START}${match}${ANSI_HIGHLIGHT_END}`
  )
}

export function formatLogForView(log: Pick<LogEntry, 'type' | 'data'>, filter: LogFilter, query: string): string | null {
  if (!logMatchesFilter(log, filter, query)) return null
  return highlightLogQuery(log.data, query)
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
