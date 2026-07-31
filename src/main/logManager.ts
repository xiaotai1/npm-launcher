const MAX_SESSION_LOG_LINES = 800

interface SessionLogLine {
  type: string
  line: string
}

const sessionLogs = new Map<string, SessionLogLine[]>()

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

export function startLogSession(projectId: string): void {
  sessionLogs.set(projectId, [])
  recordLogLine(projectId, 'info', `=== 启动于 ${new Date().toLocaleString()} ===`)
}

export function recordLogLine(projectId: string, type: string, data: string): void {
  if (!data.trim()) return
  if (!sessionLogs.has(projectId)) {
    sessionLogs.set(projectId, [])
  }

  const lines = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(line => line.trim())
  const current = sessionLogs.get(projectId)!
  for (const line of lines) {
    current.push({ type, line: line.trim() })
  }
  if (current.length > MAX_SESSION_LOG_LINES) {
    current.splice(0, current.length - MAX_SESSION_LOG_LINES)
  }
}

export function finishLogSession(projectId: string, exitCode?: number): void {
  const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '')
  recordLogLine(projectId, 'info', `=== 退出于 ${timestamp} 代码: ${exitCode ?? 'N/A'} ===`)
}

/**
 * 分析错误（进程异常退出时调用）
 */
export function analyzeErrors(projectId: string, exitCode: number): ErrorAnalysis | null {
  const lines = sessionLogs.get(projectId)?.map(item => `[${item.type}] ${item.line}`) || null
  if (!lines) return null

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
}
