# NPM Launcher

一个基于 Tauri 2、Rust 和 Vue 3 的桌面项目工作台，用于集中管理多个 NPM 项目的启动、停止、日志和终端，并集成 nvm Node.js 版本管理。支持 Windows 和 macOS。

<p align="center">
  <img src="docs/images/npm-launcher-cover.webp" alt="NPM Launcher 浅色与深色主题项目总览" width="100%">
</p>

<p align="center">
  <a href="docs/images/npm-launcher-light.webp">查看浅色主题</a> ·
  <a href="docs/images/npm-launcher-dark.webp">查看深色主题</a>
</p>

## 功能特性

### 项目管理

- 添加、编辑和删除 NPM 项目，自动读取 `package.json` 中的 scripts
- 文件夹分组、收藏、搜索筛选和拖拽排序
- 项目总览、运行状态统计和最近活动记录
- 快速打开项目目录或在 VS Code 中打开

### 进程管理

- 单个或批量启动、停止项目，实时同步运行状态
- 自动识别 npm、pnpm、Yarn 和 Bun 锁文件
- Windows 使用 `taskkill` 终止进程树，macOS 使用独立进程组
- Windows 输出优先按 UTF-8 解码，失败时回退 GBK

### 日志与错误分析

- 实时彩色日志流，按项目保留本次会话日志
- 异常退出时识别端口占用、依赖缺失、编译错误等常见问题
- 日志按需导出，不在磁盘长期堆积历史文件

### Node.js 版本管理

- 查看 nvm 已安装版本并切换全局 Node.js 版本
- 为不同项目指定 Node.js 版本，并为项目进程和终端构造独立 PATH
- 支持 Windows 上的 nvm-windows 和 macOS 上的 nvm-sh

### 交互终端

- 内置 xterm.js 与 Rust `portable-pty` 终端
- 支持输入、复制粘贴、窗口缩放和终端退出事件
- 自动进入项目目录并使用项目指定的 Node.js 版本

## 技术栈

| 技术 | 用途 |
|------|------|
| Tauri 2 | 桌面窗口、系统能力与安装包 |
| Rust | 配置、进程、日志、nvm 和 PTY 后端 |
| Vue 3.4 | 用户界面 |
| TypeScript 5.3 | 前端类型检查 |
| Vite 5 | 前端构建 |
| xterm.js 6 | 日志展示与内嵌终端 |
| portable-pty | Windows/macOS PTY 管理 |

## 环境要求

- Node.js 18 或更高版本
- Rust stable 工具链
- npm
- nvm 或 nvm-windows，仅 Node.js 版本管理功能需要
- Windows 10/11：系统 WebView2 Runtime
- macOS：Xcode Command Line Tools；生成 DMG 时需要完整 Xcode 工具链

## 开发

```bash
npm install
npm run dev
```

常用检查和构建命令：

```bash
npm run typecheck       # TypeScript 类型检查
npm run build:frontend  # 构建 Vue 前端
npm run build           # 编译当前平台 Rust 应用，不生成安装包
```

## 打包

Tauri 安装包必须在目标操作系统上原生构建，macOS 应用不能直接生成 Windows 安装包，Windows 也不能直接生成 DMG。

```bash
npm run dist      # 版本 patch +1，并打包当前平台
npm run dist:ask  # 输入版本号，并打包当前平台
npm run dist:win  # 在 Windows 上按当前版本生成 NSIS
npm run dist:mac  # 在 macOS 上按当前版本生成 DMG
```

版本脚本会同步更新以下文件：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

GitHub Actions 会分别在 Windows x64、macOS Intel 和 macOS Apple Silicon runner 上构建，发布以下 4 个文件：

- Windows NSIS 安装版
- Windows x64 便携版
- macOS Intel DMG
- macOS Apple Silicon DMG

## 项目结构

```text
src-tauri/
├── Cargo.toml              # Rust 依赖与目标平台配置
├── tauri.conf.json         # Tauri 公共配置
├── tauri.macos.conf.json   # macOS 窗口配置
├── tauri.windows.conf.json # Windows 窗口与 NSIS 配置
└── src/
    ├── commands.rs         # 前端命令入口
    ├── config.rs           # 配置持久化
    ├── environment.rs      # Shell、Node.js 与 nvm
    ├── log.rs              # 会话日志与错误分析
    ├── process.rs          # 项目进程与实时输出
    ├── terminal.rs         # PTY 终端
    └── state.rs            # 共享运行状态

src/renderer/
├── index.html
└── src/
    ├── main.ts
    ├── app/
    ├── features/
    └── shared/
        └── desktop/api.ts  # Tauri invoke/event 统一适配层
```

旧 `src/main`、`src/preload` 和测试文件仅作为迁移对照保留，不进入 Tauri 构建链。

## 配置与安全

- 沿用系统配置目录中的 `npm-launcher/config.json`，现有配置可直接读取
- Tauri capability 只开放主窗口基础权限，文件对话框和打开路径由 Rust 后端调用
- 外部 URL 仅允许打开 `http/https` 的 `localhost` 或 `127.0.0.1`
- 前端不直接访问 Node.js、文件系统或子进程 API
- Windows 默认使用系统 WebView2，不随安装包内置固定运行时

## 许可证

MIT
