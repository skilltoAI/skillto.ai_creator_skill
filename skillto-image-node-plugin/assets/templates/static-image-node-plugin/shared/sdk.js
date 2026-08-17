(() => {
  const CHANNEL = "skillto-sandbox-runtime";
  const params = new URLSearchParams(window.location.search);
  const nonce = params.get("nonce") || "";
  const pending = new Map();
  const hostListeners = new Set();
  let seq = 0;
  let hostState = {};

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.channel !== CHANNEL || data.nonce !== nonce) return;
    if (data.type === "response") {
      const entry = pending.get(data.id);
      if (!entry) return;
      pending.delete(data.id);
      data.ok ? entry.resolve(data.payload) : entry.reject(new Error(data.error || "Skill runtime request failed."));
    }
    if (data.type === "host.update") {
      hostState = data.payload || {};
      for (const listener of hostListeners) listener(hostState);
    }
  });

  function request(action, payload) {
    const id = `req_${Date.now().toString(36)}_${++seq}`;
    return new Promise((resolve, reject) => {
      if (!nonce || window.parent === window) {
        reject(new Error("Skill runtime host is not available."));
        return;
      }
      pending.set(id, { resolve, reject });
      window.parent.postMessage({ action, channel: CHANNEL, id, nonce, payload, type: "request" }, "*");
      window.setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(new Error(`Skill runtime action timed out: ${action}`));
      }, 120000);
    });
  }

  window.SkillTo = {
    assets: {
      getPreview: (handle, options) => request("assets.getPreview", { handle, ...options })
    },
    context: {
      get: () => request("context.get", {})
    },
    inputs: {
      getPrompt: () => request("inputs.getPrompt", {}),
      listConnectedAssets: (options) => request("inputs.listConnectedAssets", options || {})
    },
    llm: {
      responsesSync: (payload) => request("llm.responsesSync", payload)
    },
    prompt: {
      commit: (payload) => request("prompt.commit", payload),
      patch: (payload) => request("prompt.patch", payload),
      setDraft: (payload) => request("prompt.setDraft", payload)
    },
    state: {
      get: (key) => request("state.get", { key }),
      set: (key, value) => request("state.set", { key, value })
    },
    ui: {
      openReasoning: (payload) => request("ui.openReasoning", payload || {})
    },
    host: {
      getState: () => hostState,
      onUpdate(listener) {
        hostListeners.add(listener);
        listener(hostState);
        return () => hostListeners.delete(listener);
      }
    }
  };
})();
