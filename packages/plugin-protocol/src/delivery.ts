import { isValidGhostId, validateGhostManifest, type GhostManifest } from './manifest.js';

/** Plugin 客户端 HTTP list/detail envelope 版本；与 ghost.json 版本独立演进。 */
export const PLUGIN_API_SCHEMA_VERSION = 1 as const;

/** 普通客户端可见的 Plugin 来源范围。 */
export const PLUGIN_SCOPES = ['global', 'organization'] as const;

/** `global` 对所有已登录身份可见；`organization` 只对所属组织可见。 */
export type PluginScope = (typeof PLUGIN_SCOPES)[number];

/** 列表和详情共用的当前 Release 摘要。 */
export interface PluginReleaseSummary {
  /** plugin-server 生成的 Release 资源 ID；调用方应将其视为不透明字符串。 */
  id: string;
  /** 与该 Release 的 `manifest.version` 一致。 */
  version: string;
  /** `.cindy` 原始字节的 SHA-256，固定为 64 位小写十六进制。 */
  sha256: string;
  /** `.cindy` 原始字节数，恒为正整数。 */
  sizeBytes: number;
  /** Release 发布时间，格式为带毫秒的 UTC ISO 8601。 */
  publishedAt: string;
}

/** 详情响应中的当前 Release；在摘要基础上包含已校验的完整 manifest。 */
export interface PluginReleaseDetail extends PluginReleaseSummary {
  /** 已通过 `validateGhostManifest` 规范化的当前 manifest。 */
  manifest: GhostManifest;
}

/** Plugin 列表项；只含市场展示和版本对账所需的摘要。 */
export interface VisiblePluginSummary {
  /** plugin-server 生成的永久资源 ID，也是客户端管理安装实例的主键。 */
  id: string;
  /** 包内 `ghost.json.id`；跨不同来源允许重名，不能代替 `id`。 */
  ghostId: string;
  /** 当前 Release manifest 的展示名。 */
  name: string;
  /** 当前 Release manifest 的描述；未声明时为 `null`。 */
  description: string | null;
  /** 当前 Release manifest 的作者；未声明时为 `null`。 */
  author: string | null;
  /** Plugin 的来源范围。 */
  scope: PluginScope;
  /** Global 恒为 `null`；Organization 必须是非空组织 ID。 */
  organizationId: string | null;
  /** 对当前请求身份计算后的默认安装值，不表示强制安装或强制启用。 */
  defaultInstall: boolean;
  /** 服务端当前发布的唯一 Release。 */
  currentRelease: PluginReleaseSummary;
}

/** Plugin 详情；展示字段必须与 `currentRelease.manifest` 保持一致。 */
export interface VisiblePluginDetail {
  /** plugin-server 生成的永久资源 ID，也是客户端管理安装实例的主键。 */
  id: string;
  /** 包内 `ghost.json.id`；跨不同来源允许重名，不能代替 `id`。 */
  ghostId: string;
  /** 当前 Release manifest 的展示名。 */
  name: string;
  /** 当前 Release manifest 的描述；未声明时为 `null`。 */
  description: string | null;
  /** 当前 Release manifest 的作者；未声明时为 `null`。 */
  author: string | null;
  /** Plugin 的来源范围。 */
  scope: PluginScope;
  /** Global 恒为 `null`；Organization 必须是非空组织 ID。 */
  organizationId: string | null;
  /** 对当前请求身份计算后的默认安装值，不表示强制安装或强制启用。 */
  defaultInstall: boolean;
  /** 服务端当前发布的唯一 Release，包含完整 manifest。 */
  currentRelease: PluginReleaseDetail;
}

/** Plugin 分页列表响应。 */
export interface ListPluginsResponse {
  /** Plugin HTTP envelope 版本。 */
  schemaVersion: typeof PLUGIN_API_SCHEMA_VERSION;
  /** 当前页内对请求身份可见的 Plugin 摘要。 */
  plugins: VisiblePluginSummary[];
  /** 下一页使用的 Plugin 资源 ID；没有下一页时为 `null`。 */
  nextCursor: string | null;
}

/** 单个 Plugin 详情响应。 */
export interface GetPluginResponse {
  /** Plugin HTTP envelope 版本。 */
  schemaVersion: typeof PLUGIN_API_SCHEMA_VERSION;
  /** 当前身份可见且处于 active 状态的 Plugin 详情。 */
  plugin: VisiblePluginDetail;
}

/** 当前 Release 的短期私有下载凭证；不重复携带 HTTP envelope 版本。 */
export interface PluginDownloadResponse {
  /** 短期 HTTPS 下载地址。 */
  url: string;
  /** 下载地址过期时间，格式为带毫秒的 UTC ISO 8601。 */
  expiresAt: string;
  /** 必须与客户端准备下载的当前 Release 摘要一致。 */
  sha256: string;
  /** 必须与客户端准备下载的当前 Release 摘要一致。 */
  sizeBytes: number;
}

/** Plugin HTTP 响应违反共享契约时由解析器抛出的错误。 */
export class PluginProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginProtocolError';
  }
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PluginProtocolError(`${path} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string, max = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new PluginProtocolError(`${path} 必须是 1–${max} 字符的字符串`);
  }
  return value;
}

/** 判断值是否符合 plugin-server 当前使用的 Plugin 资源 ID 形状。 */
export function isValidPluginResourceId(value: unknown): value is string {
  return typeof value === 'string' && /^c[a-z0-9]{24}$/.test(value);
}

function isoDate(value: unknown, path: string): string {
  const text = string(value, path, 64);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text) ||
    Number.isNaN(Date.parse(text)) ||
    new Date(text).toISOString() !== text
  ) {
    throw new PluginProtocolError(`${path} 必须是 ISO 8601 UTC 时间`);
  }
  return text;
}

function parseReleaseSummary(value: unknown, path: string): PluginReleaseSummary {
  const raw = object(value, path);
  const version = string(raw.version, `${path}.version`, 32);
  const sha256 = string(raw.sha256, `${path}.sha256`, 64);
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new PluginProtocolError(`${path}.sha256 必须是 64 位小写十六进制`);
  }
  if (
    typeof raw.sizeBytes !== 'number' ||
    !Number.isSafeInteger(raw.sizeBytes) ||
    raw.sizeBytes <= 0
  ) {
    throw new PluginProtocolError(`${path}.sizeBytes 必须是正整数`);
  }
  return {
    id: string(raw.id, `${path}.id`, 128),
    version,
    sha256,
    sizeBytes: raw.sizeBytes,
    publishedAt: isoDate(raw.publishedAt, `${path}.publishedAt`),
  };
}

function parseReleaseDetail(value: unknown, ghostId: string, path: string): PluginReleaseDetail {
  const raw = object(value, path);
  const summary = parseReleaseSummary(raw, path);
  const validatedManifest = validateGhostManifest(raw.manifest);
  if (!validatedManifest.ok) {
    throw new PluginProtocolError(`${path}.manifest 不合法: ${validatedManifest.reason}`);
  }
  if (validatedManifest.manifest.id !== ghostId) {
    throw new PluginProtocolError(`${path}.manifest.id 与 ghostId 不一致`);
  }
  if (summary.version !== validatedManifest.manifest.version) {
    throw new PluginProtocolError(`${path}.version 与 manifest.version 不一致`);
  }
  return { ...summary, manifest: validatedManifest.manifest };
}

function parseVisiblePluginBase(
  value: unknown,
  path: string,
): {
  raw: Record<string, unknown>;
  id: string;
  ghostId: string;
  name: string;
  description: string | null;
  author: string | null;
  scope: PluginScope;
  organizationId: string | null;
  defaultInstall: boolean;
} {
  const raw = object(value, path);
  if (!isValidPluginResourceId(raw.id)) throw new PluginProtocolError(`${path}.id 不合法`);
  if (!isValidGhostId(raw.ghostId)) throw new PluginProtocolError(`${path}.ghostId 不合法`);
  if (!(PLUGIN_SCOPES as readonly unknown[]).includes(raw.scope)) {
    throw new PluginProtocolError(`${path}.scope 不合法`);
  }
  const scope = raw.scope as PluginScope;
  const organizationId = raw.organizationId;
  if (
    (scope === 'global' && organizationId !== null) ||
    (scope === 'organization' &&
      (typeof organizationId !== 'string' || organizationId.length === 0))
  ) {
    throw new PluginProtocolError(`${path}.organizationId 与 scope 不一致`);
  }
  if (typeof raw.defaultInstall !== 'boolean') {
    throw new PluginProtocolError(`${path}.defaultInstall 必须是 boolean`);
  }
  return {
    raw,
    id: raw.id,
    ghostId: raw.ghostId,
    name: string(raw.name, `${path}.name`),
    description:
      raw.description === null ? null : string(raw.description, `${path}.description`, 300),
    author: raw.author === null ? null : string(raw.author, `${path}.author`),
    scope,
    organizationId: organizationId as string | null,
    defaultInstall: raw.defaultInstall,
  };
}

function parseVisiblePluginSummary(value: unknown, index: number): VisiblePluginSummary {
  const path = `plugins[${index}]`;
  const parsed = parseVisiblePluginBase(value, path);
  return {
    id: parsed.id,
    ghostId: parsed.ghostId,
    name: parsed.name,
    description: parsed.description,
    author: parsed.author,
    scope: parsed.scope,
    organizationId: parsed.organizationId,
    defaultInstall: parsed.defaultInstall,
    currentRelease: parseReleaseSummary(parsed.raw.currentRelease, `${path}.currentRelease`),
  };
}

function parseVisiblePluginDetail(value: unknown, path: string): VisiblePluginDetail {
  const parsed = parseVisiblePluginBase(value, path);
  const currentRelease = parseReleaseDetail(
    parsed.raw.currentRelease,
    parsed.ghostId,
    `${path}.currentRelease`,
  );
  const manifestDescription = currentRelease.manifest.description ?? null;
  const manifestAuthor = currentRelease.manifest.author ?? null;
  if (parsed.name !== currentRelease.manifest.name) {
    throw new PluginProtocolError(`${path}.name 与 currentRelease.manifest.name 不一致`);
  }
  if (parsed.description !== manifestDescription) {
    throw new PluginProtocolError(
      `${path}.description 与 currentRelease.manifest.description 不一致`,
    );
  }
  if (parsed.author !== manifestAuthor) {
    throw new PluginProtocolError(`${path}.author 与 currentRelease.manifest.author 不一致`);
  }
  return {
    id: parsed.id,
    ghostId: parsed.ghostId,
    name: parsed.name,
    description: parsed.description,
    author: parsed.author,
    scope: parsed.scope,
    organizationId: parsed.organizationId,
    defaultInstall: parsed.defaultInstall,
    currentRelease,
  };
}

function nextCursor(value: unknown): string | null {
  if (value === null) return null;
  if (!isValidPluginResourceId(value)) {
    throw new PluginProtocolError('response.nextCursor 必须是合法 Plugin ID 或 null');
  }
  return value;
}

/**
 * 解析并规范化 Plugin 分页列表响应。
 *
 * 未知字段会被忽略；已知字段缺失、值不合法或 schema 版本不支持时抛出
 * `PluginProtocolError`。
 */
export function parseListPluginsResponse(value: unknown): ListPluginsResponse {
  const raw = object(value, 'response');
  if (raw.schemaVersion !== PLUGIN_API_SCHEMA_VERSION) {
    throw new PluginProtocolError(`response.schemaVersion 必须为 ${PLUGIN_API_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(raw.plugins)) throw new PluginProtocolError('response.plugins 必须是数组');
  return {
    schemaVersion: PLUGIN_API_SCHEMA_VERSION,
    plugins: raw.plugins.map(parseVisiblePluginSummary),
    nextCursor: nextCursor(raw.nextCursor),
  };
}

/**
 * 解析并规范化单个 Plugin 详情响应。
 *
 * 除通用字段校验外，还要求 manifest 的 id、version 和展示字段与外层数据一致。
 * 校验失败时抛出 `PluginProtocolError`。
 */
export function parseGetPluginResponse(value: unknown): GetPluginResponse {
  const raw = object(value, 'response');
  if (raw.schemaVersion !== PLUGIN_API_SCHEMA_VERSION) {
    throw new PluginProtocolError(`response.schemaVersion 必须为 ${PLUGIN_API_SCHEMA_VERSION}`);
  }
  return {
    schemaVersion: PLUGIN_API_SCHEMA_VERSION,
    plugin: parseVisiblePluginDetail(raw.plugin, 'response.plugin'),
  };
}

/**
 * 解析并规范化当前 Release 的短期下载凭证。
 *
 * 只接受 HTTPS URL、UTC 时间、合法 SHA-256 和正整数文件大小；校验失败时抛出
 * `PluginProtocolError`。
 */
export function parsePluginDownloadResponse(value: unknown): PluginDownloadResponse {
  const raw = object(value, 'response');
  const url = string(raw.url, 'response.url', 8192);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('unsupported protocol');
  } catch {
    throw new PluginProtocolError('response.url 必须是 HTTPS URL');
  }
  const sha256 = string(raw.sha256, 'response.sha256', 64);
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new PluginProtocolError('response.sha256 必须是 64 位小写十六进制');
  }
  if (
    typeof raw.sizeBytes !== 'number' ||
    !Number.isSafeInteger(raw.sizeBytes) ||
    raw.sizeBytes <= 0
  ) {
    throw new PluginProtocolError('response.sizeBytes 必须是正整数');
  }
  return {
    url,
    expiresAt: isoDate(raw.expiresAt, 'response.expiresAt'),
    sha256,
    sizeBytes: raw.sizeBytes,
  };
}
