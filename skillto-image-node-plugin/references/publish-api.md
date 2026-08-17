# Publish API

Use this reference only when the user asks to upload or deploy a plugin package.

## API Key

Creators manage API keys in SkillTo.ai:

```text
/account/creator/api-keys
```

The key begins with `skap_` and must include:

```text
skill_app:read
skill_app:write
```

Store it in an environment variable:

```bash
export SKILLTO_CREATOR_API_KEY="skap_xxx"
```

Do not write creator API keys into plugin files, logs, screenshots, or git.

## Upload Endpoint

```http
POST /api/skillto-v2/creator-agent/skill-apps/packages
Authorization: Bearer skap_xxx
Content-Type: multipart/form-data
```

Fields:

| Field | Required | Meaning |
|---|---:|---|
| `package` | yes | Plugin zip file |
| `release_note` | no | Short release note |
| `deploy` | no | Defaults to `true` |
| `skill_product_key` | no | Stable key for this Skill product; generated locally on first create/upload and reused for later debug or releases |
| `product_payload` | no | Optional JSON for creating/updating a record in `/account/creator/products` and optionally submitting review |

Official CLI example:

```bash
SKILLTO_CREATOR_API_KEY=skap_xxx \
node scripts/skillto-plugin.mjs upload ./work/my-plugin/dist/my-plugin.zip \
  --env prod \
  --release-note "initial release" \
  --deploy true
```

Run a route preflight before upload:

```bash
node scripts/skillto-plugin.mjs preflight --env prod
```

Environment shortcuts:

| Option | Target |
|---|---|
| `--env local` | `SKILLTO_LOCAL_BASE_URL` or `https://172.29.186.238:5200` |
| `--env prod` | `https://www.skillto.ai` |
| `--base-url https://host` | explicit custom target |

Production uploads must use the canonical HTTPS domain. The official CLI rejects:

- `http://` endpoints
- production IP addresses
- `--host-header`
- `--insecure-tls`

If `preflight --env prod` reports a CDN/origin failure, fix Cloudflare, TLS, or origin routing for `https://www.skillto.ai` before asking third-party creators to upload. Do not ask creators to bypass the domain with an IP address.

`scripts/upload-plugin.mjs` is the low-level transport used by `skillto-plugin.mjs`. Do not document it as the creator-facing upload command unless you are doing internal platform diagnostics.

The upload tool records deployment state in:

```text
<plugin-root>/.skillto/skill-app.json
```

This file is local state, not part of the packaged zip. It contains the stable `skill_product_key`, latest version id, debug URL, and optional product submission result. Keep the same `skill_product_key` for modifications and debugging; generate a new one only when creating a brand-new Skill product.

Expected success shape:

```json
{
  "success": true,
  "data": {
    "skill_app_uuid": "skill_app_...",
    "skill_product_key": "skill_product_key_...",
    "version_uuid": "skill_app_version_...",
    "status": "deployed",
    "panel_url": "/api/skillto-v2/public/skill-apps/{version}/files/panel/index.html",
    "reasoning_url": "/api/skillto-v2/public/skill-apps/{version}/files/reasoning/index.html",
    "debug_url": "/account/creator/skill-apps/{version}/debug"
  }
}
```

Optional product payload:

```json
{
  "enabled": true,
  "submit_review": false,
  "product": {
    "title": "剧情推理人脸 Skill",
    "subtitle": "从剧情、人设和参考图生成角色三视图与表情表"
  },
  "revision": {
    "description_html": "<p>适用于图片节点的人物一致性插件。</p>"
  }
}
```

When `submit_review` is `true`, also set:

```json
{
  "confirm_review_fee": true,
  "procurement_agreement_accepted": true,
  "procurement_contract_accepted": true
}
```

If the platform route is not available yet, upload tooling should fail clearly and keep the local zip intact.
