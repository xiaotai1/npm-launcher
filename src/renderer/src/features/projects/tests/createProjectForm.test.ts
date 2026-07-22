import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFolder,
  buildProject,
  canCreateFolder,
  canCreateProject,
  projectNameFromPath
} from '../model/createProjectForm'

test('project name is derived from Unix and Windows paths', () => {
  assert.equal(projectNameFromPath('/workspace/admin-console'), 'admin-console')
  assert.equal(projectNameFromPath('C:\\workspace\\mobile-web\\'), 'mobile-web')
  assert.equal(projectNameFromPath(''), '')
})

test('project creation requires a name, path, and command', () => {
  assert.equal(canCreateProject({ name: 'Admin', path: '/admin', command: 'dev' }), true)
  assert.equal(canCreateProject({ name: ' ', path: '/admin', command: 'dev' }), false)
  assert.equal(canCreateProject({ name: 'Admin', path: '', command: 'dev' }), false)
  assert.equal(canCreateProject({ name: 'Admin', path: '/admin', command: '' }), false)
})

test('folder creation requires a non-empty trimmed name', () => {
  assert.equal(canCreateFolder('业务应用'), true)
  assert.equal(canCreateFolder('   '), false)
})

test('creation payloads trim user-entered values', () => {
  assert.deepEqual(buildProject({ name: ' Admin ', path: ' /admin ', command: ' dev ' }, 'project-1'), {
    id: 'project-1',
    name: 'Admin',
    path: '/admin',
    command: 'dev'
  })
  assert.deepEqual(buildFolder(' 业务应用 ', 'folder-1'), {
    id: 'folder-1',
    name: '业务应用'
  })
})
