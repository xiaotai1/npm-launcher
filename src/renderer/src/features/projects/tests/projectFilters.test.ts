import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filterProjects,
  getFolderProjects,
  getRootFavorites,
  getRootProjects
} from '../model/projectFilters'

const projects = [
  { id: 'a', name: 'Admin Console', path: '/workspace/admin', command: 'dev', favorite: true },
  { id: 'b', name: 'Gateway', path: '/workspace/gateway', command: 'start', folderId: 'services' },
  { id: 'c', name: 'Docs', path: '/workspace/docs', command: 'docs' }
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
