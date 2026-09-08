const fs = require('fs')
const path = require('path')
const readline = require('readline')

const pkgPath = path.join(__dirname, '..', 'package.json')
const lockPath = path.join(__dirname, '..', 'package-lock.json')
const cargoPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml')
const cargoLockPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.lock')
const tauriPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json')
const args = process.argv.slice(2)
const explicitVersion = args.find(arg => !arg.startsWith('--'))

function assertVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`版本号格式错误：${version}，应为 x.y.z`)
  }
}

function syncVersion(version) {
  assertVersion(version)
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'))
  const tauri = JSON.parse(fs.readFileSync(tauriPath, 'utf-8'))
  const cargo = fs.readFileSync(cargoPath, 'utf-8')
  const cargoLock = fs.readFileSync(cargoLockPath, 'utf-8')
  const cargoVersionPattern = /^(\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/m
  const cargoLockVersionPattern = /(\[\[package\]\]\r?\nname = "npm-launcher"\r?\nversion = ")[^"]+(")/
  if (!cargoVersionPattern.test(cargo)) {
    throw new Error('无法更新 Cargo.toml 中的 package.version')
  }
  if (!cargoLockVersionPattern.test(cargoLock)) {
    throw new Error('无法更新 Cargo.lock 中的 npm-launcher 版本')
  }
  const nextCargo = cargo.replace(
    cargoVersionPattern,
    `$1"${version}"`
  )
  const nextCargoLock = cargoLock.replace(cargoLockVersionPattern, `$1${version}$2`)

  pkg.version = version
  lock.version = version
  if (!lock.packages?.['']) throw new Error('无法更新 package-lock.json 中的根包版本')
  lock.packages[''].version = version
  tauri.version = version
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf-8')
  fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n', 'utf-8')
  fs.writeFileSync(cargoPath, nextCargo, 'utf-8')
  fs.writeFileSync(cargoLockPath, nextCargoLock, 'utf-8')
}

function bumpVersion(version, type) {
  const parts = version.replace(/^v/, '').split('.').map(Number)
  if (type === 'major') {
    parts[0]++
    parts[1] = 0
    parts[2] = 0
  } else if (type === 'minor') {
    parts[1]++
    parts[2] = 0
  } else {
    parts[2]++
  }
  return parts.join('.')
}

function askVersion(current) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(`当前版本: ${current}\n请输入新版本号 (回车 patch+1): `, (answer) => {
      rl.close()
      const v = answer.trim()
      if (!v) {
        resolve(bumpVersion(current, 'patch'))
      } else if (/^\d+\.\d+\.\d+$/.test(v)) {
        resolve(v)
      } else {
        console.error('版本号格式错误，应为 x.y.z')
        process.exit(1)
      }
    })
  })
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const current = pkg.version
  assertVersion(current)

  if (args.includes('--skip')) {
    syncVersion(current)
    console.log(`版本: ${pkg.version} (跳过 bump)`)
    return
  }

  let newVersion

  if (explicitVersion) {
    newVersion = explicitVersion
  } else if (args.includes('--ask')) {
    newVersion = await askVersion(current)
  } else if (args.includes('--major')) {
    newVersion = bumpVersion(current, 'major')
  } else if (args.includes('--minor')) {
    newVersion = bumpVersion(current, 'minor')
  } else {
    newVersion = bumpVersion(current, 'patch')
  }

  syncVersion(newVersion)
  console.log(`版本: ${current} → ${newVersion}`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
