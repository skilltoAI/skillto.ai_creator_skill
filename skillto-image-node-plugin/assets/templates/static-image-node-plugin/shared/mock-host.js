(() => {
  const CHANNEL = "skillto-sandbox-runtime";
  const state = {
    context: { locale: "zh-CN", theme: "dark", skillAppUuid: "__PLUGIN_SLUG__", skillAppVersionUuid: "__PLUGIN_SLUG__@0.1.0" },
    currentPrompt: "人物形象参考：{{image_1}}，场景参考：{{image_2}}。女孩坐在荷花丛中，午后自然光，清新电影感。",
    assets: [
      {
        handle: "material:0",
        label: "人物参考",
        thumbnailUrl: "../assets/sample-portrait.svg",
        token: "{{image_1}}",
        type: "image",
        url: "../assets/sample-portrait.svg"
      },
      {
        handle: "material:1",
        label: "场景参考",
        thumbnailUrl: "../assets/sample-scene.svg",
        token: "{{image_2}}",
        type: "image",
        url: "../assets/sample-scene.svg"
      }
    ],
    metadata: null,
    modifiedPrompt: ""
  };

  window.SkillToMockHost = {
    state,
    postUpdate(frame) {
      if (!frame?.contentWindow) return;
      const nonce = new URL(frame.src, window.location.href).searchParams.get("nonce") || "dev";
      frame.contentWindow.postMessage({
        channel: CHANNEL,
        nonce,
        payload: {
          currentPrompt: state.modifiedPrompt || state.currentPrompt,
          materials: state.assets,
          reasoning: state.metadata,
          result: state.modifiedPrompt ? { modified_prompt: state.modifiedPrompt, metadata: state.metadata } : null
        },
        type: "host.update"
      }, "*");
    },
    attach(panelFrame, reasoningFrame) {
      const frames = [panelFrame, reasoningFrame].filter(Boolean);
      for (const frame of frames) {
        frame.addEventListener("load", () => window.SkillToMockHost.postUpdate(frame));
      }
      window.addEventListener("message", async (event) => {
        const data = event.data;
        if (!data || data.channel !== CHANNEL || data.type !== "request") return;
        const frame = frames.find((item) => item.contentWindow === event.source);
        if (!frame) return;
        try {
          const payload = await handleAction(data.action, data.payload, reasoningFrame);
          event.source.postMessage({ channel: CHANNEL, id: data.id, nonce: data.nonce, ok: true, payload, type: "response" }, "*");
          frames.forEach((item) => window.SkillToMockHost.postUpdate(item));
        } catch (error) {
          event.source.postMessage({ channel: CHANNEL, error: error.message, id: data.id, nonce: data.nonce, ok: false, type: "response" }, "*");
        }
      });
    }
  };

  async function handleAction(action, payload, reasoningFrame) {
    switch (action) {
      case "context.get":
        return state.context;
      case "inputs.getPrompt":
        return { rawPrompt: state.modifiedPrompt || state.currentPrompt, sections: { prompt: state.modifiedPrompt || state.currentPrompt } };
      case "inputs.listConnectedAssets":
        return { assets: state.assets };
      case "assets.getPreview": {
        const asset = state.assets.find((item) => item.handle === payload?.handle);
        if (!asset) throw new Error("Mock asset not found.");
        return { url: asset.url || asset.thumbnailUrl };
      }
      case "llm.responsesSync":
        return { response_id: "mock-response", text: JSON.stringify(mockLLMResult()) };
      case "prompt.setDraft":
      case "prompt.commit":
      case "prompt.patch":
        state.modifiedPrompt = payload?.modified_prompt || payload?.text || "";
        state.metadata = payload?.metadata || state.metadata;
        return { committed: action !== "prompt.setDraft", draft_prompt: state.modifiedPrompt, modified_prompt: state.modifiedPrompt };
      case "state.set":
        if (payload?.key === "reasoning_result") state.metadata = payload.value;
        return { ok: true };
      case "state.get":
        return payload?.key === "reasoning_result" ? state.metadata : null;
      case "ui.openReasoning":
        document.body.classList.add("show-reasoning");
        window.SkillToMockHost.postUpdate(reasoningFrame);
        return { ok: true };
      default:
        throw new Error(`Unsupported mock action: ${action}`);
    }
  }

  function mockLLMResult() {
    return {
      input_summary: ["{{image_1}} 人物主体", "{{image_2}} 场景气氛", "午后荷花丛"],
      story_setting: ["夏日荷塘", "清新安静", "人物与自然环境融合"],
      emotion_analysis: ["放松", "明亮", "轻盈"],
      logic_branches: ["强化自然逆光", "保留柔和肤色", "加入清透绿色调"],
      optimized_prompt: `${state.currentPrompt} 增加柔和自然逆光、空气透亮的漫反射、低饱和青绿色调和清新的电影级调色。`,
      tags: ["逆光", "柔光", "漫反射", "清新调色"]
    };
  }
})();
