import type { LogEntry } from '../../../shared/types'

const MAX_HISTORY = 500
const histories = new Map<string, LogEntry[]>()
const listeners = new Set<(log: LogEntry) => void>()

export function appendLogEntry(log: LogEntry): void {
  if (!histories.has(log.projectId)) {
    histories.set(log.projectId, [])
  }

  const history = histories.get(log.projectId)!
  history.push(log)
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY)
  }

  listeners.forEach(listener => listener(log))
}

export function getLogHistory(projectId: string): LogEntry[] {
  return histories.get(projectId)?.slice() || []
}

export function clearLogHistory(projectId: string): void {
  histories.delete(projectId)
}

export function subscribeLogHistory(listener: (log: LogEntry) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
