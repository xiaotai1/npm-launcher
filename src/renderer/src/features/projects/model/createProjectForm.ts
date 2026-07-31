import type { Folder, Project } from '../../../shared/types'

export type CreateMode = 'project' | 'folder'

export interface ProjectDraft {
  name: string
  path: string
  command: string
}

export interface PackageScriptsDiscovery {
  scripts: string[]
  error?: string
}

export function projectNameFromPath(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  return normalized.split('/').pop() || ''
}

export function packageScriptsMessage(result: PackageScriptsDiscovery): string {
  if (result.error === '该目录下没有 package.json') {
    return '该目录下没有 package.json，请选择 NPM 项目根目录'
  }
  if (result.error) {
    return `读取 package.json 失败：${result.error}`
  }
  if (result.scripts.length === 0) {
    return 'package.json 中没有 scripts，请先添加启动命令'
  }
  return `发现 ${result.scripts.length} 个可用命令`
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
