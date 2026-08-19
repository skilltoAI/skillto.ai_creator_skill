# SkillTo Tutorial Product Authoring

Use this skill when the user wants to design, write, revise, or maintain a SkillTo.ai tutorial product through an agent-facing workflow. This skill is for Agent/API operations only; it must not change or expose the existing human creator CRUD UI. This skill has no CLI requirement: call the SkillTo.ai Creator Agent HTTP API directly with a `skap_` key.

## Core Boundary

SkillTo.ai has two separate product surfaces:

- Human creator center: user-friendly UI for ordinary UGC creators. Do not expose database ids, slugs, Docmost page ids, Docmost URLs, HTML, JSON, revision payloads, storage keys, or other technical fields.
- Creator Agent/API channel: machine-facing workflow for drafting, syncing, previewing, and preparing tutorial products. This channel may operate on structured rich document payloads and opaque resource keys through `/api/skillto-v2/creator-agent/tutorial-products`.

When applying this skill, keep the human UI unchanged unless the user explicitly asks to modify it. Use agent-safe language such as "教案", "文章", "目录", "商品预览稿", "采购审核材料", and "前台预览".

## Required References

Read these references before writing or designing a tutorial product:

- `references/api-contract.md` for the agent CRUD interface and capability design.
- `references/tutorial-article-playbook.md` for article-space structure, Docmost formatting, paywall markers, and imagegen infographic rules.

If the request involves generating the intro infographic, also use `$imagegen` and save the generated image into the active project workspace before referencing it in the article content.

## Standard Workflow

1. Clarify the tutorial product subject in one sentence: the audience, professional domain, promised outcome, and the Skill or workflow being sold.
2. Build the product brief:
   - 教案名称
   - 一句话介绍
   - 目标用户
   - 可交付成果
   - 适用模型 or software stack
   - price points if known
   - material list: cover, long infographic, screenshots, example outputs, downloadable Skill package
3. Create the article space with the standard four articles:
   - `XXX教案简介`
   - `XXX提示词手册`
   - `开箱即用的Skill`
   - `Skill的下载和安装`
4. Generate or draft each article as Docmost/Tiptap JSON rich content first. Body content must not duplicate the H1 title; start with H2/H3 sections. Markdown may be used as a planning format, but the API payload should submit `format: "docmost_json"` with a `document` shaped like `{"type":"doc","content":[...]}`.
5. Place the free marker and paid marker intentionally:
   - `---以下内容免费---`
   - `----以下内容付费----`
6. Generate the intro long infographic prompt with the `$imagegen` conventions from the playbook. Use a vertical 1:2 premium editorial format, save the generated file locally, then upload it with `POST /tutorial-products/:tutorial_product_key/media/uploads` as `multipart/form-data` using `kind=article_image`. Keep the returned `/upload/...` URL for the Docmost image node.
7. Prepare agent CRUD calls only through the dedicated Creator Agent API:
   - `POST /api/skillto-v2/creator-agent/tutorial-products`
   - `POST /tutorial-products/:tutorial_product_key/media/uploads`
   - `POST /tutorial-products/:tutorial_product_key/articles/:article_key/content`
   - `POST /tutorial-products/:tutorial_product_key/preview`
   - `POST /tutorial-products/:tutorial_product_key/review-packet`
   - `POST /tutorial-products/:tutorial_product_key/review-submissions`
8. Save or update the product preview draft. Treat this as a preview/review artifact, not a direct publishing action. The saved article content must reopen in the human Docmost editor; do not submit wrapper formats such as `{"type":"docmost_markdown","body":"..."}` as the final document snapshot.
9. Return both the public preview URL and `creator_review_url` to the creator, then help open the human creator-center page at `creator_review_url` so the creator can inspect the ordinary UI result. Do not submit review while the creator has not checked the human page.
10. Only after the creator explicitly confirms the human page and procurement consent/contract, call the review submission endpoint. The result should appear in `/account/creator/tutorials` as an Agent-created tutorial product with procurement review status.

## Writing Standards

- Tone: professional, precise, design-aware, and cinematic when relevant. Avoid shallow marketing claims.
- Layout: premium editorial rhythm, short paragraphs, clear figure captions, callouts, comparison tables, and reusable prompt cards.
- Document format: final article payloads should be Docmost/Tiptap JSON (`doc`, `heading`, `paragraph`, `bulletList`, `orderedList`, `listItem`, `blockquote`, `image`, `video`, `audio`, `attachment`, `horizontalRule`, `table` where supported). Keep the paywall markers as normal paragraph text so the platform can project free and paid sections.
- Model guidance: explicitly explain model selection, input references, aspect ratio, duration, prompt sensitivity, iteration strategy, and safety limits.
- Skill delivery: make the "开箱即用的Skill" article concrete enough that a user can understand the Skill inputs, outputs, panels, and expected workflow.
- Installation: write the download and install article as a calm operational checklist, including validation, troubleshooting, and version notes.

## Agent Safety Rules

- Do not expose or request raw `id`, `slug`, `public_slug`, `article_slug`, Docmost Page ID, Docmost URLs, HTML, JSON, or revision payloads in user-facing copy.
- Do not create a second human title system when Docmost already owns the article title. In product copy, refer to article titles semantically.
- Do not publish or list a product directly. Creators submit procurement review; SkillTo.ai reviewers decide whether to purchase and list the product as platform-operated inventory.
- Do not claim a product has passed review or is live unless the API state confirms it.
- Do not submit secrets, private keys, unlicensed assets, or inaccessible local paths as public article media.

## Creator Agent Key Storage

The production Creator Agent key is a local secret. Keep it in the active project root's ignored `.env` file rather than in product content, article payloads, shell history, or source control.

- The bundled tutorial script loads `SKILLTO_CREATOR_API_KEY` from the process environment first, then from `.env`.
- To persist a key intentionally, run the script once with `--store-api-key`; it updates only `SKILLTO_CREATOR_API_KEY` in `.env` and does not print the secret.
- Never commit `.env`, include the key in a preview, or send it through the Creator Agent API as article or media content.
- For a local source image, video, or audio file, use the Creator Agent binary media endpoint. Send the file as `multipart/form-data` to `/api/skillto-v2/creator-agent/tutorial-products/{tutorial_product_key}/media/uploads` with `kind` and optional `alt`; write the returned `/upload/...` URL into the Docmost JSON. Never substitute a local path, `data:` URL, guessed `/gen/*` path, or temporary external link in production.
