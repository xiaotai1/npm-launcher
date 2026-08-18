# NPM Launcher Rust/Tauri 重构设计

日期：2026-08-18

## 1. 目标

在保留现有 Vue 3 界面、交互习惯、用户配置和全部业务功能的前提下，将 Electron 主进程与 preload 桥接迁移为 Tauri 2 + Rust，支持 Windows 与 macOS，并继续生成现有发布流程要求的四类安装产物。

完成后的应用必须具备：

- 项目与文件夹配置管理、收藏、排序和搜索；
- 单项目及批量启动、停止、状态跟踪和进程树清理；
- 实时日志、会话日志、日志导出和错误分析；
- nvm-sh 与 nvm-windows 的版本发现、切换和项目独立 Node.js 环境；
- 基于 xterm.js 的多实例交互终端；
- 文件夹选择、文件管理器、VS Code 和本地 URL 打开；
- 配置导入导出、深浅主题、窗口控制和平台原生标题栏行为；
- Windows NSIS、Windows 便携版、macOS Intel DMG 和 macOS Apple Silicon DMG。

## 2. 不在范围内

- 不重写现有 Vue 组件或视觉设计；
- 不改用纯 Rust UI 框架；
- 不增加移动端或 Linux 支持；
- 不引入数据库、后台服务或 Node.js sidecar；
- 不改变配置格式、项目模型或用户操作流程；
- 按项目规则，不新增、修改或运行测试代码。

## 3. 采用方案

采用 Tauri 2 + Vue 3 + Rust 后端，并在同一分支中分阶段替换 Electron：

1. 保留现有 `src/renderer` 和 xterm.js。
2. 新增 `src-tauri`，先实现窗口、配置和桌面 API 桥接。
3. 将配置、Node.js 环境、项目进程、日志和 PTY 逐模块迁移到 Rust。
4. 前端通过单一 `desktopAPI` 适配层访问 Tauri commands 和 events。
5. 功能完整后删除 Electron 主进程、preload、`node-pty` 和 Electron 构建依赖。
6. 改造现有 GitHub Actions，在 Windows 与 macOS 原生环境分别构建。

不采用 Node.js sidecar，因为它会保留额外运行时和双重生命周期管理；不采用纯 Rust UI，因为它会无收益地重写成熟前端并显著扩大回归范围。

## 4. 目录与职责

```text
src-tauri/
├── Cargo.toml
├── build.rs
├── tauri.conf.json
├── capabilities/
│   └── default.json
└── src/
    ├── main.rs              # 桌面入口
    ├── lib.rs               # Tauri 初始化、插件、命令注册和退出清理
    ├── models.rs            # IPC 共享数据结构
    ├── state.rs             # 项目进程、PTY 和环境缓存状态
    ├── commands.rs          # Tauri command 薄入口
    ├── config.rs            # 配置读写、导入导出和原子保存
    ├── environment.rs       # Shell、nvm、PATH、.npmrc 和 UAC
    ├── package.rs           # 包管理器、scripts 和项目健康检查
    ├── process.rs           # 项目进程、输出、状态和进程树清理
    ├── terminal.rs          # portable-pty 会话管理
    └── log.rs               # 会话日志、导出和错误分析

src/renderer/src/shared/desktop/
├── api.ts                   # 唯一的 Tauri invoke/listen 适配层
└── types.ts                 # 桌面 API 与事件类型
```

`commands.rs` 只负责参数接收、状态获取和结果转换，业务实现放在对应模块。共享运行状态由 Tauri `manage` 托管，内部使用互斥容器保护进程表、PTY 表和 Shell 环境缓存。

## 5. 前后端通信

请求响应能力使用 Tauri commands：

- 配置读取、保存、增删改、排序和导入导出；
- Node.js 版本读取、列表获取和切换；
- 文件夹选择、package scripts、文件管理器、VS Code 和 URL 打开；
- 项目启动、停止、批量启停和状态查询；
- 日志导出、错误分析、主题和窗口控制；
- PTY 创建、写入、缩放和终止。

持续数据使用 Tauri events，并保持现有载荷结构：

- `log-data`：项目日志；
- `process-status`：项目运行状态；
- `error-analysis`：异常分析；
- `pty-data`：终端输出；
- `pty-exit`：终端退出。

前端组件不直接导入散落的 Tauri API。`desktopAPI` 提供与当前 preload 等价的方法和取消监听函数，再将现有 `window.electronAPI` 调用统一替换为 `desktopAPI`。

## 6. 配置与数据兼容

Rust 配置模块继续使用现有 `config.json` 结构，不修改字段名称或默认值。

配置路径优先保持 Electron 的历史目录：

- macOS：`~/Library/Application Support/npm-launcher/config.json`；
- Windows：`%APPDATA%/npm-launcher/config.json`。

若历史路径不存在，再使用 Tauri 应用配置目录。保存继续采用“同目录临时文件写入后原子重命名”的方式；解析失败时先备份损坏文件，再返回默认配置，不覆盖仍可恢复的数据。

导入配置继续执行结构归一化，导出文件名称和 JSON 格式保持不变。

## 7. 项目进程与日志

`ProcessManager` 按项目 ID 持有子进程，维持以下语义：

- 同一项目重复启动按成功处理，不创建第二个进程；
- 启动前检查目录、`package.json`、script 和启动配置；
- 自动识别 npm、pnpm、yarn 和 bun；
- 为项目构造独立 PATH 和 `.npmrc` 环境；
- stdout 与 stderr 实时解码并按当前策略缓冲发送；
- Windows 保持 GBK/UTF-8 兼容，macOS 保持 ANSI 彩色输出；
- 手动停止立即更新 UI，并阻止旧进程退出事件污染新会话；
- 异常退出生成错误分析事件；
- 应用退出时停止全部项目进程。

Windows 沿用 `taskkill /F /T /PID` 清理进程树。macOS 为子进程建立独立进程组，先发送 `SIGTERM`，超时后发送 `SIGKILL`。

会话日志继续只保存在内存中，不新增历史日志目录。导出时沿用安全文件名和系统保存对话框。

## 8. Node.js 与 nvm

macOS：

- 使用用户登录 Shell 获取 Dock 启动时缺失的完整环境；
- 从 `NVM_DIR` 或 `~/.nvm` 发现已安装版本；
- 通过 `nvm alias default` 和 `nvm use` 切换全局版本；
- 切换成功后清除环境缓存，并向活动 PTY 广播 `nvm use`。

Windows：

- 使用 `NVM_HOME` 和 `NVM_SYMLINK` 发现版本与当前链接；
- 通过临时批处理和 PowerShell `Start-Process -Verb RunAs` 完成 UAC 提权；
- 切换目录链接后清除环境缓存；
- 保持取消 UAC、命令失败和版本不存在时的明确错误结果。

项目指定 Node.js 版本只调整该项目进程和终端的 PATH，不修改其他项目配置。

## 9. PTY 终端

Rust 使用 `portable-pty` 创建平台原生 PTY：Windows 使用 ConPTY，macOS 使用系统 PTY。

每个终端 ID 对应一个会话，包含主端、子进程、输出读取任务和退出状态。必须支持：

- 创建、写入、缩放和终止；
- 多项目终端同时运行；
- 自定义 cwd、列数、行数和项目 Node.js 环境；
- PTY 输出和退出事件；
- 终端重启与组件销毁清理；
- 切换 Node.js 后向所有活动终端写入同步命令；
- 应用退出时终止全部 PTY。

输出读取不得持有全局状态锁；锁只用于取得或更新会话句柄，避免大流量输出阻塞其他命令。

## 10. 窗口与桌面能力

- 主窗口保持 1300×850，最小 1000×700。
- macOS 保留隐藏标题栏、原生交通灯和应用菜单。
- 顶部空白区域使用 `data-tauri-drag-region` 声明为 Tauri 原生拖拽区，并占满右侧操作区之外的剩余宽度；按钮区域保持可点击且不触发拖拽。
- Windows 保留无边框窗口和自定义最小化、最大化、关闭按钮。
- 主题继续支持浅色、深色和跟随系统，并同步原生窗口主题。
- 文件选择与保存使用 Tauri dialog 插件。
- 文件、URL 和 VS Code 打开由 Rust 命令统一校验后调用系统能力。
- 本地 URL 继续只允许 `http/https` 的 `localhost` 与 `127.0.0.1`。

## 11. 权限与安全

- 前端只获得主窗口所需的最小 Tauri capability，包括标题栏原生拖拽所需的 `core:window:allow-start-dragging`。
- 不向前端开放任意 Shell 执行权限；项目命令、nvm 和外部打开均通过受控 Rust command。
- 路径和 URL 在 Rust 信任边界再次校验。
- 保持启动命令只来自已保存项目和已读取的 package scripts。
- UAC 临时文件使用随机名称并在成功、失败和取消路径清理。
- 不在日志或错误消息中输出完整环境变量。

## 12. 构建、版本与发布

前端由 Vite 单独构建，Tauri 使用构建结果作为 `frontendDist`。npm 命令保持原有使用习惯：

- `npm run dev`：启动 Tauri 开发模式；
- `npm run build`：构建前端与 Rust 应用；
- `npm run dist`：递增版本并构建当前平台安装包；
- `npm run dist:mac`：在 macOS 构建 DMG；
- `npm run dist:win`：在 Windows 构建 NSIS 和便携版；
- `npm run dist:all`：作为双平台 CI 编排入口，在 Windows 与 macOS 运行器分别执行原生构建，不在单机交叉编译原生 PTY。

这是唯一有意调整的构建语义：命令名和四产物目标保留，但双平台产物由 CI 聚合，不再要求 macOS 单机直接生成 Windows 包。

版本脚本同步更新 `package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json`。

macOS 使用带透明安全边距的专用 `.icns`，图形在 `1024×1024` 画布中按 84% 比例居中，避免 Dock 中的视觉尺寸大于其他应用；Windows 图标尺寸保持不变。

现有 GitHub Actions 改为安装 Rust 工具链和 Tauri 系统依赖，在 Windows 与 macOS 原生运行器构建。发布任务继续要求四个产物全部存在后才创建或更新 Release。

## 13. 错误处理

- Rust command 使用可序列化错误字符串返回前端，不让 panic 穿过 IPC。
- 互斥锁中毒、窗口关闭和事件发送失败均转换为可控错误或安全忽略。
- 启动失败必须移除未完成的进程状态并结束日志会话。
- PTY 创建失败发送错误文本和 `pty-exit`，不留下占位会话。
- 配置保存失败保留原文件并清理临时文件。
- 批量启动继续返回成功数、失败数和逐项目错误。

## 14. 验证标准

受项目规则约束，本次不新增、修改或运行测试代码。实现完成后执行：

1. TypeScript 类型检查。
2. Vite 前端构建。
3. Rust 格式检查和 `cargo check`。
4. macOS Intel/Apple Silicon 配置检查及本机应用构建。
5. Windows CI 原生构建，验证 NSIS 与便携版产物。
6. Windows 与 macOS 分别人工检查项目增删改、配置继承、启停、批量启停、日志、错误分析、nvm、PTY、导入导出、外部打开、主题和窗口控制。
7. 对比四个发布产物和应用安装体积。

只有双平台核心功能检查和四产物构建均通过，才视为完成迁移。若当前执行环境无法运行 Windows 应用，必须明确记录待 Windows 实机验证项，不得以 macOS 结果替代。
