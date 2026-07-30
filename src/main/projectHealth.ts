import { existsSync, statSync } from 'fs'
import { join } from 'path'
import type { Project } from './configManager'
import { readPackageScripts } from './packageScripts'
import { getNvmPaths, isWindows } from './platform'

export type ProjectHealthIssueCode =
  | 'missing-project-path'
  | 'missing-package-json'
  | 'missing-script'
  | 'missing-node-version'

export interface ProjectHealthIssue {
  code: ProjectHealthIssueCode
  message: string
}

export interface ProjectHealthResult {
  ok: boolean
  issues: ProjectHealthIssue[]
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function isNodeVersionInstalled(version: string): boolean {
  const { versionsDir } = getNvmPaths()
  if (!versionsDir) return false

  const normalized = version.replace(/^v/, '')
  const candidates = isWindows
    ? [join(versionsDir, `v${normalized}`), join(versionsDir, normalized)]
    : [join(versionsDir, version.startsWith('v') ? version : `v${normalized}`)]

  return candidates.some(path => existsSync(path))
}

export function inspectProjectHealth(project: Project): ProjectHealthResult {
  const issues: ProjectHealthIssue[] = []

  if (!project.path || !existsSync(project.path) || !isDirectory(project.path)) {
    issues.push({
      code: 'missing-project-path',
      message: `项目目录不存在或不可访问：${project.path || '未配置'}`
    })
    return { ok: false, issues }
  }

  const packageScripts = readPackageScripts(project.path)
  if (packageScripts.error) {
    issues.push({
      code: 'missing-package-json',
      message: packageScripts.error
    })
    return { ok: false, issues }
  }

  if (!packageScripts.scripts.includes(project.command)) {
    issues.push({
      code: 'missing-script',
      message: `package.json 中未找到启动命令：${project.command}`
    })
  }

  if (project.nodeVersion && !isNodeVersionInstalled(project.nodeVersion)) {
    issues.push({
      code: 'missing-node-version',
      message: `指定的 Node.js 版本未安装：${project.nodeVersion}`
    })
  }

  return { ok: issues.length === 0, issues }
}
