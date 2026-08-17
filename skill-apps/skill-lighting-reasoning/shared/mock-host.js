(() => {
  const CHANNEL = "skillto-sandbox-runtime";
  const state = {
    context: { locale: "zh-CN", theme: "dark", skillAppUuid: "skill-lighting-reasoning", skillAppVersionUuid: "skill-lighting-reasoning@0.1.0" },
    currentPrompt: "人物形象参考：{{image_1}}，场景参考：{{image_2}}。女孩在巨大旧建筑空间里发现真相，镜头需要表现犹豫、压抑、最后下定决心。",
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
        label: "场景参考：旧大厅",
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
      classic_lighting_tags: ["低调光", "侧逆光", "轮廓光", "窗光", "冷暖对比"],
      emotion_analysis: ["犹豫到决心的心理转折", "压抑、悬疑、孤独", "空间吞没人但光线给出出口"],
      input_summary: ["{{image_1}} 人物主体", "{{image_2}} 旧建筑空间参考", "分镜目标：发现真相并下定决心"],
      lighting_logic: [
        { title: "入口动机光", detail: "用远处门缝或高窗冷光给出行动方向" },
        { title: "人物轮廓", detail: "侧逆光勾勒肩颈和发丝，让人物从暗部浮出" },
        { title: "空间压迫", detail: "大厅顶部阴影和柱廊暗区形成巨大层次" },
        { title: "心理转折", detail: "面部保留少量暖色反光，暗示最终决心" }
      ],
      optimized_prompt: `${state.currentPrompt} 参考{{image_2}}反推为巨大旧式大厅深处的分镜取景，人物靠近门廊与高窗之间，采用低调光、冷色窗光和侧逆光，远处门缝形成行动方向，人物肩颈与发丝有细窄轮廓光，顶部梁柱和大厅纵深保留大片暗部压迫感，面部只保留微弱暖色反光表现从犹豫到决心的心理转折，整体冷暖低饱和电影调色，空气中有细尘与轻微雾化光束。`,
      scene_reference_inference: ["参考{{image_2}}不是普通房间，而是纵深很大的旧式大厅", "取景应靠近门廊、高窗或柱廊边缘", "暗部保留大厅顶部与远处层级，不补成均匀亮光"],
      shot_setting: ["巨大旧建筑内部", "发现真相的关键分镜", "人物从暗部走向光源"]
    };
  }
})();
