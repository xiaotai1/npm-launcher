import type { AppConfig } from './configManager'

export interface ProjectRunTarget {
  id: string
  path: string
  command: string
  nodeVersion?: string
}

export function resolveProjectRunRequest(
  config: AppConfig,
  projectId: string,
  packageScripts: string[]
): ProjectRunTarget | null {
  const project = config.projects.find(item => item.id === projectId)
  if (!project) return null
  if (!packageScripts.includes(project.command)) return null

  return {
    id: project.id,
    path: project.path,
    command: project.command,
    nodeVersion: project.nodeVersion
  }
}
