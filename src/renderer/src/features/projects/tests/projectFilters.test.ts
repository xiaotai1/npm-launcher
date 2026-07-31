import assert from 'node:assert/strict'
import test from 'node:test'
import * as projectFilters from '../model/projectFilters'
import {
  filterProjects,
  getFolderProjects,
  getRootFavorites,
  getRootProjects
} from '../model/projectFilters'

type ReorderProjectIds = (
  projects: typeof reorderProjects,
  draggedId: string,
  targetId: string,
  placement: 'before' | 'after'
) => string[]

const projects = [
  { id: 'a', name: 'Admin Console', path: '/workspace/admin', command: 'dev', favorite: true },
  { id: 'b', name: 'Gateway', path: '/workspace/gateway', command: 'start', folderId: 'services' },
  { id: 'c', name: 'Docs', path: '/workspace/docs', command: 'docs' }
]

const reorderProjects = [
  { id: 'root-a', name: 'A', path: '/a', command: 'dev' },
  { id: 'folder-a', name: 'FA', path: '/fa', command: 'dev', folderId: 'tools' },
  { id: 'root-b', name: 'B', path: '/b', command: 'dev' },
  { id: 'favorite', name: 'F', path: '/f', command: 'dev', favorite: true },
  { id: 'folder-b', name: 'FB', path: '/fb', command: 'dev', folderId: 'tools' },
  { id: 'root-c', name: 'C', path: '/c', command: 'dev' }
]

test('project search matches name, path, and command without case sensitivity', () => {
  assert.deepEqual(filterProjects(projects, 'ADMIN').map(item => item.id), ['a'])
  assert.deepEqual(filterProjects(projects, 'gateway').map(item => item.id), ['b'])
  assert.deepEqual(filterProjects(projects, 'docs').map(item => item.id), ['c'])
})

test('project groups keep favorites, root projects, and folder projects separate', () => {
  assert.deepEqual(getRootFavorites(projects).map(item => item.id), ['a'])
  assert.deepEqual(getRootProjects(projects).map(item => item.id), ['c'])
  assert.deepEqual(getFolderProjects(projects, 'services').map(item => item.id), ['b'])
})

test('项目拖拽只调整同组顺序并保留其他分组位置', () => {
  const reorderProjectIds = (projectFilters as unknown as { reorderProjectIds: ReorderProjectIds }).reorderProjectIds
  assert.equal(typeof reorderProjectIds, 'function')

  assert.deepEqual(
    reorderProjectIds(reorderProjects, 'root-a', 'root-b', 'after'),
    ['root-b', 'folder-a', 'root-a', 'favorite', 'folder-b', 'root-c']
  )
  assert.deepEqual(
    reorderProjectIds(reorderProjects, 'folder-b', 'folder-a', 'before'),
    ['root-a', 'folder-b', 'root-b', 'favorite', 'folder-a', 'root-c']
  )
  assert.deepEqual(
    reorderProjectIds(reorderProjects, 'root-a', 'favorite', 'before'),
    reorderProjects.map(project => project.id)
  )
})
