import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync('src/renderer/src/app/App.vue', 'utf-8')

test('所有配置写入都通过统一落盘结果检查', () => {
  assert.match(appSource, /async function persistConfigChange/)
  assert.match(appSource, /const saved = await operation\(\)/)
  assert.match(appSource, /if \(!saved\)/)

  for (const operation of [
    'addProject',
    'deleteProject',
    'reorderProjects',
    'toggleFavorite',
    'addFolder',
    'reorderFolders',
    'deleteFolder',
    'updateFolder',
    'moveProjectToFolder'
  ]) {
    assert.match(appSource, new RegExp(`persistConfigChange\\(\\(\\) => window\\.desktopAPI\\.${operation}`))
  }
})

test('项目 Node 版本和启动命令仅在保存成功后更新界面', () => {
  assert.match(appSource, /persistConfigChange\(\(\) => window\.desktopAPI\.updateProject/)
  assert.match(appSource, /项目 Node\.js 版本保存失败/)
  assert.match(appSource, /项目启动方案保存失败/)
})

test('主题保存失败时恢复原主题', () => {
  assert.match(appSource, /const previousTheme = config\.value\.theme/)
  assert.match(appSource, /config\.value\.theme = previousTheme/)
  assert.match(appSource, /主题设置保存失败/)
})
