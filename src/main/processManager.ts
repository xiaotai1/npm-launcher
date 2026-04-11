import { spawn, ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'
import * as iconv from 'iconv-lite'
import { deleteProject } from './configManager'
import { getShellEnv } from './platform'

// 运行中的进程
const runningProcesses: Map<string, ChildProcess> = new Map()

// 记录用户手动停止的项目，避免被误判为 error
const manualStopped: Set<string> = new Set()

export interface ProcessStatus {
  projectId: string
  status: 'running' | 'stopped' | 'error'
  pid?: number
  exitCode?: number
}

export interface LogEntry {
  projectId: string
  type: 'stdout' | 'stderr' | 'info' | 'error'
  data: string
  timestamp: number
}

/**
 * 智能解码（处理 Windows GBK 编码）
 */
function decodeBuffer(buffer: Buffer): string {
  if (!buffer || buffer.length === 0) {
    return ''
  }

  // 非 Windows 直接 UTF-8
  if (process.platform !== 'win32') {
    return buffer.toString('utf8')
  }

  // 先尝试 UTF-8
  const utf8Str = buffer.toString('utf8')
  if (!utf8Str.includes('\uFFFD')) {
    return utf8Str
  }

  // 尝试 GBK
  try {
    const gbkStr = iconv.decode(buffer, 'gbk')
    if (!gbkStr.includes('\uFFFD') && gbkStr.length > 0) {
      return gbkStr
    }
  } catch {
    // ignore
  }

  return utf8Str
}

/**
 * 移除 ANSI 转义序列
 */
function stripAnsi(text: string): string {
  // 匹配所有 ANSI 转义序列
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g
  return text.replace(ansiRegex, '')
}

/**
 * 格式化时间戳
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  const ms = date.getMilliseconds().toString().padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

/**
 * 处理日志行（添加时间戳，清理 ANSI）
 */
function processLogLine(text: string, timestamp: number): string {
  // 移除 ANSI
  let line = stripAnsi(text)
  // 移除回车符
  line = line.replace(/\r/g, '')
  // 移除控制字符
  // eslint-disable-next-line no-control-regex
  line = line.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
  // 跳过空行
  if (!line.trim()) {
    return ''
  }
  // 添加时间戳前缀
  return `[${formatTime(timestamp)}] ${line}`
}

/**
 * 发送日志
 */
function sendLog(
  mainWindow: BrowserWindow | null,
  projectId: string,
  type: LogEntry['type'],
  data: string
): void {
  if (!mainWindow || mainWindow.isDestroyed() || !data.trim()) {
    return
  }

  try {
    mainWindow.webContents.send('log-data', {
      projectId,
      type,
      data,
      timestamp: Date.now()
    } as LogEntry)
  } catch {
    // 窗口可能已销毁
  }
}

/**
 * 发送状态
 */
function sendStatus(
  mainWindow: BrowserWindow | null,
  projectId: string,
  status: ProcessStatus['status'],
  extra?: Partial<ProcessStatus>
): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    mainWindow.webContents.send('process-status', {
      projectId,
      status,
      ...extra
    } as ProcessStatus)
  } catch {
    // 窗口可能已销毁
  }
}

/**
 * 启动项目
 */
export async function startProject(
  mainWindow: BrowserWindow | null,
  projectId: string,
  projectPath: string,
  command: string
): Promise<boolean> {
  // 先停止已运行的进程
  if (runningProcesses.has(projectId)) {
    stopProject(projectId)
  }

  try {
    let child: ChildProcess

    if (process.platform === 'win32') {
      // Windows: 使用 cmd，合并 stderr 到 stdout
      child = spawn('cmd.exe', ['/c', `npm run ${command} 2>&1`], {
        cwd: projectPath,
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NPM_CONFIG_COLOR: 'never',
          TERM: 'dumb'
        } as Record<string, string>
      })
    } else {
      // Unix/macOS: 使用完整 shell 环境
      const shellEnv = await getShellEnv()
      child = spawn('npm', ['run', command], {
        cwd: projectPath,
        shell: true,
        detached: true,
        env: {
          ...shellEnv,
          FORCE_COLOR: '1'
        } as Record<string, string>
      })
    }

    runningProcesses.set(projectId, child)

    // 设置二进制编码
    child.stdout?.setEncoding('binary')
    child.stderr?.setEncoding('binary')

    // 处理 stdout
    child.stdout?.on('data', (data: string) => {
      const buffer = Buffer.from(data, 'binary')
      const decoded = decodeBuffer(buffer)
      const processed = processLogLine(decoded, Date.now())
      if (processed) {
        sendLog(mainWindow, projectId, 'stdout', processed)
      }
    })

    // 处理 stderr
    child.stderr?.on('data', (data: string) => {
      const buffer = Buffer.from(data, 'binary')
      const decoded = decodeBuffer(buffer)
      const processed = processLogLine(decoded, Date.now())
      if (processed) {
        sendLog(mainWindow, projectId, 'stderr', processed)
      }
    })

    // 进程关闭
    child.on('close', (code) => {
      runningProcesses.delete(projectId)
      // 如果是用户手动停止的，状态设为 stopped
      const wasManualStop = manualStopped.has(projectId)
      manualStopped.delete(projectId)
      if (wasManualStop) {
        sendStatus(mainWindow, projectId, 'stopped', { exitCode: code ?? 0 })
        sendLog(mainWindow, projectId, 'info', `[${formatTime(Date.now())}] 已手动停止`)
      } else {
        sendStatus(mainWindow, projectId, code === 0 ? 'stopped' : 'error', { exitCode: code ?? 0 })
        sendLog(mainWindow, projectId, 'info', `[${formatTime(Date.now())}] 进程退出，代码: ${code ?? 0}`)
      }
    })

    // 进程错误
    child.on('error', (error) => {
      runningProcesses.delete(projectId)
      sendStatus(mainWindow, projectId, 'error')
      sendLog(mainWindow, projectId, 'error', `[${formatTime(Date.now())}] 进程错误: ${error.message}`)
    })

    // 通知已启动
    sendStatus(mainWindow, projectId, 'running', { pid: child.pid })
    sendLog(mainWindow, projectId, 'info', `[${formatTime(Date.now())}] 启动: npm run ${command}`)
    sendLog(mainWindow, projectId, 'info', `[${formatTime(Date.now())}] 目录: ${projectPath}`)

    return true
  } catch (error: any) {
    sendLog(mainWindow, projectId, 'error', `[${formatTime(Date.now())}] 启动失败: ${error.message}`)
    return false
  }
}

/**
 * 停止项目
 */
export function stopProject(projectId: string): boolean {
  const child = runningProcesses.get(projectId)
  if (!child) {
    return false
  }

  try {
    // 标记为手动停止
    manualStopped.add(projectId)

    if (process.platform === 'win32') {
      // Windows: 强制终止进程树
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'])
    } else {
      // macOS/Linux: 杀整个进程组（detached 创建的进程组）
      try {
        if (child.pid) {
          process.kill(-child.pid, 'SIGTERM')
        }
      } catch {
        child.kill('SIGTERM')
      }
    }
    runningProcesses.delete(projectId)
    return true
  } catch {
    manualStopped.delete(projectId)
    return false
  }
}

/**
 * 获取进程状态
 */
export function getProcessStatus(projectId: string): ProcessStatus {
  const child = runningProcesses.get(projectId)
  if (child) {
    return {
      projectId,
      status: 'running',
      pid: child.pid
    }
  }
  return {
    projectId,
    status: 'stopped'
  }
}

/**
 * 停止所有进程
 */
export function stopAllProcesses(): void {
  runningProcesses.forEach((_, projectId) => {
    stopProject(projectId)
  })
}

/**
 * 检查是否运行中
 */
export function isProcessRunning(projectId: string): boolean {
  return runningProcesses.has(projectId)
}
