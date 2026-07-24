import { describe, expect, it } from 'vitest';
import {
  PLUGIN_API_SCHEMA_VERSION,
  parseGetPluginResponse,
  parseListPluginsResponse,
  parsePluginDownloadResponse,
  PluginProtocolError,
} from '../delivery.js';
import { GHOST_MANIFEST_SCHEMA_VERSION } from '../manifest.js';

const validManifest = {
  schemaVersion: GHOST_MANIFEST_SCHEMA_VERSION,
  id: 'acme-helper',
  name: 'Acme Helper',
  version: '1.0.0',
  kind: 'chip',
  entry: 'index.js',
  slots: ['tool'],
  tools: [{ name: 'help', description: 'Help with Acme tasks' }],
} as const;
const pluginId = `c${'p'.repeat(24)}`;
const validIcon = {
  mimeType: 'image/png',
  sha256: 'c'.repeat(64),
  sizeBytes: 2048,
  url: 'https://cdn.example.com/plugin-icon.png?signature=example',
  expiresAt: '2026-07-19T00:05:00.000Z',
} as const;

describe('plugin delivery contract', () => {
  it('parses a paginated visible Plugin summary without requiring a manifest', () => {
    const response = parseListPluginsResponse({
      schemaVersion: PLUGIN_API_SCHEMA_VERSION,
      plugins: [
        {
          id: pluginId,
          ghostId: validManifest.id,
          name: validManifest.name,
          description: null,
          author: null,
          scope: 'public',
          organizationId: null,
          defaultInstall: true,
          currentRelease: {
            id: 'release-1',
            version: validManifest.version,
            sha256: 'a'.repeat(64),
            sizeBytes: 1024,
            publishedAt: '2026-07-19T00:00:00.000Z',
            icon: validIcon,
          },
        },
      ],
      nextCursor: pluginId,
    });
    expect(response.plugins[0]?.name).toBe(validManifest.name);
    expect(response.plugins[0]?.currentRelease.version).toBe(validManifest.version);
    expect(response.plugins[0]?.currentRelease.icon).toEqual(validIcon);
    expect(response.nextCursor).toBe(pluginId);
  });

  it('accepts legacy v2 releases without icon metadata', () => {
    const response = parseListPluginsResponse({
      schemaVersion: PLUGIN_API_SCHEMA_VERSION,
      plugins: [
        {
          id: pluginId,
          ghostId: validManifest.id,
          name: validManifest.name,
          description: null,
          author: null,
          scope: 'public',
          organizationId: null,
          defaultInstall: false,
          currentRelease: {
            id: 'release-legacy',
            version: validManifest.version,
            sha256: 'a'.repeat(64),
            sizeBytes: 1024,
            publishedAt: '2026-07-19T00:00:00.000Z',
          },
        },
      ],
      nextCursor: null,
    });
    expect(response.plugins[0]?.currentRelease.icon).toBeNull();
  });

  it('rejects non-HTTPS icon URLs and invalid icon hashes', () => {
    const plugin = {
      id: pluginId,
      ghostId: validManifest.id,
      name: validManifest.name,
      description: null,
      author: null,
      scope: 'public',
      organizationId: null,
      defaultInstall: false,
      currentRelease: {
        id: 'release-icon',
        version: validManifest.version,
        sha256: 'a'.repeat(64),
        sizeBytes: 1024,
        publishedAt: '2026-07-19T00:00:00.000Z',
        icon: { ...validIcon, url: 'http://localhost:3391/icon.png' },
      },
    };
    expect(() =>
      parseListPluginsResponse({
        schemaVersion: PLUGIN_API_SCHEMA_VERSION,
        plugins: [plugin],
        nextCursor: null,
      }),
    ).toThrow(PluginProtocolError);
    expect(() =>
      parseListPluginsResponse({
        schemaVersion: PLUGIN_API_SCHEMA_VERSION,
        plugins: [
          {
            ...plugin,
            currentRelease: { ...plugin.currentRelease, icon: { ...validIcon, sha256: 'bad' } },
          },
        ],
        nextCursor: null,
      }),
    ).toThrow(PluginProtocolError);
  });

  it('parses a visible Plugin detail and validates its manifest', () => {
    const response = parseGetPluginResponse({
      schemaVersion: PLUGIN_API_SCHEMA_VERSION,
      plugin: {
        id: pluginId,
        ghostId: validManifest.id,
        name: validManifest.name,
        description: null,
        author: null,
        scope: 'public',
        organizationId: null,
        defaultInstall: true,
        currentRelease: {
          id: 'release-1',
          version: validManifest.version,
          sha256: 'a'.repeat(64),
          sizeBytes: 1024,
          publishedAt: '2026-07-19T00:00:00.000Z',
          manifest: validManifest,
        },
      },
    });
    expect(response.plugin.currentRelease.manifest.id).toBe(validManifest.id);
  });

  it('keeps availability separate from default installation', () => {
    const response = parseListPluginsResponse({
      schemaVersion: PLUGIN_API_SCHEMA_VERSION,
      plugins: [
        {
          id: pluginId,
          ghostId: validManifest.id,
          name: validManifest.name,
          description: null,
          author: null,
          scope: 'organization',
          organizationId: 'org-1',
          defaultInstall: false,
          currentRelease: {
            id: 'release-1',
            version: validManifest.version,
            sha256: 'b'.repeat(64),
            sizeBytes: 1024,
            publishedAt: '2026-07-19T00:00:00.000Z',
          },
        },
      ],
      nextCursor: null,
    });
    expect(response.plugins).toHaveLength(1);
    expect(response.plugins[0]?.defaultInstall).toBe(false);
  });

  it('parses a personal Plugin without exposing its owner identity', () => {
    const response = parseListPluginsResponse({
      schemaVersion: PLUGIN_API_SCHEMA_VERSION,
      plugins: [
        {
          id: pluginId,
          ghostId: validManifest.id,
          name: validManifest.name,
          description: null,
          author: null,
          scope: 'personal',
          organizationId: null,
          ownerPassportId: 'passport-example',
          defaultInstall: false,
          currentRelease: {
            id: 'release-1',
            version: validManifest.version,
            sha256: 'b'.repeat(64),
            sizeBytes: 1024,
            publishedAt: '2026-07-19T00:00:00.000Z',
          },
        },
      ],
      nextCursor: null,
    });
    expect(response.plugins[0]?.scope).toBe('personal');
    expect(response.plugins[0]?.organizationId).toBeNull();
    expect(response.plugins[0]).not.toHaveProperty('ownerPassportId');
  });

  it('rejects organization ownership metadata that disagrees with scope', () => {
    const plugin = {
      id: pluginId,
      ghostId: validManifest.id,
      name: validManifest.name,
      description: null,
      author: null,
      defaultInstall: false,
      currentRelease: {
        id: 'release-1',
        version: validManifest.version,
        sha256: 'b'.repeat(64),
        sizeBytes: 1024,
        publishedAt: '2026-07-19T00:00:00.000Z',
      },
    };

    expect(() =>
      parseListPluginsResponse({
        schemaVersion: PLUGIN_API_SCHEMA_VERSION,
        plugins: [{ ...plugin, scope: 'public', organizationId: 'org-1' }],
        nextCursor: null,
      }),
    ).toThrow(PluginProtocolError);
    expect(() =>
      parseListPluginsResponse({
        schemaVersion: PLUGIN_API_SCHEMA_VERSION,
        plugins: [{ ...plugin, scope: 'personal', organizationId: 'org-1' }],
        nextCursor: null,
      }),
    ).toThrow(PluginProtocolError);
    expect(() =>
      parseListPluginsResponse({
        schemaVersion: PLUGIN_API_SCHEMA_VERSION,
        plugins: [{ ...plugin, scope: 'organization', organizationId: null }],
        nextCursor: null,
      }),
    ).toThrow(PluginProtocolError);
  });

  it('parses the signed download response used by staging installation', () => {
    expect(
      parsePluginDownloadResponse({
        url: 'https://example.com/plugin.cindy?signature=example',
        expiresAt: '2026-07-19T00:05:00.000Z',
        sha256: 'c'.repeat(64),
        sizeBytes: 1024,
      }),
    ).toEqual({
      url: 'https://example.com/plugin.cindy?signature=example',
      expiresAt: '2026-07-19T00:05:00.000Z',
      sha256: 'c'.repeat(64),
      sizeBytes: 1024,
    });
    expect(() =>
      parsePluginDownloadResponse({
        url: 'http://example.com/plugin.cindy',
        expiresAt: '2026-07-19T00:05:00.000Z',
        sha256: 'c'.repeat(64),
        sizeBytes: 1024,
      }),
    ).toThrow(PluginProtocolError);
    expect(() =>
      parsePluginDownloadResponse({
        url: 'https://example.com/plugin.cindy',
        expiresAt: '0',
        sha256: 'c'.repeat(64),
        sizeBytes: 1024,
      }),
    ).toThrow(PluginProtocolError);
  });

  it('rejects an invalid list cursor and a detail manifest mismatch', () => {
    expect(() =>
      parseListPluginsResponse({
        schemaVersion: PLUGIN_API_SCHEMA_VERSION,
        plugins: [],
        nextCursor: 'INVALID',
      }),
    ).toThrow(PluginProtocolError);

    expect(() =>
      parseGetPluginResponse({
        schemaVersion: PLUGIN_API_SCHEMA_VERSION,
        plugin: {
          id: pluginId,
          ghostId: validManifest.id,
          name: validManifest.name,
          description: null,
          author: null,
          scope: 'public',
          organizationId: null,
          defaultInstall: true,
          currentRelease: {
            id: 'release-1',
            version: '2.0.0',
            sha256: 'a'.repeat(64),
            sizeBytes: 1024,
            publishedAt: '2026-07-19T00:00:00.000Z',
            manifest: validManifest,
          },
        },
      }),
    ).toThrow(PluginProtocolError);
  });

  it('rejects detail metadata that differs from its manifest', () => {
    expect(() =>
      parseGetPluginResponse({
        schemaVersion: PLUGIN_API_SCHEMA_VERSION,
        plugin: {
          id: pluginId,
          ghostId: validManifest.id,
          name: 'Stale name',
          description: null,
          author: null,
          scope: 'public',
          organizationId: null,
          defaultInstall: true,
          currentRelease: {
            id: 'release-1',
            version: validManifest.version,
            sha256: 'a'.repeat(64),
            sizeBytes: 1024,
            publishedAt: '2026-07-19T00:00:00.000Z',
            manifest: validManifest,
          },
        },
      }),
    ).toThrow(PluginProtocolError);
  });
});
