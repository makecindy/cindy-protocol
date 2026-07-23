import { describe, expect, it } from 'vitest';
import {
  SKILL_API_SCHEMA_VERSION,
  SkillProtocolError,
  parseGetSkillResponse,
  parseListSkillsResponse,
  parseSkillDownloadResponse,
} from '../index.js';
import { SKILL_PACKAGE_SCHEMA_VERSION } from '../manifest.js';

const skillId = `c${'s'.repeat(24)}`;
const manifest = {
  schemaVersion: SKILL_PACKAGE_SCHEMA_VERSION,
  slug: 'release-helper',
  name: 'Release Helper',
  description: 'Prepare and validate a release.',
  version: '1.0.0',
  files: [
    {
      path: 'SKILL.md',
      sizeBytes: 128,
      sha256: 'a'.repeat(64),
    },
  ],
} as const;

const versionSummary = {
  id: 'version-1',
  version: manifest.version,
  sha256: 'b'.repeat(64),
  sizeBytes: 512,
  publishedAt: '2026-07-23T00:00:00.000Z',
} as const;

const visibleSkill = {
  id: skillId,
  slug: manifest.slug,
  name: manifest.name,
  description: manifest.description,
  scope: 'public',
  organizationId: null,
  currentVersion: versionSummary,
} as const;

describe('skill delivery contract', () => {
  it('round-trips a paginated visible Skill summary', () => {
    expect(
      parseListSkillsResponse({
        schemaVersion: SKILL_API_SCHEMA_VERSION,
        skills: [visibleSkill],
        nextCursor: skillId,
      }),
    ).toEqual({
      schemaVersion: SKILL_API_SCHEMA_VERSION,
      skills: [visibleSkill],
      nextCursor: skillId,
    });
  });

  it('parses detail and verifies outer metadata against the manifest', () => {
    const response = parseGetSkillResponse({
      schemaVersion: SKILL_API_SCHEMA_VERSION,
      skill: {
        ...visibleSkill,
        currentVersion: { ...versionSummary, manifest },
      },
    });
    expect(response.skill.currentVersion.manifest.slug).toBe(manifest.slug);

    expect(() =>
      parseGetSkillResponse({
        schemaVersion: SKILL_API_SCHEMA_VERSION,
        skill: {
          ...visibleSkill,
          name: 'Stale name',
          currentVersion: { ...versionSummary, manifest },
        },
      }),
    ).toThrow(/manifest.name/);
  });

  it('keeps organization ownership consistent with scope', () => {
    const organization = parseListSkillsResponse({
      schemaVersion: SKILL_API_SCHEMA_VERSION,
      skills: [
        {
          ...visibleSkill,
          scope: 'organization',
          organizationId: 'org-example',
        },
      ],
      nextCursor: null,
    });
    expect(organization.skills[0]?.organizationId).toBe('org-example');
    expect(
      parseListSkillsResponse({
        schemaVersion: SKILL_API_SCHEMA_VERSION,
        skills: [
          {
            ...visibleSkill,
            scope: 'organization',
            organizationId: 'o'.repeat(128),
          },
        ],
        nextCursor: null,
      }).skills[0]?.organizationId,
    ).toBe('o'.repeat(128));

    for (const skill of [
      { ...visibleSkill, scope: 'public', organizationId: 'org-example' },
      { ...visibleSkill, scope: 'personal', organizationId: 'org-example' },
      { ...visibleSkill, scope: 'organization', organizationId: null },
      { ...visibleSkill, scope: 'organization', organizationId: 'o'.repeat(129) },
    ]) {
      expect(() =>
        parseListSkillsResponse({
          schemaVersion: SKILL_API_SCHEMA_VERSION,
          skills: [skill],
          nextCursor: null,
        }),
      ).toThrow(/organizationId/);
    }
  });

  it('parses Personal without exposing its owner identity', () => {
    const response = parseListSkillsResponse({
      schemaVersion: SKILL_API_SCHEMA_VERSION,
      skills: [
        {
          ...visibleSkill,
          scope: 'personal',
          ownerPassportId: 'passport-example',
        },
      ],
      nextCursor: null,
    });
    expect(response.skills[0]?.scope).toBe('personal');
    expect(response.skills[0]).not.toHaveProperty('ownerPassportId');
  });

  it('rejects unsupported envelopes, invalid cursors, and version mismatches', () => {
    expect(() =>
      parseListSkillsResponse({ schemaVersion: 2, skills: [], nextCursor: null }),
    ).toThrow(/schemaVersion/);
    expect(() =>
      parseListSkillsResponse({
        schemaVersion: SKILL_API_SCHEMA_VERSION,
        skills: [],
        nextCursor: 'invalid',
      }),
    ).toThrow(/nextCursor/);
    expect(() =>
      parseGetSkillResponse({
        schemaVersion: SKILL_API_SCHEMA_VERSION,
        skill: {
          ...visibleSkill,
          currentVersion: {
            ...versionSummary,
            version: '2.0.0',
            manifest,
          },
        },
      }),
    ).toThrow(/manifest.version/);
  });

  it('parses an HTTPS download credential and rejects unsafe responses', () => {
    const value = {
      url: 'https://example.com/release-helper.zip?signature=example',
      expiresAt: '2026-07-23T00:05:00.000Z',
      sha256: 'c'.repeat(64),
      sizeBytes: 512,
    };
    expect(parseSkillDownloadResponse(value)).toEqual(value);
    expect(() =>
      parseSkillDownloadResponse({ ...value, url: 'http://example.com/release-helper.zip' }),
    ).toThrow(SkillProtocolError);
    expect(() => parseSkillDownloadResponse({ ...value, sha256: 'invalid' })).toThrow(/sha256/);
    expect(() => parseSkillDownloadResponse({ ...value, expiresAt: 'tomorrow' })).toThrow(
      /expiresAt/,
    );
  });
});
