import { ipcMain, dialog, BrowserWindow, nativeTheme } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readdirSync, readFileSync, readlinkSync, existsSync } from 'fs'
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
  getProcessStatus,
  isProcessRunning
} from './processManager'
import { getMainWindow } from './index'
import { execWithSudo } from './sudoExecutor'
import { setupPtyIpc } from './ptyManager'
import { isWindows, getShellEnv, getNvmPaths, clearShellEnvCache } from './platform'
import type { Project, AppConfig } from './configManager'

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
      if (isWindows) {
        const env = await getShellEnv()
        const { stdout } = await execAsync('node --version', { env })
        return { version: stdout.trim() }
      }

      // macOS: 从 nvm default alias 解析当前版本
      const { nvmDir } = getNvmPaths()
      if (nvmDir) {
        const defaultAliasPath = join(nvmDir, 'alias', 'default')
        if (existsSync(defaultAliasPath)) {
          const alias = readFileSync(defaultAliasPath, 'utf-8').trim()
          // alias 可能是简写如 "20.19"，需要在已安装版本中找到完整匹配
          const versionsDir = join(nvmDir, 'versions', 'node')
          if (existsSync(versionsDir)) {
            const entries = readdirSync(versionsDir, { withFileTypes: true })
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const fullVer = entry.name.startsWith('v') ? entry.name : 'v' + entry.name
                // 精确匹配或前缀匹配（alias=v14.18.1 匹配 v14.18.1，alias=20.19 匹配 v20.19.x）
                const aliasWithV = alias.startsWith('v') ? alias : 'v' + alias
                if (fullVer === aliasWithV || fullVer.startsWith(aliasWithV + '.')) {
                  return { version: fullVer }
                }
              }
            }
          }
          // 没匹配到，直接返回 alias 值
          return { version: alias.startsWith('v') ? alias : 'v' + alias }
        }
      }

      // fallback
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
      const { nvmDir, versionsDir } = getNvmPaths()
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

      // 当前版本：从 default alias 解析完整版本号
      let current: string | null = null
      const defaultAliasPath = join(nvmDir!, 'alias', 'default')
      if (existsSync(defaultAliasPath)) {
        const alias = readFileSync(defaultAliasPath, 'utf-8').trim()
        const aliasWithV = alias.startsWith('v') ? alias : 'v' + alias
        // 在已安装版本中找到完整匹配
        for (const ver of versions) {
          if (ver === aliasWithV || ver.startsWith(aliasWithV + '.')) {
            current = ver
            break
          }
        }
        if (!current && alias) {
          current = aliasWithV
        }
      }
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
    try {
      const pkgPath = join(dir, 'package.json')
      if (!existsSync(pkgPath)) {
        return { scripts: [], error: '该目录下没有 package.json' }
      }
      const content = readFileSync(pkgPath, 'utf-8')
      const pkg = JSON.parse(content)
      const scripts = pkg.scripts ? Object.keys(pkg.scripts) : []
      return { scripts }
    } catch (error: any) {
      return { scripts: [], error: error.message }
    }
  })

  // ===== 原生主题 =====
  ipcMain.handle('set-native-theme', (_event, theme: 'light' | 'dark' | 'system') => {
    nativeTheme.themeSource = theme
  })

  ipcMain.handle('set-titlebar-overlay', (_event, theme: 'light' | 'dark') => {
    const win = getMainWindow()
    if (!win) return
    if (process.platform !== 'win32') return
    if (theme === 'dark') {
      win.setTitleBarOverlay({ color: '#0f172a', symbolColor: '#94a3b8' })
    } else {
      win.setTitleBarOverlay({ color: '#ffffff', symbolColor: '#475569' })
    }
  })

  // ===== 进程管理 =====

  // 启动项目
  ipcMain.handle('start-project', async (_event, projectId: string, projectPath: string, command: string): Promise<boolean> => {
    return await startProject(getMainWindow(), projectId, projectPath, command)
  })

  // 停止项目
  ipcMain.handle('stop-project', (_event, projectId: string): boolean => {
    return stopProject(projectId)
  })

  // 获取状态
  ipcMain.handle('get-process-status', (_event, projectId: string) => {
    return getProcessStatus(projectId)
  })
}
