import { describe, expect, it } from 'vitest';

import {
  MODEL_ACCESS_CATALOG_SCHEMA_VERSION,
  MODEL_ACCESS_MODELS_PATH,
  parseListModelsResponse,
  type ListModelsResponse,
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
