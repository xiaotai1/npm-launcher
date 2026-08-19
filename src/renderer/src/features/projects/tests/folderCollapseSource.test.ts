import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sidebarSource = readFileSync(
  'src/renderer/src/features/projects/components/WorkspaceSidebar.vue',
  'utf-8'
)

test('文件夹折叠状态读取并写回 Folder.collapsed', () => {
  assert.match(sidebarSource, /folder\.collapsed/)
  assert.match(sidebarSource, /'update-folder': \[folder: Folder\]/)
  assert.match(sidebarSource, /emit\('update-folder', \{ \.\.\.folder, collapsed: !folder\.collapsed \}\)/)
  assert.equal(sidebarSource.includes('const collapsedFolders'), false)
})
