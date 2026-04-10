import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

// 项目配置
export interface Project {
  id: string
  name: string
  path: string
  command: string
  favorite?: boolean
  folderId?: string | null
}

// 文件夹
export interface Folder {
  id: string
  name: string
  collapsed?: boolean
}

// 应用配置
export interface AppConfig {
  projects: Project[]
  folders: Folder[]
  theme: 'light' | 'dark' | 'system'
}

const defaultConfig: AppConfig = {
  projects: [],
  folders: [],
  theme: 'system'
}

function getConfigPath(): string {
  const userDataPath = app.getPath('userData')
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }
  return join(userDataPath, 'config.json')
}

export function getConfig(): AppConfig {
  const configPath = getConfigPath()

  if (!existsSync(configPath)) {
    saveConfig(defaultConfig)
    return defaultConfig
  }

  try {
    const content = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(content) as AppConfig
    // 合并默认值
    return {
      ...defaultConfig,
      ...config
    }
  } catch (error) {
    console.error('读取配置失败:', error)
    return defaultConfig
  }
}

export function saveConfig(config: AppConfig): boolean {
  const configPath = getConfigPath()
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('保存配置失败:', error)
    return false
  }
}

export function addProject(project: Project): boolean {
  const config = getConfig()
  // 检查 ID 是否重复
  if (config.projects.some(p => p.id === project.id)) {
    return false
  }
  config.projects.push(project)
  return saveConfig(config)
}

export function updateProject(project: Project): boolean {
  const config = getConfig()
  const index = config.projects.findIndex(p => p.id === project.id)
  if (index === -1) {
    return false
  }
  config.projects[index] = project
  return saveConfig(config)
}

export function deleteProject(projectId: string): boolean {
  const config = getConfig()
  config.projects = config.projects.filter(p => p.id !== projectId)
  return saveConfig(config)
}

export function updateTheme(theme: 'light' | 'dark' | 'system'): boolean {
  const config = getConfig()
  config.theme = theme
  return saveConfig(config)
}

export function reorderProjects(projectIds: string[]): boolean {
  const config = getConfig()
  const idSet = new Set(projectIds)
  if (idSet.size !== projectIds.length) return false
  if (config.projects.some(p => !idSet.has(p.id))) return false
  const map = new Map(config.projects.map(p => [p.id, p]))
  config.projects = projectIds.map(id => map.get(id)!)
  return saveConfig(config)
}

export function reorderFolders(folderIds: string[]): boolean {
  const config = getConfig()
  const idSet = new Set(folderIds)
  if (idSet.size !== folderIds.length) return false
  if (config.folders.some(f => !idSet.has(f.id))) return false
  const map = new Map(config.folders.map(f => [f.id, f]))
  config.folders = folderIds.map(id => map.get(id)!)
  return saveConfig(config)
}

export function addFolder(folder: Folder): boolean {
  const config = getConfig()
  if (config.folders.some(f => f.id === folder.id)) return false
  config.folders.push(folder)
  return saveConfig(config)
}

export function updateFolder(folder: Folder): boolean {
  const config = getConfig()
  const index = config.folders.findIndex(f => f.id === folder.id)
  if (index === -1) return false
  config.folders[index] = folder
  return saveConfig(config)
}

export function deleteFolder(folderId: string): boolean {
  const config = getConfig()
  config.folders = config.folders.filter(f => f.id !== folderId)
  // 将该文件夹下的项目移到根级别
  config.projects.forEach(p => {
    if (p.folderId === folderId) p.folderId = null
  })
  return saveConfig(config)
}

export function toggleProjectFavorite(projectId: string): boolean {
  const config = getConfig()
  const project = config.projects.find(p => p.id === projectId)
  if (!project) return false
  project.favorite = !project.favorite
  return saveConfig(config)
}

export function moveProjectToFolder(projectId: string, folderId: string | null): boolean {
  const config = getConfig()
  const project = config.projects.find(p => p.id === projectId)
  if (!project) return false
  project.folderId = folderId
  return saveConfig(config)
}
