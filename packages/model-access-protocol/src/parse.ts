import {
  MODEL_ACCESS_AGENTS,
  MODEL_ACCESS_CHAT_MODES,
  MODEL_ACCESS_CATALOG_SCHEMA_VERSION,
  MODEL_ACCESS_CURRENCIES,
  MODEL_ACCESS_EFFORTS,
  MODEL_ACCESS_PROVENANCES,
  MODEL_ACCESS_RESOLVE_SCHEMA_VERSION,
  MODEL_PRICE_VARIANTS,
  MODEL_REGISTRY_LEGACY_SCHEMA_VERSION,
  MODEL_REGISTRY_SCHEMA_VERSION,
  MODEL_REGISTRY_STATUSES,
  type ListModelsResponse,
  type ListModelsResponseV2,
  type ModelAccessParseResult,
  type ModelAgent,
  type ModelChatMode,
  type ModelCurrency,
  type ModelEffort,
  type ModelPriceVariant,
  type ModelRegistry,
  type ModelRegistryStatus,
  type ProviderReportedModel,
  type ResolveRequest,
  type ResolveResponse,
} from './types.js';

type PlainObject = Record<string, unknown>;

const PRICING_FIELDS = [
  'costDiscount',
  'inputCostPerToken',
  'outputCostPerToken',
  'inputCostPerTokenPriority',
  'outputCostPerTokenPriority',
  'cacheReadInputTokenCost',
  'cacheReadInputTokenCostPriority',
  'cacheCreationInputTokenCost',
  'inputCostPerTokenAbove200kTokens',
  'outputCostPerTokenAbove200kTokens',
  'cacheReadInputTokenCostAbove200kTokens',
  'inputCostPerTokenAbove200kTokensPriority',
  'outputCostPerTokenAbove200kTokensPriority',
  'cacheReadInputTokenCostAbove200kTokensPriority',
  'inputCostPerTokenAbove272kTokens',
  'outputCostPerTokenAbove272kTokens',
  'cacheReadInputTokenCostAbove272kTokens',
  'inputCostPerTokenAbove272kTokensPriority',
  'outputCostPerTokenAbove272kTokensPriority',
  'cacheReadInputTokenCostAbove272kTokensPriority',
  'inputCostPerCharacter',
  'outputCostPerCharacter',
  'inputCostPerSecond',
  'outputCostPerSecond',
  'inputCostPerAudioToken',
  'outputCostPerAudioToken',
  'inputCostPerAudioPerSecond',
  'outputCostPerAudioPerSecond',
  'inputCostPerImage',
  'outputCostPerImage',
  'inputCostPerImageToken',
  'outputCostPerImageToken',
  'cacheReadInputImageTokenCost',
  'inputCostPerVideoPerSecond',
  'outputCostPerVideoPerSecond',
] as const;

const MODEL_CATALOG_ENTRY_FIELDS = [
  'id',
  'currency',
  'agents',
  'name',
  'group',
  'description',
  'contextWindow',
  'maxOutputTokens',
  'efforts',
  'defaultEffort',
  'sortOrder',
  'supportsFastMode',
  'defaultEnabled',
  'perAgent',
  ...PRICING_FIELDS,
  'tieredPricing',
] as const;
const MODEL_TIERED_PRICING_FIELDS = [
  'range',
  'inputCostPerToken',
  'outputCostPerToken',
  'cacheReadInputTokenCost',
  'cacheCreationInputTokenCost',
] as const;
const RESOLVE_REQUEST_FIELDS = ['schemaVersion', 'entries'] as const;
const RESOLVE_RESPONSE_FIELDS = ['schemaVersion', 'knowledgeRevision', 'entries'] as const;
const RESOLVE_REQUEST_ENTRY_FIELDS = ['providerId', 'agent', 'wireProtocol', 'models'] as const;
const RESOLVE_RESPONSE_ENTRY_FIELDS = ['providerId', 'agent', 'models'] as const;
const RESOLVE_REQUEST_MODEL_FIELDS = ['id', 'name', 'providerReported'] as const;
const PROVIDER_REPORTED_MODEL_FIELDS = [
  'contextWindow',
  'maxOutput',
  'modalities',
  'capabilities',
  'mode',
  'type',
] as const;
const RESOLVED_MODEL_FIELDS = [
  'id',
  'name',
  'description',
  'family',
  'group',
  'category',
  'mode',
  'sortOrder',
  'contextWindow',
  'maxOutput',
  'efforts',
  'defaultEffort',
  'effortDisplayNames',
  'supportsFastMode',
  'modalities',
  'capabilities',
  'cost',
  'releaseDate',
  'status',
  'defaultEnabled',
  'provenance',
] as const;
const LIST_MODELS_V2_FIELDS = ['schemaVersion', 'models'] as const;
const LIST_MODELS_V2_MODEL_FIELDS = [
  ...MODEL_CATALOG_ENTRY_FIELDS,
  'family',
  'category',
  'mode',
  'maxOutput',
  'effortDisplayNames',
  'modalities',
  'capabilities',
  'cost',
  'releaseDate',
  'status',
  'newSessionDefault',
  'provenance',
] as const;
const RESOLVED_MODEL_MODALITIES_FIELDS = ['input', 'output'] as const;
const RESOLVED_MODEL_COST_FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite'] as const;

const MODEL_REGISTRY_FIELDS = ['schemaVersion', 'updatedAt', 'models'] as const;
const MODEL_REGISTRY_ENTRY_V1_FIELDS = [
  'id',
  'name',
  'routes',
  'status',
  'group',
  'description',
  'contextWindow',
  'maxOutputTokens',
  'efforts',
  'defaultEffort',
  'sortOrder',
  'supportsFastMode',
  'defaultEnabled',
  'perAgent',
] as const;
const MODEL_REGISTRY_ENTRY_V2_FIELDS = [
  ...MODEL_REGISTRY_ENTRY_V1_FIELDS,
  'newSessionDefault',
] as const;
const MODEL_REGISTRY_ROUTE_FIELDS = ['providerId', 'modelId', 'agents', 'referencePrices'] as const;
const MODEL_REGISTRY_AGENT_OVERRIDE_FIELDS = [
  'contextWindow',
  'efforts',
  'defaultEffort',
  'supportsFastMode',
  'defaultEnabled',
] as const;
const MODEL_REFERENCE_PRICE_FIELDS = [
  'currency',
  'variant',
  'inputPerMtok',
  'outputPerMtok',
  'cacheReadPerMtok',
  'cacheWritePerMtok',
  'cacheWrite1hPerMtok',
  'minInputTokens',
  'maxInputTokens',
  'effectiveFrom',
  'effectiveUntil',
  'source',
] as const;
const MODEL_REFERENCE_PRICE_SOURCE_FIELDS = ['kind', 'url', 'verifiedAt'] as const;

function ok<T>(value: T): ModelAccessParseResult<T> {
  return { ok: true, value };
}

function fail<T>(error: string): ModelAccessParseResult<T> {
  return { ok: false, error };
}

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownFieldError(
  value: PlainObject,
  allowedFields: readonly string[],
  path: string,
): string | null {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(value).find((field) => !allowed.has(field));
  return unknown ? `${path}.${unknown} is not allowed by this schema version` : null;
}

export function isModelCurrency(value: unknown): value is ModelCurrency {
  return typeof value === 'string' && MODEL_ACCESS_CURRENCIES.includes(value as ModelCurrency);
}

function isModelAgent(value: unknown): value is ModelAgent {
  return typeof value === 'string' && MODEL_ACCESS_AGENTS.includes(value as ModelAgent);
}

function isModelChatMode(value: unknown): value is ModelChatMode {
  return typeof value === 'string' && MODEL_ACCESS_CHAT_MODES.includes(value as ModelChatMode);
}

function isModelEffort(value: unknown): value is ModelEffort {
  return typeof value === 'string' && MODEL_ACCESS_EFFORTS.includes(value as ModelEffort);
}

function isModelRegistryStatus(value: unknown): value is ModelRegistryStatus {
  return (
    typeof value === 'string' && MODEL_REGISTRY_STATUSES.includes(value as ModelRegistryStatus)
  );
}

function isModelPriceVariant(value: unknown): value is ModelPriceVariant {
  return typeof value === 'string' && MODEL_PRICE_VARIANTS.includes(value as ModelPriceVariant);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function referencePriceRangesOverlap(a: PlainObject, b: PlainObject): boolean {
  if (a.currency !== b.currency || a.variant !== b.variant) return false;
  const aMin = typeof a.minInputTokens === 'number' ? a.minInputTokens : 0;
  const bMin = typeof b.minInputTokens === 'number' ? b.minInputTokens : 0;
  const aMax = typeof a.maxInputTokens === 'number' ? a.maxInputTokens : Number.POSITIVE_INFINITY;
  const bMax = typeof b.maxInputTokens === 'number' ? b.maxInputTokens : Number.POSITIVE_INFINITY;
  const tokenRangesOverlap = aMin < bMax && bMin < aMax;
  const aUntil = typeof a.effectiveUntil === 'string' ? a.effectiveUntil : null;
  const bUntil = typeof b.effectiveUntil === 'string' ? b.effectiveUntil : null;
  const dateRangesOverlap =
    (bUntil === null || String(a.effectiveFrom) < bUntil) &&
    (aUntil === null || String(b.effectiveFrom) < aUntil);
  return tokenRangesOverlap && dateRangesOverlap;
}

function isSafeSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function optionalStringError(value: unknown, path: string, max: number): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') return `${path} must be a string when present`;
  if (value.length > max) return `${path} must contain at most ${max} characters`;
  return null;
}

function optionalPositiveIntegerError(value: unknown, path: string): string | null {
  if (value === undefined) return null;
  if (!Number.isInteger(value) || (value as number) <= 0) {
    return `${path} must be a positive integer when present`;
  }
  return null;
}

function optionalFiniteNumberError(
  value: unknown,
  path: string,
  options: { nonNegative?: boolean } = {},
): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return `${path} must be a finite number when present`;
  }
  if (options.nonNegative && value < 0) {
    return `${path} must be non-negative when present`;
  }
  return null;
}

function effortListError(value: unknown, path: string): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.some((effort) => !isModelEffort(effort))) {
    return `${path} must contain only supported effort values`;
  }
  return null;
}

function overrideError(
  value: unknown,
  path: string,
  baseEfforts: readonly ModelEffort[] | undefined,
  allowedFields?: readonly string[],
): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  let error = allowedFields ? unknownFieldError(value, allowedFields, path) : null;
  if (error) return error;
  error = optionalPositiveIntegerError(value.contextWindow, `${path}.contextWindow`);
  if (error) return error;
  error = effortListError(value.efforts, `${path}.efforts`);
  if (error) return error;
  if (value.defaultEffort !== undefined && !isModelEffort(value.defaultEffort)) {
    return `${path}.defaultEffort must be a supported effort value when present`;
  }
  const effectiveEfforts =
    Array.isArray(value.efforts) && value.efforts.every(isModelEffort)
      ? (value.efforts as ModelEffort[])
      : baseEfforts;
  if (
    value.defaultEffort !== undefined &&
    effectiveEfforts !== undefined &&
    !effectiveEfforts.includes(value.defaultEffort as ModelEffort)
  ) {
    return `${path}.defaultEffort must be included in ${path}.efforts or the base efforts`;
  }
  for (const key of ['supportsFastMode', 'defaultEnabled'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      return `${path}.${key} must be a boolean when present`;
    }
  }
  return null;
}

function tieredPricingError(
  value: unknown,
  path: string,
  allowedFields?: readonly string[],
): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return `${path} must be an array when present`;
  for (const [index, tier] of value.entries()) {
    const tierPath = `${path}[${index}]`;
    if (!isPlainObject(tier)) return `${tierPath} must be an object`;
    const unknownField = allowedFields ? unknownFieldError(tier, allowedFields, tierPath) : null;
    if (unknownField) return unknownField;
    if (
      !Array.isArray(tier.range) ||
      tier.range.length !== 2 ||
      tier.range.some((bound) => typeof bound !== 'number' || !Number.isFinite(bound)) ||
      tier.range[0] < 0 ||
      tier.range[1] < tier.range[0]
    ) {
      return `${tierPath}.range must be an ascending pair of non-negative finite numbers`;
    }
    for (const field of [
      'inputCostPerToken',
      'outputCostPerToken',
      'cacheReadInputTokenCost',
      'cacheCreationInputTokenCost',
    ] as const) {
      const error = optionalFiniteNumberError(tier[field], `${tierPath}.${field}`, {
        nonNegative: true,
      });
      if (error) return error;
    }
  }
  return null;
}

function modelEntryError(value: unknown, path: string, strictNestedFields = false): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  if (typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 256) {
    return `${path}.id must be a non-empty string of at most 256 characters`;
  }
  if (!isModelCurrency(value.currency)) {
    return `${path}.currency must be CNY or USD`;
  }
  if (
    !Array.isArray(value.agents) ||
    value.agents.length === 0 ||
    value.agents.some((agent) => !isModelAgent(agent))
  ) {
    return `${path}.agents must be a non-empty array of supported agents`;
  }
  const supportedAgents = value.agents as ModelAgent[];

  for (const [key, max] of [
    ['name', 256],
    ['group', 128],
    ['description', 2_000],
  ] as const) {
    const error = optionalStringError(value[key], `${path}.${key}`, max);
    if (error) return error;
  }
  for (const key of ['contextWindow', 'maxOutputTokens'] as const) {
    const error = optionalPositiveIntegerError(value[key], `${path}.${key}`);
    if (error) return error;
  }
  let error = effortListError(value.efforts, `${path}.efforts`);
  if (error) return error;
  if (value.defaultEffort !== undefined && !isModelEffort(value.defaultEffort)) {
    return `${path}.defaultEffort must be a supported effort value when present`;
  }
  const efforts =
    Array.isArray(value.efforts) && value.efforts.every(isModelEffort)
      ? (value.efforts as ModelEffort[])
      : undefined;
  if (
    value.defaultEffort !== undefined &&
    efforts !== undefined &&
    !efforts.includes(value.defaultEffort as ModelEffort)
  ) {
    return `${path}.defaultEffort must be included in ${path}.efforts`;
  }
  error = optionalFiniteNumberError(value.sortOrder, `${path}.sortOrder`);
  if (error) return error;
  for (const key of ['supportsFastMode', 'defaultEnabled'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      return `${path}.${key} must be a boolean when present`;
    }
  }

  for (const field of PRICING_FIELDS) {
    error = optionalFiniteNumberError(value[field], `${path}.${field}`, {
      nonNegative: field !== 'costDiscount',
    });
    if (error) return error;
  }
  error = tieredPricingError(
    value.tieredPricing,
    `${path}.tieredPricing`,
    strictNestedFields ? MODEL_TIERED_PRICING_FIELDS : undefined,
  );
  if (error) return error;

  if (value.perAgent !== undefined) {
    if (!isPlainObject(value.perAgent)) return `${path}.perAgent must be an object when present`;
    for (const [agent, override] of Object.entries(value.perAgent)) {
      if (!isModelAgent(agent)) return `${path}.perAgent.${agent} is not a supported agent`;
      if (!supportedAgents.includes(agent)) {
        return `${path}.perAgent.${agent} must be included in ${path}.agents`;
      }
      error = overrideError(
        override,
        `${path}.perAgent.${agent}`,
        efforts,
        strictNestedFields ? MODEL_REGISTRY_AGENT_OVERRIDE_FIELDS : undefined,
      );
      if (error) return error;
    }
  }
  return null;
}

function isModelProvenance(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    MODEL_ACCESS_PROVENANCES.includes(value as (typeof MODEL_ACCESS_PROVENANCES)[number])
  );
}

/**
 * The resolver emits provenance **per field** (`{ contextWindow: 'override', modalities:
 * 'knowledge-base', … }`), so accept a plain object whose values are all supported provenance
 * strings. A single top-level provenance string stays accepted for backward compatibility.
 */
function isModelProvenanceValue(value: unknown): boolean {
  if (isModelProvenance(value)) return true;
  return isPlainObject(value) && Object.values(value).every((entry) => isModelProvenance(entry));
}

function requiredStringError(value: unknown, path: string, max: number): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return `${path} must be a non-empty string`;
  }
  if (value.length > max) return `${path} must contain at most ${max} characters`;
  return null;
}

function requiredPositiveIntegerError(value: unknown, path: string): string | null {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    return `${path} must be a positive integer`;
  }
  return null;
}

function stringArrayError(value: unknown, path: string): string | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return `${path} must be an array of strings`;
  }
  return null;
}

function optionalChatModeError(value: unknown, path: string): string | null {
  if (value === undefined) return null;
  return isModelChatMode(value) ? null : `${path} must be chat or responses when present`;
}

function modalitiesError(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  const unknownField = unknownFieldError(value, RESOLVED_MODEL_MODALITIES_FIELDS, path);
  if (unknownField) return unknownField;
  return (
    stringArrayError(value.input, `${path}.input`) ??
    stringArrayError(value.output, `${path}.output`)
  );
}

function capabilitiesError(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  for (const key of ['reasoning', 'toolCall', 'attachment', 'temperature']) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      return `${path}.${key} must be a boolean when present`;
    }
  }
  return null;
}

function providerReportedError(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  let error = unknownFieldError(value, PROVIDER_REPORTED_MODEL_FIELDS, path);
  if (error) return error;
  error = optionalPositiveIntegerError(value.contextWindow, `${path}.contextWindow`);
  if (error) return error;
  error = optionalPositiveIntegerError(value.maxOutput, `${path}.maxOutput`);
  if (error) return error;
  if (value.modalities !== undefined) {
    error = modalitiesError(value.modalities, `${path}.modalities`);
    if (error) return error;
  }
  if (value.capabilities !== undefined) {
    error = capabilitiesError(value.capabilities, `${path}.capabilities`);
    if (error) return error;
  }
  error = optionalChatModeError(value.mode, `${path}.mode`);
  if (error) return error;
  error = optionalStringError(value.type, `${path}.type`, 128);
  if (error) return error;
  return null;
}

function resolvedModelError(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  let error = unknownFieldError(value, RESOLVED_MODEL_FIELDS, path);
  if (error) return error;
  error = requiredStringError(value.id, `${path}.id`, 256);
  if (error) return error;
  error = requiredStringError(value.name, `${path}.name`, 256);
  if (error) return error;
  for (const [key, max] of [
    ['description', 2_000],
    ['family', 128],
    ['group', 128],
    ['category', 128],
    ['releaseDate', 64],
  ] as const) {
    error = optionalStringError(value[key], `${path}.${key}`, max);
    if (error) return error;
  }
  error = optionalChatModeError(value.mode, `${path}.mode`);
  if (error) return error;
  error = requiredPositiveIntegerError(value.contextWindow, `${path}.contextWindow`);
  if (error) return error;
  error = optionalPositiveIntegerError(value.maxOutput, `${path}.maxOutput`);
  if (error) return error;
  error = optionalFiniteNumberError(value.sortOrder, `${path}.sortOrder`);
  if (error) return error;
  error = effortListError(value.efforts, `${path}.efforts`);
  if (error) return error;
  if (!Array.isArray(value.efforts)) return `${path}.efforts must be an array`;
  if (value.defaultEffort !== null && !isModelEffort(value.defaultEffort)) {
    return `${path}.defaultEffort must be a supported effort value or null`;
  }
  if (value.defaultEffort !== null && !value.efforts.includes(value.defaultEffort)) {
    return `${path}.defaultEffort must be included in ${path}.efforts`;
  }
  if (value.effortDisplayNames !== undefined) {
    if (!isPlainObject(value.effortDisplayNames))
      return `${path}.effortDisplayNames must be an object`;
    for (const [effort, label] of Object.entries(value.effortDisplayNames)) {
      if (!isModelEffort(effort))
        return `${path}.effortDisplayNames.${effort} is not a supported effort`;
      error = requiredStringError(label, `${path}.effortDisplayNames.${effort}`, 256);
      if (error) return error;
    }
  }
  for (const key of ['supportsFastMode', 'defaultEnabled'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      return `${path}.${key} must be a boolean when present`;
    }
  }
  if (value.modalities !== undefined) {
    error = modalitiesError(value.modalities, `${path}.modalities`);
    if (error) return error;
  }
  if (value.capabilities !== undefined) {
    error = capabilitiesError(value.capabilities, `${path}.capabilities`);
    if (error) return error;
  }
  if (value.cost !== undefined) {
    if (!isPlainObject(value.cost)) return `${path}.cost must be an object`;
    error = unknownFieldError(value.cost, RESOLVED_MODEL_COST_FIELDS, `${path}.cost`);
    if (error) return error;
    for (const field of ['input', 'output', 'cacheRead', 'cacheWrite'] as const) {
      error = optionalFiniteNumberError(value.cost[field], `${path}.cost.${field}`, {
        nonNegative: true,
      });
      if (error) return error;
    }
  }
  if (
    value.status !== undefined &&
    !['active', 'alpha', 'deprecated'].includes(value.status as string)
  ) {
    return `${path}.status must be active, alpha, or deprecated when present`;
  }
  if (value.provenance !== undefined && !isModelProvenanceValue(value.provenance)) {
    return `${path}.provenance must be a supported provenance value or per-field provenance map when present`;
  }
  return null;
}

function resolveRequestModelError(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  let error = unknownFieldError(value, RESOLVE_REQUEST_MODEL_FIELDS, path);
  if (error) return error;
  error = requiredStringError(value.id, `${path}.id`, 256);
  if (error) return error;
  error = optionalStringError(value.name, `${path}.name`, 256);
  if (error) return error;
  if (value.providerReported !== undefined) {
    error = providerReportedError(value.providerReported, `${path}.providerReported`);
    if (error) return error;
  }
  return null;
}

function parseEntries(value: unknown, path: string, kind: 'request' | 'response'): string | null {
  if (!Array.isArray(value)) return `${path} must be an array`;
  const keys = new Set<string>();
  for (const [index, entry] of value.entries()) {
    const entryPath = `${path}[${index}]`;
    if (!isPlainObject(entry)) return `${entryPath} must be an object`;
    let error = unknownFieldError(
      entry,
      kind === 'request' ? RESOLVE_REQUEST_ENTRY_FIELDS : RESOLVE_RESPONSE_ENTRY_FIELDS,
      entryPath,
    );
    if (error) return error;
    error = requiredStringError(entry.providerId, `${entryPath}.providerId`, 128);
    if (error) return error;
    if (!isModelAgent(entry.agent)) return `${entryPath}.agent must be a supported agent`;
    if (kind === 'request') {
      error = optionalStringError(entry.wireProtocol, `${entryPath}.wireProtocol`, 128);
      if (error) return error;
    }
    if (!Array.isArray(entry.models)) return `${entryPath}.models must be an array`;
    const key = `${entry.providerId} ${entry.agent}`;
    if (keys.has(key)) return `${entryPath} must be unique by providerId and agent`;
    keys.add(key);
    const modelIds = new Set<string>();
    for (const [modelIndex, model] of entry.models.entries()) {
      const modelPath = `${entryPath}.models[${modelIndex}]`;
      error =
        kind === 'request'
          ? resolveRequestModelError(model, modelPath)
          : resolvedModelError(model, modelPath);
      if (error) return error;
      const id = (model as PlainObject).id as string;
      if (modelIds.has(id)) return `${modelPath}.id must be unique`;
      modelIds.add(id);
    }
  }
  return null;
}

/** Strictly parse a v2 resolve request. Invalid responses must not replace a cached snapshot. */
export function parseResolveRequest(value: unknown): ModelAccessParseResult<ResolveRequest> {
  if (!isPlainObject(value)) return fail('request must be an object');
  const unknownField = unknownFieldError(value, RESOLVE_REQUEST_FIELDS, 'request');
  if (unknownField) return fail(unknownField);
  if (value.schemaVersion !== MODEL_ACCESS_RESOLVE_SCHEMA_VERSION) {
    return fail(`request.schemaVersion must be ${MODEL_ACCESS_RESOLVE_SCHEMA_VERSION}`);
  }
  const error = parseEntries(value.entries, 'request.entries', 'request');
  return error ? fail(error) : ok(value as unknown as ResolveRequest);
}

/** Strictly parse a v2 resolve response. Invalid responses must not replace a cached snapshot. */
export function parseResolveResponse(value: unknown): ModelAccessParseResult<ResolveResponse> {
  if (!isPlainObject(value)) return fail('response must be an object');
  const unknownField = unknownFieldError(value, RESOLVE_RESPONSE_FIELDS, 'response');
  if (unknownField) return fail(unknownField);
  if (value.schemaVersion !== MODEL_ACCESS_RESOLVE_SCHEMA_VERSION) {
    return fail(`response.schemaVersion must be ${MODEL_ACCESS_RESOLVE_SCHEMA_VERSION}`);
  }
  const revisionError = requiredStringError(
    value.knowledgeRevision,
    'response.knowledgeRevision',
    256,
  );
  if (revisionError) return fail(revisionError);
  const error = parseEntries(value.entries, 'response.entries', 'response');
  return error ? fail(error) : ok(value as unknown as ResolveResponse);
}

function v2ModelIncrementalError(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  let error = unknownFieldError(value, LIST_MODELS_V2_MODEL_FIELDS, path);
  if (error) return error;
  for (const [key, max] of [
    ['family', 128],
    ['category', 128],
    ['releaseDate', 64],
  ] as const) {
    error = optionalStringError(value[key], `${path}.${key}`, max);
    if (error) return error;
  }
  error = optionalChatModeError(value.mode, `${path}.mode`);
  if (error) return error;
  error = optionalPositiveIntegerError(value.maxOutput, `${path}.maxOutput`);
  if (error) return error;
  if (value.effortDisplayNames !== undefined) {
    if (!isPlainObject(value.effortDisplayNames))
      return `${path}.effortDisplayNames must be an object`;
    for (const [effort, label] of Object.entries(value.effortDisplayNames)) {
      if (!isModelEffort(effort))
        return `${path}.effortDisplayNames.${effort} is not a supported effort`;
      error = optionalStringError(label, `${path}.effortDisplayNames.${effort}`, 256);
      if (error) return error;
    }
  }
  if (value.modalities !== undefined) {
    error = modalitiesError(value.modalities, `${path}.modalities`);
    if (error) return error;
  }
  if (value.capabilities !== undefined) {
    error = capabilitiesError(value.capabilities, `${path}.capabilities`);
    if (error) return error;
  }
  if (value.cost !== undefined) {
    if (!isPlainObject(value.cost)) return `${path}.cost must be an object`;
    error = unknownFieldError(value.cost, RESOLVED_MODEL_COST_FIELDS, `${path}.cost`);
    if (error) return error;
    for (const field of ['input', 'output', 'cacheRead', 'cacheWrite'] as const) {
      error = optionalFiniteNumberError(value.cost[field], `${path}.cost.${field}`, {
        nonNegative: true,
      });
      if (error) return error;
    }
  }
  if (
    value.status !== undefined &&
    !['active', 'alpha', 'deprecated'].includes(value.status as string)
  ) {
    return `${path}.status must be active, alpha, or deprecated when present`;
  }
  const newSessionDefaultErrorMessage = newSessionDefaultError(
    value.newSessionDefault,
    `${path}.newSessionDefault`,
    new Set(value.agents as ModelAgent[]),
  );
  if (newSessionDefaultErrorMessage) return newSessionDefaultErrorMessage;
  if (value.provenance !== undefined && !isModelProvenanceValue(value.provenance)) {
    return `${path}.provenance must be a supported provenance value or per-field provenance map when present`;
  }
  return null;
}

/** Strictly parse the additive v2 ListModels response envelope. */
export function parseListModelsResponseV2(
  value: unknown,
): ModelAccessParseResult<ListModelsResponseV2> {
  if (!isPlainObject(value)) return fail('response must be an object');
  const unknownField = unknownFieldError(value, LIST_MODELS_V2_FIELDS, 'response');
  if (unknownField) return fail(unknownField);
  if (value.schemaVersion !== MODEL_ACCESS_RESOLVE_SCHEMA_VERSION) {
    return fail(`response.schemaVersion must be ${MODEL_ACCESS_RESOLVE_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(value.models)) return fail('response.models must be an array');
  const modelIds = new Set<string>();
  for (const [index, model] of value.models.entries()) {
    const path = `response.models[${index}]`;
    const error = modelEntryError(model, path, true) ?? v2ModelIncrementalError(model, path);
    if (error) return fail(error);
    if (isPlainObject(model) && typeof model.id === 'string') {
      if (modelIds.has(model.id)) return fail(`${path}.id must be unique`);
      modelIds.add(model.id);
    }
  }
  return ok(value as unknown as ListModelsResponseV2);
}

export function parseProviderReportedModel(
  value: unknown,
): ModelAccessParseResult<ProviderReportedModel> {
  const error = providerReportedError(value, 'providerReported');
  return error ? fail(error) : ok(value as ProviderReportedModel);
}

export function parseListModelsResponse(
  value: unknown,
): ModelAccessParseResult<ListModelsResponse> {
  if (!isPlainObject(value)) return fail('response must be an object');
  if (value.schemaVersion !== MODEL_ACCESS_CATALOG_SCHEMA_VERSION) {
    return fail(`response.schemaVersion must be ${MODEL_ACCESS_CATALOG_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(value.models)) return fail('response.models must be an array');
  const modelIds = new Set<string>();
  for (const [index, model] of value.models.entries()) {
    if (isPlainObject(model) && typeof model.id === 'string') {
      if (modelIds.has(model.id)) {
        return fail(`response.models[${index}].id must be unique`);
      }
      modelIds.add(model.id);
    }
    const error = modelEntryError(model, `response.models[${index}]`);
    if (error) return fail(error);
  }
  return ok(value as unknown as ListModelsResponse);
}

function referencePriceError(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  let error = unknownFieldError(value, MODEL_REFERENCE_PRICE_FIELDS, path);
  if (error) return error;
  if (!isModelCurrency(value.currency)) return `${path}.currency must be CNY or USD`;
  if (!isModelPriceVariant(value.variant)) {
    return `${path}.variant must be a supported price variant`;
  }
  for (const field of [
    'inputPerMtok',
    'outputPerMtok',
    'cacheReadPerMtok',
    'cacheWritePerMtok',
    'cacheWrite1hPerMtok',
  ] as const) {
    error = optionalFiniteNumberError(value[field], `${path}.${field}`, {
      nonNegative: true,
    });
    if (error) return error;
  }
  if (value.inputPerMtok === undefined || value.outputPerMtok === undefined) {
    return `${path} must declare inputPerMtok and outputPerMtok`;
  }
  for (const field of ['minInputTokens', 'maxInputTokens'] as const) {
    if (
      value[field] !== undefined &&
      (!Number.isInteger(value[field]) || (value[field] as number) < 0)
    ) {
      return `${path}.${field} must be a non-negative integer when present`;
    }
  }
  const min = typeof value.minInputTokens === 'number' ? value.minInputTokens : 0;
  if (typeof value.maxInputTokens === 'number' && value.maxInputTokens <= min) {
    return `${path}.maxInputTokens must be greater than minInputTokens`;
  }
  if (!isIsoDate(value.effectiveFrom)) {
    return `${path}.effectiveFrom must be an ISO calendar date`;
  }
  if (value.effectiveUntil !== undefined) {
    if (!isIsoDate(value.effectiveUntil)) {
      return `${path}.effectiveUntil must be an ISO calendar date when present`;
    }
    if (value.effectiveUntil <= value.effectiveFrom) {
      return `${path}.effectiveUntil must be after effectiveFrom`;
    }
  }
  if (!isPlainObject(value.source)) return `${path}.source must be an object`;
  error = unknownFieldError(value.source, MODEL_REFERENCE_PRICE_SOURCE_FIELDS, `${path}.source`);
  if (error) return error;
  if (value.source.kind !== 'provider-official') {
    return `${path}.source.kind must be provider-official`;
  }
  if (!isHttpsUrl(value.source.url)) return `${path}.source.url must be an HTTPS URL`;
  if (!isIsoDate(value.source.verifiedAt)) {
    return `${path}.source.verifiedAt must be an ISO calendar date`;
  }
  return null;
}

function registryRouteError(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  let error = unknownFieldError(value, MODEL_REGISTRY_ROUTE_FIELDS, path);
  if (error) return error;
  if (!isSafeSlug(value.providerId)) {
    return `${path}.providerId must use letters, numbers, underscores, or hyphens`;
  }
  if (
    typeof value.modelId !== 'string' ||
    value.modelId.length === 0 ||
    value.modelId.length > 256
  ) {
    return `${path}.modelId must be a non-empty string of at most 256 characters`;
  }
  if (
    !Array.isArray(value.agents) ||
    value.agents.length === 0 ||
    value.agents.some((agent) => !isModelAgent(agent)) ||
    new Set(value.agents).size !== value.agents.length
  ) {
    return `${path}.agents must be a unique non-empty array of supported agents`;
  }
  if (value.referencePrices !== undefined) {
    if (!Array.isArray(value.referencePrices)) {
      return `${path}.referencePrices must be an array when present`;
    }
    for (const [index, price] of value.referencePrices.entries()) {
      error = referencePriceError(price, `${path}.referencePrices[${index}]`);
      if (error) return error;
      for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
        const previous = value.referencePrices[previousIndex];
        if (
          isPlainObject(price) &&
          isPlainObject(previous) &&
          referencePriceRangesOverlap(previous, price)
        ) {
          return `${path}.referencePrices[${index}] overlaps referencePrices[${previousIndex}] for the same currency and variant`;
        }
      }
    }
  }
  return null;
}

function newSessionDefaultError(
  value: unknown,
  path: string,
  supportedAgents: ReadonlySet<ModelAgent>,
): string | null {
  if (value === undefined) return null;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((agent) => !isModelAgent(agent)) ||
    new Set(value).size !== value.length
  ) {
    return `${path} must be a unique non-empty array of supported agents`;
  }
  for (const agent of value as ModelAgent[]) {
    if (!supportedAgents.has(agent)) {
      return `${path}.${agent} must be supported by the model`;
    }
  }
  return null;
}

function registryEntryError(
  value: unknown,
  path: string,
  schemaVersion: typeof MODEL_REGISTRY_LEGACY_SCHEMA_VERSION | typeof MODEL_REGISTRY_SCHEMA_VERSION,
): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  let error = unknownFieldError(
    value,
    schemaVersion === MODEL_REGISTRY_LEGACY_SCHEMA_VERSION
      ? MODEL_REGISTRY_ENTRY_V1_FIELDS
      : MODEL_REGISTRY_ENTRY_V2_FIELDS,
    path,
  );
  if (error) return error;
  if (typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 256) {
    return `${path}.id must be a non-empty string of at most 256 characters`;
  }
  if (typeof value.name !== 'string' || value.name.length === 0 || value.name.length > 256) {
    return `${path}.name must be a non-empty string of at most 256 characters`;
  }
  if (value.status !== undefined && !isModelRegistryStatus(value.status)) {
    return `${path}.status must be a supported registry status`;
  }
  for (const [key, max] of [
    ['group', 128],
    ['description', 2_000],
  ] as const) {
    error = optionalStringError(value[key], `${path}.${key}`, max);
    if (error) return error;
  }
  for (const key of ['contextWindow', 'maxOutputTokens'] as const) {
    error = optionalPositiveIntegerError(value[key], `${path}.${key}`);
    if (error) return error;
  }
  error = effortListError(value.efforts, `${path}.efforts`);
  if (error) return error;
  if (value.defaultEffort !== undefined && !isModelEffort(value.defaultEffort)) {
    return `${path}.defaultEffort must be a supported effort value when present`;
  }
  const efforts =
    Array.isArray(value.efforts) && value.efforts.every(isModelEffort)
      ? (value.efforts as ModelEffort[])
      : undefined;
  if (
    value.defaultEffort !== undefined &&
    efforts !== undefined &&
    !efforts.includes(value.defaultEffort as ModelEffort)
  ) {
    return `${path}.defaultEffort must be included in ${path}.efforts`;
  }
  error = optionalFiniteNumberError(value.sortOrder, `${path}.sortOrder`);
  if (error) return error;
  for (const key of ['supportsFastMode', 'defaultEnabled'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      return `${path}.${key} must be a boolean when present`;
    }
  }
  if (!Array.isArray(value.routes) || value.routes.length === 0) {
    return `${path}.routes must be a non-empty array`;
  }
  const routeKeys = new Set<string>();
  const supportedAgents = new Set<ModelAgent>();
  for (const [index, route] of value.routes.entries()) {
    error = registryRouteError(route, `${path}.routes[${index}]`);
    if (error) return error;
    const typedRoute = route as {
      providerId: string;
      modelId: string;
      agents: ModelAgent[];
    };
    const routeKey = `${typedRoute.providerId}\u0000${typedRoute.modelId}`;
    if (routeKeys.has(routeKey)) return `${path}.routes[${index}] must be unique`;
    routeKeys.add(routeKey);
    for (const agent of typedRoute.agents) supportedAgents.add(agent);
  }
  if (schemaVersion === MODEL_REGISTRY_SCHEMA_VERSION) {
    const newSessionDefaultErrorMessage = newSessionDefaultError(
      value.newSessionDefault,
      `${path}.newSessionDefault`,
      supportedAgents,
    );
    if (newSessionDefaultErrorMessage) return newSessionDefaultErrorMessage;
  }
  if (value.perAgent !== undefined) {
    if (!isPlainObject(value.perAgent)) return `${path}.perAgent must be an object when present`;
    for (const [agent, override] of Object.entries(value.perAgent)) {
      if (!isModelAgent(agent)) return `${path}.perAgent.${agent} is not a supported agent`;
      if (!supportedAgents.has(agent)) {
        return `${path}.perAgent.${agent} must be supported by at least one route`;
      }
      error = overrideError(
        override,
        `${path}.perAgent.${agent}`,
        efforts,
        MODEL_REGISTRY_AGENT_OVERRIDE_FIELDS,
      );
      if (error) return error;
    }
  }
  return null;
}

export function parseModelRegistry(value: unknown): ModelAccessParseResult<ModelRegistry> {
  if (!isPlainObject(value)) return fail('modelRegistry must be an object');
  const unknownField = unknownFieldError(value, MODEL_REGISTRY_FIELDS, 'modelRegistry');
  if (unknownField) return fail(unknownField);
  if (
    value.schemaVersion !== MODEL_REGISTRY_LEGACY_SCHEMA_VERSION &&
    value.schemaVersion !== MODEL_REGISTRY_SCHEMA_VERSION
  ) {
    return fail(
      `modelRegistry.schemaVersion must be ${MODEL_REGISTRY_LEGACY_SCHEMA_VERSION} or ${MODEL_REGISTRY_SCHEMA_VERSION}`,
    );
  }
  if (!isIsoTimestamp(value.updatedAt)) {
    return fail('modelRegistry.updatedAt must be an ISO timestamp');
  }
  if (!Array.isArray(value.models)) return fail('modelRegistry.models must be an array');
  const modelIds = new Set<string>();
  for (const [index, model] of value.models.entries()) {
    if (isPlainObject(model) && typeof model.id === 'string') {
      if (modelIds.has(model.id)) {
        return fail(`modelRegistry.models[${index}].id must be unique`);
      }
      modelIds.add(model.id);
    }
    const error = registryEntryError(model, `modelRegistry.models[${index}]`, value.schemaVersion);
    if (error) return fail(error);
  }
  return ok(value as unknown as ModelRegistry);
}
