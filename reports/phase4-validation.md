# SaintScope v0.3 第四阶段验证记录

验证日期：2026-11-20。工作分支：`feature/v0.3-zh-local-ai`。以下浏览器实测均在 Windows 桌面 Chrome 157.0.8103.79 中运行，站点由本地测试服务器按 `/SaintScope/` 子路径提供。没有 iPhone 或 Android 实机，也没有独立在线预览环境。

## 通过

- `npm test`：19/19 通过。`node --check` 对应用、Worker、Service Worker 和浏览器测试脚本通过；`git diff --check` 通过。
- `npm run test:browser`：17 项界面回归通过，包括未确认候选、人工纠正、历史、取消／重试、旧收藏、不上传。
- `/SaintScope/` 本地子路径：HTML、脚本、Worker、WASM、manifest、PNG 图标返回成功；浏览器中实际完成一次 CLIP 推理。详细静态资源字节数见 `phase4-network.json`。
- 首次联网、模型下载：`phase4-offline.json` 记录 162.3 MiB 模型资源网络读取、7,380 ms 初始化、3,912 ms 推理。这是单次桌面实测，不是手机预计值。
- 关闭浏览器后断网重开：应用界面和手动搜索可用；模型缓存仍在时 AI 推理成功，模型资源网络读取 0.0 MiB，初始化 882 ms、推理 1,429 ms。这只证明此桌面浏览器缓存存在时可离线运行。
- 删除模型缓存、保留应用缓存后：离线应用仍可打开，AI 显示模型资源不可用并提示手动搜索。删除全部缓存并离线重开：页面无法加载，符合预期。
- Service Worker 更新：`phase4-update.json` 模拟旧版 `ai4` 到新版 `ai5`，等待用户点击更新，旧应用缓存删除，`transformers-cache` 保留。
- 网络与隐私：`phase4-network.json` 单张公开测试图片中，浏览器对外请求仅为 Hugging Face 模型及其 CDN 的 GET；没有非 GET 请求。测试图由 Node 测试工具从 Wikimedia Commons 下载，再在本地传给浏览器文件输入框，应用本身没有向 Commons 发送照片。此观察只覆盖该次浏览器运行。

## 未通过或限制

- 七张历史图的第二阶段样本已出现误判，封闭候选集会给非圣人图片排序。候选不能当作确定身份；用户须人工确认或选择“无法确定”。
- 浏览器 `performance.memory` 仅测主线程 JS 堆；单图记录约 4.46 MB，**不含 Worker／WASM，也不是峰值内存**。`navigator.storage.estimate()` 在单图测试中显示缓存约 171.6 MB，属于浏览器估计存储占用。
- 模型缓存可能被浏览器自动清理；不能保证长期离线 AI。首次下载约 162 MiB，另有约 14 MB WASM 运行组件，手机网络和低内存设备仍有风险。

## 未测试

- iPhone Safari 和 Android Chrome 实机，包括相机权限、HEIC、手机推理耗时、崩溃／重新加载、低内存、安全降级、主屏幕安装和重新启动。按 `docs/mobile-test-checklist.md` 执行并记录设备、系统、浏览器和 RAM。
- GitHub Pages 上的本分支预览。当前没有证据表明仓库配置会给 PR 自动生成预览网址；正式 `main` 站点不可用于覆盖测试。
- 实际手机浏览器的模型缓存持久性、完整断网后的 PWA 重启，以及在线更新时跨设备缓存一致性。

## 建议

当前仅适合开发者测试。取得独立 HTTPS 预览网址后，让内部测试者按清单完成 iPhone 和 Android 实机验收；随后邀请专业人士检查圣人资料与识别线索。所有 24 位资料仍为 `unverified`，不得以当前测试版宣称史料已核查或模型识别准确。
