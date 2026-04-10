declare module 'electron-sudo' {
  interface SudoOptions {
    name?: string
    icns?: string
  }

  interface SudoExecOptions {
    env?: Record<string, string>
  }

  interface SudoChildProcess {
    output: {
      stdout: Buffer
      stderr: Buffer
    }
    on(event: 'close', listener: () => void): this
    on(event: 'error', listener: (err: Error) => void): this
    kill(): void
  }

  class Sudoer {
    constructor(options: SudoOptions)
    exec(command: string, options?: SudoExecOptions): Promise<SudoChildProcess>
    spawn(command: string, args: string[], options?: SudoExecOptions): Promise<SudoChildProcess>
  }

  // 导出的是工厂函数，调用后返回当前平台的 Sudoer 类
  export default function (): typeof Sudoer
}
