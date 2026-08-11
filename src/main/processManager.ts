import { spawn, exec, ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'
import * as iconv from 'iconv-lite'
import { getProjectEnv } from './platform'
import { startLogSession, recordLogLine, finishLogSession, analyzeErrors } from './logManager'
import { detectPackageManager, getPackageManagerCommand } from './packageManager'

// 运行中的进程
const runningProcesses: Map<string, ChildProcess> = new Map()

// 日志缓冲区（批量合并发送，减少 IPC 消息洪泛）
const logBuffers: Map<string, { type: LogEntry['type']; data: string }[]> = new Map()
const logFlushTimers: Map<string, NodeJS.Timeout> = new Map()
const LOG_FLUSH_INTERVAL = 30 // ms
const LOG_MAX_BUFFER_SIZE = 50 // 超过此数量立即刷新

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
 * 处理日志行（去除 ANSI，加时间戳和类型着色）
 */
function processLogLine(text: string, type: LogEntry['type'], timestamp: number): string {
  let clean = stripAnsi(text)
  clean = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  // eslint-disable-next-line no-control-regex
  clean = clean.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')

  const ts = `\x1b[2m[${formatTime(timestamp)}]\x1b[22m`
  let prefix = ''
  let suffix = ''
  switch (type) {
    case 'error': prefix = '\x1b[38;2;224;108;117m'; suffix = '\x1b[0m'; break
    case 'stderr': prefix = '\x1b[38;2;209;154;102m'; suffix = '\x1b[0m'; break
    case 'info': prefix = '\x1b[38;2;97;175;239m'; suffix = '\x1b[0m'; break
  }

  const lines = clean.split('\n').filter(l => l.trim())
  if (lines.length === 0) return ''

  return lines.map(l => `${ts} ${prefix}${l}${suffix}`).join('\r\n')
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
  if (!data.trim()) {
    return
  }

  recordLogLine(projectId, type, stripAnsi(data).replace(/\r\n/g, '\n').replace(/\r/g, '\n'))

  if (!mainWindow || mainWindow.isDestroyed()) {
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
 * 缓冲日志（批量合并发送，减少 IPC 消息洪泛）
 */
function bufferLog(
  mainWindow: BrowserWindow | null,
  projectId: string,
  type: LogEntry['type'],
  data: string
): void {
  if (!data.trim()) return

  if (!logBuffers.has(projectId)) {
    logBuffers.set(projectId, [])
  }
  const buffer = logBuffers.get(projectId)!
  buffer.push({ type, data })

  // 缓冲区满时立即刷新
  if (buffer.length >= LOG_MAX_BUFFER_SIZE) {
    flushLogBuffer(mainWindow, projectId)
    return
  }

  // 首条日志时启动定时器
  if (!logFlushTimers.has(projectId)) {
    const timer = setTimeout(() => {
      flushLogBuffer(mainWindow, projectId)
    }, LOG_FLUSH_INTERVAL)
    logFlushTimers.set(projectId, timer)
  }
}

/**
 * 刷新日志缓冲区，合并发送
 */
function flushLogBuffer(mainWindow: BrowserWindow | null, projectId: string): void {
  const buffer = logBuffers.get(projectId)
  if (!buffer || buffer.length === 0) return

  const entries = buffer.splice(0)

  const timer = logFlushTimers.get(projectId)
  if (timer) {
    clearTimeout(timer)
    logFlushTimers.delete(projectId)
  }

  // 只合并相邻同类型日志，减少 IPC 调用且保持 stdout/stderr 原始顺序
  const grouped: { type: LogEntry['type']; lines: string[] }[] = []
  for (const entry of entries) {
    const current = grouped[grouped.length - 1]
    if (current?.type === entry.type) {
      current.lines.push(entry.data)
    } else {
      grouped.push({ type: entry.type, lines: [entry.data] })
    }
  }
  for (const { type, lines } of grouped) {
    sendLog(mainWindow, projectId, type, lines.join('\r\n'))
  }
}

/**
 * 清理项目的日志缓冲区
 */
function cleanupLogBuffer(mainWindow: BrowserWindow | null, projectId: string): void {
  flushLogBuffer(mainWindow, projectId)
  logBuffers.delete(projectId)

  const timer = logFlushTimers.get(projectId)
  if (timer) {
    clearTimeout(timer)
    logFlushTimers.delete(projectId)
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
  command: string,
  nodeVersion?: string
): Promise<boolean> {
  // 重复启动按成功处理，避免旧进程退出回调干扰新进程状态
  if (runningProcesses.has(projectId)) return true

  try {
    let child: ChildProcess
    const packageManager = detectPackageManager(projectPath)
    const packageManagerCommand = getPackageManagerCommand(packageManager)

    if (process.platform === 'win32') {
      // Windows: 使用项目级环境
      const projectEnv = await getProjectEnv(nodeVersion, projectPath)
      child = spawn(packageManagerCommand, ['run', command], {
        cwd: projectPath,
        windowsHide: true,
        env: {
          ...projectEnv,
          FORCE_COLOR: '0',
          NPM_CONFIG_COLOR: 'never',
          TERM: 'dumb'
        } as Record<string, string>
      })
    } else {
      // Unix/macOS: 使用项目级环境
      const projectEnv = await getProjectEnv(nodeVersion, projectPath)
      child = spawn(packageManagerCommand, ['run', command], {
        cwd: projectPath,
        detached: true,
        env: {
          ...projectEnv,
          FORCE_COLOR: '1'
        } as Record<string, string>
      })
    }

    // 启动本次内存日志记录
    startLogSession(projectId)

    runningProcesses.set(projectId, child)

    // 设置二进制编码
    child.stdout?.setEncoding('binary')
    child.stderr?.setEncoding('binary')

    // 处理 stdout
    child.stdout?.on('data', (data: string) => {
      const buffer = Buffer.from(data, 'binary')
      const decoded = decodeBuffer(buffer)
      const processed = processLogLine(decoded, 'stdout', Date.now())
      if (processed) {
        bufferLog(mainWindow, projectId, 'stdout', processed)
      }
    })

    // 处理 stderr
    child.stderr?.on('data', (data: string) => {
      const buffer = Buffer.from(data, 'binary')
      const decoded = decodeBuffer(buffer)
      const processed = processLogLine(decoded, 'stderr', Date.now())
      if (processed) {
        bufferLog(mainWindow, projectId, 'stderr', processed)
      }
    })

    // 进程关闭
    child.on('close', (code) => {
      if (runningProcesses.get(projectId) !== child) return

      // 清理日志缓冲区，发送剩余日志
      cleanupLogBuffer(mainWindow, projectId)

      runningProcesses.delete(projectId)
      sendStatus(mainWindow, projectId, code === 0 ? 'stopped' : 'error', { exitCode: code ?? 0 })
      sendLog(mainWindow, projectId, 'info', processLogLine(`进程退出，代码: ${code ?? 0}`, 'info', Date.now()))

      // 异常退出时触发错误分析
      if (code !== 0 && code !== null && mainWindow && !mainWindow.isDestroyed()) {
        const analysis = analyzeErrors(projectId, code)
        if (analysis) {
          try {
            mainWindow.webContents.send('error-analysis', analysis)
          } catch {
            // 窗口可能已销毁
          }
        }
      }
      finishLogSession(projectId, code ?? 0)
    })

    // 进程错误
    child.on('error', (error) => {
      if (runningProcesses.get(projectId) !== child) return

      // 清理日志缓冲区，发送剩余日志
      cleanupLogBuffer(mainWindow, projectId)

      runningProcesses.delete(projectId)
      sendStatus(mainWindow, projectId, 'error')
      sendLog(mainWindow, projectId, 'error', processLogLine(`进程错误: ${error.message}`, 'error', Date.now()))
      finishLogSession(projectId)
    })

    // 通知已启动
    sendStatus(mainWindow, projectId, 'running', { pid: child.pid })
    sendLog(mainWindow, projectId, 'info', processLogLine(`启动: ${packageManager} run ${command}`, 'info', Date.now()))
    sendLog(mainWindow, projectId, 'info', processLogLine(`目录: ${projectPath}`, 'info', Date.now()))

    return true
  } catch (error: any) {
    sendLog(mainWindow, projectId, 'error', processLogLine(`启动失败: ${error.message}`, 'error', Date.now()))
    return false
  }
}

/**
 * 停止项目
 */
export function stopProject(projectId: string, mainWindow: BrowserWindow | null = null): boolean {
  const child = runningProcesses.get(projectId)
  if (!child) {
    return false
  }

  try {
    runningProcesses.delete(projectId)

    // 先完成本次日志会话，避免马上重启时旧进程收尾污染新会话
    cleanupLogBuffer(mainWindow, projectId)
    sendLog(mainWindow, projectId, 'info', processLogLine('已手动停止', 'info', Date.now()))
    finishLogSession(projectId)

    // 立即通知 UI 进程已停止，不用等 close 事件
    sendStatus(mainWindow, projectId, 'stopped')

    // 杀进程树
    const pid = child.pid
    if (process.platform === 'win32') {
      // Windows: taskkill /f 已是强制终止
      if (pid) {
        exec(`taskkill /f /t /pid ${pid}`, (error) => {
          if (error) {
            console.warn(`taskkill failed for pid ${pid}:`, error.message)
          }
        })
      }
    } else if (pid) {
      // macOS/Linux: SIGTERM 先尝试优雅退出，1 秒后强杀
      try {
        process.kill(-pid, 'SIGTERM')
      } catch {
        child.kill('SIGTERM')
      }
      setTimeout(() => {
        try {
          process.kill(-pid, 0) // 检查进程组是否还存活
          process.kill(-pid, 'SIGKILL') // 还活着就强杀
        } catch {
          // 已退出，无需处理
        }
      }, 1000)
    }

    return true
  } catch {
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
