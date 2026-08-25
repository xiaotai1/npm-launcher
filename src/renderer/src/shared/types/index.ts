// 项目配置
export interface Project {
  id: string
  name: string
  path: string
  command: string
  favorite?: boolean
  folderId?: string | null
  nodeVersion?: string
}

// 文件夹
export interface Folder {
  id: string
  name: string
  collapsed?: boolean
}

// 应用配置
export interface AppConfig {
  projects: Project[]
  folders: Folder[]
  theme: 'light' | 'dark' | 'system'
}

export type ActiveView = 'overview' | 'project'

export interface ActivityItem {
  id: string
  projectId: string
  type: 'started' | 'stopped' | 'error'
  timestamp: number
}

// 进程状态
export interface ProcessStatus {
  projectId: string
  status: 'running' | 'stopped' | 'error'
  pid?: number
  exitCode?: number
  nodeVersion?: string
}

// 日志条目
export interface LogEntry {
  projectId: string
  type: 'stdout' | 'stderr' | 'info' | 'error'
  data: string
  timestamp: number
}

// 错误分析匹配项
export interface ErrorMatch {
  name: string
  severity: 'critical' | 'warning' | 'info'
  lines: string[]
  suggestion: string
}

// 错误分析结果
export interface ErrorAnalysis {
  projectId: string
  exitCode: number
  timestamp: number
  matches: ErrorMatch[]
  summary: string
}

export interface ProjectStartFailure {
  projectId: string
  projectName: string
  message: string
}

export interface StartProjectResult {
  success: boolean
  error?: string
}

export interface StartAllProjectsResult {
  success: number
  failed: number
  failures: ProjectStartFailure[]
}

export interface DesktopAPI {
  getConfig: () => Promise<AppConfig>
  saveConfig: (config: AppConfig) => Promise<boolean>
  exportConfig: () => Promise<{ success: boolean; path?: string; error?: string }>
  importConfig: () => Promise<{ success: boolean; path?: string; error?: string }>
  addProject: (project: Project) => Promise<boolean>
  updateProject: (project: Project) => Promise<boolean>
  deleteProject: (projectId: string) => Promise<boolean>
  reorderProjects: (projectIds: string[]) => Promise<boolean>
  reorderFolders: (folderIds: string[]) => Promise<boolean>
  addFolder: (folder: Folder) => Promise<boolean>
  updateFolder: (folder: Folder) => Promise<boolean>
  deleteFolder: (folderId: string) => Promise<boolean>
  toggleFavorite: (projectId: string) => Promise<boolean>
  moveProjectToFolder: (projectId: string, folderId: string | null) => Promise<boolean>
  getNodeVersion: () => Promise<{ version: string | null; error?: string }>
  getNodeVersions: () => Promise<{ versions: string[]; current: string | null; error?: string }>
  switchNodeVersion: (version: string) => Promise<{ success: boolean; error?: string }>
  selectFolder: () => Promise<{ canceled: boolean; path: string | null }>
  getPackageScripts: (dir: string) => Promise<{ scripts: string[]; error?: string }>
  openInFileManager: (folderPath: string) => Promise<{ success: boolean; error?: string }>
  openInVscode: (folderPath: string) => Promise<{ success: boolean; error?: string }>
  openLocalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
  startProject: (projectId: string) => Promise<StartProjectResult>
  stopProject: (projectId: string) => Promise<boolean>
  getProcessStatus: (projectId: string) => Promise<ProcessStatus>
  getProcessStatuses: (projectIds: string[]) => Promise<ProcessStatus[]>
  startAllProjects: (projectIds: string[]) => Promise<StartAllProjectsResult>
  stopAllProjects: () => Promise<boolean>
  onLogData: (callback: (log: LogEntry) => void) => () => void
  onProcessStatus: (callback: (status: ProcessStatus) => void) => () => void
  exportLog: (filename: string, content: string) => Promise<{ success: boolean; path?: string; error?: string }>
  analyzeErrors: (projectId: string, exitCode: number) => Promise<ErrorAnalysis | null>
  onErrorAnalysis: (callback: (analysis: ErrorAnalysis) => void) => () => void
  platform: string
  setNativeTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  readClipboardText: () => Promise<string>
  writeClipboardText: (text: string) => Promise<void>
  ptySpawn: (id: string, cols: number, rows: number, cwd: string, nodeVersion?: string) => Promise<boolean>
  ptyWrite: (id: string, data: string) => Promise<boolean>
  ptyResize: (id: string, cols: number, rows: number) => Promise<boolean>
  ptyKill: (id: string) => Promise<boolean>
  onPtyData: (callback: (data: { id: string; data: string }) => void) => Promise<() => void>
  onPtyExit: (callback: (data: { id: string; exitCode: number }) => void) => Promise<() => void>
}

declare global {
  interface Window {
    desktopAPI: DesktopAPI
  }
}

export {}
