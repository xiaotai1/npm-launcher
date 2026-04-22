import { BrowserWindow, ipcMain } from 'electron'
import * as os from 'os'
import * as pty from 'node-pty'
import { getProjectEnv } from './platform'

const ptyProcesses = new Map<string, pty.IPty>()

export function setupPtyIpc(): void {
  ipcMain.on('pty-spawn', async (event, { id, cols = 80, rows = 24, cwd, nodeVersion }: {
    id: string
    cols: number
    rows: number
    cwd: string
    nodeVersion?: string
  }) => {
    if (ptyProcesses.has(id)) return

    const sendError = (msg: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win && !win.isDestroyed()) {
        win.webContents.send('pty-data', { id, data: `\r\n\x1b[31m${msg}\x1b[0m\r\n` })
        win.webContents.send('pty-exit', { id, exitCode: 1 })
      }
    }

    try {
      const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'] || 'cmd.exe'

      // 使用项目级环境（含指定 Node 版本的 PATH + 项目 .npmrc 配置）
      const env = await getProjectEnv(nodeVersion, cwd)

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: env as Record<string, string>
      })

      ptyProcesses.set(id, ptyProcess)

      ptyProcess.onData((data) => {
        try {
          const win = BrowserWindow.fromWebContents(event.sender)
          if (win && !win.isDestroyed()) {
            win.webContents.send('pty-data', { id, data })
          }
        } catch {
          // 窗口已销毁，忽略
        }
      })

      ptyProcess.onExit(({ exitCode }) => {
        ptyProcesses.delete(id)
        try {
          const win = BrowserWindow.fromWebContents(event.sender)
          if (win && !win.isDestroyed()) {
            win.webContents.send('pty-exit', { id, exitCode })
          }
        } catch {
          // 窗口已销毁，忽略
        }
      })
    } catch (error: any) {
      sendError(`[终端启动失败: ${error.message || error}]`)
    }
  })

  ipcMain.on('pty-write', (_event, { id, data }: { id: string; data: string }) => {
    ptyProcesses.get(id)?.write(data)
  })

  ipcMain.on('pty-resize', (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    try {
      ptyProcesses.get(id)?.resize(cols, rows)
    } catch {
      // resize 可能因进程已退出而失败
    }
  })

  ipcMain.on('pty-kill', (_event, { id }: { id: string }) => {
    ptyProcesses.get(id)?.kill()
    ptyProcesses.delete(id)
  })
}

/**
 * 向所有运行中的 PTY 发送命令字符串（用于切换 Node 版本后同步终端环境）
 */
export function broadcastToAllPty(command: string): void {
  ptyProcesses.forEach((proc) => {
    try {
      proc.write(command + '\n')
    } catch {
      // PTY 可能已退出
    }
  })
}

export function killAllPty(): void {
  ptyProcesses.forEach((proc) => proc.kill())
  ptyProcesses.clear()
}
