const fs = require('fs')
const path = require('path')
const readline = require('readline')

const pkgPath = path.join(__dirname, '..', 'package.json')
const args = process.argv.slice(2)

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
  let newVersion

  if (args.includes('--ask')) {
    newVersion = await askVersion(current)
  } else if (args.includes('--major')) {
    newVersion = bumpVersion(current, 'major')
  } else if (args.includes('--minor')) {
    newVersion = bumpVersion(current, 'minor')
  } else {
    newVersion = bumpVersion(current, 'patch')
  }

  pkg.version = newVersion
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
  console.log(`版本: ${current} → ${newVersion}`)
}

main()
