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
  calculateDownloadProgress,
  getUpdaterErrorMessage,
} = require('../src/renderer/src/app/updateHelpers.ts')

test('下载进度限制在零到一百之间', () => {
  assert.equal(calculateDownloadProgress(40, 100), 40)
  assert.equal(calculateDownloadProgress(120, 100), 100)
  assert.equal(calculateDownloadProgress(-10, 100), 0)
})

test('总大小未知时不显示虚假百分比', () => {
  assert.equal(calculateDownloadProgress(40, 0), null)
  assert.equal(calculateDownloadProgress(40, null), null)
})

test('更新错误转换成可读文本', () => {
  assert.equal(getUpdaterErrorMessage(new Error('网络不可用')), '网络不可用')
  assert.equal(getUpdaterErrorMessage('签名校验失败'), '签名校验失败')
  assert.equal(getUpdaterErrorMessage(null), '未知错误')
})
