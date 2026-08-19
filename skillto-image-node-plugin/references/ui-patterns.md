# UI Patterns

Use this reference when designing plugin panel and reasoning pages.

## Panel Page

The panel page appears in the image/video generation node editor. It should feel like a compact production tool, not a landing page.

The platform renders the outer shell and top identity chain. Do not recreate it inside the iframe:

```text
creator avatar + creator name + SkillTo.ai logo + plugin product name
```

The platform shell also owns the creator dropdown, plugin product dropdown, purchase state, reasoning icon, and close button. The platform header is left-aligned and keeps the creator avatar/name, brand, product selector, and reasoning entry in one continuous row outside the iframe. The plugin panel starts below that shell and should not include a SkillTo.ai logo header or reserve header height in its CSS.

Recommended structure:

- One prominent run button for the plugin's core reasoning action.
- Optional compact preset buttons.
- Preview/detail area explaining the selected preset or generated result.
- Clear loading state on the clicked button only; do not dim the whole interface.
- Error toast or inline error text that does not close the editor.

Do:

- Use dark surfaces, green accents, restrained borders, and compact typography.
- Keep buttons stable in size while loading.
- Preserve the host editor; never close host UI after generation.
- Use localized labels for Chinese and English environments.

Avoid:

- Whole-page translucent overlays.
- Large marketing hero blocks.
- Buttons that shift layout on hover/loading.
- Hidden dependency on host CSS.
- Duplicating platform controls such as logo, creator dropdown, product dropdown, purchase state, reasoning icon, or close button.

## Reasoning Page

The reasoning page appears inside a fixed host modal. The plugin controls only iframe content.

The modal title bar, SkillTo.ai logo, close button, and fixed modal size belong to the host. The reasoning iframe should render only the explanation/graph content.

Recommended structure:

- Left: visual reasoning graph or layered infographic.
- Right: generated prompt, tags, extracted methods, or final rationale.
- Vertical scroll inside the iframe content when the graph overflows.
- Inline asset thumbnails for material tokens, with hover preview.

For a "Skill reasoning lighting" style plugin, the left graph can use four layers:

1. User input summary, including connected image/video/text summaries.
2. Story or shot setting.
3. Character/emotion inference.
4. Prompt logic branches, usually 2 to 5 branches.

Other plugins can rename layers, but should keep a clear top-down decision trail.

## Visual Tone

- Background: near-black or deep green-black.
- Accent: `#37FC30` or related green.
- Text: white for headings, muted white for details.
- Borders: subtle white or green alpha.
- Module radius: 8 to 14 px.
- Font sizing: compact enough for dense information; avoid poster-scale headings inside panels.

## Asset Token Rendering

When text contains material tokens:

- Render `{{image_1}}` and `{{mixed_1}}` as small image thumbnails when preview URLs are available.
- Render video/audio/text tokens as compact icons.
- Show a larger preview on hover when possible.
- Keep token identity available in `title` or `aria-label`.
