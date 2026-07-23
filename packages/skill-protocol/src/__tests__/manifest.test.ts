import { describe, expect, it } from 'vitest';
import {
  SKILL_PACKAGE_SCHEMA_VERSION,
  SkillProtocolError,
  isValidSkillPackagePath,
  isValidSkillSlug,
  parseSkillPackageManifest,
} from '../manifest.js';

const sha = (character: string): string => character.repeat(64);

const validManifest = {
  schemaVersion: SKILL_PACKAGE_SCHEMA_VERSION,
  slug: 'release-helper',
  name: 'Release Helper',
  description: 'Prepare and validate a release.',
  version: '1.0.0',
  files: [
    { path: 'SKILL.md', sizeBytes: 128, sha256: sha('a') },
    { path: 'references/checklist.md', sizeBytes: 64, sha256: sha('b') },
    { path: 'scripts/verify.sh', sizeBytes: 32, sha256: sha('c') },
  ],
} as const;

describe('skill package manifest', () => {
  it('parses a complete manifest and strips unknown fields', () => {
    expect(
      parseSkillPackageManifest({
        ...validManifest,
        internalOwnerId: 'passport-example',
        files: validManifest.files.map((file) => ({ ...file, language: 'text' })),
      }),
    ).toEqual(validManifest);
  });

  it('accepts portable slugs and relative package paths', () => {
    expect(isValidSkillSlug('a')).toBe(true);
    expect(isValidSkillSlug('release-helper')).toBe(true);
    expect(isValidSkillSlug('a'.repeat(64))).toBe(true);
    expect(isValidSkillSlug('release-')).toBe(false);
    expect(isValidSkillSlug('a'.repeat(65))).toBe(false);
    expect(isValidSkillSlug('Release_Helper')).toBe(false);
    expect(isValidSkillSlug('con')).toBe(false);
    expect(isValidSkillPackagePath('参考/checklist.md')).toBe(true);
    expect(isValidSkillPackagePath('references/checklist.md')).toBe(true);
  });

  it.each([
    '../secret',
    '/absolute',
    './relative',
    'scripts\\run.cmd',
    'scripts//run.sh',
    'scripts/CON',
    'scripts/trailing. ',
    'scripts/a:b',
    `references/cafe\u0301.md`,
  ])('rejects unsafe cross-platform path %s', (path) => {
    expect(isValidSkillPackagePath(path)).toBe(false);
  });

  it('requires a non-empty root SKILL.md', () => {
    expect(() =>
      parseSkillPackageManifest({
        ...validManifest,
        files: [{ path: 'README.md', sizeBytes: 1, sha256: sha('a') }],
      }),
    ).toThrow(/SKILL\.md/);
    expect(() =>
      parseSkillPackageManifest({
        ...validManifest,
        files: [{ path: 'SKILL.md', sizeBytes: 0, sha256: sha('a') }],
      }),
    ).toThrow(/SKILL\.md/);
  });

  it('requires sorted files and rejects case-insensitive collisions', () => {
    expect(() =>
      parseSkillPackageManifest({
        ...validManifest,
        files: [
          { path: 'scripts/run.sh', sizeBytes: 1, sha256: sha('a') },
          { path: 'SKILL.md', sizeBytes: 1, sha256: sha('b') },
        ],
      }),
    ).toThrow(/升序/);
    expect(() =>
      parseSkillPackageManifest({
        ...validManifest,
        files: [
          { path: 'SKILL.md', sizeBytes: 1, sha256: sha('a') },
          { path: 'skill.md', sizeBytes: 1, sha256: sha('b') },
        ],
      }),
    ).toThrow(/跨平台同名/);
  });

  it('rejects malformed fingerprints, sizes, metadata, and schema versions', () => {
    expect(() =>
      parseSkillPackageManifest({
        ...validManifest,
        files: [{ path: 'SKILL.md', sizeBytes: -1, sha256: sha('a') }],
      }),
    ).toThrow(SkillProtocolError);
    expect(() =>
      parseSkillPackageManifest({
        ...validManifest,
        files: [{ path: 'SKILL.md', sizeBytes: 1, sha256: sha('A') }],
      }),
    ).toThrow(/sha256/);
    expect(() => parseSkillPackageManifest({ ...validManifest, name: ' padded ' })).toThrow(
      /首尾空白/,
    );
    expect(() => parseSkillPackageManifest({ ...validManifest, schemaVersion: 2 })).toThrow(
      /schemaVersion/,
    );
  });
});
