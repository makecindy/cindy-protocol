import { describe, expect, it } from 'vitest';

import {
  MODEL_ACCESS_CATALOG_SCHEMA_VERSION,
  MODEL_ACCESS_MODELS_PATH,
  MODEL_ACCESS_RESOLVE_SCHEMA_VERSION,
  MODEL_REGISTRY_LEGACY_SCHEMA_VERSION,
  MODEL_REGISTRY_SCHEMA_VERSION,
  MODEL_REGISTRY_STATUSES,
  modelRegistryCanonicalJson,
  parseListModelsResponse,
  parseListModelsResponseV2,
  parseModelRegistry,
  parseResolveRequest,
  parseResolveResponse,
  type ListModelsResponse,
  type ListModelsResponseV2,
  type ModelRegistryV1,
  type ModelRegistryV2,
  type ResolveRequest,
  type ResolveResponse,
  type ResolvedModel,
} from '../index.js';

const VALID_RESPONSE: ListModelsResponse = {
  schemaVersion: MODEL_ACCESS_CATALOG_SCHEMA_VERSION,
  models: [
    {
      id: 'example-chat-model',
      currency: 'CNY',
      agents: ['claude-code', 'codex'],
      name: 'Example Chat Model',
      contextWindow: 200_000,
      inputCostPerToken: 0.000_001,
      outputCostPerToken: 0.000_002,
      efforts: ['low', 'medium', 'high'],
      defaultEffort: 'medium',
      perAgent: {
        'claude-code': { supportsFastMode: false },
      },
      tieredPricing: [
        {
          range: [0, 200_000],
          inputCostPerToken: 0.000_001,
          outputCostPerToken: 0.000_002,
        },
      ],
    },
  ],
};

const VALID_REGISTRY: ModelRegistryV2 = {
  schemaVersion: MODEL_REGISTRY_SCHEMA_VERSION,
  updatedAt: '2026-07-31T00:00:00.000Z',
  models: [
    {
      id: 'example/model',
      name: 'Example Model',
      status: 'active',
      contextWindow: 200_000,
      efforts: ['low', 'medium', 'high'],
      defaultEffort: 'medium',
      routes: [
        {
          providerId: 'example',
          modelId: 'example-model',
          agents: ['claude-code', 'codex'],
          referencePrices: [
            {
              currency: 'USD',
              variant: 'standard',
              inputPerMtok: 1,
              outputPerMtok: 5,
              cacheReadPerMtok: 0.1,
              minInputTokens: 0,
              maxInputTokens: 200_000,
              effectiveFrom: '2026-07-01',
              source: {
                kind: 'provider-official',
                url: 'https://example.com/pricing',
                verifiedAt: '2026-07-31',
              },
            },
          ],
        },
      ],
    },
  ],
};

const VALID_REGISTRY_V1: ModelRegistryV1 = {
  schemaVersion: MODEL_REGISTRY_LEGACY_SCHEMA_VERSION,
  updatedAt: VALID_REGISTRY.updatedAt,
  models: VALID_REGISTRY.models.map(({ newSessionDefault: _newSessionDefault, ...entry }) => entry),
};

function expectReject(value: unknown, path: string): void {
  const result = parseListModelsResponse(value);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  expect(result.error).toContain(path);
}

describe('model access catalog contract', () => {
  it('round-trips the versioned model catalog with its declared currency', () => {
    const wire = JSON.parse(JSON.stringify(VALID_RESPONSE));
    const result = parseListModelsResponse(wire);
    expect(result).toEqual({ ok: true, value: VALID_RESPONSE });
    expect(MODEL_ACCESS_MODELS_PATH).toBe('/api/model-access/models');
  });

  it.each(['CNY', 'USD'] as const)('accepts the supported %s currency', (currency) => {
    const result = parseListModelsResponse({
      ...VALID_RESPONSE,
      models: [{ ...VALID_RESPONSE.models[0], currency }],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects missing or unsupported currency with the exact field path', () => {
    const { currency: _currency, ...withoutCurrency } = VALID_RESPONSE.models[0]!;
    expectReject({ ...VALID_RESPONSE, models: [withoutCurrency] }, 'response.models[0].currency');
    expectReject(
      {
        ...VALID_RESPONSE,
        models: [{ ...VALID_RESPONSE.models[0], currency: 'EUR' }],
      },
      'response.models[0].currency',
    );
  });

  it('rejects unsupported schema versions and malformed nested pricing', () => {
    expectReject({ ...VALID_RESPONSE, schemaVersion: 2 }, 'response.schemaVersion');
    expectReject(
      {
        ...VALID_RESPONSE,
        models: [
          {
            ...VALID_RESPONSE.models[0],
            tieredPricing: [{ range: [200_000, 0] }],
          },
        ],
      },
      'response.models[0].tieredPricing[0].range',
    );
  });

  it('rejects defaults that are absent from the declared effort list', () => {
    expectReject(
      {
        ...VALID_RESPONSE,
        models: [{ ...VALID_RESPONSE.models[0], efforts: ['low'], defaultEffort: 'high' }],
      },
      'response.models[0].defaultEffort',
    );
    expectReject(
      {
        ...VALID_RESPONSE,
        models: [
          {
            ...VALID_RESPONSE.models[0],
            perAgent: { codex: { efforts: ['low'], defaultEffort: 'high' } },
          },
        ],
      },
      'response.models[0].perAgent.codex.defaultEffort',
    );
  });

  it('rejects duplicate ids and overrides for unsupported agents', () => {
    expectReject(
      {
        ...VALID_RESPONSE,
        models: [{ ...VALID_RESPONSE.models[0] }, { ...VALID_RESPONSE.models[0] }],
      },
      'response.models[1].id',
    );
    expectReject(
      {
        ...VALID_RESPONSE,
        models: [
          {
            ...VALID_RESPONSE.models[0],
            agents: ['claude-code'],
            perAgent: { codex: { supportsFastMode: true } },
          },
        ],
      },
      'response.models[0].perAgent.codex',
    );
  });
});

function expectRegistryReject(value: unknown, path: string): void {
  const result = parseModelRegistry(value);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  expect(result.error).toContain(path);
}

describe('public model registry contract', () => {
  it('round-trips canonical metadata, provider routes, and sourced reference prices', () => {
    const wire = JSON.parse(JSON.stringify(VALID_REGISTRY));
    expect(parseModelRegistry(wire)).toEqual({ ok: true, value: VALID_REGISTRY });
    const v1Wire = JSON.parse(JSON.stringify(VALID_REGISTRY_V1));
    expect(parseModelRegistry(v1Wire)).toEqual({ ok: true, value: VALID_REGISTRY_V1 });
  });

  it('rejects client provenance and every other field outside the versioned schema', () => {
    const entry = VALID_REGISTRY.models[0]!;
    const route = entry.routes[0]!;
    const price = route.referencePrices![0]!;
    const cases: [unknown, string][] = [
      [{ ...VALID_REGISTRY, contextWindowVerified: true }, 'modelRegistry.contextWindowVerified'],
      [
        {
          ...VALID_REGISTRY,
          models: [{ ...entry, contextWindowExplicit: true }],
        },
        'modelRegistry.models[0].contextWindowExplicit',
      ],
      [
        {
          ...VALID_REGISTRY,
          models: [
            {
              ...entry,
              routes: [{ ...route, discoveredAt: '2026-07-31T00:00:00.000Z' }],
            },
          ],
        },
        'modelRegistry.models[0].routes[0].discoveredAt',
      ],
      [
        {
          ...VALID_REGISTRY,
          models: [{ ...entry, perAgent: { codex: { verified: true } } }],
        },
        'modelRegistry.models[0].perAgent.codex.verified',
      ],
      [
        {
          ...VALID_REGISTRY,
          models: [
            {
              ...entry,
              routes: [
                {
                  ...route,
                  referencePrices: [{ ...price, userOverride: true }],
                },
              ],
            },
          ],
        },
        'modelRegistry.models[0].routes[0].referencePrices[0].userOverride',
      ],
      [
        {
          ...VALID_REGISTRY,
          models: [
            {
              ...entry,
              routes: [
                {
                  ...route,
                  referencePrices: [
                    {
                      ...price,
                      source: { ...price.source, internalNote: 'client-only' },
                    },
                  ],
                },
              ],
            },
          ],
        },
        'modelRegistry.models[0].routes[0].referencePrices[0].source.internalNote',
      ],
    ];

    for (const [value, path] of cases) expectRegistryReject(value, path);
  });

  it('rejects unsupported versions, duplicate canonical ids, and duplicate routes', () => {
    expectRegistryReject({ ...VALID_REGISTRY, schemaVersion: 3 }, 'modelRegistry.schemaVersion');
    expectRegistryReject(
      { ...VALID_REGISTRY, models: [VALID_REGISTRY.models[0], VALID_REGISTRY.models[0]] },
      'modelRegistry.models[1].id',
    );
    expectRegistryReject(
      {
        ...VALID_REGISTRY,
        models: [
          {
            ...VALID_REGISTRY.models[0],
            routes: [VALID_REGISTRY.models[0]!.routes[0], VALID_REGISTRY.models[0]!.routes[0]],
          },
        ],
      },
      'modelRegistry.models[0].routes[1]',
    );
  });

  it('requires a canonical, calendar-valid UTC timestamp', () => {
    for (const updatedAt of [
      '2026-07-31',
      'July 31, 2026',
      '2026-07-31T00:00:00Z',
      '2026-02-29T00:00:00.000Z',
      '2026-07-31T08:00:00.000+08:00',
    ]) {
      expectRegistryReject({ ...VALID_REGISTRY, updatedAt }, 'modelRegistry.updatedAt');
    }
  });

  it('rejects malformed price bands and untraceable price sources', () => {
    const baseRoute = VALID_REGISTRY.models[0]!.routes[0]!;
    const basePrice = baseRoute.referencePrices![0]!;
    expectRegistryReject(
      {
        ...VALID_REGISTRY,
        models: [
          {
            ...VALID_REGISTRY.models[0],
            routes: [
              {
                ...baseRoute,
                referencePrices: [
                  { ...basePrice, minInputTokens: 200_000, maxInputTokens: 200_000 },
                ],
              },
            ],
          },
        ],
      },
      'maxInputTokens',
    );
    expectRegistryReject(
      {
        ...VALID_REGISTRY,
        models: [
          {
            ...VALID_REGISTRY.models[0],
            routes: [
              {
                ...baseRoute,
                referencePrices: [
                  {
                    ...basePrice,
                    source: { ...basePrice.source, url: 'http://example.com/pricing' },
                  },
                ],
              },
            ],
          },
        ],
      },
      'source.url',
    );
  });

  it('allows scheduled prices and agent-specific metadata only on supported routes', () => {
    const baseRoute = VALID_REGISTRY.models[0]!.routes[0]!;
    const basePrice = baseRoute.referencePrices![0]!;
    expect(
      parseModelRegistry({
        ...VALID_REGISTRY,
        models: [
          {
            ...VALID_REGISTRY.models[0],
            perAgent: { codex: { contextWindow: 272_000 } },
            routes: [
              {
                ...baseRoute,
                referencePrices: [
                  { ...basePrice, effectiveUntil: '2026-09-01' },
                  {
                    ...basePrice,
                    inputPerMtok: 2,
                    outputPerMtok: 10,
                    effectiveFrom: '2026-09-01',
                  },
                ],
              },
            ],
          },
        ],
      }).ok,
    ).toBe(true);

    expectRegistryReject(
      {
        ...VALID_REGISTRY,
        models: [
          {
            ...VALID_REGISTRY.models[0],
            routes: [{ ...baseRoute, agents: ['claude-code'] }],
            perAgent: { codex: { contextWindow: 272_000 } },
          },
        ],
      },
      'perAgent.codex',
    );
  });

  it('continues to parse the unchanged materialization-complete v1 wire', () => {
    // The exact shape a policy-based client requires before deriving a
    // selectable entry (MODEL_REGISTRY.md "Presence, entitlement, and sale
    // availability"): explicit status + self-consistent capability set +
    // per-agent divergence. This policy consumes the existing v1 shape
    // without a schema bump; future field additions still follow the
    // Change gate.
    expect(MODEL_REGISTRY_LEGACY_SCHEMA_VERSION).toBe(1);
    expect(MODEL_REGISTRY_SCHEMA_VERSION).toBe(2);
    const wire = {
      ...VALID_REGISTRY_V1,
      models: [
        {
          ...VALID_REGISTRY.models[0],
          status: 'preview',
          maxOutputTokens: 64_000,
          perAgent: {
            codex: {
              contextWindow: 272_000,
              efforts: ['low', 'medium', 'high'],
              defaultEffort: 'high',
            },
          },
        },
      ],
    };
    expect(parseModelRegistry(JSON.parse(JSON.stringify(wire))).ok).toBe(true);
  });

  it('versions newSessionDefault in v2 and validates its agent routing contract', () => {
    const entry = VALID_REGISTRY.models[0]!;
    const marked = {
      ...VALID_REGISTRY,
      models: [{ ...entry, newSessionDefault: ['codex'] }],
    };
    expect(parseModelRegistry(JSON.parse(JSON.stringify(marked)))).toEqual({
      ok: true,
      value: marked,
    });

    expectRegistryReject(
      {
        ...VALID_REGISTRY_V1,
        models: [{ ...VALID_REGISTRY_V1.models[0]!, newSessionDefault: ['codex'] }],
      },
      'modelRegistry.models[0].newSessionDefault',
    );

    for (const newSessionDefault of [[], ['codex', 'codex'], ['other']]) {
      expectRegistryReject(
        { ...VALID_REGISTRY, models: [{ ...entry, newSessionDefault }] },
        'modelRegistry.models[0].newSessionDefault',
      );
    }

    expectRegistryReject(
      {
        ...VALID_REGISTRY,
        models: [
          {
            ...entry,
            routes: [{ ...entry.routes[0]!, agents: ['claude-code'] }],
            newSessionDefault: ['codex'],
          },
        ],
      },
      'modelRegistry.models[0].newSessionDefault.codex',
    );
  });

  it.each(MODEL_REGISTRY_STATUSES)('accepts the %s lifecycle status', (status) => {
    expect(
      parseModelRegistry({
        ...VALID_REGISTRY,
        models: [{ ...VALID_REGISTRY.models[0], status }],
      }).ok,
    ).toBe(true);
  });

  it('accepts a fixed-effort entry: empty efforts with no default', () => {
    const { defaultEffort: _defaultEffort, ...entry } = VALID_REGISTRY.models[0]!;
    expect(
      parseModelRegistry({
        ...VALID_REGISTRY,
        models: [{ ...entry, efforts: [] }],
      }).ok,
    ).toBe(true);
  });

  it('canonicalizes object key order while preserving snapshot content changes', () => {
    const reordered = {
      models: VALID_REGISTRY.models,
      updatedAt: VALID_REGISTRY.updatedAt,
      schemaVersion: VALID_REGISTRY.schemaVersion,
    };
    expect(modelRegistryCanonicalJson(reordered)).toBe(modelRegistryCanonicalJson(VALID_REGISTRY));
    expect(
      modelRegistryCanonicalJson({
        ...reordered,
        models: reordered.models.slice(1),
      }),
    ).not.toBe(modelRegistryCanonicalJson(VALID_REGISTRY));
  });

  it('keeps availability and selectability out of the wire schema', () => {
    // Presence is the only registry-owned signal; availability/selectability
    // markers are foreign fields at every level.
    const entry = VALID_REGISTRY.models[0]!;
    const route = entry.routes[0]!;
    const cases: [unknown, string][] = [
      [{ ...entry, available: true }, 'modelRegistry.models[0].available'],
      [{ ...entry, selectable: true }, 'modelRegistry.models[0].selectable'],
      [
        { ...entry, routes: [{ ...route, available: true }] },
        'modelRegistry.models[0].routes[0].available',
      ],
    ];
    for (const [model, path] of cases) {
      expectRegistryReject({ ...VALID_REGISTRY, models: [model] }, path);
    }
  });

  it('rejects client-derived agent harnesses on routes and per-agent overrides', () => {
    // Projection harnesses (for example a client-side pi tab) never appear on
    // the wire; the closed agent enum keeps them client-owned.
    const entry = VALID_REGISTRY.models[0]!;
    const route = entry.routes[0]!;
    const cases: [unknown, string][] = [
      [
        { ...entry, routes: [{ ...route, agents: ['claude-code', 'pi'] }] },
        'modelRegistry.models[0].routes[0].agents',
      ],
      [
        { ...entry, perAgent: { pi: { contextWindow: 200_000 } } },
        'modelRegistry.models[0].perAgent.pi',
      ],
    ];
    for (const [model, path] of cases) {
      expectRegistryReject({ ...VALID_REGISTRY, models: [model] }, path);
    }
  });

  it('rejects ambiguous overlapping reference prices for the same currency and variant', () => {
    const baseRoute = VALID_REGISTRY.models[0]!.routes[0]!;
    const basePrice = baseRoute.referencePrices![0]!;
    for (const overlappingPrice of [
      { ...basePrice },
      { ...basePrice, minInputTokens: 100_000, maxInputTokens: 300_000 },
      {
        ...basePrice,
        effectiveFrom: '2026-07-15',
        effectiveUntil: '2026-08-01',
      },
    ]) {
      expectRegistryReject(
        {
          ...VALID_REGISTRY,
          models: [
            {
              ...VALID_REGISTRY.models[0],
              routes: [
                {
                  ...baseRoute,
                  referencePrices: [basePrice, overlappingPrice],
                },
              ],
            },
          ],
        },
        'referencePrices[1] overlaps referencePrices[0]',
      );
    }
  });
});

describe('model access schema v2', () => {
  const resolvedModel: ResolvedModel = {
    id: 'example-chat-model',
    name: 'Example Chat Model',
    contextWindow: 200_000,
    efforts: ['low', 'medium', 'high'],
    defaultEffort: 'medium',
    category: 'gpt',
    mode: 'chat',
    modalities: { input: ['text'], output: ['text'] },
    capabilities: { reasoning: true, toolCall: true },
    provenance: 'provider',
  };

  it('parses resolve requests with provider-reported facts and unknown ids', () => {
    const request: ResolveRequest = {
      schemaVersion: MODEL_ACCESS_RESOLVE_SCHEMA_VERSION,
      entries: [
        {
          providerId: 'openrouter',
          agent: 'codex',
          wireProtocol: 'openai-responses',
          models: [
            {
              id: 'unknown-vendor-model',
              providerReported: {
                contextWindow: 200_000,
                maxOutput: 8_192,
                modalities: { input: ['text'], output: ['text'] },
                capabilities: { reasoning: true },
                mode: 'chat',
              },
            },
          ],
        },
      ],
    };
    expect(parseResolveRequest(JSON.parse(JSON.stringify(request)))).toEqual({
      ok: true,
      value: request,
    });
  });

  it('parses resolved responses and rejects malformed metadata without clearing snapshots', () => {
    const response: ResolveResponse = {
      schemaVersion: MODEL_ACCESS_RESOLVE_SCHEMA_VERSION,
      knowledgeRevision: 'models-dev-2026-07-31',
      entries: [{ providerId: 'openrouter', agent: 'codex', models: [resolvedModel] }],
    };
    expect(parseResolveResponse(JSON.parse(JSON.stringify(response)))).toEqual({
      ok: true,
      value: response,
    });
    const result = parseResolveResponse({
      ...response,
      entries: [{ ...response.entries[0]!, models: [{ ...resolvedModel, contextWindow: 0 }] }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('contextWindow');

    for (const sortOrder of ['first', Number.NaN, Number.POSITIVE_INFINITY]) {
      const malformedSortOrder = parseResolveResponse({
        ...response,
        entries: [{ ...response.entries[0]!, models: [{ ...resolvedModel, sortOrder }] }],
      });
      expect(malformedSortOrder.ok).toBe(false);
      if (!malformedSortOrder.ok) expect(malformedSortOrder.error).toContain('sortOrder');
    }
  });

  it('parses the additive ListModels v2 envelope, including an empty list', () => {
    const response: ListModelsResponseV2 = {
      schemaVersion: MODEL_ACCESS_RESOLVE_SCHEMA_VERSION,
      models: [
        {
          ...VALID_RESPONSE.models[0]!,
          maxOutput: 8_192,
          category: 'gpt',
          mode: 'chat',
          modalities: { input: ['text'], output: ['text'] },
          capabilities: { reasoning: true },
          newSessionDefault: ['codex'],
          provenance: {
            contextWindow: 'provider',
            capabilities: 'knowledge-base',
          },
        },
      ],
    };
    expect(parseListModelsResponseV2(JSON.parse(JSON.stringify(response)))).toEqual({
      ok: true,
      value: response,
    });
    expect(parseListModelsResponseV2({ schemaVersion: 2, models: [] })).toEqual({
      ok: true,
      value: { schemaVersion: 2, models: [] },
    });

    const unsupportedDefault = parseListModelsResponseV2({
      ...response,
      models: [{ ...response.models[0]!, agents: ['claude-code'], newSessionDefault: ['codex'] }],
    });
    expect(unsupportedDefault.ok).toBe(false);
    if (!unsupportedDefault.ok) expect(unsupportedDefault.error).toContain('newSessionDefault');
  });

  it('rejects unsupported agents, duplicate provider entries, and invalid provenance', () => {
    const badAgent = {
      schemaVersion: 2,
      entries: [{ providerId: 'p', agent: 'other', models: [] }],
    };
    expect(parseResolveRequest(badAgent).ok).toBe(false);
    const duplicateEntries = {
      schemaVersion: 2,
      knowledgeRevision: 'r1',
      entries: [
        { providerId: 'p', agent: 'codex', models: [resolvedModel] },
        { providerId: 'p', agent: 'codex', models: [resolvedModel] },
      ],
    };
    expect(parseResolveResponse(duplicateEntries).ok).toBe(false);
    const badProvenance = {
      schemaVersion: 2,
      knowledgeRevision: 'r1',
      entries: [
        { providerId: 'p', agent: 'codex', models: [{ ...resolvedModel, provenance: 'other' }] },
      ],
    };
    expect(parseResolveResponse(badProvenance).ok).toBe(false);
  });

  it('accepts the resolver per-field provenance map, rejecting maps with an unsupported value', () => {
    // 服务端 enrichment 逐字段发 provenance(每个字段来自 provider/override/knowledge-base/default)。
    const perFieldProvenance = {
      schemaVersion: 2,
      knowledgeRevision: 'r1',
      entries: [
        {
          providerId: 'p',
          agent: 'codex',
          models: [
            {
              ...resolvedModel,
              provenance: {
                id: 'provider',
                contextWindow: 'override',
                modalities: 'knowledge-base',
                category: 'default',
              },
            },
          ],
        },
      ],
    };
    expect(parseResolveResponse(JSON.parse(JSON.stringify(perFieldProvenance))).ok).toBe(true);
    const badValueInMap = {
      ...perFieldProvenance,
      entries: [
        {
          providerId: 'p',
          agent: 'codex',
          models: [{ ...resolvedModel, provenance: { contextWindow: 'bogus' } }],
        },
      ],
    };
    expect(parseResolveResponse(badValueInMap).ok).toBe(false);
  });
});
