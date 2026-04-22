import { execSync } from 'child_process'
import * as os from 'os'
import * as path from 'path'
import { existsSync, readFileSync } from 'fs'

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
 * 清理 npm/pnpm 配置相关的环境变量，确保项目 .npmrc 优先级不被覆盖
 * npm_config_* 环境变量优先级高于 .npmrc 文件，会导致项目级配置失效
 */
function stripNpmConfigOverrides(env: Record<string, string>): Record<string, string> {
  const clean = { ...env }
  for (const key of Object.keys(clean)) {
    const lower = key.toLowerCase()
    if (lower.startsWith('npm_config_')) {
      delete clean[key]
    }
  }
  return clean
}

/**
 * 读取项目 .npmrc 中的 registry 配置
 */
function readProjectNpmrcRegistry(projectDir: string): string | null {
  try {
    const npmrcPath = path.join(projectDir, '.npmrc')
    if (!existsSync(npmrcPath)) return null
    const content = readFileSync(npmrcPath, 'utf-8')
    for (const line of content.split('\n')) {
      const match = line.match(/^registry\s*=\s*(.+)$/)
      if (match) return match[1].trim()
    }
    return null
  } catch {
    return null
  }
}

/**
 * 获取项目级环境变量，将指定 Node 版本的 bin 目录 prepend 到 PATH
 * macOS/Linux: ~/.nvm/versions/node/<version>/bin
 * Windows: NVM_HOME\<version>
 */
export async function getProjectEnv(nodeVersion?: string, cwd?: string): Promise<Record<string, string>> {
  let baseEnv = await getShellEnv()

  // 读取项目 .npmrc 中的 registry 配置，作为最高优先级
  if (cwd) {
    const projectRegistry = readProjectNpmrcRegistry(cwd)
    if (projectRegistry) {
      // 清理全局环境变量覆盖，再设置项目级 registry
      baseEnv = stripNpmConfigOverrides(baseEnv)
      baseEnv['npm_config_registry'] = projectRegistry
    } else {
      // 项目没有配置 registry 时，也清理掉全局环境变量覆盖，让 .npmrc 文件正常生效
      baseEnv = stripNpmConfigOverrides(baseEnv)
    }
  }

  if (!nodeVersion) {
    return baseEnv
  }

  // 查找版本目录
  let versionBinDir: string | null = null

  if (isWindows) {
    const nvmHome = process.env.NVM_HOME
    if (nvmHome) {
      const ver = nodeVersion.replace(/^v/, '')
      const verWithV = 'v' + ver
      const dir = existsSync(path.join(nvmHome, verWithV))
        ? path.join(nvmHome, verWithV)
        : existsSync(path.join(nvmHome, ver))
          ? path.join(nvmHome, ver)
          : null
      if (dir) {
        versionBinDir = dir
      }
    }
  } else {
    const { versionsDir } = getNvmPaths()
    if (versionsDir) {
      const dir = path.join(versionsDir, nodeVersion, 'bin')
      if (existsSync(dir)) {
        versionBinDir = dir
      }
    }
  }

  if (!versionBinDir) {
    return baseEnv
  }

  // prepend 版本目录到 PATH
  const env = { ...baseEnv }
  const pathKey = Object.keys(env).find(k => k.toUpperCase() === 'PATH') || 'PATH'
  env[pathKey] = versionBinDir + (isWindows ? ';' : ':') + (env[pathKey] || '')

  return env
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
