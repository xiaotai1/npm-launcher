import type { AppConfig, Folder, Project } from './configManager'

const THEMES = new Set(['light', 'dark', 'system'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeProject(value: unknown): Project | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.path !== 'string' || typeof value.command !== 'string') {
    return null
  }

  const project: Project = {
    id: value.id,
    name: value.name,
    path: value.path,
    command: value.command
  }
  if (typeof value.favorite === 'boolean') project.favorite = value.favorite
  if (typeof value.folderId === 'string' || value.folderId === null) project.folderId = value.folderId
  if (typeof value.nodeVersion === 'string') project.nodeVersion = value.nodeVersion
  return project
}

function normalizeFolder(value: unknown): Folder | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null

  const folder: Folder = {
    id: value.id,
    name: value.name
  }
  if (typeof value.collapsed === 'boolean') folder.collapsed = value.collapsed
  return folder
}

export function normalizeImportedConfig(value: unknown): AppConfig | null {
  if (!isRecord(value) || !Array.isArray(value.projects) || !Array.isArray(value.folders) || !THEMES.has(String(value.theme))) {
    return null
  }

  const projects = value.projects.map(normalizeProject)
  const folders = value.folders.map(normalizeFolder)
  if (projects.some(project => project === null) || folders.some(folder => folder === null)) return null

  return {
    projects: projects as Project[],
    folders: folders as Folder[],
    theme: value.theme as AppConfig['theme']
  }
}
