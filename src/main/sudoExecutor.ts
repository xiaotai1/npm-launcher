import { exec } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFileSync, readFileSync, unlinkSync } from 'fs'

/**
 * 在真实 cmd.exe 中执行命令（无提权）
 * 通过 PowerShell Start-Process 创建真实控制台环境
 * 避免 nvm 弹出 "terminal only" 提示
 */
export async function execInCmd(command: string): Promise<{ stdout: string; stderr: string }> {
  const rand = Date.now().toString(36) + Math.random().toString(36).slice(2)
  const batchFile = join(tmpdir(), `cmd-${rand}.bat`)
  const outputFile = join(tmpdir(), `cmd-out-${rand}.txt`)
  const psFile = join(tmpdir(), `cmd-ps-${rand}.ps1`)

  writeFileSync(batchFile, `@echo off\r\nchcp 65001 >nul 2>&1\r\n${command} > "${outputFile}" 2>&1\r\n`)

  // 用 Start-Process 创建真实控制台（不加 -Verb RunAs，不触发 UAC）
  writeFileSync(psFile, `Start-Process -FilePath cmd.exe -ArgumentList '/c "${batchFile}"' -Wait -WindowStyle Hidden\r\n`)

  return new Promise((resolve, reject) => {
    exec(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`,
      { windowsHide: true },
      (error) => {
        try { unlinkSync(batchFile) } catch {}
        try { unlinkSync(psFile) } catch {}

        if (error) {
          try { unlinkSync(outputFile) } catch {}
          reject(error)
          return
        }

        try {
          const output = readFileSync(outputFile, 'utf-8').trim()
          unlinkSync(outputFile)
          resolve({ stdout: output, stderr: '' })
        } catch {
          resolve({ stdout: '', stderr: '' })
        }
      }
    )
  })
}

/**
 * 使用管理员权限执行命令（Windows）
 * 通过 PowerShell Start-Process -Verb RunAs 触发 UAC 提权
 * 在真实的 cmd 控制台中执行，避免 nvm 弹出 "terminal only" 提示
 */
export async function execWithSudo(command: string): Promise<{ stdout: string; stderr: string }> {
  const rand = Date.now().toString(36) + Math.random().toString(36).slice(2)
  const batchFile = join(tmpdir(), `elevate-${rand}.bat`)
  const outputFile = join(tmpdir(), `elevate-out-${rand}.txt`)
  const psFile = join(tmpdir(), `elevate-ps-${rand}.ps1`)

  // 创建批处理文件：执行命令并将输出写入临时文件
  writeFileSync(batchFile, `@echo off\r\n${command} > "${outputFile}" 2>&1\r\n`)

  // 创建 PowerShell 脚本：以管理员权限运行批处理
  writeFileSync(psFile, `Start-Process -FilePath cmd.exe -ArgumentList '/c "${batchFile}"' -Verb RunAs -Wait -WindowStyle Hidden\r\n`)

  return new Promise((resolve, reject) => {
    exec(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`,
      { windowsHide: true },
      (error) => {
        // 清理临时文件
        try { unlinkSync(batchFile) } catch {}
        try { unlinkSync(psFile) } catch {}

        if (error) {
          try { unlinkSync(outputFile) } catch {}
          reject(error)
          return
        }

        // 读取捕获的输出
        try {
          const output = readFileSync(outputFile, 'utf-8').trim()
          unlinkSync(outputFile)
          resolve({ stdout: output, stderr: '' })
        } catch {
          resolve({ stdout: '', stderr: '' })
        }
      }
    )
  })
}
