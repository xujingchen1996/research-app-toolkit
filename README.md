# Research Application Toolkit

[![Stars](https://img.shields.io/github/stars/xujingchen1996/research-app-toolkit?style=social)](https://github.com/xujingchen1996/research-app-toolkit/stargazers)
[![Version](https://img.shields.io/badge/version-0.3.0-blue)](https://github.com/xujingchen1996/research-app-toolkit/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude_Code-Plugin-purple)](https://claude.ai/code)
[![Codex](https://img.shields.io/badge/Codex-Plugin-teal)](https://openai.com)

Research Application Toolkit is a single repository that ships host-specific integrations for both Claude Code and Codex.

It covers:

- CV analysis and profile extraction
- CV refinement for target programs
- Supervisor matching
- Outreach and follow-up emails
- SOP, personal statement, motivation letter, and proposal drafting
- School selection
- Interview preparation
- Interview PPT / professor meeting deck preparation
- Research gap analysis

## Install

### Recommended: npm CLI

```bash
npm install -g @xujingchen1996/research-app-toolkit
ratk install
```

Optional host selection:

```bash
ratk install --claude
ratk install --codex
ratk install --all
```

Default behavior:

- `ratk install` installs to the hosts detected on the current machine
- `ratk install --claude` installs only the Claude Code plugin
- `ratk install --codex` installs only the Codex plugin
- `ratk install --all` installs to every detected host and skips hosts that are not installed

You can also run the installer without a global install:

```bash
npx @xujingchen1996/research-app-toolkit install
```

## Usage

### Claude Code

After installation into Claude Code, use the slash commands:

```bash
/ra:cv-analyze
/ra:cv-polish
/ra:professor-match
/ra:cold-email
/ra:doc-assist
/ra:school-select
/ra:interview-prep
/ra:interview-ppt
/ra:gap-analysis
```

### Codex

After installation into Codex, use the plugin in chat with prompts such as:

```text
Analyze my CV and extract a research application profile
Match supervisors and schools for my target research area
Draft a bilingual outreach email to a potential supervisor
Help me prepare a professor meeting or PhD interview PPT
```

The Codex host keeps its own `codex/memory.md` state and supports `zh`, `en`, and `bilingual` output modes.

## Repository Layout

```text
research-app-toolkit/
├── .claude-plugin/                  # Claude Code manifest
├── .codex-plugin/                   # Codex manifest
├── .local.md                        # Claude Code shared state template
├── assets/                          # Shared assets such as the Codex icon
├── commands/                        # Claude Code slash commands
├── hooks/                           # Claude Code hooks
├── agents/                          # Claude Code helper agents
├── skills/                          # Claude Code skills
├── codex/
│   ├── memory.md                    # Codex shared state
│   └── skills/                      # Codex skills and bundle manifest
├── bin/                             # npm CLI entrypoint
├── lib/                             # Installer helpers
├── test/                            # Installer tests
├── package.json
└── README.md
```

## Development Notes

- Claude Code and Codex skills are intentionally maintained separately to avoid host-specific prompt interference.
- Shared installation is handled by the `ratk` CLI rather than host auto-discovery from a cloned repository.
- Local host state such as `~/.claude`, `~/.codex`, `~/.agents`, and Codex caches should not be committed to this repository.

## Test

```bash
npm test
```

## License

MIT

## DeepSeek Harness（DSH）

同一个 npm 包提供 RA 科研申请预设、九个技能，以及申请档案、选校与导师、邮件与文书、面试准备四个 UI 标签页。DSH 当前验证版本为 0.2.0-rc.2。

### 尚未安装 DSH：先准备文件

```bash
npm install -g @xujingchen1996/research-app-toolkit
ratk install --dsh
```

也可直接运行：

```bash
npx @xujingchen1996/research-app-toolkit install --dsh
```

此步骤不需要 DSH，也不会自动安装 DSH 或修改 profile。它将 bundle 放到 `~/.dsh/bundles/research-app-toolkit/`；若设置 `DSH_HOME`，则使用 `$DSH_HOME/bundles/research-app-toolkit/`。预安装成功表示文件已就绪，使用预设和 UI 仍需要安装 DSH。

### 已安装 DSH：启用预设与 UI

1. 打开 DSH 的“插件 → 添加插件”。
2. 输入安装器输出的完整本地目录，或者包名 `@xujingchen1996/research-app-toolkit`。
3. 安装后点击“立即启用”，在新会话选择“RA 科研申请模式”。
4. Web 与 Desktop 的 profile 独立，分别添加并启用。旧会话若持有旧工具版本，重启宿主或新建 RA 会话。

如果已手工安装旧的 `@local/dsh-preset-research-app-toolkit` 与 `dsh-ra-studio`，先在插件管理器停用这两个 bundle，再启用新包，避免重复预设/接口。此操作不删除工作区档案。

### 使用与数据

- 九个技能：`/cv-analyze`、`/cv-polish`、`/professor-match`、`/school-select`、`/cold-email`、`/document-assist`、`/gap-analysis`、`/interview-prep`、`/interview-ppt`。
- 申请档案：当前会话工作区 `.ra/memory.md`；工作台记录：`.ra/workbench.json`。模板不会覆盖已有个人材料。
- UI 支持编辑、保存和准备任务；“准备任务”只填写对话草稿，用户发送后模型才处理。模型与 UI 通过 `ra_workbench` 共用数据。
- Zotero、图像生成、生命科学专用技能和 PPTX 导出工具属于可选能力，包不会自动安装它们。

普通安装与测试不需要 DSH；本包没有运行时依赖，DSH 仅声明为可选 peer dependency。

发布前检查：`npm run check`、`npm test`。已安装 DSH 时再运行 `npm run test:dsh`，该检查可用 `DSH_NODE_MODULES` 指定 DSH 的 node_modules 目录。
