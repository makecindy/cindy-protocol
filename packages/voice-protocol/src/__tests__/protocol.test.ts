import { describe, expect, it } from 'vitest';

import {
  VOICE_MAX_REFINER_PAYLOAD_CHARS,
  VOICE_PROTOCOL_VERSION,
  VOICE_ASR_PATH,
  VOICE_DICTIONARY_LEARNING_PATH,
  VOICE_SESSION_PATH,
  makeVoiceRefinePath,
  parseCreateVoiceSessionRequest,
  parseCreateVoiceSessionResponse,
  parseVoiceErrorResponse,
  parseVoiceRefineRequest,
  parseVoiceRefineRequestWithPayload,
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

/** Same refinement input, minus the prompt version the server now owns. */
const SERVER_OWNED_REFINEMENT_PAYLOAD: VoiceRefinerUserPayload = {
  schemaName: 'dictation_refinement',
  input: {
    context: { uiLanguage: 'zh-CN', sourceLanguage: 'zh-CN' },
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

  it('round-trips the server-owned prompt marker and rejects bad owners', () => {
    roundTrip(
      {
        ...VALID_SESSION_RESPONSE,
        refiner: { enabled: true, provider: 'example-refiner-provider', promptOwner: 'server' },
      } satisfies CreateVoiceSessionResponse,
      parseCreateVoiceSessionResponse,
    );
    // Absent marker is the rollout default: a server that predates the field
    // keeps the historical client-owned behaviour.
    expect(parseCreateVoiceSessionResponse(VALID_SESSION_RESPONSE).ok).toBe(true);
    expectReject(
      {
        ...VALID_SESSION_RESPONSE,
        refiner: { enabled: true, provider: 'example-refiner-provider', promptOwner: 'nobody' },
      },
      parseCreateVoiceSessionResponse,
      'promptOwner',
    );
    expectReject(
      { ...VALID_SESSION_RESPONSE, refiner: { enabled: false, promptOwner: 'server' } },
      parseCreateVoiceSessionResponse,
      'must be absent',
    );
  });

  it('builds encoded Cindy-owned routes', () => {
    expect(VOICE_SESSION_PATH).toBe('/api/voice/sessions');
    expect(VOICE_ASR_PATH).toBe('/api/voice/asr');
    expect(VOICE_DICTIONARY_LEARNING_PATH).toBe('/api/voice/dictionary-learning');
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

  it('accepts a server-owned envelope carrying only the user message', () => {
    const request = {
      messages: [{ role: 'user', content: JSON.stringify(SERVER_OWNED_REFINEMENT_PAYLOAD) }],
    };
    expect(parseVoiceRefineRequest(request).ok).toBe(true);
    expect(parseVoiceRefinerUserPayloadJson(request.messages[0].content)).toEqual({
      ok: true,
      value: SERVER_OWNED_REFINEMENT_PAYLOAD,
    });
  });

  it('round-trips both payload schemas without a client prompt version', () => {
    roundTrip(SERVER_OWNED_REFINEMENT_PAYLOAD, parseVoiceRefinerUserPayload);
    roundTrip(
      {
        schemaName: 'dictation_dictionary_learning',
        input: { beforeText: '旧文本', afterText: '新文本' },
      } satisfies VoiceRefinerUserPayload,
      parseVoiceRefinerUserPayload,
    );
  });

  it('rejects envelopes that are empty, over-long or missing the user message', () => {
    expectReject({ messages: [] }, parseVoiceRefineRequest, 'request.messages');
    expectReject(
      {
        messages: [
          { role: 'system', content: 'a' },
          { role: 'user', content: 'b' },
          { role: 'user', content: 'c' },
        ],
      },
      parseVoiceRefineRequest,
      'request.messages',
    );
    // A lone system message is not a valid server-owned request: the user
    // payload is what carries the schemaName the server dispatches on.
    expectReject(
      { messages: [{ role: 'system', content: 'only a prompt' }] },
      parseVoiceRefineRequest,
      'messages[0].role must be user',
    );
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

describe('route-aware combined parsing', () => {
  const learningPayload = {
    schemaName: 'dictation_dictionary_learning',
    input: { beforeText: '旧文本', afterText: '新文本' },
  } satisfies VoiceRefinerUserPayload;

  function envelope(payload: unknown, system?: string) {
    const user = { role: 'user', content: JSON.stringify(payload) };
    return { messages: system ? [{ role: 'system', content: system }, user] : [user] };
  }

  it('derives the prompt owner from the envelope', () => {
    const serverOwned = parseVoiceRefineRequestWithPayload(envelope(learningPayload));
    expect(serverOwned.ok && serverOwned.value.promptOwner).toBe('server');

    const clientOwned = parseVoiceRefineRequestWithPayload(
      envelope(VALID_REFINEMENT_PAYLOAD, 'a prompt'),
    );
    expect(clientOwned.ok && clientOwned.value.promptOwner).toBe('client');
    expect(clientOwned.ok && clientOwned.value.payload).toEqual(VALID_REFINEMENT_PAYLOAD);
  });

  it('keeps promptVersion mandatory for client-owned payloads', () => {
    // The relaxation is scoped to server-owned prompts: a client-owned request
    // that drops the version would silently lose the cache-key input that
    // identifies the prompt it was built for.
    expectReject(
      envelope(SERVER_OWNED_REFINEMENT_PAYLOAD, 'a prompt'),
      parseVoiceRefineRequestWithPayload,
      'promptVersion',
    );
    expect(parseVoiceRefineRequestWithPayload(envelope(SERVER_OWNED_REFINEMENT_PAYLOAD)).ok).toBe(
      true,
    );
  });

  it('locks the dictionary-learning route to server-owned learning payloads', () => {
    expect(
      parseVoiceRefineRequestWithPayload(envelope(learningPayload), {
        route: 'dictionary_learning',
      }).ok,
    ).toBe(true);
    // A caller-supplied prompt on the session-less route would bypass the
    // server's own prompt injection.
    expectReject(
      { value: envelope(learningPayload, 'attacker prompt') },
      (input: { value: unknown }) =>
        parseVoiceRefineRequestWithPayload(input.value, { route: 'dictionary_learning' }),
      'must omit the system message',
    );
    // So would smuggling a refinement payload onto it.
    expectReject(
      { value: envelope(SERVER_OWNED_REFINEMENT_PAYLOAD) },
      (input: { value: unknown }) =>
        parseVoiceRefineRequestWithPayload(input.value, { route: 'dictionary_learning' }),
      'must be dictation_dictionary_learning',
    );
  });

  it('leaves the standalone payload parser permissive for owner-agnostic callers', () => {
    expect(parseVoiceRefinerUserPayload(SERVER_OWNED_REFINEMENT_PAYLOAD).ok).toBe(true);
    expect(
      parseVoiceRefinerUserPayload(SERVER_OWNED_REFINEMENT_PAYLOAD, { promptOwner: 'client' }).ok,
    ).toBe(false);
  });

  it('infers server ownership from the dictionary-learning route alone', () => {
    // Passing only `route` must still apply the server-owned field rules —
    // otherwise a caller-supplied promptVersion slips through route-aware
    // validation on a route that is server-owned by definition.
    expectReject(
      { value: { ...learningPayload, input: { ...learningPayload.input, promptVersion: 'v1' } } },
      (input: { value: unknown }) =>
        parseVoiceRefinerUserPayload(input.value, { route: 'dictionary_learning' }),
      'promptVersion must be absent',
    );
    expect(parseVoiceRefinerUserPayload(learningPayload, { route: 'dictionary_learning' }).ok).toBe(
      true,
    );
  });

  it('rejects client ownership on the dictionary-learning route in the standalone parser', () => {
    // The route is server-owned by definition, so this option combination is
    // self-contradictory. Consumers that parse envelope and payload separately
    // must not be able to validate it.
    expectReject(
      { value: learningPayload },
      (input: { value: unknown }) =>
        parseVoiceRefinerUserPayload(input.value, {
          route: 'dictionary_learning',
          promptOwner: 'client',
        }),
      'cannot be client-owned on this route',
    );
    expect(
      parseVoiceRefinerUserPayload(learningPayload, {
        route: 'dictionary_learning',
        promptOwner: 'server',
      }).ok,
    ).toBe(true);
  });

  it('rejects a caller-supplied promptVersion when the server owns the prompt', () => {
    // Mirror of the cache-key rule: under server ownership the version is the
    // server's, so a caller-supplied one is attacker-controlled metadata a
    // handler might select or cache against.
    expectReject(
      envelope(VALID_REFINEMENT_PAYLOAD),
      parseVoiceRefineRequestWithPayload,
      'promptVersion must be absent',
    );
    expect(parseVoiceRefineRequestWithPayload(envelope(SERVER_OWNED_REFINEMENT_PAYLOAD)).ok).toBe(
      true,
    );
    // Owner-agnostic standalone callers stay permissive.
    expect(parseVoiceRefinerUserPayload(VALID_REFINEMENT_PAYLOAD).ok).toBe(true);
  });

  it('rejects a caller-supplied cache key when the server owns the prompt', () => {
    // Forwarding it would let a caller pick the cache shard for a prompt it
    // never saw; under server ownership the key is the server's to generate.
    expectReject(
      { ...envelope(learningPayload), prompt_cache_key: 'attacker-chosen-shard' },
      parseVoiceRefineRequestWithPayload,
      'prompt_cache_key must be absent',
    );
    // Client-owned requests still carry their own key, as before.
    expect(
      parseVoiceRefineRequestWithPayload({
        ...envelope(VALID_REFINEMENT_PAYLOAD, 'a prompt'),
        prompt_cache_key: 'xdt:dictation_refinement:abc',
      }).ok,
    ).toBe(true);
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
