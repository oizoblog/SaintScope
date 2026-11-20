# SaintScope v0.3 开发中

面向基督教艺术与文化遗产的简体中文静态 PWA。当前开发分支提供实验性本地 CLIP 候选排序，模型不能自行确认人物身份。

## 功能

- 拍照或从相册选图；照片只在浏览器本地预览和分析，不发送给识别服务器。
- 用户点击“开始识别”后，Worker 才从 Hugging Face 下载 CLIP ViT-B/32 量化权重，使用 WASM 在本机计算图像与英文图像描述的余弦相似度。
- 最多展示三位候选的中文／法语名称、典型象征物、匹配描述和相似度排序。相似度不是准确率或概率。
- 显示模型下载／加载／推理状态；可以取消，终止 Worker 并忽略旧任务结果。模型下载失败后仍可手动按象征物搜索。
- 每次完成的模型分析默认标为“身份尚未确认”；用户可以确认候选、查看资料、手动搜索并纠正、标记“都不是”或“无法确定”。人工确认不等于史料核实。
- 逐次识别历史只保存时间、模型版本、候选稳定 ID 与相似度、人工选择及状态。照片不写入本地存储。支持删除单条与清空全部记录；存储不可用时显示本页暂存警告。
- 保留 24 位圣人、手动搜索和收藏。旧版以法语名称保存的记录仍能显示。

24 位圣人资料均标记为 `unverified`，历史与传说字段尚待逐条来源核查。旧收藏与新的逐次识别历史使用不同的本地存储键，不会相互覆盖。

## 本地运行

安装固定依赖并生成静态 Worker、WASM 与完整 `dist/` 站点：

```sh
npm ci
npm run build
python -m http.server 8000
```

本地源码调试可访问 http://localhost:8000。部署时只发布 `dist/`，其中已包含 Worker、WASM、PWA 图标与许可文件；静态托管本身不运行 Node.js。`ai-worker.bundle.js` 由 `npm run build` 生成并被 Git 忽略。首次识别需要联网下载模型权重；再次运行可使用浏览器缓存，但缓存可能被浏览器清理。

`node tools/verify-dist.mjs` 核对 `dist/` 文件清单及相对路径。`.github/workflows/ci.yml` 对 PR 只做只读构建；`.github/workflows/pages.yml` 只允许维护者从 `main` 手动触发正式 Pages 部署。当前开发分支没有独立 Pages 预览，不能用该工作流测试正式站点。启用正式部署前需在仓库 Pages 设置中选择 GitHub Actions，并限制 `github-pages` 环境只允许 `main`。

## 测试

```sh
npm test
node --check app.js
node --check saints.js
node --check prompts.js
node --check recognition-history.js
node --check ai-worker.js
git diff --check
```

`npm run benchmark` 使用本机 Chrome、Wikimedia Commons 上已标明来源与许可的七张缩略图执行浏览器测试。测试图清单在 `tests/fixtures.json`，浏览器实测记录在 `reports/phase2-browser.json`。可设置 `SAINTSCOPE_CASES=peter-keys` 只跑单项；也可用 `CHROME_PATH` 指向另一 Chrome 可执行文件。测试脚本会联网下载测试图片和模型，图片只送入本地浏览器文件输入框。

`node tests/browser-stage3.mjs` 使用本机 Chrome 与可控 Worker 检查确认、纠正、历史、取消、失败和不上传数据的界面流程，结果写入 `reports/phase3-browser.json`。`reports/phase3-integration.json` 是第三阶段界面运行真实 CLIP 的单图记录。

`node tests/browser-offline.mjs` 在 `/SaintScope/` 子路径上使用持久 Chrome 配置运行首次下载、关闭浏览器后完全离线重启、离线手动搜索与 AI、模型缓存删除后的降级；`node tests/browser-update.mjs` 测试 Service Worker 等待用户更新、旧应用缓存清理与模型缓存保留。两者结果写入 `reports/phase4-*.json`。运行离线测试会下载约 162 MiB 模型资源。手机实测步骤见 [移动端测试清单](docs/mobile-test-checklist.md)。

## 当前限制

这七张非实拍的历史艺术图片已暴露明显误判，包括猫也会被封闭候选集排出三位；因此目前不提供自动确认身份或固定成功门槛。“无法确定”是用户选择，不是经过验证的模型拒判。用户已报告 iPhone Safari 局域网 HTTPS、主屏幕 PWA 完全断网重启及缓存模型的本地 CLIP 推理通过实机测试；记录与尚缺的设备、耗时信息见 [iPhone 实机测试记录](reports/iphone-safari-beta.md)。这只证明该设备在当时缓存保留的条件下可离线运行；浏览器清理缓存后仍需联网重新下载模型。Android Chrome 实机和独立在线预览尚未验证。
