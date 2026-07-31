import type { ProjectStartFailure } from '../../../shared/types'

export interface LaunchFailure extends ProjectStartFailure {
  timestamp: number
}

export type LaunchFailureState = Record<string, LaunchFailure>

export function setLaunchFailure(
  state: LaunchFailureState,
  failure: ProjectStartFailure,
  timestamp = Date.now()
): LaunchFailureState {
  return {
    ...state,
    [failure.projectId]: {
      ...failure,
      timestamp
    }
  }
}

export function clearLaunchFailure(state: LaunchFailureState, projectId: string): LaunchFailureState {
  if (!state[projectId]) return state
  const next = { ...state }
  delete next[projectId]
  return next
}

export function mergeLaunchFailures(
  state: LaunchFailureState,
  failures: ProjectStartFailure[],
  requestedProjectIds: string[],
  timestamp = Date.now()
): LaunchFailureState {
  const next = { ...state }
  for (const projectId of requestedProjectIds) {
    delete next[projectId]
  }
  for (const failure of failures) {
    next[failure.projectId] = {
      ...failure,
      timestamp
    }
  }
  return next
}
