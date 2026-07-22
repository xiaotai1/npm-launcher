import type { Project } from '../../../shared/types'

export function filterProjects(projects: Project[], query: string): Project[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return projects

  return projects.filter(project =>
    project.name.toLocaleLowerCase().includes(normalized) ||
    project.path.toLocaleLowerCase().includes(normalized) ||
    project.command.toLocaleLowerCase().includes(normalized)
  )
}

export function getRootFavorites(projects: Project[]): Project[] {
  return projects.filter(project => project.favorite && !project.folderId)
}

export function getRootProjects(projects: Project[]): Project[] {
  return projects.filter(project => !project.favorite && !project.folderId)
}

export function getFolderProjects(projects: Project[], folderId: string): Project[] {
  return projects.filter(project => project.folderId === folderId)
}
