# Platform Contract

Use this reference when creating or reviewing a SkillTo.ai image node plugin package.

## Package Shape

Required files:

```text
skillto.skill.json
panel/index.html
reasoning/index.html
shared/sdk.js
shared/sdk.d.ts
assets/
```

The plugin must be static HTML/CSS/JS. A build system is optional, but the packaged output must contain static files only.

## Manifest

Use `manifest_version: "2026-08-sandbox-js"`.

Required `ui_slots`:

```json
{
  "panel": {
    "entry": "panel/index.html",
    "width": 680,
    "height": 760
  },
  "reasoning": {
    "entry": "reasoning/index.html",
    "width": 1260,
    "height": 820
  }
}
```

Required output schema:

```json
{
  "type": "object",
  "properties": {
    "modified_prompt": { "type": "string" },
    "metadata": {
      "type": "object",
      "properties": {
        "reasoning": { "type": "object" },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        },
        "source": { "type": "string" }
      }
    }
  },
  "required": ["modified_prompt"]
}
```

Common permissions:

```json
[
  "read.current_prompt",
  "read.connected_assets.image",
  "read.connected_assets.video",
  "read.connected_assets.audio",
  "read.connected_text",
  "llm.responses.sync",
  "write.prompt_patch",
  "ui.reasoning_modal"
]
```

## SDK

Use only `window.SkillTo` for host interaction.

Core calls:

```js
const context = await SkillTo.context.get();
const prompt = await SkillTo.inputs.getPrompt();
const { assets } = await SkillTo.inputs.listConnectedAssets({ types: ["image", "video", "audio", "text"] });
const preview = await SkillTo.assets.getPreview(assets[0].handle);
const response = await SkillTo.llm.responsesSync({ prompt, materials: assets.map((asset) => asset.handle) });

await SkillTo.prompt.setDraft({ text: modifiedPrompt, metadata });
await SkillTo.prompt.commit({ modified_prompt: userEditedPrompt, metadata });
await SkillTo.state.set("reasoning_result", metadata);
await SkillTo.ui.openReasoning();
```

## Output Rules

- `modified_prompt` is the only main output.
- `optimized_prompt` may exist only as an internal LLM draft name.
- `metadata.reasoning` powers the reasoning page.
- `metadata.tags` powers tag chips.
- Downstream image/video generation must consume only `modified_prompt`.
- Do not store reasoning, tags, JSON structures, or explanations inside `modified_prompt` unless the user explicitly edits them into the prompt.

## Connected Assets

Connected assets are opaque handles. Display previews only through `SkillTo.assets.getPreview()` or host-provided safe URLs. Keep material tokens such as `{{image_1}}`, `{{mixed_1}}`, `{{video_1}}`, and `{{audio_1}}` intact unless the user asks to remove them.
