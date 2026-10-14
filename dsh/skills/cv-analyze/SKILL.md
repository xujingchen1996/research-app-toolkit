---
name: cv-analyze
description: 分析科研申请 CV、简历，提取教育、技能、项目及成果，建立可供其他申请技能复用的申请人档案。
---

# CV 档案分析

## 共享档案与语言

开始前读取本技能目录相对路径 `../../references/shared-state.md`，按其约定读取当前会话工作区的 `.ra/memory.md`。文件缺失时按模板初始化；当前材料已足够时直接继续，不强制先跑 CV 分析。

支持 `zh`、`en`、`bilingual`。当前请求优先于档案偏好，再按任务场景选择语言。双语采用主版本加简短对照，避免全文重复；档案章节标题保持模板的固定英文结构。

## 流程

1. 从档案 `cv_file_path` 读取路径；为空时用 `rg --files` 在工作区查找 CV/resume 文件，无明确候选再询问用户。
2. PDF 优先用 `pdftotext`；不可用时检查本地 PDF 提取库，扫描件需已有 OCR 工具，否则说明无法提取。`textutil` 适用于 DOCX 等格式，不作为 PDF 提取器。不要自行安装依赖。
3. 提取教育、技术技能、科研相关项目、工作实习、奖励、论文成果；保留来源文件及尚未确认的信息。
4. 整理 Strengths for Applications、Areas for Improvement、Packaging Opportunities。
5. 完整提取后更新工作区 `.ra/memory.md` 的 `cv_file_path`、`cv_profile_analyzed: true` 及各章节，保留已有申请偏好。提取失败或材料不足时不把分析标记为完成。

## 交付

优先报告三个最强优势、最能连接研究方向的经历，以及两到三个可改善的包装点。客观记录成绩与缺口，不编造论文、奖励或经历。
