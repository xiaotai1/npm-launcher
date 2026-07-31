import type { Project } from '../../../shared/types'

export function pathTail(path: string): string {
  const normalized = path.trim().replace(/[\\/]+$/, '')
  const parts = normalized.split(/[\\/]/).filter(Boolean)
  return parts.at(-1) || normalized || '项目目录'
}

export function extractLocalPort(url?: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname) || !parsed.port) return null
    return `:${parsed.port}`
  } catch {
    const match = url.match(/^(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)/)
    return match ? `:${match[1]}` : null
  }
}

export function projectSecondaryLabel(project: Project, localUrl?: string | null): string {
  return extractLocalPort(localUrl) || pathTail(project.path)
}

export function projectDisplayMeta(project: Project, localUrl?: string | null): string {
  return `npm run ${project.command} · ${projectSecondaryLabel(project, localUrl)}`
}
