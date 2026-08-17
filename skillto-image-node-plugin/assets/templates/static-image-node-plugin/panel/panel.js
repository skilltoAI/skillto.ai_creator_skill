const { SkillTo } = window;

const state = {
  assets: [],
  context: { locale: "zh-CN" },
  metadata: null,
  prompt: ""
};

const els = {
  assetList: document.getElementById("assetList"),
  commitButton: document.getElementById("commitButton"),
  draftEditor: document.getElementById("draftEditor"),
  openReasoning: document.getElementById("openReasoning"),
  promptPreview: document.getElementById("promptPreview"),
  runButton: document.getElementById("runButton"),
  status: document.getElementById("status")
};

init().catch((error) => setStatus(error.message, true));

async function init() {
  state.context = await safe(() => SkillTo.context.get(), state.context);
  localize(state.context.locale);
  await refreshInputs();
  els.runButton.addEventListener("click", runReasoning);
  els.commitButton.addEventListener("click", commitDraft);
  els.openReasoning.addEventListener("click", () => SkillTo.ui.openReasoning().catch((error) => setStatus(error.message, true)));
}

async function refreshInputs() {
  const promptResult = await SkillTo.inputs.getPrompt();
  const assetsResult = await SkillTo.inputs.listConnectedAssets({ types: ["image", "video", "audio", "text"] });
  state.prompt = promptResult.rawPrompt || promptResult.sections?.prompt || "";
  state.assets = Array.isArray(assetsResult) ? assetsResult : assetsResult.assets || [];
  els.promptPreview.textContent = state.prompt || t("No prompt yet.", "暂无提示词。");
  els.draftEditor.value = els.draftEditor.value || state.prompt;
  renderAssets();
}

function renderAssets() {
  els.assetList.innerHTML = "";
  for (const asset of state.assets) {
    const chip = document.createElement("span");
    chip.className = "asset-chip";
    if (asset.thumbnailUrl || asset.url) {
      const img = document.createElement("img");
      img.alt = asset.label || asset.token || asset.handle;
      img.src = asset.thumbnailUrl || asset.url;
      chip.appendChild(img);
    }
    chip.appendChild(document.createTextNode(asset.label || asset.token || asset.handle));
    els.assetList.appendChild(chip);
  }
  if (!state.assets.length) {
    els.assetList.textContent = t("No connected assets.", "暂无连接素材。");
  }
}

async function runReasoning() {
  setLoading(true);
  try {
    await refreshInputs();
    const response = await SkillTo.llm.responsesSync({
      generation: { maxOutputTokens: 1800, temperature: 0.35 },
      materials: state.assets.map((asset) => asset.handle),
      prompt: buildInstruction(state.prompt, state.context.locale),
      tool: "__PLUGIN_SLUG___reasoning"
    });
    const parsed = parseLLMResponse(response.text);
    const metadata = {
      reasoning: {
        input_summary: parsed.input_summary,
        story_setting: parsed.story_setting,
        emotion_analysis: parsed.emotion_analysis,
        logic_branches: parsed.logic_branches
      },
      source: "__PLUGIN_SLUG__",
      tags: parsed.tags
    };
    state.metadata = metadata;
    els.draftEditor.value = parsed.optimized_prompt;
    await SkillTo.state.set("reasoning_result", metadata);
    await SkillTo.prompt.setDraft({ text: parsed.optimized_prompt, metadata });
    setStatus(t("Draft generated.", "草稿已生成。"));
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setLoading(false);
  }
}

async function commitDraft() {
  const modifiedPrompt = els.draftEditor.value.trim();
  if (!modifiedPrompt) {
    setStatus(t("Draft is empty.", "草稿为空。"), true);
    return;
  }
  await SkillTo.prompt.commit({ modified_prompt: modifiedPrompt, metadata: state.metadata || undefined });
  setStatus(t("Edited prompt committed.", "用户修改后的 prompt 已提交。"));
}

function buildInstruction(prompt, locale) {
  const outputLanguage = locale && locale.toLowerCase().startsWith("zh") ? "Simplified Chinese" : "English";
  return [
    "You are a SkillTo.ai image node plugin. Rewrite only the part of the user's prompt that this plugin owns.",
    "Keep characters, composition, actions, scene objects, and material tokens such as {{image_1}} unchanged unless absolutely necessary.",
    `Output language: ${outputLanguage}.`,
    "Return strict JSON with keys: input_summary, story_setting, emotion_analysis, logic_branches, tags, optimized_prompt.",
    "logic_branches must contain 2 to 5 short branches. optimized_prompt must be the final user-modified prompt.",
    "",
    "Original prompt:",
    prompt
  ].join("\n");
}

function parseLLMResponse(text) {
  const cleaned = String(text || "").replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const value = JSON.parse(cleaned);
  return {
    emotion_analysis: stringArray(value.emotion_analysis),
    input_summary: stringArray(value.input_summary),
    logic_branches: stringArray(value.logic_branches || value.lighting_logic).slice(0, 5),
    optimized_prompt: String(value.optimized_prompt || value.modified_prompt || "").trim(),
    story_setting: stringArray(value.story_setting),
    tags: stringArray(value.tags || value.classic_lighting_tags).slice(0, 10)
  };
}

function stringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function setLoading(loading) {
  els.runButton.disabled = loading;
  els.runButton.classList.toggle("is-loading", loading);
  els.runButton.querySelector(".run-button__spark").textContent = loading ? "◌" : "✣";
}

function setStatus(message, isError = false) {
  els.status.textContent = message || "";
  els.status.style.color = isError ? "#ffb4b4" : "#bbf7d0";
}

function localize(locale) {
  const zh = locale && locale.toLowerCase().startsWith("zh");
  document.documentElement.lang = zh ? "zh-CN" : "en-US";
  document.querySelectorAll("[data-i18n-zh]").forEach((node) => {
    node.textContent = zh ? node.dataset.i18nZh : node.dataset.i18nEn;
  });
}

function t(en, zh) {
  return state.context.locale && state.context.locale.toLowerCase().startsWith("zh") ? zh : en;
}

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
