const fs = require('node:fs')

const tag = process.argv[2] || ''
if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  throw new Error(`发布 Tag 必须使用 vX.Y.Z 格式，当前为：${tag || '空'}`)
}

const expected = tag.slice(1)
const packageVersion = require('../package.json').version
const tauriVersion = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8')).version
const cargoContent = fs.readFileSync('src-tauri/Cargo.toml', 'utf8')
const cargoVersion = cargoContent.match(/^version\s*=\s*"([^"]+)"/m)?.[1]

for (const [name, version] of [
  ['package.json', packageVersion],
  ['src-tauri/tauri.conf.json', tauriVersion],
  ['src-tauri/Cargo.toml', cargoVersion],
]) {
  if (version !== expected) throw new Error(`${name} 版本为 ${version || '未找到'}，与 Tag ${tag} 不一致`)
}

console.log(`版本校验通过：${tag}`)
