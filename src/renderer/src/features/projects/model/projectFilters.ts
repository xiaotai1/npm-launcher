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

export type ProjectDropPlacement = 'before' | 'after'

function projectGroupKey(project: Project): string {
  if (project.folderId) return `folder:${project.folderId}`
  return project.favorite ? 'root:favorite' : 'root:normal'
}

export function canReorderProjects(projects: Project[], draggedId: string, targetId: string): boolean {
  const draggedProject = projects.find(project => project.id === draggedId)
  const targetProject = projects.find(project => project.id === targetId)
  return Boolean(
    draggedProject
    && targetProject
    && draggedId !== targetId
    && projectGroupKey(draggedProject) === projectGroupKey(targetProject)
  )
}

export function reorderProjectIds(
  projects: Project[],
  draggedId: string,
  targetId: string,
  placement: ProjectDropPlacement
): string[] {
  const currentIds = projects.map(project => project.id)
  const draggedProject = projects.find(project => project.id === draggedId)
  const targetProject = projects.find(project => project.id === targetId)

  if (!draggedProject || !targetProject || !canReorderProjects(projects, draggedId, targetId)) return currentIds

  const groupKey = projectGroupKey(draggedProject)

  const groupIds = projects
    .filter(project => projectGroupKey(project) === groupKey)
    .map(project => project.id)
  const draggedIndex = groupIds.indexOf(draggedId)
  if (draggedIndex === -1) return currentIds

  groupIds.splice(draggedIndex, 1)
  const targetIndex = groupIds.indexOf(targetId)
  if (targetIndex === -1) return currentIds
  groupIds.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, draggedId)

  let groupIndex = 0
  return projects.map(project => (
    projectGroupKey(project) === groupKey ? groupIds[groupIndex++] : project.id
  ))
}
