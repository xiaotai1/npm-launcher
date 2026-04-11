import { execSync } from 'child_process'
import * as os from 'os'
import * as path from 'path'

export const isMac = process.platform === 'darwin'
export const isWindows = process.platform === 'win32'

/**
 * 获取用户登录 shell
 */
function getLoginShell(): string {
  if (isWindows) return 'cmd.exe'
  return process.env.SHELL || '/bin/zsh'
}

/**
 * 从 process.env 中提取纯字符串键值对（过滤 undefined 值）
 * node-pty 的 posix_spawnp 遇到 undefined 值会失败
 */
function sanitizeEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const clean: Record<string, string> = {}
  for (const key of Object.keys(env)) {
    const val = env[key]
    if (typeof val === 'string') {
      clean[key] = val
    }
  }
  return clean
}

/**
 * 通过登录 shell 获取完整环境变量（解决 macOS Dock 启动不加载 .zshrc 的问题）
 * 缓存结果，避免反复执行
 */
let cachedShellEnv: Record<string, string> | null = null

export async function getShellEnv(): Promise<Record<string, string>> {
  if (isWindows) {
    return sanitizeEnv(process.env)
  }

  if (cachedShellEnv) {
    return cachedShellEnv
  }

  const shell = getLoginShell()
  const command = `"${shell}" -l -c env`

  return new Promise((resolve) => {
    try {
      const stdout = execSync(command, { encoding: 'utf-8', timeout: 5000 })
      const env = sanitizeEnv(process.env)

      stdout.split('\n').forEach((line) => {
        const match = line.match(/^([^=]+)=(.*)$/)
        if (match) {
          env[match[1]] = match[2]
        }
      })

      cachedShellEnv = env
      resolve(env)
    } catch {
      cachedShellEnv = sanitizeEnv(process.env)
      resolve(cachedShellEnv)
    }
  })
}

/**
 * 清除 shell 环境缓存（用于刷新版本列表时重新读取）
 */
export function clearShellEnvCache(): void {
  cachedShellEnv = null
}

/**
 * 获取 NVM 相关路径（跨平台）
 */
export function getNvmPaths(): {
  nvmDir: string | null
  versionsDir: string | null
} {
  if (isWindows) {
    const nvmHome = process.env.NVM_HOME || null
    return {
      nvmDir: nvmHome,
      versionsDir: nvmHome
    }
  }

  // macOS/Linux: nvm-sh
  const nvmDir = process.env.NVM_DIR || path.join(os.homedir(), '.nvm')
  return {
    nvmDir,
    versionsDir: path.join(nvmDir, 'versions', 'node')
  }
}
