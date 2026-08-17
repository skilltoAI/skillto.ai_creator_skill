export {};

declare global {
  interface Window {
    SkillTo: SkillToSDK;
  }

  type SkillToAssetType = "image" | "video" | "audio" | "text" | "mixed";

  interface SkillToAsset {
    handle: string;
    label: string;
    thumbnailUrl?: string;
    token?: string;
    type: SkillToAssetType;
    url?: string;
  }

  interface SkillToPromptResult {
    rawPrompt: string;
    sections?: Record<string, string>;
  }

  interface SkillToLLMResponse {
    response_id?: string;
    text: string;
  }

  interface SkillToMetadata {
    reasoning?: Record<string, unknown>;
    tags?: string[];
    source?: string;
    [key: string]: unknown;
  }

  interface SkillToSDK {
    assets: {
      getPreview(handle: string, options?: Record<string, unknown>): Promise<{ url: string; expiresAt?: string }>;
    };
    context: {
      get(): Promise<{ locale: string; theme?: string; skillAppUuid?: string; skillAppVersionUuid?: string }>;
    };
    inputs: {
      getPrompt(): Promise<SkillToPromptResult>;
      listConnectedAssets(options?: { types?: SkillToAssetType[] }): Promise<{ assets: SkillToAsset[] } | SkillToAsset[]>;
    };
    llm: {
      responsesSync(payload: Record<string, unknown>): Promise<SkillToLLMResponse>;
    };
    prompt: {
      setDraft(payload: { text: string; metadata?: SkillToMetadata }): Promise<{ draft_prompt: string }>;
      commit(payload: { modified_prompt: string; metadata?: SkillToMetadata }): Promise<{ modified_prompt: string; committed: boolean }>;
      patch(payload: { text?: string; modified_prompt?: string; metadata?: SkillToMetadata }): Promise<{ modified_prompt: string; committed?: boolean }>;
    };
    state: {
      get(key: string): Promise<unknown>;
      set(key: string, value: unknown): Promise<{ ok: boolean }>;
    };
    ui: {
      openReasoning(payload?: Record<string, unknown>): Promise<{ ok: boolean }>;
    };
    host: {
      getState(): Record<string, unknown>;
      onUpdate(listener: (state: Record<string, unknown>) => void): () => void;
    };
  }
}
