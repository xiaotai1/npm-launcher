const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  module._compile(output, filename)
}

const {
  buildProject,
  canCreateProject,
} = require('../src/renderer/src/features/projects/model/createProjectForm.ts')

test('只有自定义启动命令时允许创建项目', () => {
  assert.equal(canCreateProject({
    name: '管理后台',
    path: '/workspace/admin',
    command: '',
    customCommand: 'pnpm --filter web dev',
    nodeVersion: '',
  }), true)
})

test('脚本命令和自定义启动命令都为空时拒绝创建项目', () => {
  assert.equal(canCreateProject({
    name: '管理后台',
    path: '/workspace/admin',
    command: '  ',
    customCommand: '  ',
    nodeVersion: '',
  }), false)
})

test('创建项目时清理并保留运行配置', () => {
  assert.deepEqual(buildProject({
    name: ' 管理后台 ',
    path: ' /workspace/admin ',
    command: ' dev ',
    customCommand: ' pnpm --filter web dev ',
    nodeVersion: ' v20.19.6 ',
  }, 'project-1'), {
    id: 'project-1',
    name: '管理后台',
    path: '/workspace/admin',
    command: 'dev',
    customCommand: 'pnpm --filter web dev',
    nodeVersion: 'v20.19.6',
  })
})

test('创建项目时省略空的可选运行配置', () => {
  assert.deepEqual(buildProject({
    name: '管理后台',
    path: '/workspace/admin',
    command: 'dev',
    customCommand: '  ',
    nodeVersion: '  ',
  }, 'project-1'), {
    id: 'project-1',
    name: '管理后台',
    path: '/workspace/admin',
    command: 'dev',
  })
})
