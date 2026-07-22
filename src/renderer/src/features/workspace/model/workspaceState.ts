import type { ActivityItem, ProcessStatus, Project } from '../../../shared/types'

export interface OverviewCounts {
  total: number
  running: number
  error: number
}

export function getOverviewCounts(
  projects: Project[],
  statuses: Record<string, ProcessStatus>
): OverviewCounts {
  const projectIds = new Set(projects.map(project => project.id))
  const configuredStatuses = Object.values(statuses).filter(status => projectIds.has(status.projectId))

  return {
    total: projects.length,
    running: configuredStatuses.filter(status => status.status === 'running').length,
    error: configuredStatuses.filter(status => status.status === 'error').length
  }
}

export function activityFromStatus(
  previous: ProcessStatus | undefined,
  next: ProcessStatus,
  timestamp = Date.now()
): ActivityItem | null {
  if (previous?.status === next.status) return null

  const type = next.status === 'running'
    ? 'started'
    : next.status === 'error'
      ? 'error'
      : 'stopped'

  return {
    id: `${next.projectId}-${timestamp}-${type}`,
    projectId: next.projectId,
    type,
    timestamp
  }
}

export function appendActivity(
  items: ActivityItem[],
  item: ActivityItem | null,
  limit = 20
): ActivityItem[] {
  return item ? [item, ...items].slice(0, limit) : items
}
