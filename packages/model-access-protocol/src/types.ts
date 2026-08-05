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

/** Legacy version of the provider-independent public model registry embedded in Catalog. */
export const MODEL_REGISTRY_LEGACY_SCHEMA_VERSION = 1 as const;

/** Current version of the provider-independent public model registry embedded in Catalog. */
export const MODEL_REGISTRY_SCHEMA_VERSION = 2 as const;

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

interface ModelRegistryEntryBase {
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

/** Registry v1 entry. The strict v1 wire contract does not allow new-session defaults. */
export interface ModelRegistryEntryV1 extends ModelRegistryEntryBase {
  newSessionDefault?: never;
}

/** Current Registry entry (schema v2). */
export interface ModelRegistryEntry extends ModelRegistryEntryBase {
  /**
   * Agents for which this model is the preferred new-conversation default (the
   * cold-start seed). Independent of `sortOrder` (which only orders the picker)
   * and `defaultEnabled` (picker visibility): clients prefer a marked model that
   * is available and visible as the new-session seed, falling back to `sortOrder`
   * when none is marked (or when several are, lowest `sortOrder` wins). Each
   * listed agent must be routable by this entry.
   */
  newSessionDefault?: ModelAgent[];
}

/**
 * Public provider-independent metadata and reference-price registry.
 * This object is embedded as `Catalog.modelRegistry` in the public catalog JSON.
 */
interface ModelRegistryBase {
  /** Canonical UTC ISO timestamp (`Date#toISOString`) for the immutable registry snapshot. */
  updatedAt: string;
}

/**
 * Source-compatible public Registry shape. Runtime parsing still enforces the exact per-version
 * field allowlist; use ModelRegistryV1/ModelRegistryV2 when a builder needs compile-time precision.
 */
export interface ModelRegistry extends ModelRegistryBase {
  schemaVersion: typeof MODEL_REGISTRY_LEGACY_SCHEMA_VERSION | typeof MODEL_REGISTRY_SCHEMA_VERSION;
  models: ModelRegistryEntry[];
}

export interface ModelRegistryV1 extends ModelRegistry {
  schemaVersion: typeof MODEL_REGISTRY_LEGACY_SCHEMA_VERSION;
  models: ModelRegistryEntryV1[];
}

export interface ModelRegistryV2 extends ModelRegistry {
  schemaVersion: typeof MODEL_REGISTRY_SCHEMA_VERSION;
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

/** Schema version for the model-catalog resolve request/response contract. */
export const MODEL_ACCESS_RESOLVE_SCHEMA_VERSION = 2 as const;

/** Supported chat transport modes in schema v2 model-access payloads. */
export const MODEL_ACCESS_CHAT_MODES = ['chat', 'responses'] as const;
export type ModelChatMode = (typeof MODEL_ACCESS_CHAT_MODES)[number];

export const MODEL_ACCESS_PROVENANCES = [
  'provider',
  'override',
  'knowledge-base',
  'default',
] as const;
export type ModelProvenance = (typeof MODEL_ACCESS_PROVENANCES)[number];

/**
 * Per-field provenance: maps a resolved model field name (`contextWindow`, `modalities`, …) to the
 * layer that supplied its value. The resolver emits provenance **per field**, so this is the wire
 * shape; a single top-level {@link ModelProvenance} string stays accepted for backward compatibility.
 */
export type ModelFieldProvenance = Partial<Record<string, ModelProvenance>>;

/** Display and capability metadata for a resolved per-provider model offer. */
export interface ResolvedModelCapabilities {
  reasoning?: boolean;
  toolCall?: boolean;
  attachment?: boolean;
  temperature?: boolean;
  /** Additive capability keys may be introduced without changing the schema version. */
  [key: string]: unknown;
}

export interface ResolvedModelModalities {
  input: string[];
  output: string[];
}

export interface ResolvedModelCost {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

/**
 * A model offer after provider facts and catalog knowledge have been resolved.
 * The id is the provider-reported id and is never rewritten by resolve.
 */
export interface ResolvedModel {
  id: string;
  name: string;
  description?: string;
  family?: string;
  group?: string;
  category?: string;
  mode?: ModelChatMode;
  sortOrder?: number;
  contextWindow: number;
  maxOutput?: number;
  efforts: ModelEffort[];
  defaultEffort: ModelEffort | null;
  effortDisplayNames?: Partial<Record<ModelEffort, string>>;
  supportsFastMode?: boolean;
  modalities?: ResolvedModelModalities;
  capabilities?: ResolvedModelCapabilities;
  cost?: ResolvedModelCost;
  releaseDate?: string;
  status?: 'active' | 'alpha' | 'deprecated';
  defaultEnabled?: boolean;
  provenance?: ModelProvenance | ModelFieldProvenance;
}

export interface ResolveRequestModel {
  id: string;
  name?: string;
  providerReported?: ProviderReportedModel;
}

export interface ProviderReportedModel {
  contextWindow?: number;
  maxOutput?: number;
  modalities?: ResolvedModelModalities;
  capabilities?: ResolvedModelCapabilities;
  mode?: ModelChatMode;
  type?: string;
}

export interface ResolveRequestEntry {
  providerId: string;
  agent: ModelAgent;
  wireProtocol?: string;
  models: ResolveRequestModel[];
}

export interface ResolveRequest {
  schemaVersion: typeof MODEL_ACCESS_RESOLVE_SCHEMA_VERSION;
  entries: ResolveRequestEntry[];
}

export interface ResolveResponseEntry {
  providerId: string;
  agent: ModelAgent;
  models: ResolvedModel[];
}

export interface ResolveResponse {
  schemaVersion: typeof MODEL_ACCESS_RESOLVE_SCHEMA_VERSION;
  knowledgeRevision: string;
  entries: ResolveResponseEntry[];
}

/** Additive v2 fields on the existing ListModels model entry. */
export interface ListModelsResponseV2Model extends ModelCatalogEntry {
  family?: string;
  category?: string;
  mode?: ModelChatMode;
  maxOutput?: number;
  effortDisplayNames?: Partial<Record<ModelEffort, string>>;
  modalities?: ResolvedModelModalities;
  capabilities?: ResolvedModelCapabilities;
  cost?: ResolvedModelCost;
  releaseDate?: string;
  status?: 'active' | 'alpha' | 'deprecated';
  /** Agents for which this available model is the preferred new-conversation default. */
  newSessionDefault?: ModelAgent[];
  provenance?: ModelProvenance | ModelFieldProvenance;
}

/** Schema v2 keeps the v1 models envelope and fields, adding resolved metadata. */
export interface ListModelsResponseV2 {
  schemaVersion: typeof MODEL_ACCESS_RESOLVE_SCHEMA_VERSION;
  models: ListModelsResponseV2Model[];
}
