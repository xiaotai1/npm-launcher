import { app, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIpc } from './ipc'
import { stopAllProcesses } from './processManager'
import { killAllPty } from './ptyManager'

// 国内镜像源
const NODE_MIRROR = 'https://npmmirror.com/mirrors/node/'
const NPM_MIRROR = 'https://npmmirror.com/mirrors/npm/'

/**
 * 检测并设置 nvm 国内镜像源
 */
function ensureNvmMirror(): void {
  const nvmHome = process.env.NVM_HOME
  if (!nvmHome || !existsSync(nvmHome)) return

  const settingsPath = join(nvmHome, 'settings.txt')
  if (!existsSync(settingsPath)) return

  try {
    let content = readFileSync(settingsPath, 'utf-8')
    let changed = false

    // 检查 node_mirror
    if (!content.includes('npmmirror.com') && !content.includes('taobao.org')) {
      content = content.replace(/^node_mirror:\s*.*$/m, `node_mirror: ${NODE_MIRROR}`)
      content = content.replace(/^npm_mirror:\s*.*$/m, `npm_mirror: ${NPM_MIRROR}`)
      changed = true
    }

    if (changed) {
      writeFileSync(settingsPath, content, 'utf-8')
    }
  } catch {
    // 静默失败，不影响启动
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    frame: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#94a3b8',
      height: 48
    },
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 开发模式
  if (is.dev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 应用就绪
app.whenReady().then(() => {
  // 设置 App 用户模型 ID
  electronApp.setAppUserModelId('com.npm-launcher.app')

  // 开发模式下默认通过 F12 按退出或重新加载
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  ensureNvmMirror()
  setupIpc()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出
app.on('window-all-closed', () => {
  stopAllProcesses()
  killAllPty()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 退出前清理所有进程
app.on('before-quit', () => {
  stopAllProcesses()
  killAllPty()
})

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
