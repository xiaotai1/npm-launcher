import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface PackageScriptsResult {
  scripts: string[]
  error?: string
}

export function readPackageScripts(dir: string): PackageScriptsResult {
  try {
    const pkgPath = join(dir, 'package.json')
    if (!existsSync(pkgPath)) {
      return { scripts: [], error: '该目录下没有 package.json' }
    }

    const content = readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(content)
    const scripts = pkg.scripts && typeof pkg.scripts === 'object'
      ? Object.keys(pkg.scripts)
      : []

    return { scripts }
  } catch (error: any) {
    return { scripts: [], error: error.message }
  }
}
