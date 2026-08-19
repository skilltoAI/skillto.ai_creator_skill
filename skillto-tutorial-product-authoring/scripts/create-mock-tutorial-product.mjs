#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access } from "node:fs/promises";

const apiKey = process.env.SKILLTO_CREATOR_API_KEY;
if (!apiKey || !apiKey.startsWith("skap_")) {
  console.error("Missing SKILLTO_CREATOR_API_KEY=skap_xxx");
  process.exit(1);
}

const baseURL = process.env.SKILLTO_BASE_URL || "https://www.skillto.ai";
const introMediaPath = process.env.SKILLTO_TUTORIAL_INTRO_MEDIA_PATH || "";
const fallbackIntroMediaURL = "/images/workflow/lighting/rembrandt.webp";

const product = {
  name: `Mock 光影叙事提示词教案 ${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "")}`,
  intro: "把故事情绪、镜头语言和模型提示词组织成可执行的光影创作流程。",
  locale: "zh-CN",
  audience: "AI 影像创作者、商业摄影师、短片导演、AIGC 内容团队",
  price_currency: "CNY",
  list_price_cents: 19800,
  sale_price_cents: 1787,
  gift_points: 0,
  tags: ["lighting", "cinematic", "prompt", "skill"],
  target_models: ["Seedance", "GPT Image", "Midjourney"],
  cover_image_url: fallbackIntroMediaURL
};

const articleBodies = {
  intro: `## 这套教案解决什么问题

AI 影像创作最难的部分，往往不是写出漂亮形容词，而是把故事的情绪、角色关系和镜头任务翻译成可执行的光线结构。

这套教案用影视布光的思路拆解提示词：先判断叙事关系，再选择主光、辅光、轮廓光和环境光，最后把它们变成模型能稳定理解的描述。

![光影叙事提示词教案信息图](__INTRO_MEDIA_URL__)

---以下内容免费---

## 你会获得什么

| 模块 | 你能拿走什么 | 适合谁 |
| --- | --- | --- |
| 光影判断框架 | 从故事目标推导光位、光比和色温 | 影像创作者 |
| 提示词手册 | 可复用的光线 prompt 骨架和模型注意事项 | Prompt 工程师 |
| 开箱 Skill | 直接生成布光提示词的工作流 | AIGC 团队 |
| 安装说明 | 下载、导入、验证和排错流程 | 创作者工作室 |

## 学完后的交付标准

- 能把“压抑、神秘、温柔、疏离”等情绪转为具体光线设计。
- 能区分 GPT Image、Midjourney、Seedance 在光影提示上的敏感点。
- 能输出可以直接进入图像或视频模型的成套提示词。

----以下内容付费----

## 专业工作流总览

### 1. 叙事判断

先判断画面的主冲突：角色是在靠近、逃离、观察还是被观察。这个判断决定光从哪里来，也决定阴影应该保护什么信息。

### 2. 光位设计

用主光建立方向，用辅光控制可读性，用轮廓光分离主体，用环境光建立世界观。不要把所有光都写成“cinematic lighting”，而要说明它们各自承担的任务。

### 3. 模型翻译

把影视语言翻译成模型友好的句子：角度、强度、颜色、阴影边缘、空间反射和镜头限制都要明确。`,

  prompt_manual: `## 先选模型，再写提示词

不同模型对光线词汇的响应不同。图像模型更吃“画面结构”和“材质反射”，视频模型更吃“时间连续性”和“镜头运动下的光线稳定”。

| 目标 | 推荐模型 | 不推荐场景 | 注意事项 |
| --- | --- | --- | --- |
| 静态概念图 | GPT Image / Midjourney | 复杂连续动作 | 强化构图、色温和材质 |
| 短视频镜头 | Seedance / Veo class model | 需要精确文字排版 | 加入镜头运动和光线连续性 |
| 文案推理 | GPT class model | 直接生成最终画面 | 先产出布光方案再转 prompt |

---以下内容免费---

## 免费示例

目标：一个角色在雨夜窗边做决定，情绪克制但紧张。

提示词骨架：

- 场景：rainy night interior, window-side composition
- 主光：cool soft key light from window, 45 degrees
- 辅光：very low warm fill from practical lamp
- 阴影：deep but readable shadows, no flat lighting

----以下内容付费----

## 专业提示词库

### Prompt Card 01：低调悬疑

用途：人物内心冲突、侦探、秘密交易。

完整提示词：

Low-key cinematic lighting, narrow cool key light from camera left, weak amber practical fill in the background, deep negative fill on the opposite side, sharp rim light separating the shoulder line, controlled specular highlights, tense quiet atmosphere.

模型注意：

- Seedance 需要补充镜头运动和光线连续性。
- GPT Image 需要补充画面比例与主体位置。
- Midjourney 容易把阴影做脏，需要加入 clean shadow edge。`,

  ready_skill: `## 这个 Skill 能帮你做什么

这个 Skill 把“故事情绪”转成“可执行布光提示词”。你输入角色、场景、情绪、参考图和目标模型，它输出可直接复制到图像或视频模型里的提示词。

## 面板与输入项

| 输入项 | 用户要填什么 | 影响结果 |
| --- | --- | --- |
| 故事情绪 | 紧张、温柔、疏离、史诗感 | 决定光比和色温 |
| 场景类型 | 室内、外景、棚拍、夜景 | 决定光源逻辑 |
| 目标模型 | Seedance / GPT Image / Midjourney | 决定提示词格式 |
| 参考素材 | 人物、场景、色彩参考 | 决定一致性约束 |

---以下内容免费---

## 典型使用场景

- 给短片镜头生成稳定的布光提示词。
- 给商品视觉做情绪化光线方案。
- 给人物海报生成可控的明暗层次。

----以下内容付费----

## 开箱工作流

1. 准备人物或场景参考。
2. 输入画面叙事目标。
3. 选择目标模型和比例。
4. 生成布光提示词。
5. 检查阴影、色温、主体分离和镜头连续性。

## 输出质量检查

- 主光是否有方向。
- 阴影是否服务情绪。
- 轮廓光是否让主体从背景里分离。
- 色温是否符合故事世界观。
- 提示词是否避免互相冲突的光源描述。`,

  install: `## 下载前确认

| 项目 | 要求 |
| --- | --- |
| SkillTo.ai 账号 | 已登录并拥有使用权限 |
| 浏览器 | Chrome / Edge 最新版 |
| 可选模型权限 | Seedance、GPT Image 或兼容图像/视频模型 |

---以下内容免费---

## 安装流程预览

购买后，你会在商品详情页获得 Skill 包下载入口，并在 SkillTo.ai 的 Skill 管理里导入使用。

----以下内容付费----

## 下载与安装

1. 打开商品详情页。
2. 下载 Skill 包。
3. 进入 SkillTo.ai Skill 管理。
4. 导入 Skill 包并确认版本。
5. 打开画布，选择光影叙事提示词 Skill。
6. 输入测试案例，生成第一版提示词。

## 验证是否安装成功

| 现象 | 表示 |
| --- | --- |
| Skill 面板能打开 | 安装成功 |
| 输入后能生成布光提示词 | 推理链路正常 |
| 输出包含模型注意事项 | 教案配置完整 |

## 常见问题

### 看不到 Skill

确认是否登录购买账号，并刷新 Skill 管理页。

### 输出不稳定

减少抽象形容词，增加明确的光位、角度、色温和阴影约束。`
};

function request(path, { method = "GET", body } = {}) {
  const url = `${baseURL}${path}`;
  const args = [
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
    "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
  ];
  if (body !== undefined) {
    args.push("--data-binary", JSON.stringify(body));
  }
  return runCurl(args).then((text) => {
    const payload = JSON.parse(text);
    if (!payload.success) {
      throw new Error(payload.message || text);
    }
    return payload.data;
  });
}

function runCurl(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("curl", args, { windowsHide: true });
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

async function uploadTutorialMedia(tutorialProductKey, filePath, kind, alt) {
  await access(filePath);
  const text = await runCurl([
    "-sS",
    "-L",
    "--fail-with-body",
    "-X",
    "POST",
    `${baseURL}/api/skillto-v2/creator-agent/tutorial-products/${tutorialProductKey}/media/uploads`,
    "-H",
    `Authorization: Bearer ${apiKey}`,
    "-H",
    "Accept: application/json",
    "-F",
    `file=@${filePath}`,
    "-F",
    `kind=${kind}`,
    "-F",
    `alt=${alt}`,
    "-H",
    "User-Agent: SkillTo-Tutorial-Product-Authoring/1.0"
  ]);
  const payload = JSON.parse(text);
  if (!payload.success || !payload.data?.url) {
    throw new Error(payload.message || "tutorial media upload failed");
  }
  return payload.data;
}

const created = await request("/api/skillto-v2/creator-agent/tutorial-products", {
  method: "POST",
  body: product
});

let introMediaURL = fallbackIntroMediaURL;
if (introMediaPath) {
  const uploaded = await uploadTutorialMedia(
    created.tutorial_product_key,
    introMediaPath,
    "cover",
    "光影叙事提示词教案信息图"
  );
  introMediaURL = uploaded.url;
}

const byRole = new Map(created.articles.map((article) => [article.role, article]));
for (const [role, body] of Object.entries(articleBodies)) {
  const article = byRole.get(role);
  if (!article) continue;
  await request(`/api/skillto-v2/creator-agent/tutorial-products/${created.tutorial_product_key}/articles/${article.article_key}/content`, {
    method: "POST",
    body: {
      format: "docmost_json",
      document: markdownToDocmostDocument(body.replaceAll("__INTRO_MEDIA_URL__", introMediaURL)),
      paywall_markers: {
        free_marker: "---以下内容免费---",
        paid_marker: "----以下内容付费----"
      }
    }
  });
}

function markdownToDocmostDocument(markdown) {
  const content = [];
  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items = [];
      while (index < lines.length) {
        const itemLine = lines[index].trim();
        if (!itemLine.startsWith("- ") && !itemLine.startsWith("* ")) break;
        items.push({
          type: "listItem",
          content: [paragraphNode(itemLine.slice(2).trim())],
        });
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
    if (line.startsWith("#### ")) {
      content.push(headingNode(line.slice(5).trim(), 4));
    } else if (line.startsWith("### ")) {
      content.push(headingNode(line.slice(4).trim(), 3));
    } else if (line.startsWith("## ")) {
      content.push(headingNode(line.slice(3).trim(), 2));
    } else if (line.startsWith("# ")) {
      content.push(headingNode(line.slice(2).trim(), 2));
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
  const node = {
    type: "table",
    content: rows.map((cells, rowIndex) => ({
      type: "tableRow",
      content: cells.map((cell) => ({
        type: rowIndex === 0 ? "tableHeader" : "tableCell",
        content: [paragraphNode(cell)],
      })),
    })),
  };
  return { node, nextIndex: index };
}

const preview = await request(`/api/skillto-v2/creator-agent/tutorial-products/${created.tutorial_product_key}/preview`, {
  method: "POST",
  body: {}
});

const creatorReviewURL = preview.creator_review_url
  ? `${baseURL}${preview.creator_review_url}`
  : `${baseURL}/account/creator/tutorials`;

console.log(JSON.stringify({
  tutorial_product_key: preview.tutorial_product_key,
  name: preview.name,
  preview_url: `${baseURL}${preview.preview_url}`,
  product_preview_url: `${baseURL}${preview.product_preview_url}`,
  creator_review_url: creatorReviewURL,
  review_state: preview.review_state,
  checklist: preview.checklist
}, null, 2));
