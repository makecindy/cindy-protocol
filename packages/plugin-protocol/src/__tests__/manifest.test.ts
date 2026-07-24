import { describe, expect, it } from 'vitest';
import {
  GHOST_MANIFEST_SCHEMA_VERSION,
  isSafeGhostRelativePath,
  isValidGhostId,
  validateGhostManifest,
} from '../manifest.js';

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

describe('Ghost manifest contract', () => {
  it('accepts and normalizes a valid schema v2 manifest', () => {
    const result = validateGhostManifest(validManifest);
    expect(result).toEqual({ ok: true, manifest: validManifest });
  });

  it('rejects invalid ids and schema versions', () => {
    expect(isValidGhostId('../escape')).toBe(false);
    expect(validateGhostManifest({ ...validManifest, schemaVersion: 1 }).ok).toBe(false);
  });

  it('rejects Windows reserved device names in ids and relative paths', () => {
    expect(isValidGhostId('con')).toBe(false);
    expect(isValidGhostId('com1')).toBe(false);
    expect(isSafeGhostRelativePath('CON.js')).toBe(false);
    expect(isSafeGhostRelativePath('assets/AUX.html')).toBe(false);
    expect(isSafeGhostRelativePath('assets/console.html')).toBe(true);
    expect(validateGhostManifest({ ...validManifest, entry: 'assets/LPT9.js' }).ok).toBe(false);
  });

  it('rejects credential exchange URLs on non-default HTTPS ports', () => {
    const result = validateGhostManifest({
      ...validManifest,
      settingsHtml: 'settings.html',
      slots: ['network'],
      tools: undefined,
      network: {
        hosts: ['api.example.com'],
        secrets: [
          {
            key: 'api_key',
            label: 'API key',
            inject: { header: 'Authorization', format: 'Bearer {value}' },
            exchange: {
              url: 'https://api.example.com:8443/token',
              bodyFormat: '{"key":"{value}"}',
              tokenPath: 'token',
            },
          },
        ],
      },
    });

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toContain('仅支持 https 默认端口');
  });

  it('normalizes a representative full capability manifest', () => {
    const result = validateGhostManifest({
      schemaVersion: GHOST_MANIFEST_SCHEMA_VERSION,
      id: 'full-helper',
      name: 'Full Helper',
      version: '2.0.0',
      author: 'Cindy',
      description: 'Exercises the shared manifest contract.',
      whenToUse: 'Use for representative protocol validation.',
      icon: 'assets/icon.png',
      entry: 'src/main.js',
      launch: 'resident',
      settingsHtml: 'settings.html',
      settingsHeight: 320,
      slots: ['subscribe', 'tool', 'card', 'panel', 'cindy', 'network', 'notify', 'fs'],
      tools: [
        {
          name: 'run_helper',
          description: 'Run the helper.',
          parameters: {
            type: 'object',
            properties: { input: { type: 'string' } },
            required: ['input'],
          },
        },
      ],
      cindy: { image: ['generate'], video: ['edit'] },
      subscribe: { topics: ['turn'], hooks: ['will-user-message'] },
      network: {
        hosts: ['api.example.com'],
        secrets: [
          {
            key: 'api_key',
            label: 'API key',
            inject: { header: 'Authorization', format: 'Bearer {value}' },
          },
        ],
      },
      command: 'full-helper',
      keywords: ['full helper'],
      panel: {
        title: 'Full Helper',
        html: 'panel.html',
        position: 'right',
        minWidth: 320,
        defaultFraction: 0.2,
      },
      unknownField: 'ignored',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.kind).toBe('chip');
    expect(result.manifest.slots).toEqual([
      'subscribe',
      'tool',
      'card',
      'panel',
      'cindy',
      'network',
      'notify',
      'fs',
    ]);
    expect(result.manifest).not.toHaveProperty('unknownField');
  });

  it("panel.position 'tab' 合法;tab 时停靠专属字段(minWidth/defaultFraction)明确拒绝", () => {
    const withPanel = (panel: Record<string, unknown>) => ({
      ...validManifest,
      slots: ['tool', 'panel'],
      panel: { html: 'panel.html', ...panel },
    });

    const tab = validateGhostManifest(withPanel({ position: 'tab' }));
    expect(tab.ok).toBe(true);
    if (tab.ok) expect(tab.manifest.panel?.position).toBe('tab');

    for (const extra of [{ minWidth: 240 }, { defaultFraction: 0.2 }]) {
      const rejected = validateGhostManifest(withPanel({ position: 'tab', ...extra }));
      expect(rejected.ok, JSON.stringify(extra)).toBe(false);
      if (!rejected.ok) expect(rejected.reason).toContain('仅停靠形态');
    }

    // top/bottom 仍收词明确拒绝,野值仍拒。
    const pending = validateGhostManifest(withPanel({ position: 'top' }));
    expect(pending.ok).toBe(false);
    if (!pending.ok) expect(pending.reason).toContain('暂未支持');
    expect(validateGhostManifest(withPanel({ position: 'center' })).ok).toBe(false);
  });
});
