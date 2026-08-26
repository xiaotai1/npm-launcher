import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type {
  AppConfig,
  DesktopAPI,
  ErrorAnalysis,
  Folder,
  LogEntry,
  ProcessStatus,
  Project,
  StartAllProjectsResult,
  StartProjectResult
} from '../types'

function subscribe<T>(event: string, callback: (payload: T) => void): () => void {
  let active = true
  let unlisten: UnlistenFn | null = null
  void listen<T>(event, ({ payload }) => callback(payload)).then(dispose => {
    if (active) unlisten = dispose
    else dispose()
  })
  return () => {
    active = false
    unlisten?.()
  }
}

function subscribeReady<T>(event: string, callback: (payload: T) => void): Promise<UnlistenFn> {
  return listen<T>(event, ({ payload }) => callback(payload))
}

function detectPlatform(): string {
  const agent = navigator.userAgent
  if (agent.includes('Windows')) return 'win32'
  if (agent.includes('Macintosh') || agent.includes('Mac OS')) return 'darwin'
  return 'linux'
}

export const desktopAPI: DesktopAPI = {
  getConfig: () => invoke<AppConfig>('get_config'),
  saveConfig: config => invoke<boolean>('save_config', { configValue: config }),
  exportConfig: () => invoke('export_config'),
  importConfig: () => invoke('import_config'),
  addProject: (project: Project) => invoke<boolean>('add_project', { project }),
  updateProject: (project: Project) => invoke<boolean>('update_project', { project }),
  deleteProject: projectId => invoke<boolean>('delete_project', { projectId }),
  reorderProjects: projectIds => invoke<boolean>('reorder_projects', { projectIds }),
  reorderFolders: folderIds => invoke<boolean>('reorder_folders', { folderIds }),
  addFolder: (folder: Folder) => invoke<boolean>('add_folder', { folder }),
  updateFolder: (folder: Folder) => invoke<boolean>('update_folder', { folder }),
  deleteFolder: folderId => invoke<boolean>('delete_folder', { folderId }),
  toggleFavorite: projectId => invoke<boolean>('toggle_favorite', { projectId }),
  moveProjectToFolder: (projectId, folderId) =>
    invoke<boolean>('move_project_to_folder', { projectId, folderId }),
  getNodeVersion: () => invoke('get_node_version'),
  getNodeVersions: () => invoke('get_node_versions'),
  switchNodeVersion: version => invoke('switch_node_version', { version }),
  selectFolder: () => invoke('select_folder'),
  getPackageScripts: dir => invoke('get_package_scripts', { dir }),
  openInFileManager: folderPath => invoke('open_in_file_manager', { folderPath }),
  openInVscode: folderPath => invoke('open_in_vscode', { folderPath }),
  openLocalUrl: url => invoke('open_local_url', { url }),
  startProject: projectId => invoke<StartProjectResult>('start_project', { projectId }),
  stopProject: projectId => invoke<boolean>('stop_project', { projectId }),
  getProcessStatus: projectId => invoke<ProcessStatus>('get_process_status', { projectId }),
  getProcessStatuses: projectIds => invoke<ProcessStatus[]>('get_process_statuses', { projectIds }),
  startAllProjects: projectIds => invoke<StartAllProjectsResult>('start_all_projects', { projectIds }),
  stopAllProjects: () => invoke<boolean>('stop_all_projects'),
  onLogData: callback => subscribe<LogEntry>('log-data', callback),
  onProcessStatus: callback => subscribe<ProcessStatus>('process-status', callback),
  exportLog: (filename, content) => invoke('export_log', { filename, content }),
  analyzeErrors: (projectId, exitCode) =>
    invoke<ErrorAnalysis | null>('analyze_errors', { projectId, exitCode }),
  onErrorAnalysis: callback => subscribe<ErrorAnalysis>('error-analysis', callback),
  getSessionLogs: projectId =>
    invoke<Omit<LogEntry, 'timestamp'>[]>('get_session_logs', { projectId }),
  platform: detectPlatform(),
  setNativeTheme: theme => invoke<void>('set_native_theme', { theme }),
  minimize: () => invoke<void>('window_minimize'),
  maximize: () => invoke<void>('window_maximize'),
  close: () => invoke<void>('window_close'),
  isMaximized: () => invoke<boolean>('window_is_maximized'),
  readClipboardText: () => invoke<string>('plugin:clipboard-manager|read_text'),
  writeClipboardText: text => invoke<void>('plugin:clipboard-manager|write_text', { text }),
  ptySpawn: (id, cols, rows, cwd, nodeVersion) =>
    invoke<boolean>('pty_spawn', { id, cols, rows, cwd, nodeVersion }),
  ptyWrite: (id, data) => invoke<boolean>('pty_write', { id, data }),
  ptyResize: (id, cols, rows) => invoke<boolean>('pty_resize', { id, cols, rows }),
  ptyKill: id => invoke<boolean>('pty_kill', { id }),
  onPtyData: callback => subscribeReady<{ id: string; data: string }>('pty-data', callback),
  onPtyExit: callback => subscribeReady<{ id: string; exitCode: number }>('pty-exit', callback)
}

window.desktopAPI = desktopAPI
