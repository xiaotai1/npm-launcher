import { contextBridge, ipcRenderer } from 'electron'
import type { Project, AppConfig, Folder } from '../main/configManager'
import type { ProcessStatus, LogEntry } from '../main/processManager'

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 配置
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),
  saveConfig: (config: AppConfig): Promise<boolean> => ipcRenderer.invoke('save-config', config),
  addProject: (project: Project): Promise<boolean> => ipcRenderer.invoke('add-project', project),
  updateProject: (project: Project): Promise<boolean> => ipcRenderer.invoke('update-project', project),
  deleteProject: (projectId: string): Promise<boolean> => ipcRenderer.invoke('delete-project', projectId),
  reorderProjects: (projectIds: string[]): Promise<boolean> => ipcRenderer.invoke('reorder-projects', projectIds),
  reorderFolders: (folderIds: string[]): Promise<boolean> => ipcRenderer.invoke('reorder-folders', folderIds),
  addFolder: (folder: Folder): Promise<boolean> => ipcRenderer.invoke('add-folder', folder),
  updateFolder: (folder: Folder): Promise<boolean> => ipcRenderer.invoke('update-folder', folder),
  deleteFolder: (folderId: string): Promise<boolean> => ipcRenderer.invoke('delete-folder', folderId),
  toggleFavorite: (projectId: string): Promise<boolean> => ipcRenderer.invoke('toggle-favorite', projectId),
  moveProjectToFolder: (projectId: string, folderId: string | null): Promise<boolean> => ipcRenderer.invoke('move-project-to-folder', projectId, folderId),

  // Node 版本
  getNodeVersion: (): Promise<{ version: string | null; error?: string }> =>
    ipcRenderer.invoke('get-node-version'),
  getNodeVersions: (): Promise<{ versions: string[]; current: string | null; error?: string }> =>
    ipcRenderer.invoke('get-node-versions'),
  switchNodeVersion: (version: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('switch-node-version', version),

  // 原生主题
  setNativeTheme: (theme: 'light' | 'dark' | 'system'): Promise<void> =>
    ipcRenderer.invoke('set-native-theme', theme),

  // 窗口控制（自定义标题栏）
  minimize: (): Promise<void> => ipcRenderer.invoke('window-minimize'),
  maximize: (): Promise<void> => ipcRenderer.invoke('window-maximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window-close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window-is-maximized'),

  // 文件对话框
  selectFolder: (): Promise<{ canceled: boolean; path: string | null }> =>
    ipcRenderer.invoke('select-folder'),
  getPackageScripts: (dir: string): Promise<{ scripts: string[]; error?: string }> =>
    ipcRenderer.invoke('get-package-scripts', dir),
  openInFileManager: (folderPath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('open-in-file-manager', folderPath),
  openInVscode: (folderPath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('open-in-vscode', folderPath),

  // 进程管理
  startProject: (projectId: string, projectPath: string, command: string, nodeVersion?: string): Promise<boolean> =>
    ipcRenderer.invoke('start-project', projectId, projectPath, command, nodeVersion),
  stopProject: (projectId: string): Promise<boolean> =>
    ipcRenderer.invoke('stop-project', projectId),
  getProcessStatus: (projectId: string): Promise<ProcessStatus> =>
    ipcRenderer.invoke('get-process-status', projectId),
  startAllProjects: (projects: Array<{ id: string; path: string; command: string; nodeVersion?: string }>): Promise<{ success: number; failed: number }> =>
    ipcRenderer.invoke('start-all-projects', projects),
  stopAllProjects: (): Promise<boolean> =>
    ipcRenderer.invoke('stop-all-projects'),

  // 事件监听
  onLogData: (callback: (log: LogEntry) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, log: LogEntry) => callback(log)
    ipcRenderer.on('log-data', handler)
    return () => ipcRenderer.removeListener('log-data', handler)
  },

  onProcessStatus: (callback: (status: ProcessStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: ProcessStatus) => callback(status)
    ipcRenderer.on('process-status', handler)
    return () => ipcRenderer.removeListener('process-status', handler)
  },

  // 日志管理
  getLogFiles: (projectId: string): Promise<string[]> =>
    ipcRenderer.invoke('get-log-files', projectId),
  getLogContent: (projectId: string, filename: string): Promise<string> =>
    ipcRenderer.invoke('get-log-content', projectId, filename),
  exportLog: (projectId: string): Promise<{ success: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('export-log', projectId),
  analyzeErrors: (projectId: string, exitCode: number): Promise<any> =>
    ipcRenderer.invoke('analyze-errors', projectId, exitCode),
  openLogDir: (projectId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('open-log-dir', projectId),
  onErrorAnalysis: (callback: (analysis: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, analysis: any) => callback(analysis)
    ipcRenderer.on('error-analysis', handler)
    return () => ipcRenderer.removeListener('error-analysis', handler)
  },

  // 平台信息
  platform: process.platform,

  // PTY 终端
  ptySpawn: (id: string, cols: number, rows: number, cwd: string, nodeVersion?: string) => {
    ipcRenderer.send('pty-spawn', { id, cols, rows, cwd, nodeVersion })
  },
  ptyWrite: (id: string, data: string) => {
    ipcRenderer.send('pty-write', { id, data })
  },
  ptyResize: (id: string, cols: number, rows: number) => {
    ipcRenderer.send('pty-resize', { id, cols, rows })
  },
  ptyKill: (id: string) => {
    ipcRenderer.send('pty-kill', { id })
  },
  onPtyData: (callback: (data: { id: string; data: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; data: string }) => callback(data)
    ipcRenderer.on('pty-data', handler)
    return () => ipcRenderer.removeListener('pty-data', handler)
  },
  onPtyExit: (callback: (data: { id: string; exitCode: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; exitCode: number }) => callback(data)
    ipcRenderer.on('pty-exit', handler)
    return () => ipcRenderer.removeListener('pty-exit', handler)
  }
})
