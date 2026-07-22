import { describe, expect, it } from 'vitest';

import {
  VOICE_MAX_REFINER_PAYLOAD_CHARS,
  VOICE_PROTOCOL_VERSION,
  VOICE_ASR_PATH,
  VOICE_SESSION_PATH,
  makeVoiceRefinePath,
  parseCreateVoiceSessionRequest,
  parseCreateVoiceSessionResponse,
  parseVoiceErrorResponse,
  parseVoiceRefineRequest,
  parseVoiceRefinerUserPayload,
  parseVoiceRefinerUserPayloadJson,
  type CreateVoiceSessionRequest,
  type CreateVoiceSessionResponse,
  type VoiceRefinerUserPayload,
} from '../index';

function roundTrip<T>(value: T, parse: (input: unknown) => { ok: boolean; value?: T }): T {
  const parsed = parse(JSON.parse(JSON.stringify(value)));
  expect(parsed.ok).toBe(true);
  if (!parsed.ok || parsed.value === undefined) throw new Error('unreachable');
  expect(parsed.value).toEqual(value);
  return parsed.value;
}

function expectReject<T>(
  value: T,
  parse: (input: T) => { ok: boolean; error?: string },
  keyword: string,
): void {
  const parsed = parse(value);
  expect(parsed.ok).toBe(false);
  if (parsed.ok) throw new Error('unreachable');
  expect(parsed.error).toContain(keyword);
}

const VALID_SESSION_REQUEST: CreateVoiceSessionRequest = {
  protocolVersion: VOICE_PROTOCOL_VERSION,
  mode: 'dictation',
  language: 'zh-CN',
  client: 'desktop',
  clientVersion: '1.2.3',
  asrProvider: 'example-asr-provider',
  refinerProvider: 'example-refiner-provider',
};

const VALID_SESSION_RESPONSE: CreateVoiceSessionResponse = {
  protocolVersion: VOICE_PROTOCOL_VERSION,
  sessionId: '11111111-1111-4111-8111-111111111111',
  ticket: 'one-shot-ticket',
  expiresAt: '2026-07-21T12:00:00.000Z',
  asr: {
    provider: 'example-asr-provider',
    websocketUrl: 'wss://voice.example.com/api/voice/asr',
    protocolProfile: 'qwen-asr-server-vad',
    sampleRate: 16_000,
  },
  refiner: { enabled: true, provider: 'example-refiner-provider' },
};

const VALID_REFINEMENT_PAYLOAD: VoiceRefinerUserPayload = {
  schemaName: 'dictation_refinement',
  input: {
    promptVersion: 'dictation-refinement.zh.v1',
    context: {
      uiLanguage: 'zh-CN',
      sourceLanguage: 'zh-CN',
      userDictionary: 'Cindy',
    },
    dictationText: '测试语音输入',
  },
};

describe('voice session contract', () => {
  it('round-trips the create request and response', () => {
    roundTrip(VALID_SESSION_REQUEST, parseCreateVoiceSessionRequest);
    roundTrip(VALID_SESSION_RESPONSE, parseCreateVoiceSessionResponse);
  });

  it('accepts rollout-era v1 messages without protocolVersion', () => {
    const request = { ...VALID_SESSION_REQUEST };
    const response = { ...VALID_SESSION_RESPONSE };
    delete request.protocolVersion;
    delete response.protocolVersion;
    expect(parseCreateVoiceSessionRequest(request).ok).toBe(true);
    expect(parseCreateVoiceSessionResponse(response).ok).toBe(true);
  });

  it('rejects unsupported versions and malformed request fields', () => {
    expectReject(
      { ...VALID_SESSION_REQUEST, protocolVersion: 2 },
      parseCreateVoiceSessionRequest,
      'protocolVersion',
    );
    expectReject(
      { ...VALID_SESSION_REQUEST, client: 'browser' },
      parseCreateVoiceSessionRequest,
      'client',
    );
    expectReject(
      { ...VALID_SESSION_REQUEST, asrProvider: '' },
      parseCreateVoiceSessionRequest,
      'asrProvider',
    );
  });

  it('rejects invalid ASR targets and refiner field combinations', () => {
    expectReject(
      {
        ...VALID_SESSION_RESPONSE,
        asr: { ...VALID_SESSION_RESPONSE.asr, websocketUrl: 'https://voice.example.com/asr' },
      },
      parseCreateVoiceSessionResponse,
      'websocketUrl',
    );
    expectReject(
      {
        ...VALID_SESSION_RESPONSE,
        asr: { ...VALID_SESSION_RESPONSE.asr, protocolProfile: 'unknown-profile' },
      },
      parseCreateVoiceSessionResponse,
      'protocolProfile',
    );
    expectReject(
      { ...VALID_SESSION_RESPONSE, refiner: { enabled: true } },
      parseCreateVoiceSessionResponse,
      'refiner.provider',
    );
    expectReject(
      { ...VALID_SESSION_RESPONSE, refiner: { enabled: false, provider: 'unexpected' } },
      parseCreateVoiceSessionResponse,
      'must be absent',
    );
  });

  it('builds encoded Cindy-owned routes', () => {
    expect(VOICE_SESSION_PATH).toBe('/api/voice/sessions');
    expect(VOICE_ASR_PATH).toBe('/api/voice/asr');
    expect(makeVoiceRefinePath('session/a', 'provider+b')).toBe(
      '/api/voice/sessions/session%2Fa/refine?provider=provider%2Bb',
    );
  });
});

describe('voice refinement contract', () => {
  it('round-trips both supported user payload schemas', () => {
    roundTrip(VALID_REFINEMENT_PAYLOAD, parseVoiceRefinerUserPayload);
    roundTrip(
      {
        schemaName: 'dictation_dictionary_learning',
        input: {
          promptVersion: 'dictation-dictionary-learning.zh.v1',
          source: 'in_app',
          beforeText: '旧文本',
          afterText: '新文本',
          context: { activeApp: 'Cindy' },
          existingEntries: [
            {
              term: 'Cindy',
              aliases: [{ text: '辛迪', count: 2 }],
              source: 'manual',
              frequency: 4,
            },
          ],
          existingCandidates: [{ term: 'Codex', evidenceCount: 1 }],
        },
      } satisfies VoiceRefinerUserPayload,
      parseVoiceRefinerUserPayload,
    );
  });

  it('parses the request envelope and encoded user payload', () => {
    const request = {
      prompt_cache_key: 'voice-session',
      messages: [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: JSON.stringify(VALID_REFINEMENT_PAYLOAD) },
      ],
    };
    expect(parseVoiceRefineRequest(request).ok).toBe(true);
    expect(parseVoiceRefinerUserPayloadJson(request.messages[1].content)).toEqual({
      ok: true,
      value: VALID_REFINEMENT_PAYLOAD,
    });
  });

  it('rejects bad message order, malformed JSON and unsupported schemas', () => {
    expectReject(
      {
        messages: [
          { role: 'user', content: 'wrong order' },
          { role: 'system', content: 'wrong order' },
        ],
      },
      parseVoiceRefineRequest,
      'messages[0].role',
    );
    expectReject('{', parseVoiceRefinerUserPayloadJson, 'valid JSON');
    expectReject(
      '"' + 'x'.repeat(VOICE_MAX_REFINER_PAYLOAD_CHARS + 1) + '"',
      parseVoiceRefinerUserPayloadJson,
      'payload too large',
    );
    expectReject({ schemaName: 'unknown', input: {} }, parseVoiceRefinerUserPayload, 'schemaName');
    expectReject(
      { input: VALID_REFINEMENT_PAYLOAD.input },
      parseVoiceRefinerUserPayload,
      'schemaName is required',
    );
  });

  it('rejects unknown strict fields and invalid dictionary counts', () => {
    expectReject(
      {
        ...VALID_REFINEMENT_PAYLOAD,
        input: { ...VALID_REFINEMENT_PAYLOAD.input, promptVersion: '' },
      },
      parseVoiceRefinerUserPayload,
      'promptVersion',
    );
    expectReject(
      {
        schemaName: 'dictation_dictionary_learning',
        input: { promptVersion: '', beforeText: 'before', afterText: 'after' },
      },
      parseVoiceRefinerUserPayload,
      'promptVersion',
    );
    expectReject(
      {
        ...VALID_REFINEMENT_PAYLOAD,
        input: { ...VALID_REFINEMENT_PAYLOAD.input, unexpected: true },
      },
      parseVoiceRefinerUserPayload,
      'unknown field',
    );
    expectReject(
      {
        schemaName: 'dictation_dictionary_learning',
        input: {
          promptVersion: 'v1',
          beforeText: '',
          afterText: '',
          existingCandidates: [{ term: 'Cindy', evidenceCount: -1 }],
        },
      },
      parseVoiceRefinerUserPayload,
      'evidenceCount',
    );
  });
});

describe('voice error envelope', () => {
  it('accepts the shared structured error shape', () => {
    expect(
      parseVoiceErrorResponse({ error: { code: 'RATE_LIMITED', message: 'Try later' } }),
    ).toEqual({
      ok: true,
      value: { error: { code: 'RATE_LIMITED', message: 'Try later' } },
    });
  });

  it('rejects missing codes', () => {
    expectReject({ error: { code: '', message: 'bad' } }, parseVoiceErrorResponse, 'error.code');
  });
});
