# Agent CRUD API and Capability Design

This document defines the Creator Agent capabilities for SkillTo.ai tutorial products. It is an Agent/API reference, not a human creator UI contract. There is no CLI requirement: local Agents call the SkillTo.ai HTTP API directly with a `skap_` Creator Agent key.

## Principles

- A tutorial product is itself a product. Do not model it as a separate visible item that must be "bound" to another product in the human workflow.
- Human creators see product language: 教案名称, 介绍, 价格, 目录, 文章, 商品预览, 采购审核.
- Agent APIs may use opaque keys, but never expose raw database ids, public slugs, Docmost URLs, HTML, JSON, or revision payloads to human users.
- A creator can prepare drafts, previews, coupons, and procurement review materials. A creator cannot directly publish or list a product.
- The platform review team decides whether SkillTo.ai purchases the product as platform-operated B2C inventory.

## Authentication

Creator Agent endpoints must use the Creator Agent channel:

```http
Authorization: Bearer skap_...
Content-Type: application/json
```

The token must be scoped to the creator account and can only access that creator's own tutorial products, media, previews, and review submissions. SSO tokens, Classic sessions, platform channel keys, and model API keys are not accepted.

Required scopes:

- `tutorial_product:read`
- `tutorial_product:write`
- `tutorial_product:content_write`
- `tutorial_product:media_write`
- `tutorial_product:submit_review`

## Opaque Keys

API responses may return stable opaque keys, for example:

- `tutorial_product_key`
- `article_key`
- `asset_key`
- `preview_key`
- `review_submission_key`

These keys are for Agent/API use. Do not show them in human creator UI.

## Product Draft CRUD

### Create Tutorial Product Draft

```http
POST /api/skillto-v2/creator-agent/tutorial-products
```

Request:

```json
{
  "name": "布光推理：从故事到可执行光位",
  "intro": "把故事、情绪与光线翻译成可执行的创作指令。",
  "locale": "zh-CN",
  "audience": "AI 影像创作者、商业摄影师、短片导演",
  "price_currency": "CNY",
  "list_price_cents": 1787,
  "sale_price_cents": 1787,
  "gift_points": 0,
  "tags": ["lighting", "film", "prompt"],
  "target_models": ["Seedance", "GPT Image", "Midjourney"],
  "cover_image_url": "/upload/creator/lighting-cover.png"
}
```

Behavior:

- Server creates the tutorial product draft.
- Server creates the article space and default article tree.
- Server creates a draft product revision so the human `/account/creator/tutorials` list can show price.
- Server generates internal public paths and slugs.
- Server returns safe product projection and preview actions.

Response:

```json
{
  "tutorial_product_key": "tp_xxx",
  "status": "draft",
  "name": "布光推理：从故事到可执行光位",
  "preview_url": "/t/tmdk4h?preview=1",
  "product_preview_url": "/s/pabcde?preview=1",
  "creator_review_url": "/account/creator/tutorials/123",
  "review_state": "draft",
  "articles": [
    {
      "article_key": "ta_xxx",
      "role": "intro",
      "title": "布光推理教案简介",
      "state": "empty"
    }
  ],
  "checklist": {
    "has_price": true,
    "has_preview": true,
    "has_articles": false,
    "has_required_agreement": false,
    "has_cover": true
  }
}
```

### Get Product Draft

```http
GET /api/skillto-v2/creator-agent/tutorial-products/{tutorial_product_key}
```

Return a safe projection:

- product name and intro
- price points and derived display prices
- article tree and article states
- media readiness
- product preview URL
- creator review URL for the human creator-center page
- review status
- missing review checklist items

### Update Product Draft

```http
PATCH /api/skillto-v2/creator-agent/tutorial-products/{tutorial_product_key}
```

Allowed fields:

- `name`
- `intro`
- `audience`
- `original_price_points`
- `tags`
- `target_models`
- `cover_asset_key`
- `hero_asset_key`

Rejected fields:

- `id`
- `slug`
- `public_slug`
- `docmost_page_id`
- `docmost_edit_url`
- `docmost_read_url`
- `html`
- `json`
- `revision_payload`

The current no-CLI implementation accepts public or site-relative media URLs for `cover_image_url` and `hero_image_url`. File upload can be added later without changing the opaque product/article key strategy.

### Delete or Archive Draft

```http
DELETE /api/skillto-v2/creator-agent/tutorial-products/{tutorial_product_key}
```

Allowed for drafts that have not been purchased/listed by the platform. If already submitted or listed, use archive/withdraw semantics according to review state.

## Article Space CRUD

### Create Article

```http
POST /api/skillto-v2/creator-agent/tutorial-products/{tutorial_product_key}/articles
```

Request:

```json
{
  "role": "prompt_manual",
  "title": "布光推理提示词手册",
  "parent_article_key": null,
  "sort_order": 20
}
```

Rules:

- Max directory depth is 3.
- Article titles are human semantic names.
- The server manages article slugs and Docmost document ids.

### Update Article Metadata

```http
PATCH /api/skillto-v2/creator-agent/tutorial-products/{tutorial_product_key}/articles/{article_key}
```

Allowed fields:

- `title`
- `role`
- `parent_article_key`
- `sort_order`
- `visibility_state`

### Delete Article

```http
DELETE /api/skillto-v2/creator-agent/tutorial-products/{tutorial_product_key}/articles/{article_key}
```

Directories with children must not be deleted until children are moved or removed.

### Save Article Content

```http
POST /api/skillto-v2/creator-agent/tutorial-products/{tutorial_product_key}/articles/{article_key}/content
```

Request should use sanitized Docmost/Tiptap JSON as the primary format. Markdown is only a compatibility input; tutorial-product authoring skills should generate the final `document` payload directly so the human creator-center editor can reopen the article.

```json
{
  "format": "docmost_json",
  "document": {
    "type": "doc",
    "content": [
      {
        "type": "heading",
        "attrs": { "level": 2 },
        "content": [{ "type": "text", "text": "课程目标" }]
      },
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "---以下内容免费---" }]
      },
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "这里是公开试看内容。" }]
      },
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "----以下内容付费----" }]
      },
      {
        "type": "image",
        "attrs": {
          "src": "/upload/creator/lighting-infographic.png",
          "alt": "布光推理教案信息图"
        }
      }
    ]
  },
  "assets": [
    {
      "asset_key": "asset_intro_infographic",
      "placement": "after_first_section",
      "alt": "布光推理教案简介信息图"
    }
  ],
  "paywall_markers": {
    "free_marker": "---以下内容免费---",
    "paid_marker": "----以下内容付费----"
  }
}
```

Server responsibilities:

- Validate Docmost-compatible rich document content. If markdown is submitted for compatibility, convert it to the same `{"type":"doc","content":[...]}` document shape before saving.
- Sanitize and normalize public rendering.
- Save the product preview draft.
- Track article readiness without exposing revision internals.
- Recognize `---以下内容免费---` and `----以下内容付费----` as public paywall markers.

Allowed document nodes should follow the project’s vendored Docmost/Tiptap editor and the existing rich-text custom page implementation: `doc`, `heading`, `paragraph`, `text`, `bulletList`, `orderedList`, `listItem`, `blockquote`, `horizontalRule`, `image`, `video`, `audio`, `attachment`, `details`, and table-related nodes when supported by the editor. The final saved snapshot must be reloadable by the human Docmost editor; do not store a custom wrapper such as `{"type":"docmost_markdown","body":"..."}` as the article document.

## Media Capabilities

### Upload Media Binary

```http
POST /api/skillto-v2/creator-agent/tutorial-products/{tutorial_product_key}/media/uploads
```

Use `multipart/form-data`, not JSON:

```text
file=@lighting-tutorial-intro-vertical.png
kind=article_image
alt=布光推理教案简介信息图
```

Authentication remains the same `Authorization: Bearer skap_...`; scope must include `tutorial_product:media_write`.

Allowed `kind` values:

- `article_image`
- `article_video`
- `article_audio`
- `cover`
- `hero`
- `hero_video`

The platform validates the binary media type and stores it under a stable public site-relative `/upload/...` URL. Image uploads allow up to 20 MB, video up to 200 MB, and audio up to 60 MB. Video responses may include `poster_url` when the generated poster is ready.

Response example:

```json
{
  "asset_key": "asset_4e4c7e2b1c3d4f5a6b7c8d9e",
  "kind": "article_image",
  "media_type": "image",
  "url": "/upload/images/260819/abc123/abc123.png",
  "filename": "lighting-tutorial-intro-vertical.png",
  "content_type": "image/png",
  "size": 284931,
  "width": 1440,
  "height": 2880,
  "alt": "布光推理教案简介信息图"
}
```

Use `url` in the article document immediately:

```json
{
  "type": "image",
  "attrs": {
    "src": "/upload/images/260819/abc123/abc123.png",
    "alt": "布光推理教案简介信息图"
  }
}
```

`asset_key` is for the Agent's local record only. The human creator UI must not show it. Do not submit local paths, `data:` URLs, guessed `/gen/*` URLs, or external temporary links as article media.

### Register an Existing Media URL (Compatibility)

```http
POST /api/skillto-v2/creator-agent/tutorial-products/{tutorial_product_key}/media
Content-Type: application/json
```

This older endpoint registers an existing `http(s)` or site-relative URL. It does not upload bytes and should only be used when the asset is already known to be publicly reachable.

## Preview and Review

### Save Preview Draft

```http
POST /api/skillto-v2/creator-agent/tutorial-products/{tutorial_product_key}/preview
```

Returns:

- `preview_url`
- article readiness summary
- missing fields
- public rendering warnings

### Prepare Procurement Review Packet

```http
POST /api/skillto-v2/creator-agent/tutorial-products/{tutorial_product_key}/review-packet
```

This prepares the packet but does not submit it.

The packet should include:

- product name and intro
- price points
- article completeness
- media completeness
- preview URL
- creator declaration
- SkillTo.ai procurement agreement text in Chinese and English

### Submit Procurement Review

```http
POST /api/skillto-v2/creator-agent/tutorial-products/{tutorial_product_key}/review-submissions
```

Only call this endpoint after the Agent has opened `creator_review_url` and the creator has explicitly confirmed the human creator-center page and procurement agreement. Required request fields:

```json
{
  "accepted_procurement_agreement": true,
  "accepted_settlement_delay": true,
  "accepted_platform_after_sales": true,
  "signature_display_name": "Creator Name"
}
```

Behavior:

- Validates at least one article has a saved preview version.
- Validates price, cover/media, preview draft, and procurement agreement confirmation.
- Creates or reuses a product revision.
- Creates a `skillto_commerce_review_submissions` record.
- Sets product state to `under_review`.
- Does not list or publish the product; platform reviewers are the only listing path.

## Procurement Agreement Copy

Chinese summary:

SkillTo.ai 是 B2C 平台，不支持创作者与普通用户之间的 C2C 直接交易。创作者提交商品后，即表示同意在审核通过时由 SkillTo.ai 采购该商品并作为平台自营商品向普通用户销售。SkillTo.ai 提供售后支持、信用担保与交易保障；商品结算存在 1 周账期作为保障金，用于处理退款、质量争议和售后风险。

English summary:

SkillTo.ai operates as a B2C platform and does not support direct C2C transactions between creators and end users. By submitting a product, the creator agrees that, upon approval, SkillTo.ai may purchase the product and sell it as platform-operated inventory. SkillTo.ai provides after-sales support, credit assurance, and transaction protection. Settlement is delayed by one week as a reserve for refunds, quality disputes, and support risk.

## Capability Checklist

The skill should be able to:

- turn a product idea into a tutorial product brief
- generate the standard four-article structure
- produce Docmost-ready article copy
- generate an imagegen prompt for the intro long infographic
- register generated media as product assets
- create, read, update, delete, or archive tutorial product drafts
- create, update, sort, and delete article nodes
- save article content as a preview draft
- check readiness for procurement review
- prepare review packet copy in Chinese and English
- avoid direct publishing or human-facing technical fields
