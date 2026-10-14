# DSH 平台与发布约定

## 平台资产

根 npm 包同时提供 Claude Code、Codex 和 DSH，根 exports 的默认入口指向 DSH host 插件；安装器仍通过 bin/ratk.js 与 lib/installer.js 工作。DSH 的 client、preset、技能、模板和共享契约均在 dsh/，不依赖本机缓存路径。

资源定位从 profile 的 Node 包解析找到本包 package.json，再取 dsh/skills。不得改回个人绝对路径。两个 role 使用同一个 host 模块：api 注册 UI 接口，tools 注册 ra_workbench；client 模块 ID 必须等于根 npm 包名。

## 预安装与启用

`ratk install --dsh` 无须 DSH；只复制完整 bundle 到 DSH_HOME/bundles/research-app-toolkit，未设置 DSH_HOME 时用当前用户 .dsh。它不创建 profile、不修改其他平台、不安装 DSH。真正启用由 DSH 插件管理器完成，Web/Desktop 分别注册。

更新预安装目录保留旧目录备份。用户数据在各会话工作区 .ra/，不会存入 npm 包。旧本地两个 bundle 必须先停用，再启用同一 preset ID 的新包，避免重复注册。

## 验证与发布

- npm 运行时无 dependencies；DSH 为 optional peer，普通安装不会自动拉取。
- npm test 在没有 DSH 的环境验证安装器与存储/API/UI 生命周期；test:dsh 单独定位实际 DSH schema 和技能提供方。
- npm pack 白名单不含 tests、scripts、.agentdocs、缓存、凭证或实际申请数据。发布前检查压缩包里仅有空白状态模板。
- 先通过 check/test/test:dsh 及真实 tarball 安装，再推送 GitHub 与 npm 发布。npm 二次验证必须由账号本人完成；不能把登录成功当成发布成功。
- npm 发布后从官方 registry 回读版本、latest、peer 配置与 tarball 校验值，并重新安装该线上版本验证无 DSH 的 --dsh 预安装。
