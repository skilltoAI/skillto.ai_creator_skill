---
name: skillto-image-node-plugin
description: Create, adapt, validate, preview, package, and upload SkillTo.ai image node plugins. Use when Codex is asked to build a third-party sandbox iframe plugin for SkillTo.ai image/video generation nodes, similar to Skill reasoning lighting, with panel/reasoning pages, SkillTo SDK calls, connected asset access, LLM prompt rewriting, modified_prompt output, metadata reasoning UI, zip packaging, or creator API-key deployment.
---

# SkillTo.ai Image Node Plugin

## Core Contract

Build **SkillTo.ai image node plugins** as standalone static packages. They do not require the SkillTo.ai source repo and must run only inside the platform sandbox iframe.

The host platform owns the plugin shell around the iframe. Third-party plugins must not recreate or style the platform header, creator selector, product selector, SkillTo.ai logo, purchase state dropdown, close button, or reasoning-entry icon. The host header is a continuous identity chain:

```text
creator avatar + creator name + SkillTo.ai logo + plugin product name
```

Creators design only the iframe content below that shell. The left-aligned host header occupies its own layout row and never overlays the iframe; the generated package must not reserve or recreate that row.

Every plugin must provide:

- `skillto.skill.json`
- `panel/index.html`
- `reasoning/index.html`
- static `shared/` and `assets/` files
- final business output as `modified_prompt`
- sidecar UI data in `metadata.reasoning` and `metadata.tags`

Never expose Provider keys, direct model endpoints, browser login state, host DOM access, cookies, localStorage, IndexedDB, or arbitrary external network access. All prompt, asset, LLM, state, and UI actions must go through `window.SkillTo`.

## Workflow

1. Clarify the plugin goal: what part of the prompt it modifies, what connected image/video/audio/text assets it needs, what reasoning or explanation UI it shows, and whether it needs creator upload.
2. Read the relevant reference files:
   - `references/platform-contract.md` for manifest, SDK, output, and permission rules.
   - `references/ui-patterns.md` for panel and reasoning UI structure.
   - `references/security-checklist.md` before packaging or reviewing a plugin.
   - `references/publish-api.md` only when upload/deploy is requested.
   - `references/install-and-environments.md` when installation, local debug, production upload, or review submission is discussed.
3. Create a plugin from the static template:
   ```bash
   node scripts/create-plugin.mjs my-plugin --output ./work
   ```
4. Edit the generated plugin only inside its own directory. Preserve static HTML/CSS/JS unless the user explicitly asks for a build system.
5. Validate and package:
   ```bash
   node scripts/validate-plugin.mjs ./work/my-plugin
   node scripts/pack-plugin.mjs ./work/my-plugin
   ```
6. Preview locally when needed:
   ```bash
   node scripts/preview-plugin.mjs ./work/my-plugin
   ```
   Use `--smoke` in automated checks.
7. Upload only when explicitly requested and a creator API key is available:
   ```bash
   SKILLTO_CREATOR_API_KEY=skap_xxx node scripts/skillto-plugin.mjs upload ./work/my-plugin/dist/my-plugin.zip --env local
   ```
   The upload script must print and persist the stable `skill_product_key` in `<plugin-root>/.skillto/skill-app.json`. Reuse that key for every debug or release of the same Skill product; generate a new key only for a brand-new Skill product.

## Implementation Rules

- Keep the plugin standalone. Do not import files from `E:\wwai\skillto.ai` or any SkillTo.ai source checkout.
- Use `SkillTo.inputs.getPrompt()` as the prompt source. Preserve user material tokens such as `{{image_1}}` unless the user requests a different contract.
- Use `SkillTo.inputs.listConnectedAssets()` and `SkillTo.assets.getPreview()` for connected media. Do not guess asset URLs.
- Use `SkillTo.llm.responsesSync()` for model calls. Ask for JSON when reasoning metadata is needed; normalize failures to a user-visible error.
- Use `SkillTo.prompt.setDraft({ text, metadata })` for generated drafts and `SkillTo.prompt.commit({ modified_prompt, metadata })` when the user confirms or edits.
- Use `SkillTo.state.set("reasoning_result", metadata)` and `SkillTo.host.onUpdate(...)` to share explanation data between panel and reasoning pages.
- Reasoning pages may render structure graphs, thumbnails, tags, and explanation text, but must not change the host modal size or close the editor.
- Do not place SkillTo.ai logos, creator avatar/name selectors, plugin product dropdowns, purchase-state UI, close buttons, or standard reasoning-entry icons inside `panel/index.html`. Those are host shell controls.
- Do not exceed the platform iframe slot sizes. `panel` must fit within `680 x 760`; `reasoning` must fit within `1260 x 820`. Use `height: 100%`, `min-height: 0`, and internal scrolling instead of larger fixed dimensions.
- Treat the generated package's `shared/sdk.d.ts` as the canonical SDK signature. It exposes only `context`, `inputs`, `assets`, `llm`, `prompt`, `state`, `ui.openReasoning`, and `host`; do not invent host or browser APIs.
- CSS should match SkillTo.ai dark visual language: restrained panels, green accents, compact typography, clear loading states, no translucent disabled whole-page overlays.
- When upload/deploy is requested, send `skill_product_key` to the platform. If the user asks to create or update the product listing, use `product_payload` only for optional product fields and review submission flags; the ordinary human creator UI remains unchanged.

## Resource Use

- Copy `assets/templates/static-image-node-plugin/` for new plugins.
- Prefer the scripts in `scripts/` over ad hoc packaging or validation commands.
- Keep newly generated plugin directories outside this skill folder unless the user explicitly asks to add a reusable template.
- Prefer `scripts/skillto-plugin.mjs` for preflight and upload. It enforces HTTPS production domains and rejects insecure production IP uploads; use `upload-plugin.mjs` only as the internal low-level implementation.

## Done Criteria

A plugin is ready when:

- `validate-plugin.mjs` passes.
- `pack-plugin.mjs` creates a zip.
- `preview-plugin.mjs --smoke` passes.
- `modified_prompt` is the only main output.
- metadata is display-only and does not overwrite prompt.
- no secrets or prohibited network permissions are present.
