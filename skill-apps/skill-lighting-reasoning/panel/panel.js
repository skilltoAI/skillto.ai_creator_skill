const { SkillTo } = window;

const state = {
  assets: [],
  context: { locale: "zh-CN" },
  metadata: null,
  prompt: "",
  previews: new Map()
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
  els.runButton.addEventListener("click", runLightingReasoning);
  els.commitButton.addEventListener("click", commitDraft);
  els.openReasoning.addEventListener("click", () => SkillTo.ui.openReasoning().catch((error) => setStatus(error.message, true)));
}

async function refreshInputs() {
  const promptResult = await SkillTo.inputs.getPrompt();
  const assetsResult = await SkillTo.inputs.listConnectedAssets({ types: ["image", "video", "text"] });
  state.prompt = promptResult.rawPrompt || promptResult.sections?.prompt || "";
  state.assets = Array.isArray(assetsResult) ? assetsResult : assetsResult.assets || [];
  await hydratePreviews();
  els.promptPreview.textContent = state.prompt || t("No prompt yet.", "暂无提示词。");
  if (!els.draftEditor.value.trim()) els.draftEditor.value = state.prompt;
  renderAssets();
}

async function hydratePreviews() {
  await Promise.all(state.assets.map(async (asset) => {
    if (!asset?.handle || state.previews.has(asset.handle)) return;
    const preview = await safe(() => SkillTo.assets.getPreview(asset.handle), null);
    state.previews.set(asset.handle, preview?.url || asset.url || asset.thumbnailUrl || "");
  }));
}

function renderAssets() {
  els.assetList.innerHTML = "";
  if (!state.assets.length) {
    els.assetList.textContent = t("No connected scene or character references.", "暂无连接的场景或人物参考。");
    return;
  }
  for (const asset of state.assets) {
    const chip = document.createElement("span");
    chip.className = "asset-chip";
    const previewURL = state.previews.get(asset.handle) || asset.thumbnailUrl || asset.url;
    if (previewURL) {
      const img = document.createElement("img");
      img.alt = asset.label || asset.token || asset.handle;
      img.src = previewURL;
      chip.appendChild(img);
    }
    chip.appendChild(document.createTextNode(asset.label || asset.token || asset.handle));
    els.assetList.appendChild(chip);
  }
}

async function runLightingReasoning() {
  setLoading(true);
  try {
    await refreshInputs();
    const response = await SkillTo.llm.responsesSync({
      generation: { maxOutputTokens: 2400, responseFormat: "json_object", temperature: 0.28 },
      input: {
        connected_assets: state.assets.map((asset) => ({
          handle: asset.handle,
          label: asset.label,
          token: asset.token,
          type: asset.type
        })),
        locale: state.context.locale,
        prompt: state.prompt
      },
      materials: state.assets.map((asset) => asset.handle),
      prompt: buildInstruction(),
      tool: "skill_lighting_reasoning"
    });
    const parsed = parseLLMResponse(response.output_text || response.text || response.content || "");
    const modifiedPrompt = parsed.optimized_prompt || state.prompt;
    const metadata = {
      reasoning: {
        emotion_analysis: parsed.emotion_analysis,
        input_summary: parsed.input_summary,
        lighting_logic: parsed.lighting_logic,
        scene_reference_inference: parsed.scene_reference_inference,
        shot_setting: parsed.shot_setting
      },
      source: "skill-lighting-reasoning",
      tags: parsed.classic_lighting_tags
    };
    state.metadata = metadata;
    els.draftEditor.value = modifiedPrompt;
    await SkillTo.state.set("reasoning_result", metadata);
    await SkillTo.prompt.setDraft({ text: modifiedPrompt, metadata });
    setStatus(t("Lighting reasoning draft generated.", "布光推理草稿已生成。"));
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
  setStatus(t("Edited modified_prompt committed.", "用户修改后的 modified_prompt 已提交。"));
}

function buildInstruction() {
  const zh = isZh();
  const outputLanguage = zh ? "Simplified Chinese" : "English";
  return [
    "You are the official SkillTo.ai image node plugin named Skill推理布光.",
    "Task: rewrite only lighting, color grading, atmosphere, and scene-taking details in the user's prompt.",
    "Analyze the standard SkillTo.ai image node input: prompt text, connected reference images/videos/text, character references, scene references, and material tokens.",
    "Infer: 1) what shot/story scene the user wants, 2) shot emotion and psychological change, 3) scene atmosphere, 4) what concrete scene-taking should be inferred from scene references when the user did not specify it completely, 5) which emotional lighting and color grading are most reasonable.",
    "For scene-taking inference, explicitly decide whether the scene should be inside a large layered hall, near a window, in a basement, in an exterior courtyard, atrium, corridor, doorway, or another concrete location suggested by references.",
    "Do not change character identity, action, core composition, or material tokens such as {{image_1}}, {{image_2}}, {{video_1}}.",
    `Output language: ${outputLanguage}.`,
    "Return strict JSON only, no markdown.",
    "JSON keys:",
    "- input_summary: array of 3-6 short phrases, including prompt and connected asset summaries.",
    "- scene_reference_inference: array of 2-5 short phrases about concrete scene-taking inferred from reference assets.",
    "- shot_setting: array of 2-5 short phrases about the story shot and location.",
    "- emotion_analysis: array of 2-5 short phrases about emotion, psychology, and atmosphere.",
    "- lighting_logic: array of 2-5 short branches. Each branch may be a string or {title, detail}.",
    "- classic_lighting_tags: array of 3-8 concise classic lighting/color tags.",
    "- optimized_prompt: final modified_prompt preserving the original request and tokens, changing only lighting/color/atmosphere/scene-taking details."
  ].join("\n");
}

function parseLLMResponse(text) {
  const cleaned = String(text || "").replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const value = JSON.parse(cleaned);
  const lightingLogic = array(value.lighting_logic || value.logic_branches).slice(0, 5).map((item) => {
    if (typeof item === "object" && item) {
      return {
        detail: String(item.detail || item.reason || item.text || "").trim(),
        title: String(item.title || item.name || "").trim()
      };
    }
    return { detail: String(item || "").trim(), title: "" };
  }).filter((item) => item.detail || item.title);
  return {
    classic_lighting_tags: stringArray(value.classic_lighting_tags || value.tags).slice(0, 8),
    emotion_analysis: stringArray(value.emotion_analysis),
    input_summary: stringArray(value.input_summary),
    lighting_logic: lightingLogic.length ? lightingLogic : [{ title: "", detail: t("Use emotionally coherent lighting.", "使用符合情绪的布光。") }],
    optimized_prompt: String(value.optimized_prompt || value.modified_prompt || "").trim(),
    scene_reference_inference: stringArray(value.scene_reference_inference || value.scene_inference),
    shot_setting: stringArray(value.shot_setting || value.story_setting)
  };
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
  return isZh() ? zh : en;
}

function isZh() {
  return state.context.locale && state.context.locale.toLowerCase().startsWith("zh");
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function stringArray(value) {
  return array(value).map((item) => String(item || "").trim()).filter(Boolean);
}

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
