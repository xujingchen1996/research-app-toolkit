# 代理文档索引

## 架构

`architecture/dsh-platform.md` - 三平台 npm 包、预安装/启用边界与发布验收；修改 DSH、安装器或发布配置时必读。

## 已完成任务

`workflow/done/261014-dsh-npm-release.md` - DSH 整合、便携性、打包与发布阶段。

## 全局约束

- npm 运行时不依赖 DSH；DSH 预安装只准备 bundle 文件，不修改 profile。
- 同一 npm 包承载 Claude/Codex/DSH 三个平台；平台资产与状态独立。
- npm 发布只包含 files 白名单；`.agentdocs` 为 GitHub 维护资源，不进入 npm。
