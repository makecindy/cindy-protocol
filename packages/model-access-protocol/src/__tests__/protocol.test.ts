import { describe, expect, it } from 'vitest';

import {
  MODEL_ACCESS_CATALOG_SCHEMA_VERSION,
  MODEL_ACCESS_MODELS_PATH,
  MODEL_REGISTRY_SCHEMA_VERSION,
  parseListModelsResponse,
  parseModelRegistry,
  type ListModelsResponse,
  type ModelRegistry,
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

const VALID_REGISTRY: ModelRegistry = {
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
  });

  it('rejects unsupported versions, duplicate canonical ids, and duplicate routes', () => {
    expectRegistryReject({ ...VALID_REGISTRY, schemaVersion: 2 }, 'modelRegistry.schemaVersion');
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
});
