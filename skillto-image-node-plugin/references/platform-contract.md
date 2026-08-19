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

## Host Shell Boundary

The platform owns all UI outside the sandbox iframe. A plugin package must not implement or restyle the platform shell:

- creator avatar and creator-name dropdown
- SkillTo.ai logo in the top identity chain
- plugin product dropdown and purchase status
- host reasoning-entry icon
- modal close, resize, or shell controls

The shell identity chain is rendered by SkillTo.ai as:

```text
creator avatar + creator name + SkillTo.ai logo + plugin product name
```

`panel/index.html` starts inside the plugin iframe below that shell. The host header consumes its own space in normal layout and never overlays the iframe. `reasoning/index.html` starts inside the host reasoning modal body; the modal title bar remains platform-owned.

```text
+----------------------------------------------------------------+
| creator avatar + creator name | SkillTo.ai | product | graph   |  platform host
+----------------------------------------------------------------+
|                                                                |
|                     panel/index.html iframe                   |  creator package
|                                                                |
+----------------------------------------------------------------+
```

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

Slot size limits are strict. A package is invalid if its manifest or explicit page CSS/HTML/JS dimensions exceed:

| Slot | Maximum iframe size |
|---|---:|
| `panel` | `680 x 760` |
| `reasoning` | `1260 x 820` |

Panels and reasoning pages must use responsive sizing, `width: 100%`, `height: 100%`, and internal scrolling for overflow. Do not set fixed, min, max, inline, or scripted pixel dimensions above the slot size.

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
const { rawPrompt, sections } = await SkillTo.inputs.getPrompt();
const { assets } = await SkillTo.inputs.listConnectedAssets({ types: ["image", "video", "audio", "text"] });
const preview = await SkillTo.assets.getPreview(assets[0].handle);
const response = await SkillTo.llm.responsesSync({ prompt, materials: assets.map((asset) => asset.handle) });

await SkillTo.prompt.setDraft({ text: modifiedPrompt, metadata });
await SkillTo.prompt.commit({ modified_prompt: userEditedPrompt, metadata });
await SkillTo.state.set("reasoning_result", metadata);
await SkillTo.ui.openReasoning();
```

`shared/sdk.d.ts` in the generated package is the canonical SDK contract. Use it for TypeScript types and verify package code against it; narrative examples must not add fields or call forms that are absent from that declaration.

## Output Rules

- `modified_prompt` is the only main output.
- `optimized_prompt` may exist only as an internal LLM draft name.
- `metadata.reasoning` powers the reasoning page.
- `metadata.tags` powers tag chips.
- Downstream image/video generation must consume only `modified_prompt`.
- Do not store reasoning, tags, JSON structures, or explanations inside `modified_prompt` unless the user explicitly edits them into the prompt.

## Connected Assets

Connected assets are opaque handles. Display previews only through `SkillTo.assets.getPreview()` or host-provided safe URLs. Keep material tokens such as `{{image_1}}`, `{{mixed_1}}`, `{{video_1}}`, and `{{audio_1}}` intact unless the user asks to remove them.
