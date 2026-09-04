# NPM Launcher

一个基于 Tauri 2、Rust 和 Vue 3 的桌面项目工作台，用于集中管理多个 NPM 项目的启动、停止、日志和终端，并集成 nvm Node.js 版本管理。支持 Windows 和 macOS。

<p align="center">
  <a href="https://github.com/xiaotai1/npm-launcher">
    <img alt="GitHub" src="https://img.shields.io/badge/GitHub-xiaotai1%2Fnpm--launcher-181717?style=flat&logo=github" />
  </a>
</p>

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

### 应用更新

- 启动后静默检查 GitHub Releases，也可从顶部工具栏手动检查
- 展示新版本说明、下载进度，并在签名校验通过后安装和重启
- 支持 Windows x64 NSIS、macOS Intel 与 macOS Apple Silicon

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
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

提交前建议依次运行 `npm run typecheck`、`cargo test` 和 Clippy。GitHub Actions 会在 Windows x64、macOS Intel 与 macOS Apple Silicon 构建任务中执行相同门禁。

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
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

GitHub Actions 会分别在 Windows x64、macOS Intel 和 macOS Apple Silicon runner 上构建，发布以下 4 个文件：

- Windows NSIS 安装版
- Windows x64 便携版
- macOS Intel DMG
- macOS Apple Silicon DMG

Tag 发布还会生成 Tauri Updater 使用的签名更新包、`.sig` 和 `latest.json`。Windows 便携版不参与自动更新。

### 应用内更新发布

首次配置时生成专用更新密钥：

```bash
npx tauri signer generate -w ~/.tauri/npm-launcher.key
```

在 GitHub 仓库的 `release` Environment 中配置以下 Secrets：

- `TAURI_SIGNING_PRIVATE_KEY`：`~/.tauri/npm-launcher.key` 的完整内容
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：生成密钥时设置的密码

私钥不得写入仓库，且必须离线备份。丢失私钥后，已经安装的客户端将无法验证使用新密钥签发的更新。

发布流程（在当前开发分支执行，不需要切换到其他分支）：

```bash
# 1. 同步版本号，按提示输入目标版本，例如 1.0.11
node scripts/bump-version.js --ask

# 2. 检查版本文件是否都与 Tag 一致
node scripts/check-release-version.js v1.0.11

# 3. 提交版本变更，并推送当前分支
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: 发布 v1.0.11"
git push origin HEAD

# 4. 创建带说明的 annotated Tag，并推送 Tag 触发发布工作流
git tag -a v1.0.11 -m "Release v1.0.11: 修复已知问题，优化 UI 交互"
git push origin v1.0.11
```

其中 `v1.0.11` 和提交说明请替换为本次实际版本与更新内容。`git tag -a -m` 会把说明写入 Tag，工作流会读取该说明作为 GitHub Release 正文，并显示在应用更新弹窗中。

只需推送 Tag，不要提前在 GitHub 页面手动创建或发布 Release。推送 Tag 后，工作流会在 Windows x64、macOS Intel、macOS Apple Silicon 全部构建完成后创建 Release；如果同 Tag 的 Release 已存在，则会复用并更新说明、补齐产物。没有 Tag 说明时会自动生成变更日志。尚未集成 Updater 的旧版本需要手动安装一次新版，此后才能使用应用内更新。

### 发布签名

Updater 密钥只负责验证更新包没有被替换，不等同于操作系统代码签名。对外分发前仍建议在对应平台配置证书：

- macOS：Apple Developer ID Application 证书、签名身份、Apple ID 或 App Store Connect API 凭据，并完成 notarization 与 staple。
- Windows：受信任的代码签名证书，并在上传产物前使用 `signtool` 对安装版和便携版签名。

证书和账号凭据不能写入仓库，应通过 GitHub Actions Secrets 注入。未配置时，macOS Gatekeeper 或 Windows SmartScreen 可能显示来源警告。

## 项目结构

```text
src-tauri/
├── Cargo.toml              # Rust 依赖与目标平台配置
├── tauri.conf.json         # Tauri 公共配置
├── tauri.macos.conf.json   # macOS 标题栏与窗口配置
├── tauri.windows.conf.json # Windows 窗口与 NSIS 配置
├── build.rs                # Tauri 构建入口
├── capabilities/           # 主窗口权限声明
├── icons/                  # Windows 与 macOS 应用图标
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

## 配置与安全

- 沿用系统配置目录中的 `npm-launcher/config.json`，现有配置可直接读取
- Tauri capability 只开放主窗口基础权限，文件对话框和打开路径由 Rust 后端调用
- 外部 URL 仅允许打开 `http/https` 的 `localhost`、IPv4 回环/监听地址或 IPv6 回环地址 `[::1]`
- 前端不直接访问 Node.js、文件系统或子进程 API
- Windows 默认使用系统 WebView2，不随安装包内置固定运行时

## 许可证

MIT
