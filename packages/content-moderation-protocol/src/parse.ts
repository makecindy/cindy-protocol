import {
  MODERATION_BUSINESS_CODES,
  MODERATION_JSON_LOGICAL_PATHS,
  MODERATION_STREAM_CREATE_LOGICAL_PATH,
  MODERATION_SUBMIT_LOGICAL_PATH,
  MODERATION_UPLOAD_LOGICAL_PATH,
  type ModerationBusinessCode,
  type ModerationGatewayJsonBody,
  type ModerationItem,
  type ModerationJsonLogicalPath,
  type ModerationJsonSignRequest,
  type ModerationParseResult,
  type ModerationSignErrorResponse,
  type ModerationSignedJsonResponse,
  type ModerationSignedUploadResponse,
  type ModerationUploadSignRequest,
} from './types.js';

type PlainObject = Record<string, unknown>;

function ok<T>(value: T): ModerationParseResult<T> {
  return { ok: true, value };
}

function fail<T>(error: string): ModerationParseResult<T> {
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
  if (value.length > options.max) {
    return `${path} must contain at most ${options.max} characters`;
  }
  return null;
}

function optionalStringError(
  value: unknown,
  path: string,
  options: { min?: number; max: number },
): string | null {
  return value === undefined ? null : stringError(value, path, options);
}

export function isModerationJsonLogicalPath(value: unknown): value is ModerationJsonLogicalPath {
  return (
    typeof value === 'string' &&
    MODERATION_JSON_LOGICAL_PATHS.includes(value as ModerationJsonLogicalPath)
  );
}

export function isModerationBusinessCode(value: unknown): value is ModerationBusinessCode {
  return (
    typeof value === 'string' && MODERATION_BUSINESS_CODES.includes(value as ModerationBusinessCode)
  );
}

export function parseModerationJsonSignRequest(
  value: unknown,
): ModerationParseResult<ModerationJsonSignRequest> {
  if (!isPlainObject(value)) return fail('request must be an object');
  if (!hasOnlyKeys(value, ['logical_path', 'body'])) {
    return fail('request contains an unknown field');
  }
  if (!isModerationJsonLogicalPath(value.logical_path)) {
    return fail('request.logical_path is unsupported');
  }
  const error = stringError(value.body, 'request.body', { min: 2, max: 2_100_000 });
  return error ? fail(error) : ok(value as unknown as ModerationJsonSignRequest);
}

export function parseModerationUploadSignRequest(
  value: unknown,
): ModerationParseResult<ModerationUploadSignRequest> {
  if (!isPlainObject(value)) return fail('request must be an object');
  if (Object.keys(value).length > 0) return fail('request must be empty');
  return ok(value as ModerationUploadSignRequest);
}

function validateItem(value: unknown, path: string): string | null {
  if (!isPlainObject(value)) return `${path} must be an object`;
  if (!hasOnlyKeys(value, ['type', 'data', 'content_id'])) {
    return `${path} contains an unknown field`;
  }
  if (value.type !== 'TEXT' && value.type !== 'IMAGE') {
    return `${path}.type must be TEXT or IMAGE`;
  }
  return (
    stringError(value.data, `${path}.data`, { min: 1, max: 2_000_000 }) ??
    stringError(value.content_id, `${path}.content_id`, { min: 1, max: 512 })
  );
}

function validateExtra(value: unknown, path: string): string | null {
  if (value === undefined) return null;
  if (!isPlainObject(value)) return `${path} must be an object`;
  if (!hasOnlyKeys(value, ['scene', 'agentKind', 'modelId'])) {
    return `${path} contains an unknown field`;
  }
  return (
    optionalStringError(value.scene, `${path}.scene`, { min: 1, max: 128 }) ??
    optionalStringError(value.agentKind, `${path}.agentKind`, { min: 1, max: 128 }) ??
    optionalStringError(value.modelId, `${path}.modelId`, { min: 1, max: 256 })
  );
}

function validateGatewayBody(
  value: unknown,
  logicalPath: ModerationJsonLogicalPath,
): string | null {
  if (!isPlainObject(value)) return 'body must be an object';
  if (!hasOnlyKeys(value, ['business_code', 'data_id', 'items', 'user_info', 'extra'])) {
    return 'body contains an unknown field';
  }
  let error = stringError(value.data_id, 'body.data_id', { min: 1, max: 512 });
  if (error) return error;
  if (!isPlainObject(value.user_info) || !hasOnlyKeys(value.user_info, ['user_id'])) {
    return 'body.user_info must contain only user_id';
  }
  error = stringError(value.user_info.user_id, 'body.user_info.user_id', {
    min: 1,
    max: 512,
  });
  if (error) return error;
  error = validateExtra(value.extra, 'body.extra');
  if (error) return error;
  if (!Array.isArray(value.items)) return 'body.items must be an array';

  if (logicalPath === MODERATION_STREAM_CREATE_LOGICAL_PATH) {
    if (value.business_code !== 'stream-output') {
      return 'body.business_code must be stream-output';
    }
    return value.items.length === 0 ? null : 'body.items must be empty for stream creation';
  }

  if (!isModerationBusinessCode(value.business_code)) {
    return 'body.business_code is unsupported';
  }
  if (value.items.length < 1 || value.items.length > 64) {
    return 'body.items must contain between 1 and 64 items';
  }
  for (let index = 0; index < value.items.length; index += 1) {
    error = validateItem(value.items[index], `body.items[${index}]`);
    if (error) return error;
  }
  return null;
}

export function parseModerationGatewayJsonBody(
  logicalPath: ModerationJsonLogicalPath,
  raw: string,
): ModerationParseResult<ModerationGatewayJsonBody> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail('body must be valid JSON');
  }
  const error = validateGatewayBody(value, logicalPath);
  return error ? fail(error) : ok(value as ModerationGatewayJsonBody);
}

function validateHeaders(value: unknown, contentType: boolean): value is Record<string, string> {
  if (!isPlainObject(value)) return false;
  const allowed = contentType
    ? ['Authorization', 'X-Timestamp', 'X-Nonce', 'Content-Type']
    : ['Authorization', 'X-Timestamp', 'X-Nonce'];
  if (!hasOnlyKeys(value, allowed)) return false;
  if (
    stringError(value.Authorization, 'headers.Authorization', { min: 1, max: 8_192 }) ||
    stringError(value['X-Timestamp'], 'headers.X-Timestamp', { min: 1, max: 128 }) ||
    stringError(value['X-Nonce'], 'headers.X-Nonce', { min: 1, max: 256 })
  ) {
    return false;
  }
  return !contentType || value['Content-Type'] === 'application/json';
}

export function parseModerationSignedJsonResponse(
  value: unknown,
  expectedPath?: ModerationJsonLogicalPath,
): ModerationParseResult<ModerationSignedJsonResponse> {
  if (!isPlainObject(value)) return fail('response must be an object');
  if (!hasOnlyKeys(value, ['gateway_base_url', 'logical_path', 'headers'])) {
    return fail('response contains an unknown field');
  }
  const error = stringError(value.gateway_base_url, 'response.gateway_base_url', {
    min: 1,
    max: 2_048,
  });
  if (error) return fail(error);
  if (!isModerationJsonLogicalPath(value.logical_path)) {
    return fail('response.logical_path is unsupported');
  }
  if (expectedPath !== undefined && value.logical_path !== expectedPath) {
    return fail('response.logical_path does not match the request');
  }
  if (!validateHeaders(value.headers, true)) {
    return fail('response.headers is invalid');
  }
  return ok(value as unknown as ModerationSignedJsonResponse);
}

export function parseModerationSignedUploadResponse(
  value: unknown,
): ModerationParseResult<ModerationSignedUploadResponse> {
  if (!isPlainObject(value)) return fail('response must be an object');
  if (!hasOnlyKeys(value, ['gateway_base_url', 'logical_path', 'query', 'headers'])) {
    return fail('response contains an unknown field');
  }
  let error = stringError(value.gateway_base_url, 'response.gateway_base_url', {
    min: 1,
    max: 2_048,
  });
  if (error) return fail(error);
  if (value.logical_path !== MODERATION_UPLOAD_LOGICAL_PATH) {
    return fail('response.logical_path is unsupported');
  }
  if (!isPlainObject(value.query) || !hasOnlyKeys(value.query, ['folder'])) {
    return fail('response.query must contain only folder');
  }
  error = stringError(value.query.folder, 'response.query.folder', { min: 1, max: 512 });
  if (error) return fail(error);
  if (!validateHeaders(value.headers, false)) {
    return fail('response.headers is invalid');
  }
  return ok(value as unknown as ModerationSignedUploadResponse);
}

export function parseModerationSignErrorResponse(
  value: unknown,
): ModerationParseResult<ModerationSignErrorResponse> {
  if (!isPlainObject(value) || !hasOnlyKeys(value, ['error']) || !isPlainObject(value.error)) {
    return fail('response.error must be an object');
  }
  if (!hasOnlyKeys(value.error, ['code', 'message'])) {
    return fail('response.error contains an unknown field');
  }
  const error =
    stringError(value.error.code, 'response.error.code', { min: 1, max: 100 }) ??
    stringError(value.error.message, 'response.error.message', { min: 1, max: 2_000 });
  return error ? fail(error) : ok(value as unknown as ModerationSignErrorResponse);
}

export function moderationGatewayBodyMatchesPath(
  logicalPath: ModerationJsonLogicalPath,
  body: ModerationGatewayJsonBody,
): boolean {
  return logicalPath === MODERATION_SUBMIT_LOGICAL_PATH
    ? body.business_code !== 'stream-output'
    : body.business_code === 'stream-output';
}

export function isModerationItem(value: unknown): value is ModerationItem {
  return validateItem(value, 'item') === null;
}
