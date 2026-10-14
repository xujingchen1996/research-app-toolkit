# DSH 整合与发布

目标：将本地 RA preset、九个技能与四页 UI 纳入原仓库与 @xujingchen1996/research-app-toolkit npm 包，发布新版。

方案：dsh/ 目录承载单一 bundle，根 manifest 同时声明 dsh.bundle 与 dsh.client。资源从已安装 package.json 定位，不能使用个人路径。ratk install --dsh 支持无 DSH 的文件预安装；真正启用使用 DSH 插件管理器，不伪造 profile 注册。保留 Claude/Codex 原始资源与安装测试。

## 阶段

- [x] 核对账号、原 npm 包与仓库安装器。
- [x] 合并 DSH bundle，新增预安装 CLI 与文档。
- [x] 语法、格式、17 项单元/集成、DSH 实际技能加载及无 DSH npm tarball 安装验证；56 文件，约 57 KB。
- [ ] GitHub 推送、npm 发布与线上回读验收。
- [ ] 更新维护契约、归档任务。
