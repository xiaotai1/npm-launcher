import type { LogEntry } from '../../../shared/types'

const MAX_HISTORY = 800
const sessionLogs = new Map<string, LogEntry[]>()
const listeners = new Set<(log: LogEntry) => void>()

export function appendSessionLogEntry(log: LogEntry): void {
  if (!sessionLogs.has(log.projectId)) {
    sessionLogs.set(log.projectId, [])
  }

  const logs = sessionLogs.get(log.projectId)!
  logs.push(log)
  if (logs.length > MAX_HISTORY) {
    logs.splice(0, logs.length - MAX_HISTORY)
  }

  listeners.forEach(listener => listener(log))
}

export function getSessionLogs(projectId: string): LogEntry[] {
  return sessionLogs.get(projectId)?.slice() || []
}

export function clearSessionLogs(projectId: string): void {
  sessionLogs.delete(projectId)
}

export function subscribeSessionLogs(listener: (log: LogEntry) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
