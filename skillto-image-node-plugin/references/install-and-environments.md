# Install And Environments

Use this reference when a user asks whether this skill can be installed by third-party creators or used against local/debug/production SkillTo.ai environments.

## Agent Installation

This skill is intentionally agent-runtime neutral:

- `SKILL.md` is the entry instruction file.
- `agents/openai.yaml` provides OpenAI/Codex metadata.
- `references/` contains the platform contract and safety rules.
- `scripts/` contains all local tooling.
- `assets/templates/` contains the standalone plugin template.

Codex installation:

```powershell
Copy-Item -Recurse -Force `
  E:\wwai\skillto.ai_skill\skillto-image-node-plugin `
  C:\Users\Administrator\.codex\skills\skillto-image-node-plugin
```

Claude Code / OpenClaw installation:

- Install or link the same `skillto-image-node-plugin/` folder into that tool's local skills/agents directory.
- The tool must load `SKILL.md` as the instruction entry.
- The scripts require Node.js 20+ and no SkillTo.ai source checkout.

If an agent runtime does not support local skills natively, keep this folder in the creator project and ask the agent to read `skillto-image-node-plugin/SKILL.md` before building the plugin.

## Environment Targets

Use the official CLI for environment checks and uploads:

| Target | Command | Base URL |
|---|---|---|
| WSL2/server-local debug | `--env local` | `SKILLTO_LOCAL_BASE_URL` or `https://172.29.186.238:5200` |
| Production | `--env prod` | `https://www.skillto.ai` |
| Custom | `--base-url https://host` | explicit value |

Examples:

```bash
node scripts/skillto-plugin.mjs preflight --env prod
SKILLTO_CREATOR_API_KEY=skap_xxx node scripts/skillto-plugin.mjs upload ./work/my-plugin/dist/my-plugin.zip --env local
SKILLTO_CREATOR_API_KEY=skap_xxx node scripts/skillto-plugin.mjs upload ./work/my-plugin/dist/my-plugin.zip --env prod
SKILLTO_CREATOR_API_KEY=skap_xxx node scripts/skillto-plugin.mjs upload ./work/my-plugin/dist/my-plugin.zip --base-url https://staging.skillto.ai
```

The official CLI requires HTTPS. Production and custom endpoints must be domain names, not IP addresses. It intentionally rejects `--insecure-tls` and `--host-header`; those options are not safe creator-facing workflows. If production preflight fails, fix the public domain route instead of bypassing it.

## Review Submission

Uploading a zip deploys the plugin. Creating a product record and submitting review is optional:

```bash
node scripts/skillto-plugin.mjs upload ./work/my-plugin/dist/my-plugin.zip \
  --env prod \
  --create-product \
  --product-title "My Skill" \
  --submit-review \
  --confirm-review-fee \
  --procurement-agreement-accepted \
  --procurement-contract-accepted
```

The ordinary human creator UI remains unchanged. These fields are only for creator-agent automation.
