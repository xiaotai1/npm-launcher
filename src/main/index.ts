import { app, BrowserWindow, nativeTheme, Menu } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIpc } from './ipc'
import { stopAllProcesses } from './processManager'
import { killAllPty } from './ptyManager'
import { getShellEnv, isMac } from './platform'

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
    // macOS 保持原生标题栏样式，Windows 使用自定义
    frame: process.platform !== 'win32',
    titleBarStyle: isMac ? 'hidden' : undefined,
    icon: join(__dirname, '../../build/icon.png'),
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
app.whenReady().then(async () => {
  // 设置 App 用户模型 ID
  electronApp.setAppUserModelId('com.npm-launcher.app')

  // 开发模式下默认通过 F12 按退出或重新加载
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // macOS: 预加载 shell 环境变量（含 nvm PATH）
  if (isMac) {
    await getShellEnv()
  }

  createWindow()
  ensureNvmMirror()
  setupIpc()

  // macOS: 设置应用菜单，避免菜单栏显示 "Electron"
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: app.name, submenu: [
        { label: `关于 ${app.name}`, role: 'about' },
        { type: 'separator' },
        { label: '隐藏', role: 'hide' },
        { label: '隐藏其他', role: 'hideOthers' },
        { label: '全部显示', role: 'unhide' },
        { type: 'separator' },
        { label: '退出', accelerator: 'Cmd+Q', click: () => app.quit() }
      ]},
      { label: '编辑', submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' }
      ]}
    ]))
  }

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
