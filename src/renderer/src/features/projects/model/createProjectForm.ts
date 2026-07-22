import type { Folder, Project } from '../../../shared/types'

export type CreateMode = 'project' | 'folder'

export interface ProjectDraft {
  name: string
  path: string
  command: string
}

export function projectNameFromPath(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  return normalized.split('/').pop() || ''
}

export function canCreateProject(draft: ProjectDraft): boolean {
  return Boolean(draft.name.trim() && draft.path.trim() && draft.command.trim())
}

export function canCreateFolder(name: string): boolean {
  return Boolean(name.trim())
}

export function buildProject(draft: ProjectDraft, id: string): Project {
  return {
    id,
    name: draft.name.trim(),
    path: draft.path.trim(),
    command: draft.command.trim()
  }
}

export function buildFolder(name: string, id: string): Folder {
  return { id, name: name.trim() }
}
