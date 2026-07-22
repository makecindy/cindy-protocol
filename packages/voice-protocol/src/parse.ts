/** Runtime validation for every Cindy-owned voice HTTP payload. */

import {
  VOICE_CLIENT_KINDS,
  VOICE_MAX_REFINER_PAYLOAD_CHARS,
  VOICE_PROTOCOL_PROFILES,
  VOICE_PROTOCOL_VERSION,
  type CreateVoiceSessionRequest,
  type CreateVoiceSessionResponse,
  type VoiceClientKind,
  type VoiceErrorResponse,
  type VoiceParseResult,
  type VoiceProtocolProfile,
  type VoiceRefineRequest,
  type VoiceRefinerUserPayload,
} from './types';

type PlainObject = Record<string, unknown>;

function ok<T>(value: T): VoiceParseResult<T> {
  return { ok: true, value };
}

function fail<T>(error: string): VoiceParseResult<T> {
  return { ok: false, error };
}

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: PlainObject, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function stringError(
  value: unknown,
  path: string,
  options: { min?: number; max: number },
): string | null {
  if (typeof value !== 'string') return `${path} must be a string`;
  if (options.min !== undefined && value.length < options.min) {
    return `${path} must contain at least ${options.min} character(s)`;
  }
  if (value.length > options.max) return `${path} must contain at most ${options.max} characters`;
  return null;
}

function optionalStringError(
  value: unknown,
  path: string,
  options: { min?: number; max: number },
): string | null {
  return value === undefined ? null : stringError(value, path, options);
}

function optionalCountError(value: unknown, path: string): string | null {
  if (value === undefined) return null;
  if (!Number.isInteger(value) || (value as number) < 0) {
    return `${path} must be a non-negative integer when present`;
  }
  return null;
}

export function isVoiceClientKind(value: unknown): value is VoiceClientKind {
  return typeof value === 'string' && VOICE_CLIENT_KINDS.includes(value as VoiceClientKind);
}

export function isVoiceProtocolProfile(value: unknown): value is VoiceProtocolProfile {
  return (
    typeof value === 'string' && VOICE_PROTOCOL_PROFILES.includes(value as VoiceProtocolProfile)
  );
}

function protocolVersionError(value: unknown, path: string): string | null {
  if (value === undefined || value === VOICE_PROTOCOL_VERSION) return null;
  return `${path} must be ${VOICE_PROTOCOL_VERSION} when present`;
}

export function parseCreateVoiceSessionRequest(
  value: unknown,
): VoiceParseResult<CreateVoiceSessionRequest> {
  if (!isPlainObject(value)) return fail('request must be an object');

  let error = protocolVersionError(value.protocolVersion, 'request.protocolVersion');
  if (error) return fail(error);
  if (value.mode !== undefined && value.mode !== 'dictation') {
    return fail('request.mode must be dictation when present');
  }
  error = optionalStringError(value.language, 'request.language', { min: 1, max: 32 });
  if (error) return fail(error);
  if (!isVoiceClientKind(value.client)) {
    return fail('request.client must be desktop or mobile');
  }
  error = optionalStringError(value.clientVersion, 'request.clientVersion', { max: 64 });
  if (error) return fail(error);
  error = stringError(value.asrProvider, 'request.asrProvider', { min: 1, max: 80 });
  if (error) return fail(error);
  error = optionalStringError(value.refinerProvider, 'request.refinerProvider', {
    min: 1,
    max: 80,
  });
  if (error) return fail(error);

  return ok(value as unknown as CreateVoiceSessionRequest);
}

export function parseCreateVoiceSessionResponse(
  value: unknown,
): VoiceParseResult<CreateVoiceSessionResponse> {
  if (!isPlainObject(value)) return fail('response must be an object');

  let error = protocolVersionError(value.protocolVersion, 'response.protocolVersion');
  if (error) return fail(error);
  error = stringError(value.sessionId, 'response.sessionId', { min: 1, max: 200 });
  if (error) return fail(error);
  error = stringError(value.ticket, 'response.ticket', { min: 1, max: 4096 });
  if (error) return fail(error);
  error = stringError(value.expiresAt, 'response.expiresAt', { min: 1, max: 64 });
  if (error) return fail(error);
  if (Number.isNaN(Date.parse(value.expiresAt as string))) {
    return fail('response.expiresAt must be an ISO-compatible timestamp');
  }

  if (!isPlainObject(value.asr)) return fail('response.asr must be an object');
  error = stringError(value.asr.provider, 'response.asr.provider', { min: 1, max: 80 });
  if (error) return fail(error);
  error = stringError(value.asr.websocketUrl, 'response.asr.websocketUrl', {
    min: 1,
    max: 2048,
  });
  if (error) return fail(error);
  if (!/^wss?:\/\//i.test(value.asr.websocketUrl as string)) {
    return fail('response.asr.websocketUrl must use ws or wss');
  }
  if (!isVoiceProtocolProfile(value.asr.protocolProfile)) {
    return fail('response.asr.protocolProfile is unsupported');
  }
  if (
    !Number.isInteger(value.asr.sampleRate) ||
    (value.asr.sampleRate as number) <= 0 ||
    (value.asr.sampleRate as number) > 48_000
  ) {
    return fail('response.asr.sampleRate must be a positive integer no greater than 48000');
  }
  error = optionalStringError(value.asr.model, 'response.asr.model', { min: 1, max: 160 });
  if (error) return fail(error);
  error = optionalStringError(value.asr.resourceId, 'response.asr.resourceId', {
    min: 1,
    max: 160,
  });
  if (error) return fail(error);

  if (!isPlainObject(value.refiner)) return fail('response.refiner must be an object');
  if (typeof value.refiner.enabled !== 'boolean') {
    return fail('response.refiner.enabled must be a boolean');
  }
  if (value.refiner.enabled) {
    error = stringError(value.refiner.provider, 'response.refiner.provider', {
      min: 1,
      max: 80,
    });
    if (error) return fail(error);
  } else if (value.refiner.provider !== undefined) {
    return fail('response.refiner.provider must be absent when refinement is disabled');
  }

  return ok(value as unknown as CreateVoiceSessionResponse);
}

export function parseVoiceRefineRequest(value: unknown): VoiceParseResult<VoiceRefineRequest> {
  if (!isPlainObject(value)) return fail('request must be an object');
  let error = optionalStringError(value.prompt_cache_key, 'request.prompt_cache_key', { max: 200 });
  if (error) return fail(error);
  if (!Array.isArray(value.messages) || value.messages.length !== 2) {
    return fail('request.messages must contain exactly system and user messages');
  }

  const [system, user] = value.messages;
  if (!isPlainObject(system) || system.role !== 'system') {
    return fail('request.messages[0].role must be system');
  }
  error = stringError(system.content, 'request.messages[0].content', { min: 1, max: 32_000 });
  if (error) return fail(error);
  if (!isPlainObject(user) || user.role !== 'user') {
    return fail('request.messages[1].role must be user');
  }
  error = stringError(user.content, 'request.messages[1].content', { min: 1, max: 64_000 });
  if (error) return fail(error);

  return ok(value as unknown as VoiceRefineRequest);
}

function validateRefinementContext(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  const limits: Readonly<Record<string, number>> = {
    uiLanguage: 32,
    sourceLanguage: 32,
    userRefinementInstructions: 1_000,
    userDictionary: 4_000,
    voiceInputHistory: 20_000,
    selectionBefore: 1_200,
    selectedText: 1_200,
    selectionAfter: 1_200,
  };
  if (!hasOnlyKeys(value, Object.keys(limits))) return `${path} contains an unknown field`;
  for (const [key, max] of Object.entries(limits)) {
    const error = optionalStringError(value[key], `${path}.${key}`, { max });
    if (error) return error;
  }
  return null;
}

function validateDictationRefinementInput(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  const keys = [
    'promptVersion',
    'context',
    'dictationText',
    'replyToMessage',
    'userDictionaryMatches',
  ];
  if (!hasOnlyKeys(value, keys)) return `${path} contains an unknown field`;
  let error = stringError(value.promptVersion, `${path}.promptVersion`, { min: 1, max: 80 });
  if (error) return error;
  error = validateRefinementContext(value.context, `${path}.context`);
  if (error) return error;
  error = stringError(value.dictationText, `${path}.dictationText`, { min: 1, max: 20_000 });
  if (error) return error;
  error = optionalStringError(value.replyToMessage, `${path}.replyToMessage`, { max: 500 });
  if (error) return error;
  return optionalStringError(value.userDictionaryMatches, `${path}.userDictionaryMatches`, {
    max: 1_800,
  });
}

function validateAlias(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  if (!hasOnlyKeys(value, ['text', 'count'])) return `${path} contains an unknown field`;
  return (
    stringError(value.text, `${path}.text`, { max: 160 }) ??
    optionalCountError(value.count, `${path}.count`)
  );
}

function validateTermBase(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  let error = stringError(value.term, `${path}.term`, { max: 160 });
  if (error) return error;
  if (value.aliases === undefined) return null;
  if (!Array.isArray(value.aliases) || value.aliases.length > 5) {
    return `${path}.aliases must be an array with at most 5 items`;
  }
  for (let index = 0; index < value.aliases.length; index += 1) {
    error = validateAlias(value.aliases[index], `${path}.aliases[${index}]`);
    if (error) return error;
  }
  return null;
}

function validateDictionaryEntry(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  if (!hasOnlyKeys(value, ['term', 'aliases', 'source', 'frequency'])) {
    return `${path} contains an unknown field`;
  }
  const error = validateTermBase(value, path);
  if (error) return error;
  if (value.source !== undefined && value.source !== 'manual' && value.source !== 'automatic') {
    return `${path}.source must be manual or automatic when present`;
  }
  return optionalCountError(value.frequency, `${path}.frequency`);
}

function validateDictionaryCandidate(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  if (!hasOnlyKeys(value, ['term', 'aliases', 'evidenceCount'])) {
    return `${path} contains an unknown field`;
  }
  return (
    validateTermBase(value, path) ??
    optionalCountError(value.evidenceCount, `${path}.evidenceCount`)
  );
}

function validateDictionaryCollection(
  value: unknown,
  path: string,
  validateItem: (item: unknown, itemPath: string) => string | null,
): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > 80) {
    return `${path} must be an array with at most 80 items`;
  }
  for (let index = 0; index < value.length; index += 1) {
    const error = validateItem(value[index], `${path}[${index}]`);
    if (error) return error;
  }
  return null;
}

function validateDictionaryLearningContext(value: unknown, path: string): string | null {
  if (value === undefined) return null;
  if (!isPlainObject(value)) return `${path} must be an object when present`;
  const limits: Readonly<Record<string, number>> = {
    uiLanguage: 32,
    sourceLanguage: 32,
    activeApp: 200,
    selectionBefore: 600,
    selectedText: 600,
    selectionAfter: 600,
  };
  if (!hasOnlyKeys(value, Object.keys(limits))) return `${path} contains an unknown field`;
  for (const [key, max] of Object.entries(limits)) {
    const error = optionalStringError(value[key], `${path}.${key}`, { max });
    if (error) return error;
  }
  return null;
}

function validateDictionaryLearningInput(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  const keys = [
    'promptVersion',
    'debug',
    'source',
    'rawTranscriptText',
    'beforeText',
    'afterText',
    'context',
    'existingEntries',
    'existingCandidates',
  ];
  if (!hasOnlyKeys(value, keys)) return `${path} contains an unknown field`;
  let error = stringError(value.promptVersion, `${path}.promptVersion`, { min: 1, max: 80 });
  if (error) return error;
  if (value.debug !== undefined && typeof value.debug !== 'boolean') {
    return `${path}.debug must be a boolean when present`;
  }
  if (
    value.source !== undefined &&
    value.source !== 'in_app' &&
    value.source !== 'external_overlay'
  ) {
    return `${path}.source must be in_app or external_overlay when present`;
  }
  error = optionalStringError(value.rawTranscriptText, `${path}.rawTranscriptText`, { max: 2_000 });
  if (error) return error;
  error = stringError(value.beforeText, `${path}.beforeText`, { max: 2_000 });
  if (error) return error;
  error = stringError(value.afterText, `${path}.afterText`, { max: 2_000 });
  if (error) return error;
  error = validateDictionaryLearningContext(value.context, `${path}.context`);
  if (error) return error;
  error = validateDictionaryCollection(
    value.existingEntries,
    `${path}.existingEntries`,
    validateDictionaryEntry,
  );
  if (error) return error;
  return validateDictionaryCollection(
    value.existingCandidates,
    `${path}.existingCandidates`,
    validateDictionaryCandidate,
  );
}

export function parseVoiceRefinerUserPayload(
  value: unknown,
): VoiceParseResult<VoiceRefinerUserPayload> {
  if (!isPlainObject(value)) return fail('payload must be an object');
  if (!hasOnlyKeys(value, ['schemaName', 'input'])) {
    return fail('payload contains an unknown field');
  }

  if (value.schemaName === undefined) {
    return fail('payload.schemaName is required');
  }

  let error: string | null;
  if (value.schemaName === 'dictation_refinement') {
    error = validateDictationRefinementInput(value.input, 'payload.input');
  } else if (value.schemaName === 'dictation_dictionary_learning') {
    error = validateDictionaryLearningInput(value.input, 'payload.input');
  } else {
    return fail('payload.schemaName is unsupported');
  }
  return error ? fail(error) : ok(value as unknown as VoiceRefinerUserPayload);
}

export function parseVoiceRefinerUserPayloadJson(
  raw: string,
): VoiceParseResult<VoiceRefinerUserPayload> {
  if (raw.length > VOICE_MAX_REFINER_PAYLOAD_CHARS) {
    return fail(`payload too large: ${raw.length} > ${VOICE_MAX_REFINER_PAYLOAD_CHARS} chars`);
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail('payload must be valid JSON');
  }
  return parseVoiceRefinerUserPayload(value);
}

export function parseVoiceErrorResponse(value: unknown): VoiceParseResult<VoiceErrorResponse> {
  if (!isPlainObject(value) || !isPlainObject(value.error)) {
    return fail('response.error must be an object');
  }
  const codeError = stringError(value.error.code, 'response.error.code', { min: 1, max: 100 });
  if (codeError) return fail(codeError);
  const messageError = stringError(value.error.message, 'response.error.message', {
    min: 1,
    max: 2_000,
  });
  return messageError ? fail(messageError) : ok(value as unknown as VoiceErrorResponse);
}
