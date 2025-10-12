import {
  AIRenameConfig,
  AIRenameContext,
  LayerDataForAI,
  RenamedLayer,
} from "../types";

interface BackendResponse {
  success: boolean;
  renamedLayers?: Array<{ id: string; newName: string }>;
  message?: string;
}

const REQUEST_TIMEOUT_MS = 20000;
const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TEMPERATURE = 0.7;

export class AIRenameService {
  private backendUrl: string;

  constructor(backendUrl: string) {
    this.backendUrl = this.normalizeUrl(backendUrl);
  }

  updateBackendUrl(url: string) {
    this.backendUrl = this.normalizeUrl(url);
  }

  async renameLayersWithAI(
    layers: LayerDataForAI[],
    context: AIRenameContext,
    configOverrides?: Partial<AIRenameConfig>
  ): Promise<RenamedLayer[]> {
    const payloadConfig = this.buildConfigPayload(configOverrides);
    const backendResponse = await this.callBackend(
      {
        layers,
        context,
        config: payloadConfig,
      },
      configOverrides?.apiKey
    );

    if (!backendResponse.success) {
      throw new Error(
        backendResponse.message || "AI rename backend returned an error."
      );
    }

    const originalNames = new Map(
      layers.map((layer) => [layer.id, layer.name])
    );

    return (backendResponse.renamedLayers ?? []).map((layer) => ({
      id: layer.id,
      newName: layer.newName,
      oldName: originalNames.get(layer.id) ?? "",
    }));
  }

  private buildConfigPayload(
    configOverrides?: Partial<AIRenameConfig>
  ): Record<string, unknown> {
    const model = configOverrides?.model || DEFAULT_MODEL;
    return {
      model,
      temperature: configOverrides?.temperature ?? DEFAULT_TEMPERATURE,
      namingConvention: configOverrides?.namingConvention,
      customNamingPattern: configOverrides?.customNamingPattern,
      namingTemplates: configOverrides?.namingTemplates,
      layerTypeRules: configOverrides?.layerTypeRules,
      excludePatterns: configOverrides?.excludePatterns,
      reviewMode: configOverrides?.reviewMode,
      undoHistoryLimit: configOverrides?.undoHistoryLimit,
      batchSize: configOverrides?.batchSize,
    };
  }

  private async callBackend(
    payload: unknown,
    apiKey?: string,
    retries = 3,
    attempt = 0
  ): Promise<BackendResponse> {
    const endpoint = `${this.backendUrl}/api/rename-layers`;
    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await this.parseJson(response);

      if (!response.ok) {
        const shouldRetry =
          (response.status >= 500 || response.status === 429) &&
          attempt < retries;

        if (shouldRetry) {
          await this.backoff(attempt);
          return this.callBackend(payload, apiKey, retries, attempt + 1);
        }

        throw new Error(
          data?.message || `AI rename backend error (${response.status}).`
        );
      }

      return (data as BackendResponse) ?? { success: false };
    } catch (error) {
      if (attempt >= retries) {
        if ((error as Error).name === "AbortError") {
          throw new Error("AI rename request timed out.");
        }
        throw error instanceof Error
          ? error
          : new Error("AI rename request failed.");
      }

      await this.backoff(attempt);
      return this.callBackend(payload, apiKey, retries, attempt + 1);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private async parseJson(response: Response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, message: "Invalid JSON returned from backend." };
    }
  }

  private async backoff(attempt: number) {
    const delay = Math.min(2000 * 2 ** attempt, 8000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private normalizeUrl(url: string) {
    return url.replace(/\/+$/, "");
  }
}
