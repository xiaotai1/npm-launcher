// 项目配置
export interface Project {
  id: string
  name: string
  path: string
  command: string
  favorite?: boolean
  folderId?: string | null
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

// 进程状态
export interface ProcessStatus {
  projectId: string
  status: 'running' | 'stopped' | 'error'
  pid?: number
  exitCode?: number
}

// 日志条目
export interface LogEntry {
  projectId: string
  type: 'stdout' | 'stderr' | 'info' | 'error'
  data: string
  timestamp: number
}

// Electron API 类型声明
declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<AppConfig>
      saveConfig: (config: AppConfig) => Promise<boolean>
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
      startProject: (projectId: string, projectPath: string, command: string) => Promise<boolean>
      stopProject: (projectId: string) => Promise<boolean>
      getProcessStatus: (projectId: string) => Promise<ProcessStatus>
      onLogData: (callback: (log: LogEntry) => void) => () => void
      onProcessStatus: (callback: (status: ProcessStatus) => void) => () => void
      ptySpawn: (id: string, cols: number, rows: number, cwd: string) => void
      ptyWrite: (id: string, data: string) => void
      ptyResize: (id: string, cols: number, rows: number) => void
      ptyKill: (id: string) => void
      onPtyData: (callback: (data: { id: string; data: string }) => void) => () => void
      onPtyExit: (callback: (data: { id: string; exitCode: number }) => void) => () => void
      setNativeTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>
      setTitlebarOverlay: (theme: 'light' | 'dark') => Promise<void>
    }
  }
}

export {}
