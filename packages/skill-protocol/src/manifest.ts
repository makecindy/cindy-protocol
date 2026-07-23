/** Skill 包内必须存在的根入口文件。 */
export const SKILL_ENTRY_FILE = 'SKILL.md' as const;

/** Skill 发布 manifest 的格式版本；与市场 HTTP envelope 独立演进。 */
export const SKILL_PACKAGE_SCHEMA_VERSION = 1 as const;

/** 市场 Skill slug：小写字母或数字开头和结尾，中间允许小写字母、数字和连字符。 */
const SKILL_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/** Windows 设备保留名；跨平台安装时任何路径段都不得使用。 */
const WINDOWS_RESERVED_NAME_RE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

/** Skill 协议值不合法时由运行时解析器抛出的错误。 */
export class SkillProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillProtocolError';
  }
}

/** 发布包中单个普通文件的内容指纹。目录不进入清单。 */
export interface SkillPackageFileEntry {
  /** 相对于 Skill 根目录的规范 POSIX 路径。 */
  path: string;
  /** 文件原始字节数；空文件允许为 0。 */
  sizeBytes: number;
  /** 文件原始字节的 SHA-256，固定为 64 位小写十六进制。 */
  sha256: string;
}

/**
 * Skill 发布包的确定性 manifest。
 *
 * manifest 作为发布请求元数据传输，不放入自身的 `files` 清单，避免自指纹。
 * 服务端必须重新从上传制品计算文件清单，不能信任发布方声明。
 */
export interface SkillPackageManifest {
  schemaVersion: typeof SKILL_PACKAGE_SCHEMA_VERSION;
  /** 市场逻辑名称；同一 Scope owner 内永久唯一。 */
  slug: string;
  /** 展示名，必须与 `SKILL.md` frontmatter.name 一致。 */
  name: string;
  /** 简介，必须与 `SKILL.md` frontmatter.description 一致。 */
  description: string;
  /** 不透明版本字符串；同一 Skill 内不可重复。 */
  version: string;
  /** 按 `path` 逐字升序排列的完整普通文件清单。 */
  files: SkillPackageFileEntry[];
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SkillProtocolError(`${path} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string, max: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new SkillProtocolError(`${path} 必须是 1–${max} 字符的字符串`);
  }
  return value;
}

/** 判断值是否符合市场 Skill slug 规则。 */
export function isValidSkillSlug(value: unknown): value is string {
  return (
    typeof value === 'string' && SKILL_SLUG_RE.test(value) && !WINDOWS_RESERVED_NAME_RE.test(value)
  );
}

/** 判断值是否为可安全安装到 macOS、Windows 和 Linux 的相对 POSIX 文件路径。 */
export function isValidSkillPackagePath(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 240 ||
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.endsWith('/') ||
    value.includes('\\') ||
    value.normalize('NFC') !== value
  ) {
    return false;
  }
  const segments = value.split('/');
  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== '.' &&
      segment !== '..' &&
      !/[<>:"|?*]/.test(segment) &&
      ![...segment].some((character) => character.charCodeAt(0) <= 31) &&
      !/[. ]$/.test(segment) &&
      !WINDOWS_RESERVED_NAME_RE.test(segment),
  );
}

function parseFileEntry(value: unknown, index: number): SkillPackageFileEntry {
  const path = `manifest.files[${index}]`;
  const raw = object(value, path);
  if (!isValidSkillPackagePath(raw.path)) {
    throw new SkillProtocolError(`${path}.path 不是安全的相对 POSIX 路径`);
  }
  if (
    typeof raw.sizeBytes !== 'number' ||
    !Number.isSafeInteger(raw.sizeBytes) ||
    raw.sizeBytes < 0
  ) {
    throw new SkillProtocolError(`${path}.sizeBytes 必须是非负安全整数`);
  }
  const sha256 = string(raw.sha256, `${path}.sha256`, 64);
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new SkillProtocolError(`${path}.sha256 必须是 64 位小写十六进制`);
  }
  return { path: raw.path, sizeBytes: raw.sizeBytes, sha256 };
}

/**
 * 解析并规范化 Skill 发布 manifest。
 *
 * 未知字段会被忽略；已知字段缺失、文件路径不安全、大小/指纹不合法、
 * 清单未排序或存在跨平台同名冲突时抛出 `SkillProtocolError`。
 */
export function parseSkillPackageManifest(value: unknown): SkillPackageManifest {
  const raw = object(value, 'manifest');
  if (raw.schemaVersion !== SKILL_PACKAGE_SCHEMA_VERSION) {
    throw new SkillProtocolError(`manifest.schemaVersion 必须为 ${SKILL_PACKAGE_SCHEMA_VERSION}`);
  }
  if (!isValidSkillSlug(raw.slug)) {
    throw new SkillProtocolError('manifest.slug 不合法');
  }
  const name = string(raw.name, 'manifest.name', 100);
  const description = string(raw.description, 'manifest.description', 500);
  const version = string(raw.version, 'manifest.version', 64);
  if (name.trim() !== name || description.trim() !== description || version.trim() !== version) {
    throw new SkillProtocolError('manifest.name/description/version 不得有首尾空白');
  }
  if (!Array.isArray(raw.files) || raw.files.length === 0) {
    throw new SkillProtocolError('manifest.files 必须是非空数组');
  }

  const files = raw.files.map(parseFileEntry);
  const caseFoldedPaths = new Set<string>();
  let previousPath: string | null = null;
  let totalSize = 0;
  for (const file of files) {
    if (previousPath !== null && file.path <= previousPath) {
      throw new SkillProtocolError('manifest.files 必须按 path 逐字升序排列且不得重复');
    }
    const caseFoldedPath = file.path.toLocaleLowerCase('en-US');
    if (caseFoldedPaths.has(caseFoldedPath)) {
      throw new SkillProtocolError(`manifest.files 存在跨平台同名路径: ${file.path}`);
    }
    caseFoldedPaths.add(caseFoldedPath);
    previousPath = file.path;
    totalSize += file.sizeBytes;
    if (!Number.isSafeInteger(totalSize)) {
      throw new SkillProtocolError('manifest.files 总大小超出安全整数范围');
    }
  }

  const entry = files.find((file) => file.path === SKILL_ENTRY_FILE);
  if (!entry || entry.sizeBytes === 0) {
    throw new SkillProtocolError(`manifest.files 必须包含非空的 ${SKILL_ENTRY_FILE}`);
  }

  return {
    schemaVersion: SKILL_PACKAGE_SCHEMA_VERSION,
    slug: raw.slug,
    name,
    description,
    version,
    files,
  };
}
