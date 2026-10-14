# 技术约束

- 保留 Claude Code 与 Codex 的既有安装方式，新增平台采用独立资源目录。
- 代理文档入口为 `.agentdocs/index.md`，跨文件变更前阅读。
- 不提交本机配置、凭证、实际申请档案、日志、截图或安装缓存。
- 代码注释与新增维护文档使用中文；单个源码文件不超过 1000 行。
- 使用 Node.js 原生 `node:test`，不引入测试框架。
- 提交前运行 `npm run check`、`npm test`、`npm pack --dry-run --json`。
- 检查包含语法、格式与包内容白名单；新增安装目标需在临时 home 验证不影响其他平台，并验证没有 DSH 时仍可安装。
- DSH 实际集成测试用 `npm run test:dsh`，从 `DSH_NODE_MODULES` 或当前 CLI 安装目录定位运行时，不写入绝对个人路径。
