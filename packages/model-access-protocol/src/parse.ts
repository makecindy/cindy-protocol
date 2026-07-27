import {
  MODEL_ACCESS_AGENTS,
  MODEL_ACCESS_CATALOG_SCHEMA_VERSION,
  MODEL_ACCESS_CURRENCIES,
  MODEL_ACCESS_EFFORTS,
  type ListModelsResponse,
  type ModelAccessParseResult,
  type ModelAgent,
  type ModelCurrency,
  type ModelEffort,
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

function ok<T>(value: T): ModelAccessParseResult<T> {
  return { ok: true, value };
}

function fail<T>(error: string): ModelAccessParseResult<T> {
  return { ok: false, error };
}

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isModelCurrency(value: unknown): value is ModelCurrency {
  return typeof value === 'string' && MODEL_ACCESS_CURRENCIES.includes(value as ModelCurrency);
}

function isModelAgent(value: unknown): value is ModelAgent {
  return typeof value === 'string' && MODEL_ACCESS_AGENTS.includes(value as ModelAgent);
}

function isModelEffort(value: unknown): value is ModelEffort {
  return typeof value === 'string' && MODEL_ACCESS_EFFORTS.includes(value as ModelEffort);
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
): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  let error = optionalPositiveIntegerError(value.contextWindow, `${path}.contextWindow`);
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

function tieredPricingError(value: unknown, path: string): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return `${path} must be an array when present`;
  for (const [index, tier] of value.entries()) {
    const tierPath = `${path}[${index}]`;
    if (!isPlainObject(tier)) return `${tierPath} must be an object`;
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

function modelEntryError(value: unknown, path: string): string | null {
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
  error = tieredPricingError(value.tieredPricing, `${path}.tieredPricing`);
  if (error) return error;

  if (value.perAgent !== undefined) {
    if (!isPlainObject(value.perAgent)) return `${path}.perAgent must be an object when present`;
    for (const [agent, override] of Object.entries(value.perAgent)) {
      if (!isModelAgent(agent)) return `${path}.perAgent.${agent} is not a supported agent`;
      if (!supportedAgents.includes(agent)) {
        return `${path}.perAgent.${agent} must be included in ${path}.agents`;
      }
      error = overrideError(override, `${path}.perAgent.${agent}`, efforts);
      if (error) return error;
    }
  }
  return null;
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
