const { SkillTo } = window;

let hostState = {};
let context = { locale: "zh-CN" };

init().catch(() => renderEmpty());

async function init() {
  try {
    context = await SkillTo.context.get();
  } catch {
    context = { locale: navigator.language || "zh-CN" };
  }
  localize(context.locale);
  SkillTo.host.onUpdate((nextState) => {
    hostState = nextState || {};
    render();
  });
  try {
    const reasoning = await SkillTo.state.get("reasoning_result");
    if (reasoning) hostState = { ...hostState, reasoning };
  } catch {
    // Static preview mode may not have persisted state yet.
  }
  render();
}

function render() {
  const result = normalizeResult(hostState);
  if (!result) {
    renderEmpty();
    return;
  }
  renderList("inputSummary", result.reasoning.input_summary, result.materials);
  renderList("sceneInference", result.reasoning.scene_reference_inference, result.materials);
  renderList("storySetting", result.reasoning.shot_setting, result.materials);
  renderList("emotionAnalysis", result.reasoning.emotion_analysis, result.materials);
  renderBranches(result.reasoning.lighting_logic);
  renderTags(result.tags);
  renderPrompt(result.modified_prompt, result.materials);
}

function normalizeResult(state) {
  const metadata = state.result?.metadata || state.reasoning || {};
  const reasoning = metadata.reasoning || metadata;
  const modifiedPrompt = state.result?.modified_prompt || state.currentPrompt || "";
  const normalized = {
    materials: Array.isArray(state.materials) ? state.materials : [],
    modified_prompt: modifiedPrompt,
    reasoning: {
      emotion_analysis: stringArray(reasoning.emotion_analysis),
      input_summary: stringArray(reasoning.input_summary),
      lighting_logic: logicArray(reasoning.lighting_logic || reasoning.logic_branches).slice(0, 5),
      scene_reference_inference: stringArray(reasoning.scene_reference_inference || reasoning.scene_inference),
      shot_setting: stringArray(reasoning.shot_setting || reasoning.story_setting)
    },
    tags: stringArray(metadata.tags || reasoning.classic_lighting_tags || reasoning.tags).slice(0, 8)
  };
  if (!normalized.modified_prompt || normalized.reasoning.lighting_logic.length < 1) return null;
  return normalized;
}

function renderList(id, items, materials) {
  const target = document.getElementById(id);
  target.innerHTML = "";
  for (const item of (items.length ? items : ["-"]).slice(0, 6)) {
    const li = document.createElement("li");
    appendInlineAssets(li, item, materials);
    target.appendChild(li);
  }
}

function renderBranches(items) {
  const target = document.getElementById("logicBranches");
  target.innerHTML = "";
  const branches = items.length ? items.slice(0, 5) : [{ title: "-", detail: "-" }];
  target.style.setProperty("--branch-count", String(branches.length));
  for (const [index, item] of branches.entries()) {
    const branch = document.createElement("article");
    branch.className = "branch";
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const title = document.createElement("strong");
    title.textContent = item.title || text("Lighting logic", "布光逻辑");
    const detail = document.createElement("p");
    appendInlineAssets(detail, item.detail || "", []);
    branch.append(number, title, detail);
    target.appendChild(branch);
  }
}

function renderTags(tags) {
  const target = document.getElementById("tagList");
  target.innerHTML = "";
  for (const tag of tags.length ? tags : [text("emotional lighting", "情绪布光")]) {
    const span = document.createElement("span");
    span.textContent = tag;
    target.appendChild(span);
  }
}

function renderPrompt(prompt, materials) {
  const target = document.getElementById("modifiedPrompt");
  target.innerHTML = "";
  const lines = String(prompt || "").split(/(?<=[。；!?！？;])/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines.length ? lines : [prompt]) {
    const p = document.createElement("p");
    appendInlineAssets(p, line, materials);
    target.appendChild(p);
  }
}

function appendInlineAssets(target, text, materials) {
  const materialByToken = new Map((materials || []).map((item) => [item.token, item]));
  const pattern = /\{\{(?:image|mixed|video|audio)_\d+\}\}/g;
  let offset = 0;
  const value = String(text || "");
  for (const match of value.matchAll(pattern)) {
    if (match.index > offset) target.appendChild(document.createTextNode(value.slice(offset, match.index)));
    target.appendChild(createAssetToken(materialByToken.get(match[0]), match[0]));
    offset = match.index + match[0].length;
  }
  if (offset < value.length || !target.childNodes.length) target.appendChild(document.createTextNode(value.slice(offset)));
}

function createAssetToken(asset, token) {
  if (!asset) return document.createTextNode(token);
  const label = asset.label || asset.token || token;
  const wrapper = document.createElement("span");
  wrapper.className = "asset-token";
  wrapper.title = label;
  if (asset.thumbnailUrl || asset.url) {
    const img = document.createElement("img");
    img.alt = label;
    img.src = asset.thumbnailUrl || asset.url;
    wrapper.appendChild(img);
    const preview = document.createElement("span");
    preview.className = "asset-token__preview";
    const previewImg = document.createElement("img");
    previewImg.alt = label;
    previewImg.src = asset.url || asset.thumbnailUrl;
    preview.appendChild(previewImg);
    wrapper.appendChild(preview);
  } else {
    wrapper.textContent = token.match(/\d+/)?.[0] || "□";
  }
  return wrapper;
}

function renderEmpty() {
  renderList("inputSummary", [text("Run Skill lighting reasoning in the panel first.", "请先在面板中运行 Skill推理布光。")], []);
  renderList("sceneInference", ["-"], []);
  renderList("storySetting", ["-"], []);
  renderList("emotionAnalysis", ["-"], []);
  renderBranches([]);
  renderTags([]);
  renderPrompt("", []);
}

function localize(locale) {
  const zh = locale && locale.toLowerCase().startsWith("zh");
  document.documentElement.lang = zh ? "zh-CN" : "en-US";
  document.querySelectorAll("[data-i18n-zh]").forEach((node) => {
    node.textContent = zh ? node.dataset.i18nZh : node.dataset.i18nEn;
  });
}

function text(en, zh) {
  return context.locale && context.locale.toLowerCase().startsWith("zh") ? zh : en;
}

function stringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function logicArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "object" && item) {
      return {
        detail: String(item.detail || item.reason || item.text || "").trim(),
        title: String(item.title || item.name || "").trim()
      };
    }
    return { detail: String(item || "").trim(), title: "" };
  }).filter((item) => item.detail || item.title);
}
