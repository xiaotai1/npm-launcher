import { BrowserWindow, ipcMain } from 'electron'
import * as os from 'os'
import * as pty from 'node-pty'

const ptyProcesses = new Map<string, pty.IPty>()

export function setupPtyIpc(): void {
  ipcMain.on('pty-spawn', (event, { id, cols = 80, rows = 24, cwd }: {
    id: string
    cols: number
    rows: number
    cwd: string
  }) => {
    if (ptyProcesses.has(id)) return

    const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'] || 'cmd.exe'

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: process.env as Record<string, string>
    })

    ptyProcesses.set(id, ptyProcess)

    ptyProcess.onData((data) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win && !win.isDestroyed()) {
        win.webContents.send('pty-data', { id, data })
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      ptyProcesses.delete(id)
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win && !win.isDestroyed()) {
        win.webContents.send('pty-exit', { id, exitCode })
      }
    })
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

export function killAllPty(): void {
  ptyProcesses.forEach((proc) => proc.kill())
  ptyProcesses.clear()
}
