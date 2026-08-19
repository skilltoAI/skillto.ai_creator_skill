#!/usr/bin/env node

import { basename, resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const envFile = resolve(args["env-file"] || ".env");
const projectEnv = loadDotenv(envFile);
const apiKey = args["api-key"] || process.env.SKILLTO_CREATOR_API_KEY || projectEnv.SKILLTO_CREATOR_API_KEY;

if (args["store-api-key"]) {
  if (!apiKey || !apiKey.startsWith("skap_")) {
    console.error("Missing a valid Creator Agent key to store.");
    process.exit(1);
  }
  saveDotenvValue(envFile, "SKILLTO_CREATOR_API_KEY", apiKey);
}

if ((!apiKey || !apiKey.startsWith("skap_")) && !args["dry-run"]) {
  console.error("Missing SKILLTO_CREATOR_API_KEY. Set it in the environment or the project .env file.");
  process.exit(1);
}

const baseURL = args["base-url"] || process.env.SKILLTO_BASE_URL || projectEnv.SKILLTO_BASE_URL || "https://www.skillto.ai";
const imagePath = args.image ? resolve(args.image) : null;
const imageURL = normalizePublicURL(args["image-url"]);
if (!args["dry-run"] && imagePath && !imageURL) {
  console.error("A public HTTPS --image-url is required for production article media. The Creator Agent media endpoint only registers public URLs and cannot upload local files.");
  process.exit(1);
}
const imageFilename = imagePath ? basename(imagePath) : imageURL ? basename(new URL(imageURL).pathname) : "lighting-tutorial-infographic.png";
const imageAlt = "推理布光 Skill 图文教程信息图";

const product = {
  name: `Mock 推理布光 Skill 图文教程 ${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "")}`,
  intro: "从故事情绪推导可执行光位，让 AI 影像创作的布光、画面层次和提示词结构都有依据。",
  locale: "zh-CN",
  audience: "AI 影像创作者、商业摄影师、短片导演、视觉设计师",
  price_currency: "CNY",
  list_price_cents: 19800,
  sale_price_cents: 1787,
  gift_points: 0,
  tags: ["lighting", "cinematic", "prompt", "tutorial", "skill"],
  target_models: ["Midjourney", "Seedance", "GPT Image", "Runway", "Pika"],
  cover_image_url: imageURL || "/images/workflow/lighting/rembrandt.webp"
};

if (args["dry-run"]) {
  const imageSrc = imageURL || imagePath || product.cover_image_url;
  const dryRun = {
    product,
    media: imagePath || imageURL
      ? {
          kind: "intro_infographic",
          source: imageURL ? "public_url" : "local_attachment",
          filename: imageFilename,
          alt: imageAlt,
          ...(imageURL ? { public_url: imageURL } : { local_path: imagePath })
        }
      : null,
    articles: buildArticleBodies(imageSrc, imageAlt)
  };
  const output = JSON.stringify(dryRun, null, 2);
  if (args.out) {
    writeFileSync(resolve(args.out), output);
  } else {
    console.log(output);
  }
  process.exit(0);
}

const created = await request("/api/skillto-v2/creator-agent/tutorial-products", {
  method: "POST",
  body: product
});

let imageSrc = product.cover_image_url;
let assetKey = null;
if (imageURL) {
  const registered = await registerAttachment(created.tutorial_product_key, imageURL);
  assetKey = registered.asset_key || registered.key || null;
  imageSrc = registered.url || registered.public_url || registered.src || registered.path || registered.media_url || imageSrc;
}

const articleBodies = buildArticleBodies(imageSrc, imageAlt);
const byRole = new Map(created.articles.map((article) => [article.role, article]));

for (const [role, body] of Object.entries(articleBodies)) {
  const article = byRole.get(role);
  if (!article) continue;
  const contentBody = {
    format: "docmost_json",
    document: markdownToDocmostDocument(body),
    paywall_markers: {
      free_marker: "---以下内容免费---",
      paid_marker: "----以下内容付费----"
    }
  };
  if (assetKey && role === "intro") {
    contentBody.assets = [{ asset_key: assetKey, placement: "after_first_section", alt: imageAlt }];
  }
  await request(`/api/skillto-v2/creator-agent/tutorial-products/${created.tutorial_product_key}/articles/${article.article_key}/content`, {
    method: "POST",
    body: contentBody
  });
}

const preview = await request(`/api/skillto-v2/creator-agent/tutorial-products/${created.tutorial_product_key}/preview`, {
  method: "POST",
  body: {}
});

let reviewPacket = null;
if (args["review-packet"] !== "false") {
  reviewPacket = await request(`/api/skillto-v2/creator-agent/tutorial-products/${created.tutorial_product_key}/review-packet`, {
    method: "POST",
    body: {}
  });
}

let submission = null;
if (args["submit-review"]) {
  if (!args["confirm-procurement"]) {
    throw new Error("Refusing to submit review without --confirm-procurement after creator-center inspection.");
  }
  submission = await request(`/api/skillto-v2/creator-agent/tutorial-products/${created.tutorial_product_key}/review-submissions`, {
    method: "POST",
    body: {
      accepted_procurement_agreement: true,
      accepted_settlement_delay: true,
      accepted_platform_after_sales: true,
      signature_display_name: args.signature || "Creator"
    }
  });
}

console.log(JSON.stringify({
  name: preview.name,
  preview_url: absoluteURL(preview.preview_url),
  product_preview_url: absoluteURL(preview.product_preview_url),
  creator_review_url: absoluteURL(preview.creator_review_url || "/account/creator/tutorials"),
  review_state: preview.review_state,
  checklist: preview.checklist,
  media: {
    filename: imageFilename,
    src: imageSrc,
    registered: Boolean(assetKey || imageURL)
  },
  review_packet_ready: Boolean(reviewPacket),
  review_submission_state: submission?.state || submission?.review_state || null
}, null, 2));

async function registerAttachment(tutorialProductKey, publicURL) {
  return request(`/api/skillto-v2/creator-agent/tutorial-products/${tutorialProductKey}/media`, {
    method: "POST",
    body: {
      kind: "intro_infographic",
      source: "public_url",
      filename: imageFilename,
      alt: imageAlt,
      license_note: "User-provided attachment for this mock tutorial product.",
      url: publicURL
    }
  });
}

function buildArticleBodies(src, alt) {
  return {
    intro: `## 这套教案解决什么问题

很多创作者知道“电影感布光”很好看，却很难把故事情绪稳定翻译成可执行的光位、光比和提示词。结果常见问题是画面有氛围但不可复现，人物情绪和光线方向互相打架，或者模型输出每次都漂移。

这套 mock 图文教程围绕“推理布光 Skill”展开：先判断角色关系与情绪，再推导主光、辅光、轮廓光和色温，最后把推理结果写成图像或视频模型可执行的 prompt。

---以下内容免费---

## 教程总览图

![${alt}](${src})

> 图注：附图展示了从故事情绪到可执行光位的完整教程结构，包括问题拆解、流程地图、模型选择、提示词结构、交付物和付费进阶预览。

## 你会获得什么

| 模块 | 你能拿走什么 | 适合谁 |
| --- | --- | --- |
| 故事情绪拆解 | 把抽象情绪转成画面任务 | AI 影像创作者 |
| 布光推理流程 | 主光、辅光、轮廓光和色温的决策路径 | 摄影师与导演 |
| 提示词手册 | 可复用的 prompt 结构和模型差异说明 | Prompt 工程师 |
| 开箱 Skill | 一套可直接使用的推理布光工作流 | AIGC 团队 |

## 学完后的交付标准

- 能从故事意图判断光线方向，而不是堆叠“cinematic lighting”。
- 能为人物、商业摄影和短片镜头分别设计光比、色温与阴影层次。
- 能输出适配 Midjourney、GPT Image、Seedance、Runway 和 Pika 的提示词。

----以下内容付费----

## 专业工作流总览

### 1. 故事意图

先确认画面在讲什么：人物是在隐藏、对抗、释然，还是被环境吞没。这个判断决定光是否应该暴露信息、制造距离，或者把观众的视线压向某个局部。

### 2. 角色与情绪

把人物状态拆成姿态、目光、动作和心理张力。布光不只照亮脸，而是决定观众如何理解角色。

### 3. 光线推理

用主光建立方向，用辅光控制可读性，用轮廓光分离主体，用环境光建立空间。每一束光都要有叙事职责。

### 4. 提示词生成

把布光判断转成模型能理解的句子：角度、强度、色温、阴影边缘、材质反射、镜头焦段和构图比例都要明确。`,

    prompt_manual: `## 先选模型，再写提示词

不同模型对光线词汇的响应并不一样。图像模型更依赖构图、材质和静态光比；视频模型还需要时间连续性、镜头运动和角色位置稳定。

| 目标 | 推荐模型 | 不推荐场景 | 注意事项 |
| --- | --- | --- | --- |
| 静态概念图 | GPT Image / Midjourney | 连续动作设计 | 强化主体位置、色温、光源方向 |
| 电影感短片 | Seedance / Runway / Pika | 需要精确文字排版 | 补充镜头运动与光线连续性 |
| 布光方案推理 | GPT class model | 直接生成最终画面 | 先输出推理表，再转 prompt |

## 提示词骨架

### 角色与目标

说明人物身份、情绪状态、动作和叙事目标。

### 视觉语言

定义构图、镜头、主光方向、辅光强度、轮廓光、色温和画面层次。

### 约束条件

写清楚不要出现的风格漂移、错误光源、过曝、脏阴影和不必要的装饰。

---以下内容免费---

## 免费示例

目标：一个角色在夜晚窗边做决定，情绪克制但紧张。

| 结构 | 示例 |
| --- | --- |
| 场景 | rainy night interior, window-side composition |
| 主光 | cool soft key light from window, 45 degrees |
| 辅光 | very low warm fill from a practical lamp |
| 阴影 | deep but readable shadows, no flat lighting |

----以下内容付费----

## 专业提示词库

### Prompt Card 01：低调悬疑

用途：人物内心冲突、侦探、秘密交易。

Low-key cinematic lighting, narrow cool key light from camera left, weak amber practical fill in the background, deep negative fill on the opposite side, clean shadow edge, sharp rim light separating the shoulder line, controlled specular highlights, tense quiet atmosphere.

### Prompt Card 02：商业质感

用途：产品海报、人物品牌照、轻奢视觉。

Controlled studio lighting, large soft key light above front-left, subtle silver bounce fill, warm background practicals, polished highlights on material surfaces, strong subject-background separation, clean composition, premium commercial photography.

### Prompt Card 03：温柔回忆

用途：人物回忆、亲密空间、低冲突情绪。

Soft golden-hour side light, gentle wrap on the face, low contrast shadows, warm ambient bounce, delicate rim on hairline, calm shallow depth of field, intimate visual rhythm, natural skin texture.`,

    ready_skill: `## 这个 Skill 能帮你做什么

推理布光 Skill 会把“故事情绪”转换成“可执行布光提示词”。用户输入角色、场景、情绪、目标模型和参考素材后，Skill 输出可复制到图像或视频模型的提示词，并附带推理依据。

## 面板与输入项

| 输入项 | 用户要填什么 | 影响结果 |
| --- | --- | --- |
| 故事情绪 | 紧张、温柔、孤独、史诗感 | 决定光比、阴影和色温 |
| 场景类型 | 棚拍、室内、外景、夜景 | 决定光源逻辑 |
| 目标模型 | Midjourney / GPT Image / Seedance | 决定提示词格式 |
| 参考素材 | 人物、场景、色彩参考 | 提高一致性 |
| 输出比例 | 1:1、3:4、9:16、16:9 | 影响构图与镜头语言 |

---以下内容免费---

## 典型使用场景

- 给短片镜头生成稳定的布光提示词。
- 给商业摄影方案快速形成灯位说明。
- 给人物海报生成可控的明暗层次。

----以下内容付费----

## 开箱工作流

1. 准备人物或场景参考图。
2. 输入画面叙事目标。
3. 选择目标模型、比例和画面风格。
4. 生成布光推理和最终 prompt。
5. 检查阴影、色温、主体分离和镜头连续性。
6. 根据失败点迭代光位或约束词。

## 输出质量检查

- 主光是否有明确方向。
- 阴影是否服务情绪，而不是吞掉主体。
- 轮廓光是否让人物从背景里分离。
- 色温是否符合故事世界观。
- 镜头焦段、景深和构图是否互相一致。
- 提示词是否避免互相冲突的光源描述。`,

    install: `## 下载前确认

| 项目 | 要求 |
| --- | --- |
| SkillTo.ai 账号 | 已登录并拥有对应购买权限 |
| 浏览器 | Chrome / Edge 最新版 |
| 可选模型权限 | Midjourney、GPT Image、Seedance 或兼容图像/视频模型 |
| 素材准备 | 人物参考、场景参考或情绪关键词 |

---以下内容免费---

## 安装流程预览

购买后，你会在商品详情页获得 Skill 包下载入口，并在 SkillTo.ai 的 Skill 管理里导入使用。首次使用建议先用一张人物半身参考图测试，确认输出是否包含光位、光比、色温和模型注意事项。

----以下内容付费----

## 下载与安装

1. 打开商品详情页。
2. 下载推理布光 Skill 包。
3. 进入 SkillTo.ai 的 Skill 管理。
4. 导入 Skill 包并确认版本。
5. 打开画布，选择推理布光 Skill。
6. 输入测试案例，生成第一版提示词。

## 验证是否安装成功

| 现象 | 表示 |
| --- | --- |
| Skill 面板能打开 | 安装成功 |
| 输入后能生成布光提示词 | 推理链路正常 |
| 输出包含模型注意事项 | 教案配置完整 |
| 能保留参考图意图 | 素材读取正常 |

## 常见问题

### 看不到 Skill

确认是否登录购买账号，并刷新 Skill 管理页。

### 输出不稳定

减少抽象形容词，增加明确的光位、角度、色温、阴影边缘和构图约束。

### 素材无法读取

检查素材格式、文件大小和浏览器权限，必要时重新上传压缩后的参考图。`
  };
}

function markdownToDocmostDocument(markdown) {
  const content = [];
  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length) {
        const itemLine = lines[index].trim();
        if (!/^\d+\.\s+/.test(itemLine)) break;
        items.push({ type: "listItem", content: [paragraphNode(itemLine.replace(/^\d+\.\s+/, ""))] });
        index += 1;
      }
      index -= 1;
      content.push({ type: "orderedList", content: items });
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items = [];
      while (index < lines.length) {
        const itemLine = lines[index].trim();
        if (!itemLine.startsWith("- ") && !itemLine.startsWith("* ")) break;
        items.push({ type: "listItem", content: [paragraphNode(itemLine.slice(2).trim())] });
        index += 1;
      }
      index -= 1;
      content.push({ type: "bulletList", content: items });
      continue;
    }
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      content.push({ type: "image", attrs: { src: imageMatch[2].trim(), alt: imageMatch[1].trim() } });
      continue;
    }
    if (line.startsWith("> ")) {
      content.push({ type: "blockquote", content: [paragraphNode(line.slice(2).trim())] });
      continue;
    }
    if (line.startsWith("#### ")) {
      content.push(headingNode(line.slice(5).trim(), 4));
    } else if (line.startsWith("### ")) {
      content.push(headingNode(line.slice(4).trim(), 3));
    } else if (line.startsWith("## ")) {
      content.push(headingNode(line.slice(3).trim(), 2));
    } else if (line === "---" || line === "----") {
      content.push({ type: "horizontalRule" });
    } else if (/^\|.*\|$/.test(line)) {
      const table = readMarkdownTable(lines, index);
      if (table.node) content.push(table.node);
      index = table.nextIndex - 1;
    } else {
      content.push(paragraphNode(line));
    }
  }
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

function headingNode(text, level) {
  return { type: "heading", attrs: { level }, content: textContent(text) };
}

function paragraphNode(text) {
  return text ? { type: "paragraph", content: textContent(text) } : { type: "paragraph" };
}

function textContent(text) {
  return [{ type: "text", text }];
}

function readMarkdownTable(lines, startIndex) {
  const rows = [];
  let index = startIndex;
  while (index < lines.length && /^\|.*\|$/.test(lines[index].trim())) {
    const rowLine = lines[index].trim();
    if (!/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(rowLine)) {
      rows.push(rowLine.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
    }
    index += 1;
  }
  if (!rows.length) return { node: null, nextIndex: index };
  return {
    node: {
      type: "table",
      content: rows.map((cells, rowIndex) => ({
        type: "tableRow",
        content: cells.map((cell) => ({
          type: rowIndex === 0 ? "tableHeader" : "tableCell",
          content: [paragraphNode(cell)]
        }))
      }))
    },
    nextIndex: index
  };
}

function request(path, { method = "GET", body } = {}) {
  const url = `${baseURL}${path}`;
  const curlArgs = [
    "-sS",
    "-L",
    "--fail-with-body",
    "-X",
    method,
    url,
    "-H",
    `Authorization: Bearer ${apiKey}`,
    "-H",
    "Accept: application/json",
    "-H",
    "Content-Type: application/json",
    "-H",
    "User-Agent: SkillTo.ai Creator Agent"
  ];
  if (body !== undefined) curlArgs.push("--data-binary", JSON.stringify(body));
  return runCurl(curlArgs).then((text) => {
    const payload = JSON.parse(text);
    if (!payload.success) throw new Error(payload.message || text);
    return payload.data;
  });
}

function runCurl(curlArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn("curl", curlArgs, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `curl exited with ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function loadDotenv(filePath) {
  if (!existsSync(filePath)) return {};
  const values = {};
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const delimiter = line.indexOf("=");
    if (delimiter < 1) continue;
    const key = line.slice(0, delimiter).trim();
    const value = line.slice(delimiter + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
    values[key] = value;
  }
  return values;
}

function saveDotenvValue(filePath, key, value) {
  const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const entry = `${key}=${value}`;
  const expression = new RegExp(`^${escapeRegExp(key)}=.*$`, "m");
  const next = expression.test(existing)
    ? existing.replace(expression, entry)
    : `${existing}${existing && !existing.endsWith("\n") ? "\n" : ""}${entry}\n`;
  writeFileSync(filePath, next, { encoding: "utf8", mode: 0o600 });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePublicURL(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("Only HTTPS media URLs are supported.");
    return url.toString();
  } catch (error) {
    console.error(`Invalid --image-url: ${error.message}`);
    process.exit(1);
  }
}

function absoluteURL(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${baseURL}${path}`;
}
