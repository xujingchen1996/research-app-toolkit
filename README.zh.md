# 科研申请工具包

[![Stars](https://img.shields.io/github/stars/xujingchen1996/research-app-toolkit?style=social)](https://github.com/xujingchen1996/research-app-toolkit/stargazers)
[![版本](https://img.shields.io/badge/version-0.2.3--3-blue)](https://github.com/xujingchen1996/research-app-toolkit/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude_Code-Plugin-purple)](https://claude.ai/code)
[![Codex](https://img.shields.io/badge/Codex-Plugin-teal)](https://openai.com)

Research Application Toolkit 是一个统一的代码仓库，旨在为 Claude Code 和 Codex 这两个 AI 平台提供特定的主机集成插件。
本工具包覆盖了学术科研申请的全流程，主要包含以下功能：

- 简历分析：CV 分析与个人档案提取
- 简历润色：针对目标项目进行 CV 优化
- 导师匹配：自动匹配潜在的导师与研究小组
- 联系沟通：撰写冷邮件（Cold Email）及后续跟进邮件
- 文书辅助：起草 SOP（目的陈述）、个人陈述、动机信及研究计划书
- 选校策略：辅助进行学校与项目的筛选
- 面试准备：模拟面试问题准备
- 演示文稿：制作面试 PPT 或与教授面谈的演示文稿
- 研究分析：进行研究领域内的 Gap 分析

## 安装

### 推荐方式：使用 npm CLI

```bash
npm install -g @xujingchen1996/research-app-toolkit
ratk install
```

可选：指定主机安装

```bash
# 仅安装到 Claude Code
ratk install --claude
# 仅安装到 Codex
ratk install --codex
# 安装到所有检测到的主机
ratk install --all
```

安装逻辑说明：

- `ratk install` 默认安装到当前机器上检测到的主机。
- `ratk install --claude` 指定Claude安装。
- `ratk install --codex` 指定Codex安装。
- `ratk install --all` 尝试安装到所有检测到的主机，若主机未安装则跳过。

无需全局安装的运行方式：

```bash
npx @xujingchen1996/research-app-toolkit install
```

## 使用方法

### Claude Code

安装完成后，使用以下斜杠命令（Slash Commands）进行交互

```bash
/ra:cv-analyze      # 简历分析
/ra:cv-polish       # 简历润色
/ra:professor-match # 导师匹配
/ra:cold-email      # 冷邮件撰写
/ra:doc-assist      # 文书辅助
/ra:school-select   # 选校建议
/ra:interview-prep  # 面试准备
/ra:interview-ppt   # 面试 PPT 制作
/ra:gap-analysis    # 研究 Gap 分析
```

### Codex

安装后，直接在聊天中输入以下类型的提示词（Prompts）即可使用：

```text
Analyze my CV and extract a research application profile
Match supervisors and schools for my target research area
Draft a bilingual outreach email to a potential supervisor
Help me prepare a professor meeting or PhD interview PPT
```

注意：Codex 主机会维护自己的 `codex/memory.md` 状态文件，并支持 `zh`（中文）、`en`（英文）和 `bilingual`（双语）三种输出模式。

## 仓库目录结构

```text
research-app-toolkit/
├── .claude-plugin/     # Claude Code 插件清单文件
├── .codex-plugin/      # Codex 插件清单文件
├── .local.md           # Claude Code 共享状态模板
├── assets/             # 共享资源（如图标）
├── commands/           # Claude Code 斜杠命令定义
├── hooks/              # Claude Code 钩子
├── agents/             # Claude Code 辅助 Agent
├── skills/             # Claude Code 技能库
├── codex/
│   ├── memory.md       # Codex 共享状态文件
│   └── skills/         # Codex 技能及清单
├── bin/                # npm CLI 入口文件
├── lib/                # 安装程序辅助工具
├── test/               # 安装程序测试
├── package.json
└── README.md
```

## 开发与测试
独立维护：为了防止提示词干扰，Claude Code 和 Codex 的技能文件被有意分开维护。
安装机制：共享安装由 ratk CLI 处理，而不是依赖克隆仓库后的主机自动发现。
本地状态：请勿将本地主机状态（如 ~/.claude, ~/.codex, ~/.agents 等缓存文件）提交到此仓库。

## 运行测试：

```bash
npm test
```

## License

MIT
