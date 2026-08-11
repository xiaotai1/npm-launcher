import { app, BrowserWindow, nativeTheme, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIpc } from './ipc'
import { stopAllProcesses } from './processManager'
import { killAllPty } from './ptyManager'
import { getShellEnv, isMac } from './platform'

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
    trafficLightPosition: isMac ? { x: 18, y: 15 } : undefined,
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

  // 开发模式：使用 electron-vite 提供的实际渲染地址，避免端口被占用后加载到旧地址
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
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

  // 开发模式下通过 F12 手动打开或关闭开发者工具
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // macOS: 预加载 shell 环境变量（含 nvm PATH）
  if (isMac) {
    await getShellEnv()
  }

  createWindow()
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
