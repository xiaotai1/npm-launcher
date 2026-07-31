export interface ProjectStartFailure {
  projectId: string
  projectName: string
  message: string
}

export interface StartAllProjectsResult {
  success: number
  failed: number
  failures: ProjectStartFailure[]
}

export function createStartAllProjectsResult(): StartAllProjectsResult {
  return {
    success: 0,
    failed: 0,
    failures: []
  }
}

export function recordStartSuccess(result: StartAllProjectsResult): void {
  result.success += 1
}

export function recordStartFailure(
  result: StartAllProjectsResult,
  project: { id: string; name: string },
  message: string
): void {
  result.failed += 1
  result.failures.push({
    projectId: project.id,
    projectName: project.name,
    message
  })
}
