# Security Checklist

Use this checklist before packaging or reviewing any SkillTo.ai image node plugin.

## Sandbox Rules

- The plugin must run in an iframe with scripts only.
- Do not require `allow-same-origin`, `allow-popups`, `allow-forms`, or `allow-downloads`.
- Do not access `window.parent` except through the SDK postMessage protocol.
- Do not read or write cookies, localStorage, sessionStorage, IndexedDB, or host DOM.

## CSP

Recommended HTML CSP:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https: http:; media-src 'self' blob: https: http:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" />
```

During packaging, inline scripts may require a stricter generated CSP or a nonce. Do not permit arbitrary `connect-src`.

## Secret Rules

Reject packages containing likely secrets:

- `sk-...`, `skap_...`, `xoxb-...`
- private key blocks
- `api_key`, `secret`, `token`, `password` assignments with long values
- `.env` files

Use environment variables only for local upload scripts, never inside packaged plugin files.

## Zip Safety

Reject zip entries or source files with:

- absolute paths
- `..` path segments
- symlinks
- executable install scripts intended to run on user machines
- hidden system files such as `.DS_Store`
- files larger than the configured limit
- too many total files

## Runtime Safety

- LLM calls must go through `SkillTo.llm.responsesSync()`.
- Asset previews must go through `SkillTo.assets.getPreview()`.
- Prompt writes must go through `SkillTo.prompt.setDraft()` or `SkillTo.prompt.commit()`.
- `metadata` must remain sidecar data.
- Do not include tracking pixels, analytics beacons, or third-party scripts.
