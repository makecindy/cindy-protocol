/** Initial version of the Cindy model catalog response contract. */
export const MODEL_ACCESS_CATALOG_SCHEMA_VERSION = 1 as const;

/** Stable Cindy-owned model catalog path. */
export const MODEL_ACCESS_MODELS_PATH = '/api/model-access/models' as const;

export const MODEL_ACCESS_CURRENCIES = ['CNY', 'USD'] as const;
export type ModelCurrency = (typeof MODEL_ACCESS_CURRENCIES)[number];

export const MODEL_ACCESS_AGENTS = ['claude-code', 'codex'] as const;
export type ModelAgent = (typeof MODEL_ACCESS_AGENTS)[number];

export const MODEL_ACCESS_EFFORTS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra',
] as const;
export type ModelEffort = (typeof MODEL_ACCESS_EFFORTS)[number];

export interface ModelTieredPricing {
  range: [number, number];
  inputCostPerToken?: number;
  outputCostPerToken?: number;
  cacheReadInputTokenCost?: number;
  cacheCreationInputTokenCost?: number;
}

/**
 * Public AIGateway pricing projection. Numeric values retain their original
 * per-unit scale and use the model entry's `currency`.
 */
export interface ModelPricing {
  costDiscount?: number;
  inputCostPerToken?: number;
  outputCostPerToken?: number;
  inputCostPerTokenPriority?: number;
  outputCostPerTokenPriority?: number;
  cacheReadInputTokenCost?: number;
  cacheReadInputTokenCostPriority?: number;
  cacheCreationInputTokenCost?: number;
  inputCostPerTokenAbove200kTokens?: number;
  outputCostPerTokenAbove200kTokens?: number;
  cacheReadInputTokenCostAbove200kTokens?: number;
  inputCostPerTokenAbove200kTokensPriority?: number;
  outputCostPerTokenAbove200kTokensPriority?: number;
  cacheReadInputTokenCostAbove200kTokensPriority?: number;
  inputCostPerTokenAbove272kTokens?: number;
  outputCostPerTokenAbove272kTokens?: number;
  cacheReadInputTokenCostAbove272kTokens?: number;
  inputCostPerTokenAbove272kTokensPriority?: number;
  outputCostPerTokenAbove272kTokensPriority?: number;
  cacheReadInputTokenCostAbove272kTokensPriority?: number;
  inputCostPerCharacter?: number;
  outputCostPerCharacter?: number;
  inputCostPerSecond?: number;
  outputCostPerSecond?: number;
  inputCostPerAudioToken?: number;
  outputCostPerAudioToken?: number;
  inputCostPerAudioPerSecond?: number;
  outputCostPerAudioPerSecond?: number;
  inputCostPerImage?: number;
  outputCostPerImage?: number;
  inputCostPerImageToken?: number;
  outputCostPerImageToken?: number;
  cacheReadInputImageTokenCost?: number;
  inputCostPerVideoPerSecond?: number;
  outputCostPerVideoPerSecond?: number;
  tieredPricing?: ModelTieredPricing[];
}

export interface ModelAgentOverride {
  contextWindow?: number;
  efforts?: ModelEffort[];
  defaultEffort?: ModelEffort;
  supportsFastMode?: boolean;
  defaultEnabled?: boolean;
}

export interface ModelCatalogEntry extends ModelPricing {
  id: string;
  /**
   * ISO 4217 currency for every price on this entry. The server declares the
   * deployment's accounting currency; clients must not infer it from locale.
   */
  currency: ModelCurrency;
  agents: ModelAgent[];
  name?: string;
  group?: string;
  description?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  efforts?: ModelEffort[];
  defaultEffort?: ModelEffort;
  sortOrder?: number;
  supportsFastMode?: boolean;
  defaultEnabled?: boolean;
  perAgent?: Partial<Record<ModelAgent, ModelAgentOverride>>;
}

export interface ListModelsResponse {
  schemaVersion: typeof MODEL_ACCESS_CATALOG_SCHEMA_VERSION;
  models: ModelCatalogEntry[];
}

export type ModelAccessParseResult<T> = { ok: true; value: T } | { ok: false; error: string };
