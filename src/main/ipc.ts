import { app, ipcMain, dialog, BrowserWindow, nativeTheme, shell } from 'electron'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { readdirSync, readlinkSync, existsSync, promises as fsp } from 'fs'
import { join, basename } from 'path'
import * as os from 'os'
import {
  getConfig,
  saveConfig,
  addProject as addProjectToConfig,
  updateProject as updateProjectInConfig,
  deleteProject as deleteProjectFromConfig,
  reorderProjects as reorderProjectsInConfig,
  reorderFolders as reorderFoldersInConfig,
  addFolder as addFolderToConfig,
  updateFolder as updateFolderInConfig,
  deleteFolder as deleteFolderFromConfig,
  toggleProjectFavorite as toggleFavoriteInConfig,
  moveProjectToFolder as moveProjectToFolderInConfig
} from './configManager'
import type { Folder } from './configManager'
import {
  startProject,
  stopProject,
  stopAllProcesses,
  getProcessStatus,
  isProcessRunning
} from './processManager'
import { getMainWindow } from './index'
import { execWithSudo } from './sudoExecutor'
import { setupPtyIpc, broadcastToAllPty } from './ptyManager'
import { isWindows, getShellEnv, getNvmPaths, clearShellEnvCache } from './platform'
import type { Project, AppConfig } from './configManager'
import { getLogFiles, getLogContent, getLogDirPath, analyzeErrors } from './logManager'
import type { ErrorAnalysis } from './logManager'
import { readPackageScripts } from './packageScripts'
import { resolveProjectRunRequest } from './projectRunRequest'
import { inspectProjectHealth } from './projectHealth'

interface StartProjectResult {
  success: boolean
  error?: string
}

const execAsync = promisify(exec)

export function setupIpc(): void {
  setupPtyIpc()
  // ===== 配置管理 =====

  // 获取配置
  ipcMain.handle('get-config', (): AppConfig => {
    return getConfig()
  })

  // 保存配置
  ipcMain.handle('save-config', (_event, config: AppConfig): boolean => {
    return saveConfig(config)
  })

  // 添加项目
  ipcMain.handle('add-project', (_event, project: Project): boolean => {
    return addProjectToConfig(project)
  })

  // 更新项目
  ipcMain.handle('update-project', (_event, project: Project): boolean => {
    return updateProjectInConfig(project)
  })

  // 删除项目
  ipcMain.handle('delete-project', (_event, projectId: string): boolean => {
    // 先停止进程
    if (isProcessRunning(projectId)) {
      stopProject(projectId)
    }
    return deleteProjectFromConfig(projectId)
  })

  // 排序项目
  ipcMain.handle('reorder-projects', (_event, projectIds: string[]): boolean => {
    return reorderProjectsInConfig(projectIds)
  })

  // 排序文件夹
  ipcMain.handle('reorder-folders', (_event, folderIds: string[]): boolean => {
    return reorderFoldersInConfig(folderIds)
  })

  // 文件夹管理
  ipcMain.handle('add-folder', (_event, folder: Folder): boolean => {
    return addFolderToConfig(folder)
  })

  ipcMain.handle('update-folder', (_event, folder: Folder): boolean => {
    return updateFolderInConfig(folder)
  })

  ipcMain.handle('delete-folder', (_event, folderId: string): boolean => {
    return deleteFolderFromConfig(folderId)
  })

  ipcMain.handle('toggle-favorite', (_event, projectId: string): boolean => {
    return toggleFavoriteInConfig(projectId)
  })

  ipcMain.handle('move-project-to-folder', (_event, projectId: string, folderId: string | null): boolean => {
    return moveProjectToFolderInConfig(projectId, folderId)
  })

  // ===== Node.js 版本 =====

  ipcMain.handle('get-node-version', async (): Promise<{ version: string | null; error?: string }> => {
    try {
      // 统一通过 login shell 执行 node --version，确保与终端行为一致
      const env = await getShellEnv()
      const { stdout } = await execAsync('node --version', { env })
      return { version: stdout.trim() }
    } catch (error: any) {
      return { version: null, error: error.message }
    }
  })

  // 获取 nvm 已安装的版本列表
  ipcMain.handle('get-node-versions', async (): Promise<{ versions: string[]; current: string | null; error?: string }> => {
    try {
      const versionPattern = isWindows ? /^v?\d+\.\d+\.\d+$/ : /^v\d+\.\d+\.\d+$/

      if (isWindows) {
        // === Windows: nvm-windows ===
        const nvmHome = process.env.NVM_HOME
        if (!nvmHome || !existsSync(nvmHome)) {
          return { versions: [], current: null, error: '未找到 NVM_HOME 环境变量' }
        }

        const entries = readdirSync(nvmHome, { withFileTypes: true })
        const versions: string[] = []
        for (const entry of entries) {
          if (entry.isDirectory() && versionPattern.test(entry.name)) {
            let ver = entry.name
            if (!ver.startsWith('v')) ver = 'v' + ver
            versions.push(ver)
          }
        }
        versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

        const nvmSymlink = process.env.NVM_SYMLINK
        let current: string | null = null
        if (nvmSymlink && existsSync(nvmSymlink)) {
          try {
            const linkTarget = readlinkSync(nvmSymlink)
            const baseName = basename(linkTarget)
            current = baseName.startsWith('v') ? baseName : 'v' + baseName
          } catch { /* ignore */ }
        }
        return { versions, current }
      }

      // === macOS / Linux: nvm-sh ===
      const { versionsDir } = getNvmPaths()
      if (!versionsDir || !existsSync(versionsDir)) {
        return { versions: [], current: null, error: '未找到 NVM 安装目录' }
      }

      const entries = readdirSync(versionsDir, { withFileTypes: true })
      const versions: string[] = []
      for (const entry of entries) {
        if (entry.isDirectory() && versionPattern.test(entry.name)) {
          versions.push(entry.name)
        }
      }
      versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

      // 当前版本：通过 login shell 执行 node --version 获取实际版本
      let current: string | null = null
      try {
        const env = await getShellEnv()
        const { stdout } = await execAsync('node --version', { env })
        current = stdout.trim()
      } catch { /* ignore */ }
      if (!current && versions.length > 0) {
        current = versions[0]
      }

      return { versions, current }
    } catch (error: any) {
      return { versions: [], current: null, error: error.message }
    }
  })

  // 切换 Node 版本
  ipcMain.handle('switch-node-version', async (_event, version: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (isWindows) {
        // === Windows: nvm-windows（通过 mklink /J） ===
        const nvmHome = process.env.NVM_HOME
        const nvmSymlink = process.env.NVM_SYMLINK
        if (!nvmHome || !nvmSymlink) {
          return { success: false, error: '未找到 NVM_HOME 或 NVM_SYMLINK 环境变量' }
        }

        const ver = version.replace(/^v/, '')
        const verWithV = 'v' + ver
        const targetDir = existsSync(join(nvmHome, verWithV))
          ? join(nvmHome, verWithV)
          : join(nvmHome, ver)

        if (!existsSync(targetDir)) {
          return { success: false, error: `版本 ${version} 未安装` }
        }

        const command = `rmdir "${nvmSymlink}" 2>nul & mklink /J "${nvmSymlink}" "${targetDir}"`
        const { stdout } = await execWithSudo(command)

        if (stdout.includes('cannot') || stdout.includes('error') || stdout.includes('Error')) {
          return { success: false, error: stdout }
        }
        // 切换后刷新环境缓存
        clearShellEnvCache()
        return { success: true }
      }

      // === macOS / Linux: 通过 login shell 执行 nvm alias default + nvm use ===
      const nvmDir = process.env.NVM_DIR || join(os.homedir(), '.nvm')
      const shell = process.env.SHELL || '/bin/zsh'
      // alias default 持久化 + nvm use 立即生效
      const command = `"${shell}" -l -c "source '${nvmDir}/nvm.sh' && nvm alias default ${version} && nvm use ${version}"`

      const { stdout, stderr } = await execAsync(command, { timeout: 15000 })

      // nvm use 输出可能在 stdout 或 stderr
      const output = stdout + stderr
      if (output.includes('N/A') || output.includes('not installed')) {
        return { success: false, error: `版本 ${version} 未安装` }
      }

      // 切换后刷新环境缓存
      clearShellEnvCache()

      // 向所有运行中的终端发送 nvm use，同步 Node 版本
      broadcastToAllPty(`source '${nvmDir}/nvm.sh' && nvm use ${version}`)

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ===== 文件对话框 =====

  // 选择文件夹
  ipcMain.handle('select-folder', async (): Promise<{ canceled: boolean; path: string | null }> => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: '选择项目目录'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, path: null }
    }
    return { canceled: false, path: result.filePaths[0] }
  })

  // 读取 package.json 的 scripts
  ipcMain.handle('get-package-scripts', async (_event, dir: string): Promise<{ scripts: string[]; error?: string }> => {
    return readPackageScripts(dir)
  })

  // 在系统文件管理器中打开文件夹
  ipcMain.handle('open-in-file-manager', async (_event, folderPath: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await shell.openPath(folderPath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 在 VS Code 中打开项目
  ipcMain.handle('open-in-vscode', async (_event, folderPath: string): Promise<{ success: boolean; error?: string }> => {
    // 查找 code 可执行文件（跨平台）
    const candidates = isWindows
      ? ['code.cmd', 'code']
      : [
          '/usr/local/bin/code',
          join(process.env.HOME || '', '.local/bin/code'),
          '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
        ]

    for (const cmd of candidates) {
      if (existsSync(cmd) || !cmd.includes('/')) {
        try {
          const child = spawn(cmd, ['-n', folderPath], { detached: true, stdio: 'ignore' })
          child.unref()
          return { success: true }
        } catch {
          continue
        }
      }
    }

    // 最终回退：vscode:// URL 协议
    try {
      await shell.openExternal('vscode://file/' + folderPath)
      return { success: true }
    } catch {
      return { success: false, error: '未找到 VS Code，请确保已安装' }
    }
  })

  // 打开运行日志中识别到的本地访问地址
  ipcMain.handle('open-local-url', async (_event, url: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const parsed = new URL(url)
      const isLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname)
      if (!['http:', 'https:'].includes(parsed.protocol) || !isLocal) {
        return { success: false, error: '仅支持打开本地访问地址' }
      }

      await shell.openExternal(parsed.toString())
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || '打开地址失败' }
    }
  })

  // ===== 原生主题 =====
  ipcMain.handle('set-native-theme', (_event, theme: 'light' | 'dark' | 'system') => {
    nativeTheme.themeSource = theme
  })

  // ===== 进程管理 =====

  // 启动项目
  ipcMain.handle('start-project', async (_event, projectId: string): Promise<StartProjectResult> => {
    const config = getConfig()
    const configuredProject = config.projects.find(project => project.id === projectId)
    if (!configuredProject) return { success: false, error: '项目配置不存在' }

    const health = inspectProjectHealth(configuredProject)
    if (!health.ok) {
      return { success: false, error: health.issues[0]?.message || '启动前检查未通过' }
    }

    const target = resolveProjectRunRequest(config, projectId, readPackageScripts(configuredProject.path).scripts)
    if (!target) return { success: false, error: '项目启动配置已失效' }

    const success = await startProject(getMainWindow(), target.id, target.path, target.command, target.nodeVersion)
    return success ? { success: true } : { success: false, error: '项目启动失败' }
  })

  // 停止项目
  ipcMain.handle('stop-project', (_event, projectId: string): boolean => {
    return stopProject(projectId, getMainWindow())
  })

  // 获取状态
  ipcMain.handle('get-process-status', (_event, projectId: string) => {
    return getProcessStatus(projectId)
  })

  // 批量启动所有项目
  ipcMain.handle('start-all-projects', async (_event, projects: Array<{ id: string; path: string; command: string; nodeVersion?: string }>): Promise<{ success: number; failed: number }> => {
    const config = getConfig()
    let success = 0
    let failed = 0

    for (const request of projects) {
      const configuredProject = config.projects.find(project => project.id === request.id)
      if (!configuredProject) {
        failed++
        continue
      }

      const health = inspectProjectHealth(configuredProject)
      if (!health.ok) {
        failed++
        continue
      }

      const target = resolveProjectRunRequest(config, request.id, readPackageScripts(configuredProject.path).scripts)
      if (!target) {
        failed++
        continue
      }

      const result = await startProject(getMainWindow(), target.id, target.path, target.command, target.nodeVersion)
      if (result) {
        success++
      } else {
        failed++
      }
    }
    return { success, failed }
  })

  // 批量停止所有项目
  ipcMain.handle('stop-all-projects', (): boolean => {
    stopAllProcesses()
    return true
  })

  // ===== 日志管理 =====

  // 获取项目的历史日志文件列表
  ipcMain.handle('get-log-files', (_event, projectId: string): string[] => {
    return getLogFiles(projectId)
  })

  // 读取指定日志文件内容
  ipcMain.handle('get-log-content', (_event, projectId: string, filename: string): string => {
    return getLogContent(projectId, filename)
  })

  // 导出日志到用户选择的目录
  ipcMain.handle('export-log', async (event, projectId: string): Promise<{ success: boolean; path?: string; error?: string }> => {
    try {
      const logDir = getLogDirPath(projectId)
      const files = getLogFiles(projectId)
      if (files.length === 0) {
        return { success: false, error: '没有可导出的日志文件' }
      }

      const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0]
      if (!win) {
        return { success: false, error: '无法获取窗口' }
      }

      // 拼接完整的默认保存路径（桌面 + 文件名）
      const homeDir = app.getPath('home')
      const defaultPath = join(homeDir, 'Desktop', files[0])

      const result = await dialog.showSaveDialog(win, {
        title: '导出日志',
        defaultPath,
        filters: [{ name: '日志文件', extensions: ['log'] }, { name: '所有文件', extensions: ['*'] }]
      })
      if (result.canceled || !result.filePath) {
        return { success: false }
      }

      const latestLog = join(logDir, files[0])
      const content = await fsp.readFile(latestLog, 'utf-8')
      await fsp.writeFile(result.filePath, content, 'utf-8')
      return { success: true, path: result.filePath }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 手动触发错误分析
  ipcMain.handle('analyze-errors', (_event, projectId: string, exitCode: number): ErrorAnalysis | null => {
    return analyzeErrors(projectId, exitCode)
  })

  // 打开日志目录
  ipcMain.handle('open-log-dir', async (_event, projectId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const logDir = getLogDirPath(projectId)
      await shell.openPath(logDir)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ===== 窗口控制（自定义标题栏） =====
  ipcMain.handle('window-minimize', () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.minimize()
    }
  })

  ipcMain.handle('window-maximize', () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
    }
  })

  ipcMain.handle('window-close', () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.close()
    }
  })

  ipcMain.handle('window-is-maximized', () => {
    const win = getMainWindow()
    return win?.isMaximized() ?? false
  })
}
