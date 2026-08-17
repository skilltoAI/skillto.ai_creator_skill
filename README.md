[![SkillTo.ai](docs/assets/skillto-logo.png)](https://www.skillto.ai)

# SkillTo.ai Creator Skill

Public agent skill tooling for building SkillTo.ai creator image-node plugins.

Official website: [https://www.skillto.ai](https://www.skillto.ai)

中文文档: [README.zh-CN.md](README.zh-CN.md)

## Contents

- `skillto-image-node-plugin/` - an agent skill for creating, adapting, validating, previewing, packaging, and uploading SkillTo.ai image node plugins.
- `skill-apps/skill-lighting-reasoning/` - a sample Skill app built with this tooling.

## Requirements

- Node.js 18 or newer.
- A SkillTo.ai creator API key for production upload.

## Install For Agent Use

The skill is a plain local `SKILL.md` directory with self-contained references, scripts, and templates. It does not require access to the SkillTo.ai main source repository.

Install by copying or symlinking this folder into the local skills directory used by your agent runtime:

```text
skillto-image-node-plugin/
```

The required entry file is:

```text
skillto-image-node-plugin/SKILL.md
```

For Codex, Claude Code, OpenClaw, or another agent runtime, use the equivalent local skill directory supported by that tool, or point the tool at this folder as a local skill capability.

### Codex

Copy the skill folder into your Codex local skills directory:

```powershell
$skillsDir = Join-Path $env:USERPROFILE ".codex\skills"
New-Item -ItemType Directory -Force -Path $skillsDir | Out-Null
Copy-Item -Recurse -Force .\skillto-image-node-plugin (Join-Path $skillsDir "skillto-image-node-plugin")
```

Use it by asking Codex to load the skill before creating or editing a plugin:

```text
Use the skillto-image-node-plugin skill to create a SkillTo.ai image node plugin that rewrites lighting and atmosphere while preserving the original prompt intent.
```

### Claude Code

Copy or link `skillto-image-node-plugin/` into the local skills or agents directory configured for Claude Code, or keep this repository in the creator project and ask Claude Code to read the entry file:

```text
Read skillto-image-node-plugin/SKILL.md, then build a SkillTo.ai image node plugin in ./work/my-plugin.
```

After generation, run the validation and packaging scripts from this repository:

```bash
node skillto-image-node-plugin/scripts/validate-plugin.mjs ./work/my-plugin
node skillto-image-node-plugin/scripts/pack-plugin.mjs ./work/my-plugin
```

### OpenClaw

Copy or link `skillto-image-node-plugin/` into the local skills or agents directory configured for OpenClaw. The instruction entry is:

```text
skillto-image-node-plugin/SKILL.md
```

Use it with a direct prompt such as:

```text
Use skillto-image-node-plugin/SKILL.md as the contract and create a production-ready SkillTo.ai image node plugin. Validate it before packaging.
```

## Creator API Key

Production upload requires a SkillTo.ai creator API key.

1. Sign in at [https://www.skillto.ai](https://www.skillto.ai).
2. Open [Creator API Keys](https://www.skillto.ai/account/creator/api-keys).
3. Create a new API key.
4. Grant the key these scopes:
   - `skill_app:read`
   - `skill_app:write`
5. Copy the key once. It should start with `skap_`.
6. Store it in an environment variable before upload:

```bash
export SKILLTO_CREATOR_API_KEY="skap_xxx"
```

PowerShell:

```powershell
$env:SKILLTO_CREATOR_API_KEY = "skap_xxx"
```

Never commit creator API keys to git, plugin files, screenshots, logs, or issue comments.

## What Creators Can Do

With only this repository and Node.js, a creator can:

- generate a new image node plugin from a static template
- implement `panel/index.html` and `reasoning/index.html`
- use the mock host to preview plugin UI and reasoning behavior
- validate sandbox, CSP, manifest, output schema, and secret rules
- package a plugin zip
- upload the zip to SkillTo.ai production with a creator `skap_` API key
- optionally create or update a Skill product record and submit it for review

## Stable Skill Product Key

Every generated plugin gets a stable `skill_product_key` stored locally in:

```text
<plugin-root>/.skillto/skill-app.json
```

Keep this key for every modification and production release of the same Skill product. Generate a new key only for a brand-new Skill product.

`.skillto/` is local state and is excluded from plugin zip packages.

## Quick Start

```bash
cd skillto-image-node-plugin
node scripts/create-plugin.mjs role-face-generator --output ./work
node scripts/validate-plugin.mjs ./work/role-face-generator
node scripts/pack-plugin.mjs ./work/role-face-generator
node scripts/preview-plugin.mjs ./work/role-face-generator --smoke
```

Check the production endpoint before uploading:

```bash
node scripts/skillto-plugin.mjs preflight --env prod
```

Upload to production:

```bash
SKILLTO_CREATOR_API_KEY=skap_xxx \
node scripts/skillto-plugin.mjs upload ./work/role-face-generator/dist/role-face-generator.zip \
  --env prod \
  --release-note "production release"
```

Create or update the optional product record:

```bash
SKILLTO_CREATOR_API_KEY=skap_xxx \
node scripts/skillto-plugin.mjs upload ./work/role-face-generator/dist/role-face-generator.zip \
  --env prod \
  --create-product \
  --product-title "Role Face Generator" \
  --product-subtitle "Generate character turnarounds and expression sheets from story, persona, and reference images"
```

Submit for review only when explicitly confirmed:

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

## Security Notes

- Keep creator API keys in environment variables only.
- Do not place secrets in plugin source files, manifests, templates, or packaged zip files.
- `work/`, `dist/`, `.skillto/`, and `.skillto-preview/` are local/generated paths and are excluded from git.
