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

/** Version of the provider-independent public model registry embedded in Catalog. */
export const MODEL_REGISTRY_SCHEMA_VERSION = 1 as const;

/**
 * Lifecycle signal. `retired` is the explicit end-of-life tombstone; the
 * absence of an entry or route is not (omission is not retirement). See
 * MODEL_REGISTRY.md "Lifecycle status".
 */
export const MODEL_REGISTRY_STATUSES = ['preview', 'active', 'deprecated', 'retired'] as const;
export type ModelRegistryStatus = (typeof MODEL_REGISTRY_STATUSES)[number];

export const MODEL_PRICE_VARIANTS = ['standard', 'priority', 'batch', 'fast'] as const;
export type ModelPriceVariant = (typeof MODEL_PRICE_VARIANTS)[number];

export interface ModelReferencePriceSource {
  kind: 'provider-official';
  /** Public HTTPS page supporting the price. */
  url: string;
  /** ISO calendar date on which Cindy last verified the source. */
  verifiedAt: string;
}

/**
 * A time- and input-band-specific public reference price.
 *
 * Prices are deliberately normalized to one million tokens. They are estimates,
 * not Cindy AI / XD Gateway sale prices and not an account's actual provider bill.
 */
export interface ModelReferencePrice {
  currency: ModelCurrency;
  variant: ModelPriceVariant;
  inputPerMtok: number;
  outputPerMtok: number;
  cacheReadPerMtok?: number;
  /** Default prompt-cache write tier (normally the provider's 5-minute tier). */
  cacheWritePerMtok?: number;
  cacheWrite1hPerMtok?: number;
  /** Inclusive lower bound. Omitted means zero. */
  minInputTokens?: number;
  /** Exclusive upper bound. Omitted means unbounded. */
  maxInputTokens?: number;
  /** Inclusive ISO calendar date. */
  effectiveFrom: string;
  /** Exclusive ISO calendar date. */
  effectiveUntil?: string;
  source: ModelReferencePriceSource;
}

/**
 * Maps a canonical model to the exact id accepted by one provider route.
 *
 * A route declares catalog presence, not entitlement: newer clients may
 * derive locally selectable entries from it under their own built-in
 * provider policy, while a dynamic provider model list remains authoritative
 * for live entitlement/availability. See MODEL_REGISTRY.md "Presence,
 * entitlement, and sale availability".
 */
export interface ModelRegistryRoute {
  providerId: string;
  modelId: string;
  agents: ModelAgent[];
  referencePrices?: ModelReferencePrice[];
}

export interface ModelRegistryEntry {
  /** Stable provider-independent Cindy id, for example `openai/gpt-5.6-terra`. */
  id: string;
  name: string;
  routes: ModelRegistryRoute[];
  status?: ModelRegistryStatus;
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

/**
 * Public provider-independent metadata and reference-price registry.
 * This object is embedded as `Catalog.modelRegistry` in the public catalog JSON.
 */
export interface ModelRegistry {
  schemaVersion: typeof MODEL_REGISTRY_SCHEMA_VERSION;
  /** Canonical UTC ISO timestamp (`Date#toISOString`) for the immutable registry snapshot. */
  updatedAt: string;
  models: ModelRegistryEntry[];
}

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
