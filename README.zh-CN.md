# SkillTo.ai Creator Skill

用于构建 SkillTo.ai 创作者图像节点插件的公开 Agent Skill 工具集。

English documentation: [README.md](README.md)

## 内容

- `skillto-image-node-plugin/` - 用于创建、改造、验证、预览、打包和上传 SkillTo.ai 图像节点插件的 Agent Skill。
- `skill-apps/skill-lighting-reasoning/` - 使用本工具集构建的示例 Skill app。

## 环境要求

- Node.js 18 或更高版本。
- 用于生产上传的 SkillTo.ai 创作者 API Key。

## 安装到 Agent

该 skill 是一个普通的本地 `SKILL.md` 目录，包含自洽的参考文档、脚本和模板，不依赖 SkillTo.ai 主仓库源码。

把下面这个目录复制或软链接到你的 Agent 运行时支持的本地 skills 目录：

```text
skillto-image-node-plugin/
```

入口文件是：

```text
skillto-image-node-plugin/SKILL.md
```

Codex、Claude Code、OpenClaw 或其他 Agent 运行时可以使用各自支持的本地 skill 目录，也可以直接指向这个目录作为本地能力。

## 创作者可以做什么

只需要本仓库和 Node.js，创作者就可以：

- 从静态模板生成新的图像节点插件
- 实现 `panel/index.html` 和 `reasoning/index.html`
- 使用 mock host 预览插件 UI 和 reasoning 行为
- 验证沙箱、CSP、manifest、输出 schema 和敏感信息规则
- 打包插件 zip
- 使用创作者 `skap_` API Key 上传到 SkillTo.ai 生产环境
- 可选地创建或更新 Skill 产品记录，并提交审核

## 稳定的 Skill Product Key

每个生成的插件都会得到一个稳定的 `skill_product_key`，本地存储在：

```text
<plugin-root>/.skillto/skill-app.json
```

同一个 Skill 产品的每次修改和生产发布都应该复用这个 key。只有创建全新的 Skill 产品时才生成新的 key。

`.skillto/` 是本地状态目录，不会被打进插件 zip。

## 快速开始

```bash
cd skillto-image-node-plugin
node scripts/create-plugin.mjs role-face-generator --output ./work
node scripts/validate-plugin.mjs ./work/role-face-generator
node scripts/pack-plugin.mjs ./work/role-face-generator
node scripts/preview-plugin.mjs ./work/role-face-generator --smoke
```

上传前检查生产端点：

```bash
node scripts/skillto-plugin.mjs preflight --env prod
```

上传到生产环境：

```bash
SKILLTO_CREATOR_API_KEY=skap_xxx \
node scripts/skillto-plugin.mjs upload ./work/role-face-generator/dist/role-face-generator.zip \
  --env prod \
  --release-note "production release"
```

创建或更新可选的产品记录：

```bash
SKILLTO_CREATOR_API_KEY=skap_xxx \
node scripts/skillto-plugin.mjs upload ./work/role-face-generator/dist/role-face-generator.zip \
  --env prod \
  --create-product \
  --product-title "角色人脸生成器" \
  --product-subtitle "根据剧情、人设和参考图生成角色三视图与表情表"
```

只有明确确认后才提交审核：

```bash
SKILLTO_CREATOR_API_KEY=skap_xxx \
node scripts/skillto-plugin.mjs upload ./work/role-face-generator/dist/role-face-generator.zip \
  --env prod \
  --create-product \
  --submit-review \
  --confirm-review-fee \
  --procurement-agreement-accepted \
  --procurement-contract-accepted
```

## 安全说明

- 创作者 API Key 只放在环境变量中。
- 不要把密钥写入插件源码、manifest、模板或打包后的 zip。
- `work/`、`dist/`、`.skillto/`、`.skillto-preview/` 都是本地或生成目录，已从 git 中排除。
