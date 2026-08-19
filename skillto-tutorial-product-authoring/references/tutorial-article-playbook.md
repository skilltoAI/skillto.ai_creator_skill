# Tutorial Product Article Playbook

This playbook defines how to write a SkillTo.ai tutorial product with professional Docmost-ready formatting.

## Standard Article Space

Although a small tutorial can use three articles, Skill tutorial products should normally use four articles because download and installation deserve their own operational page:

1. `XXX教案简介`
2. `XXX提示词手册`
3. `开箱即用的Skill`
4. `Skill的下载和安装`

Use the exact product subject in place of `XXX`.

## Global Docmost Rules

- Put the article title in the Docmost title field. Do not repeat it as an H1 in the body.
- Body heading depth should be H2/H3/H4 only.
- Keep paragraphs short: usually 1 to 3 sentences.
- Use tables for model choices, prompt variants, parameter presets, and troubleshooting.
- Use callouts for "设计判断", "模型注意", "避坑", "交付标准", and "版权/素材提醒".
- Use image captions below every major image.
- Do not paste raw HTML unless an internal importer explicitly requires it.
- Use these paywall markers exactly:

```text
---以下内容免费---
----以下内容付费----
```

The free marker should not render on the public reading page. The paid marker should render as a purchase guidance module for unpaid readers and disappear for entitled readers.

## Article 1: `XXX教案简介`

Purpose: sell the learning outcome without sounding like a banner ad. This page establishes professional trust.

Recommended structure:

```markdown
## 这套教案解决什么问题

用 2-3 段说明创作者为什么需要这套方法，以及它把哪类模糊创作问题变成可执行流程。

---以下内容免费---

## 你会获得什么

| 模块 | 你能拿走什么 | 适合谁 |
| --- | --- | --- |
| 方法框架 | ... | ... |
| 提示词手册 | ... | ... |
| 开箱 Skill | ... | ... |

![XXX教案简介信息图](asset_key_or_url)

> 图注：用一张 1:2 长图概括课程目标、流程、适用模型和交付物。

## 学完后的交付标准

- ...
- ...

----以下内容付费----

## 专业工作流总览

用 H3 分解为 3-5 个阶段，每个阶段说明输入、判断、输出。
```

### Intro Infographic With `$imagegen`

Use `$imagegen` to create a premium vertical long infographic for this article. The target aspect ratio is 1:2.

Prompt template:

```text
Create a vertical 1:2 premium editorial infographic for a SkillTo.ai tutorial product.

Subject: {XXX}
Audience: {AI creators / designers / filmmakers / photographers}
Visual direction: high-end design education, cinematic production notes, clean grid, refined typography, deep professional tone, not a marketing poster.
Core sections:
1. Problem this tutorial solves
2. Workflow map
3. Model selection notes
4. Prompt structure
5. Deliverables
6. Paid advanced section preview
Brand signal: SkillTo.ai, subtle and clean.
Text language: {Chinese or English}
Must include these exact short labels if text rendering is reliable:
- 教案简介
- 提示词手册
- 开箱 Skill
- 下载和安装
Avoid: clutter, fake screenshots, misspelled SkillTo.ai, low-resolution icons, childish colors, unreadable micro text.
```

If image text fidelity is uncertain, keep the infographic text sparse and repeat all important information in the article body.

## Article 2: `XXX提示词手册`

Purpose: teach the user how to prompt and how to choose the right model.

Recommended structure:

```markdown
## 先选模型，再写提示词

| 目标 | 推荐模型 | 不推荐场景 | 注意事项 |
| --- | --- | --- | --- |
| 静态概念图 | GPT Image / Midjourney | ... | ... |
| 短视频镜头 | Seedance / Veo class model | ... | ... |
| 文案推理 | GPT class model | ... | ... |

## 提示词骨架

### 角色与目标
...

### 视觉语言
...

### 约束条件
...

---以下内容免费---

## 免费示例

给 1 个完整示例和 1 个拆解表。

----以下内容付费----

## 专业提示词库

提供 6-12 张 prompt cards，每张卡包括用途、完整提示词、参数、适用模型、常见失败点。
```

Model selection notes must mention:

- model strength and weakness
- required input type
- reference image handling
- aspect ratio and duration limits
- style drift
- cost and iteration strategy
- safety or copyright limitations

## Article 3: `开箱即用的Skill`

Purpose: explain the packaged Skill as a usable product, not just source code.

Recommended structure:

```markdown
## 这个 Skill 能帮你做什么

说明输入、处理过程、输出。

## 面板与输入项

| 输入项 | 用户要填什么 | 影响结果 |
| --- | --- | --- |
| 风格方向 | ... | ... |
| 参考图 | ... | ... |
| 输出比例 | ... | ... |

---以下内容免费---

## 典型使用场景

- ...
- ...

----以下内容付费----

## 开箱工作流

1. 准备素材
2. 输入目标
3. 选择模型和参数
4. 生成并检查
5. 迭代修正

## 输出质量检查

用设计/影视专业标准列出检查项。
```

For film or visual design products, include professional vocabulary such as composition, contrast, key light, rim light, color temperature, lens language, continuity, visual hierarchy, rhythm, and production constraints.

## Article 4: `Skill的下载和安装`

Purpose: help the user install and validate the Skill calmly.

Recommended structure:

```markdown
## 下载前确认

| 项目 | 要求 |
| --- | --- |
| SkillTo.ai 账号 | ... |
| 浏览器 | ... |
| 可选模型权限 | ... |

---以下内容免费---

## 安装流程预览

说明用户大致会经历什么，不给完整可复制资源。

----以下内容付费----

## 下载与安装

1. 下载 Skill 包
2. 打开 SkillTo.ai Skill 管理
3. 导入或安装
4. 配置可选模型
5. 运行示例

## 验证是否安装成功

| 现象 | 表示 |
| --- | --- |
| ... | ... |

## 常见问题

### 看不到 Skill
...

### 输出不稳定
...

### 素材无法读取
...
```

Never include private keys or production-only credentials in this article.

## Quality Checklist

Before saving a tutorial product preview, check:

- article space has the standard 4 articles
- at least one article contains a generated 1:2 intro infographic or its planned asset slot
- free and paid markers are placed once per article where needed
- public free content is useful but not a full replacement for the paid product
- paid content contains concrete reusable value
- model selection advice is specific
- Skill download/install instructions are testable
- no raw technical identifiers are visible in human-facing copy
- no inaccessible local file paths are used as public media
