import { app } from 'electron'
import { join } from 'path'
import { appendFileSync, mkdirSync, readdirSync, readFileSync, unlinkSync, existsSync, statSync } from 'fs'

// 日志文件写入器
const logWriters: Map<string, string> = new Map() // projectId → 当前日志文件路径

// 错误分析结果
export interface ErrorMatch {
  name: string
  severity: 'critical' | 'warning' | 'info'
  lines: string[]
  suggestion: string
}

export interface ErrorAnalysis {
  projectId: string
  exitCode: number
  timestamp: number
  matches: ErrorMatch[]
  summary: string
}

// 错误模式规则
interface ErrorPattern {
  name: string
  patterns: RegExp[]
  suggestion: string
  severity: 'critical' | 'warning' | 'info'
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    name: '端口占用',
    patterns: [/EADDRINUSE/, /already in use/, /port.*occupied/i],
    suggestion: '端口被占用，请检查是否有其他进程使用了相同端口，或修改项目端口配置',
    severity: 'critical'
  },
  {
    name: '依赖缺失',
    patterns: [/Cannot find module/, /MODULE_NOT_FOUND/, /Error: Cannot find/],
    suggestion: '缺少依赖模块，请尝试运行 npm install 安装依赖',
    severity: 'critical'
  },
  {
    name: '编译错误',
    patterns: [/SyntaxError/, /TypeError/, /compilation failed/i, /build failed/i],
    suggestion: '代码存在语法或类型错误，请检查报错位置对应的源文件',
    severity: 'critical'
  },
  {
    name: '内存溢出',
    patterns: [/FATAL ERROR: CALL_AND_RETRY_LAST/, /heap out of memory/, /ENOMEM/],
    suggestion: 'Node.js 内存不足，可尝试增大内存限制：node --max-old-space-size=4096',
    severity: 'critical'
  },
  {
    name: '权限错误',
    patterns: [/EACCES/, /Permission denied/, /operation not permitted/],
    suggestion: '权限不足，请检查文件/目录权限，或尝试以管理员身份运行',
    severity: 'warning'
  },
  {
    name: '网络错误',
    patterns: [/ETIMEDOUT/, /ECONNREFUSED/, /ECONNRESET/, /network error/i, /fetch failed/i],
    suggestion: '网络连接失败，请检查网络状态或 npm 源配置',
    severity: 'warning'
  },
  {
    name: 'TypeScript 错误',
    patterns: [/TS\d{4}:/, /error TS/, /Type '.*' is not assignable/],
    suggestion: 'TypeScript 类型错误，请检查对应的 .ts 文件',
    severity: 'warning'
  },
  {
    name: 'Webpack/Vite 构建错误',
    patterns: [/Module build failed/, /webpack.*error/i, /vite.*error/i, /vite.*failed/i],
    suggestion: '构建工具报错，请检查构建配置和源文件',
    severity: 'warning'
  }
]

const LOG_RETENTION_DAYS = 30

function getLogsDir(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'logs')
}

function getProjectLogDir(projectId: string): string {
  const dir = join(getLogsDir(), projectId)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function formatTimestampForFilename(): string {
  const now = new Date()
  const y = now.getFullYear().toString()
  const m = (now.getMonth() + 1).toString().padStart(2, '0')
  const d = now.getDate().toString().padStart(2, '0')
  const h = now.getHours().toString().padStart(2, '0')
  const min = now.getMinutes().toString().padStart(2, '0')
  const s = now.getSeconds().toString().padStart(2, '0')
  return `${y}-${m}-${d}_${h}-${min}-${s}`
}

/**
 * 启动日志文件（每次项目启动时调用）
 */
export function startLogFile(projectId: string): string {
  // 清理旧日志
  cleanOldLogs(projectId)

  const dir = getProjectLogDir(projectId)
  const filename = `${formatTimestampForFilename()}.log`
  const filePath = join(dir, filename)
  logWriters.set(projectId, filePath)

  // 写入启动标记
  appendFileSync(filePath, `=== 启动于 ${new Date().toLocaleString()} ===\n`)
  return filePath
}

/**
 * 写入日志行
 */
export function writeLog(projectId: string, type: string, data: string): void {
  const filePath = logWriters.get(projectId)
  if (!filePath) return

  const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '')
  const line = `[${timestamp}] [${type}] ${data}\n`
  try {
    appendFileSync(filePath, line)
  } catch {
    // 写入失败忽略（磁盘满等）
  }
}

/**
 * 结束日志文件（进程退出时调用）
 */
export function endLogFile(projectId: string, exitCode?: number): void {
  const filePath = logWriters.get(projectId)
  if (!filePath) return

  const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '')
  appendFileSync(filePath, `=== 退出于 ${timestamp} 代码: ${exitCode ?? 'N/A'} ===\n`)
  logWriters.delete(projectId)
}

/**
 * 获取项目的历史日志文件列表
 */
export function getLogFiles(projectId: string): string[] {
  const dir = getProjectLogDir(projectId)
  if (!existsSync(dir)) return []

  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.log'))
      .sort()
      .reverse() // 最新的在前
  } catch {
    return []
  }
}

/**
 * 读取指定日志文件内容
 */
export function getLogContent(projectId: string, filename: string): string {
  const filePath = join(getProjectLogDir(projectId), filename)
  if (!existsSync(filePath)) return ''

  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

/**
 * 获取当前日志文件路径
 */
export function getCurrentLogPath(projectId: string): string | null {
  return logWriters.get(projectId) || null
}

/**
 * 获取日志目录路径（用于打开文件管理器）
 */
export function getLogDirPath(projectId: string): string {
  return getProjectLogDir(projectId)
}

/**
 * 分析错误（进程异常退出时调用）
 */
export function analyzeErrors(projectId: string, exitCode: number): ErrorAnalysis | null {
  const filePath = logWriters.get(projectId)
  if (!filePath || !existsSync(filePath)) return null

  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const matches: ErrorMatch[] = []

    for (const pattern of ERROR_PATTERNS) {
      const matchedLines: string[] = []
      for (const line of lines) {
        for (const regex of pattern.patterns) {
          if (regex.test(line)) {
            matchedLines.push(line.trim())
            if (matchedLines.length >= 3) break
          }
        }
        if (matchedLines.length >= 3) break
      }
      if (matchedLines.length > 0) {
        matches.push({
          name: pattern.name,
          severity: pattern.severity,
          lines: matchedLines,
          suggestion: pattern.suggestion
        })
      }
    }

    // 生成摘要
    let summary: string
    if (matches.length === 0) {
      summary = `进程异常退出（代码: ${exitCode}），未匹配到已知错误模式`
    } else if (matches.length === 1) {
      summary = `进程异常退出（代码: ${exitCode}），可能原因: ${matches[0].name}`
    } else {
      const names = matches.map(m => m.name).join('、')
      summary = `进程异常退出（代码: ${exitCode}），发现 ${matches.length} 个问题: ${names}`
    }

    return {
      projectId,
      exitCode,
      timestamp: Date.now(),
      matches,
      summary
    }
  } catch {
    return null
  }
}

/**
 * 清理超过 30 天的旧日志文件
 */
function cleanOldLogs(projectId: string): void {
  const dir = getProjectLogDir(projectId)
  if (!existsSync(dir)) return

  const now = Date.now()
  const maxAge = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000

  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.log'))
    for (const file of files) {
      const filePath = join(dir, file)
      try {
        const stat = statSync(filePath)
        if (now - stat.mtimeMs > maxAge) {
          unlinkSync(filePath)
        }
      } catch {
        // 忽略无法读取的文件
      }
    }
  } catch {
    // 忽略目录读取错误
  }
}