import { ipcMain, dialog, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readdirSync, readFileSync, readlinkSync, existsSync } from 'fs'
import { join, basename } from 'path'
import https from 'https'
import http from 'http'
import {
  getConfig,
  saveConfig,
  addProject as addProjectToConfig,
  updateProject as updateProjectInConfig,
  deleteProject as deleteProjectFromConfig,
  reorderProjects as reorderProjectsInConfig,
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
      const { stdout } = await execAsync('node --version')
      return { version: stdout.trim() }
    } catch (error: any) {
      return { version: null, error: error.message }
    }
  })

  // 获取 nvm 已安装的版本列表（直接读取文件系统，避免 nvm 弹窗）
  ipcMain.handle('get-node-versions', async (): Promise<{ versions: string[]; current: string | null; error?: string }> => {
    try {
      const nvmHome = process.env.NVM_HOME
      if (!nvmHome || !existsSync(nvmHome)) {
        return { versions: [], current: null, error: '未找到 NVM_HOME 环境变量' }
      }

      // 读取 NVM_HOME 目录下的子文件夹作为已安装版本
      const entries = readdirSync(nvmHome, { withFileTypes: true })
      const versionPattern = /^v?\d+\.\d+\.\d+$/
      const versions: string[] = []

      for (const entry of entries) {
        if (entry.isDirectory() && versionPattern.test(entry.name)) {
          let ver = entry.name
          if (!ver.startsWith('v')) ver = 'v' + ver
          versions.push(ver)
        }
      }

      // 按版本号降序排列
      versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

      // 当前版本通过 NVM_SYMLINK 判断
      const nvmSymlink = process.env.NVM_SYMLINK
      let current: string | null = null
      if (nvmSymlink && existsSync(nvmSymlink)) {
        try {
          const linkTarget = readlinkSync(nvmSymlink)
          const baseName = basename(linkTarget)
          current = baseName.startsWith('v') ? baseName : 'v' + baseName
        } catch {
          // symlink 读取失败，用 node --version 的结果匹配
        }
      }

      return { versions, current }
    } catch (error: any) {
      return { versions: [], current: null, error: error.message }
    }
  })

  // 切换 Node 版本（直接更新 nvm 符号链接，不调用 nvm 命令避免弹窗）
  ipcMain.handle('switch-node-version', async (_event, version: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const nvmHome = process.env.NVM_HOME
      const nvmSymlink = process.env.NVM_SYMLINK
      if (!nvmHome || !nvmSymlink) {
        return { success: false, error: '未找到 NVM_HOME 或 NVM_SYMLINK 环境变量' }
      }

      // 目标版本目录（兼容有/无 v 前缀）
      const ver = version.replace(/^v/, '')
      const verWithV = 'v' + ver
      const targetDir = existsSync(join(nvmHome, verWithV))
        ? join(nvmHome, verWithV)
        : join(nvmHome, ver)

      if (!existsSync(targetDir)) {
        return { success: false, error: `版本 ${version} 未安装` }
      }

      // nvm use 的本质：删除旧符号链接，创建新的指向目标版本的 junction
      const command = `rmdir "${nvmSymlink}" 2>nul & mklink /J "${nvmSymlink}" "${targetDir}"`
      const { stdout } = await execWithSudo(command)

      if (stdout.includes('cannot') || stdout.includes('error') || stdout.includes('Error')) {
        return { success: false, error: stdout }
      }
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 获取可安装的远程 Node 版本列表（从 nvm 镜像源获取，与 nvm install 用同一个源）
  ipcMain.handle('get-available-node-versions', async (): Promise<{ versions: string[]; error?: string }> => {
    try {
      // 读取 nvm 镜像源配置
      const nvmHome = process.env.NVM_HOME
      let mirrorUrl = 'https://nodejs.org/dist/'
      if (nvmHome && existsSync(join(nvmHome, 'settings.txt'))) {
        const settings = readFileSync(join(nvmHome, 'settings.txt'), 'utf-8')
        const match = settings.match(/^node_mirror:\s*(.+)$/m)
        if (match && match[1].trim()) {
          mirrorUrl = match[1].trim()
        }
      }

      const url = mirrorUrl + 'index.json'
      const mod = url.startsWith('https') ? https : http

      const versions = await new Promise<string[]>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('请求超时，请检查网络连接')), 15000)
        const request = mod.get(url, (res) => {
          clearTimeout(timeout)
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => {
            try {
              const list = JSON.parse(data) as Array<{ version: string }>
              resolve(list.map((item) => item.version))
            } catch {
              reject(new Error('解析版本数据失败'))
            }
          })
        })
        request.on('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
      return { versions }
    } catch (error: any) {
      return { versions: [], error: error.message }
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

  // ===== 进程管理 =====

  // 启动项目
  ipcMain.handle('start-project', (_event, projectId: string, projectPath: string, command: string): boolean => {
    return startProject(getMainWindow(), projectId, projectPath, command)
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
