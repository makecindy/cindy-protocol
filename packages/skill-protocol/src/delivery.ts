import {
  isValidSkillSlug,
  parseSkillPackageManifest,
  SkillProtocolError,
  type SkillPackageManifest,
} from './manifest.js';

/** Skill 客户端 HTTP list/detail envelope 版本。 */
export const SKILL_API_SCHEMA_VERSION = 1 as const;

/** 普通客户端可见的云端 Skill 来源范围。 */
export const SKILL_SCOPES = ['public', 'organization', 'personal'] as const;

/** Public 对所有登录身份可见，其余范围只对对应组织或自然人可见。 */
export type SkillScope = (typeof SKILL_SCOPES)[number];

/** 列表和详情共用的当前 Version 摘要。 */
export interface SkillVersionSummary {
  /** plugin-server 生成的 Version 资源 ID；调用方应视为不透明字符串。 */
  id: string;
  /** 与当前发布 manifest.version 一致。 */
  version: string;
  /** 完整上传制品原始字节的 SHA-256。 */
  sha256: string;
  /** 完整上传制品原始字节数。 */
  sizeBytes: number;
  /** 发布时间，格式为带毫秒的 UTC ISO 8601。 */
  publishedAt: string;
}

/** 详情响应中的当前 Version；摘要之外包含完整发布 manifest。 */
export interface SkillVersionDetail extends SkillVersionSummary {
  manifest: SkillPackageManifest;
}

/** Skill 市场列表项。Personal owner 的 passportId 不进入客户端 DTO。 */
export interface VisibleSkillSummary {
  /** plugin-server 生成的永久 Skill 资源 ID。 */
  id: string;
  /** 同一 Scope owner 内唯一的市场逻辑名称。 */
  slug: string;
  /** 当前 Version manifest 的展示名。 */
  name: string;
  /** 当前 Version manifest 的简介。 */
  description: string;
  /** Skill 的云端可见范围。 */
  scope: SkillScope;
  /** Organization 必须是非空组织 ID；Public 和 Personal 恒为 null。 */
  organizationId: string | null;
  /** 服务端当前发布的唯一 Version。 */
  currentVersion: SkillVersionSummary;
}

/** Skill 市场详情。 */
export interface VisibleSkillDetail extends Omit<VisibleSkillSummary, 'currentVersion'> {
  currentVersion: SkillVersionDetail;
}

/** Skill 分页列表响应。 */
export interface ListSkillsResponse {
  schemaVersion: typeof SKILL_API_SCHEMA_VERSION;
  skills: VisibleSkillSummary[];
  nextCursor: string | null;
}

/** 单个 Skill 详情响应。 */
export interface GetSkillResponse {
  schemaVersion: typeof SKILL_API_SCHEMA_VERSION;
  skill: VisibleSkillDetail;
}

/** 当前 Version 的短期私有下载凭证。 */
export interface SkillDownloadResponse {
  url: string;
  expiresAt: string;
  sha256: string;
  sizeBytes: number;
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SkillProtocolError(`${path} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string, max = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new SkillProtocolError(`${path} 必须是 1–${max} 字符的字符串`);
  }
  return value;
}

function sha256(value: unknown, path: string): string {
  const text = string(value, path, 64);
  if (!/^[a-f0-9]{64}$/.test(text)) {
    throw new SkillProtocolError(`${path} 必须是 64 位小写十六进制`);
  }
  return text;
}

function positiveSize(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new SkillProtocolError(`${path} 必须是正整数`);
  }
  return value;
}

function isoDate(value: unknown, path: string): string {
  const text = string(value, path, 64);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text) ||
    Number.isNaN(Date.parse(text)) ||
    new Date(text).toISOString() !== text
  ) {
    throw new SkillProtocolError(`${path} 必须是 ISO 8601 UTC 时间`);
  }
  return text;
}

/** 判断值是否符合 plugin-server Prisma Skill 资源 ID 的当前形状。 */
export function isValidSkillResourceId(value: unknown): value is string {
  return typeof value === 'string' && /^c[a-z0-9]{24}$/.test(value);
}

function parseVersionSummary(value: unknown, path: string): SkillVersionSummary {
  const raw = object(value, path);
  return {
    id: string(raw.id, `${path}.id`, 128),
    version: string(raw.version, `${path}.version`, 64),
    sha256: sha256(raw.sha256, `${path}.sha256`),
    sizeBytes: positiveSize(raw.sizeBytes, `${path}.sizeBytes`),
    publishedAt: isoDate(raw.publishedAt, `${path}.publishedAt`),
  };
}

function parseVersionDetail(value: unknown, slug: string, path: string): SkillVersionDetail {
  const raw = object(value, path);
  const summary = parseVersionSummary(raw, path);
  const manifest = parseSkillPackageManifest(raw.manifest);
  if (manifest.slug !== slug) {
    throw new SkillProtocolError(`${path}.manifest.slug 与 skill.slug 不一致`);
  }
  if (manifest.version !== summary.version) {
    throw new SkillProtocolError(`${path}.manifest.version 与 version 不一致`);
  }
  return { ...summary, manifest };
}

function parseVisibleSkillBase(
  value: unknown,
  path: string,
): {
  raw: Record<string, unknown>;
  id: string;
  slug: string;
  name: string;
  description: string;
  scope: SkillScope;
  organizationId: string | null;
} {
  const raw = object(value, path);
  if (!isValidSkillResourceId(raw.id)) {
    throw new SkillProtocolError(`${path}.id 不合法`);
  }
  if (!isValidSkillSlug(raw.slug)) {
    throw new SkillProtocolError(`${path}.slug 不合法`);
  }
  const name = string(raw.name, `${path}.name`, 100);
  const description = string(raw.description, `${path}.description`, 500);
  if (name.trim() !== name || description.trim() !== description) {
    throw new SkillProtocolError(`${path}.name/description 不得有首尾空白`);
  }
  if (!(SKILL_SCOPES as readonly unknown[]).includes(raw.scope)) {
    throw new SkillProtocolError(`${path}.scope 不合法`);
  }
  const scope = raw.scope as SkillScope;
  const organizationId = raw.organizationId;
  if (
    ((scope === 'public' || scope === 'personal') && organizationId !== null) ||
    (scope === 'organization' &&
      (typeof organizationId !== 'string' ||
        organizationId.length === 0 ||
        organizationId.length > 128))
  ) {
    throw new SkillProtocolError(`${path}.organizationId 与 scope 不一致`);
  }
  return {
    raw,
    id: raw.id,
    slug: raw.slug,
    name,
    description,
    scope,
    organizationId: organizationId as string | null,
  };
}

function parseVisibleSkillSummary(value: unknown, index: number): VisibleSkillSummary {
  const path = `skills[${index}]`;
  const parsed = parseVisibleSkillBase(value, path);
  return {
    id: parsed.id,
    slug: parsed.slug,
    name: parsed.name,
    description: parsed.description,
    scope: parsed.scope,
    organizationId: parsed.organizationId,
    currentVersion: parseVersionSummary(parsed.raw.currentVersion, `${path}.currentVersion`),
  };
}

function parseVisibleSkillDetail(value: unknown, path: string): VisibleSkillDetail {
  const parsed = parseVisibleSkillBase(value, path);
  const currentVersion = parseVersionDetail(
    parsed.raw.currentVersion,
    parsed.slug,
    `${path}.currentVersion`,
  );
  if (parsed.name !== currentVersion.manifest.name) {
    throw new SkillProtocolError(`${path}.name 与 currentVersion.manifest.name 不一致`);
  }
  if (parsed.description !== currentVersion.manifest.description) {
    throw new SkillProtocolError(
      `${path}.description 与 currentVersion.manifest.description 不一致`,
    );
  }
  return {
    id: parsed.id,
    slug: parsed.slug,
    name: parsed.name,
    description: parsed.description,
    scope: parsed.scope,
    organizationId: parsed.organizationId,
    currentVersion,
  };
}

function nextCursor(value: unknown): string | null {
  if (value === null) return null;
  if (!isValidSkillResourceId(value)) {
    throw new SkillProtocolError('response.nextCursor 必须是合法 Skill ID 或 null');
  }
  return value;
}

/** 解析并规范化 Skill 分页列表响应。 */
export function parseListSkillsResponse(value: unknown): ListSkillsResponse {
  const raw = object(value, 'response');
  if (raw.schemaVersion !== SKILL_API_SCHEMA_VERSION) {
    throw new SkillProtocolError(`response.schemaVersion 必须为 ${SKILL_API_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(raw.skills)) {
    throw new SkillProtocolError('response.skills 必须是数组');
  }
  return {
    schemaVersion: SKILL_API_SCHEMA_VERSION,
    skills: raw.skills.map(parseVisibleSkillSummary),
    nextCursor: nextCursor(raw.nextCursor),
  };
}

/** 解析并规范化单个 Skill 详情响应，并校验外层展示字段与 manifest 一致。 */
export function parseGetSkillResponse(value: unknown): GetSkillResponse {
  const raw = object(value, 'response');
  if (raw.schemaVersion !== SKILL_API_SCHEMA_VERSION) {
    throw new SkillProtocolError(`response.schemaVersion 必须为 ${SKILL_API_SCHEMA_VERSION}`);
  }
  return {
    schemaVersion: SKILL_API_SCHEMA_VERSION,
    skill: parseVisibleSkillDetail(raw.skill, 'response.skill'),
  };
}

/** 解析当前 Skill Version 的短期 HTTPS 下载凭证。 */
export function parseSkillDownloadResponse(value: unknown): SkillDownloadResponse {
  const raw = object(value, 'response');
  const url = string(raw.url, 'response.url', 4096);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new SkillProtocolError('response.url 必须是合法 URL');
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new SkillProtocolError('response.url 必须使用 HTTPS');
  }
  return {
    url,
    expiresAt: isoDate(raw.expiresAt, 'response.expiresAt'),
    sha256: sha256(raw.sha256, 'response.sha256'),
    sizeBytes: positiveSize(raw.sizeBytes, 'response.sizeBytes'),
  };
}
