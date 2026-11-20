# 第五阶段：源码与部署产物分离

本地模拟日期：2026-11-20；浏览器：Windows Chrome 157.0.8103.79。未触发 GitHub Actions、未推送、未发布正式 Pages、未做手机实机测试。

## 本地构建与部署模拟

- `npm run build` 成功，现有 `build.mjs` 生成 Worker 与 WASM，并由 `tools/prepare-dist.mjs` 准备独立 `dist/`。`node tools/verify-dist.mjs` 核对 17 个文件与 PWA 相对路径，通过。
- `dist/` 顶层包含 `index.html`、应用和资料 JS、`ai-worker.bundle.js`、`sw.js`、manifest、SVG／PNG 图标、第三方说明；`vendor/` 包含 WASM、运行 JS 与许可证。没有源码构建工具、测试或模型权重。
- `npm test`：19/19 通过。构建相关 JS 语法检查、`git diff --check` 通过。
- `SAINTSCOPE_STATIC_ROOT=dist` 的本地 HTTP 服务以 `/SaintScope/` 前缀提供产物；Worker、WASM、图标和 manifest 均加载。`reports/phase5-dist-network.json`：真实圣乔治图片推理成功，模型首次读取 162.3 MiB、初始化 7,857 ms、推理 3,905 ms；取消后重试成功，模型读取 0.0 MiB；模拟模型下载失败后，24 条手动检索结果可用。浏览器只观察到 Hugging Face 模型资源 GET，没有非 GET 请求。
- `reports/phase5-dist-offline.json`：首次联网后关闭 Chrome、完全断网重开，应用界面、手动检索和 CLIP AI 均成功；离线 AI 模型资源网络读取 0.0 MiB。删除模型缓存后应用界面仍可用，AI 失败并提示手动检索；删除所有缓存后离线页面无法打开。模型缓存不保证长期保留。

## 安全与部署配置

- 原先触发告警的 Gist 标识符仍存在于**生成的** Worker bundle 中。这不是安全扫描豁免；方案是让该文件只进入 `dist/` 构建产物，而不进入未来的 Git 提交。未发现新增凭据、Mistral API 调用或照片上传。
- `.github/workflows/ci.yml` 仅在 `pull_request` 和开发分支 push 下运行，只有 `contents: read`，不部署，不使用 `pull_request_target` 或仓库秘密。
- `.github/workflows/pages.yml` 仅有 `workflow_dispatch` 触发；构建和部署作业同时检查 `refs/heads/main`。构建作业只读；部署作业才获得 `actions: read`、`pages: write`、`id-token: write`，使用官方 `upload-pages-artifact` 与 `deploy-pages`。本地已解析 YAML 并核对触发器、权限与作业条件；GitHub 托管运行尚未验证。
- 正式 Pages 需要管理员在仓库设置中选择 GitHub Actions 发布源，并给 `github-pages` 环境加 `main` 分支保护。该设置本轮未更改。GitHub Pages 当前配置没有已验证的 PR 独立预览；本轮只做本地 HTTP 模拟。
- 已有 `1dd57c0`、`f5eec9f`、`4db26ba` 仍含旧 bundle。即使新提交不再跟踪生成文件，直接推送整条分支仍会被 Push Protection 扫描到旧提交。**尚不具备直接推送条件，也不应在本轮清理历史。**
