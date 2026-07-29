/**
 * Cindy voice client <-> voice-server wire types.
 *
 * Provider-native WebSocket frames are deliberately excluded: voice-server
 * transports those frames opaquely and never needs to understand them.
 */

/** Initial voice protocol generation. Missing `protocolVersion` means v1 during rollout. */
export const VOICE_PROTOCOL_VERSION = 1 as const;

/** Stable Cindy-owned API paths. */
export const VOICE_SESSION_PATH = '/api/voice/sessions' as const;
export const VOICE_ASR_PATH = '/api/voice/asr' as const;
/**
 * Session-less dictionary-learning endpoint, authenticated by the account
 * token alone. Dictionary learning is triggered by the user editing inserted
 * text *after* dictation finished, when the ASR session (and its one-shot
 * ticket) is already gone — so it cannot reuse the session-scoped refine path.
 */
export const VOICE_DICTIONARY_LEARNING_PATH = '/api/voice/dictionary-learning' as const;

/**
 * Max raw length (chars) accepted by `parseVoiceRefinerUserPayloadJson` before
 * `JSON.parse` — a coarse OOM guard, mirroring the 64k cap that
 * `parseVoiceRefineRequest` applies to `messages[1].content` (the carrier of
 * this JSON). Field-level limits inside the payload stay the fine-grained
 * bounds.
 */
export const VOICE_MAX_REFINER_PAYLOAD_CHARS = 64_000;

export const VOICE_CLIENT_KINDS = ['desktop', 'mobile'] as const;
export type VoiceClientKind = (typeof VOICE_CLIENT_KINDS)[number];

export const VOICE_PROTOCOL_PROFILES = [
  'volcengine-sauc-duration',
  'qwen-asr-server-vad',
  'openai-transcription-manual',
] as const;
export type VoiceProtocolProfile = (typeof VOICE_PROTOCOL_PROFILES)[number];

export const VOICE_REFINER_SCHEMA_NAMES = [
  'dictation_refinement',
  'dictation_dictionary_learning',
] as const;
export type VoiceRefinerSchemaName = (typeof VOICE_REFINER_SCHEMA_NAMES)[number];

/**
 * Who owns the refiner system prompt for this session.
 *
 * - `client`: the client sends its own bundled prompt as `messages[0]`. This is
 *   the historical behaviour and stays the default when the field is absent, so
 *   a client talking to a server that predates this field keeps working.
 * - `server`: the client omits the system message entirely and voice-server
 *   injects its own prompt (selected by `schemaName`). Lets the managed prompt
 *   be iterated without shipping a client release.
 *
 * Only meaningful for managed refinement: a BYOK client dials the upstream
 * directly and must always carry its own prompt.
 */
export const VOICE_PROMPT_OWNERS = ['client', 'server'] as const;
export type VoicePromptOwner = (typeof VOICE_PROMPT_OWNERS)[number];

/** Authenticated control-plane request that allocates one ASR session. */
export interface CreateVoiceSessionRequest {
  protocolVersion?: typeof VOICE_PROTOCOL_VERSION;
  mode?: 'dictation';
  language?: string;
  client: VoiceClientKind;
  clientVersion?: string;
  asrProvider: string;
  refinerProvider?: string;
}

/** ASR data-plane target authorized by a short-lived, single-use ticket. */
export interface VoiceAsrTarget {
  provider: string;
  websocketUrl: string;
  protocolProfile: VoiceProtocolProfile;
  sampleRate: number;
  model?: string;
  resourceId?: string;
}

export type VoiceRefinerTarget =
  | { enabled: false; provider?: never; promptOwner?: never }
  | { enabled: true; provider: string; promptOwner?: VoicePromptOwner };

/** Successful `POST /api/voice/sessions` response. */
export interface CreateVoiceSessionResponse {
  protocolVersion?: typeof VOICE_PROTOCOL_VERSION;
  sessionId: string;
  ticket: string;
  expiresAt: string;
  asr: VoiceAsrTarget;
  refiner: VoiceRefinerTarget;
}

export interface VoiceRefinementContext {
  uiLanguage?: string;
  sourceLanguage?: string;
  userRefinementInstructions?: string;
  userDictionary?: string;
  voiceInputHistory?: string;
  selectionBefore?: string;
  selectedText?: string;
  selectionAfter?: string;
}

export interface VoiceDictationRefinementInput {
  /**
   * Version tag of the *client-owned* prompt this payload was built for; part
   * of the prompt-cache key. Absent under `promptOwner: 'server'`, where the
   * server owns both the prompt and its version.
   */
  promptVersion?: string;
  context: VoiceRefinementContext;
  dictationText: string;
  replyToMessage?: string;
  userDictionaryMatches?: string;
}

export interface VoiceDictionaryAlias {
  text: string;
  count?: number;
}

export interface VoiceDictionaryTermState {
  term: string;
  aliases?: VoiceDictionaryAlias[];
}

export interface VoiceDictionaryEntryState extends VoiceDictionaryTermState {
  source?: 'manual' | 'automatic';
  frequency?: number;
}

export interface VoiceDictionaryCandidateState extends VoiceDictionaryTermState {
  evidenceCount?: number;
}

export interface VoiceDictionaryLearningContext {
  uiLanguage?: string;
  sourceLanguage?: string;
  activeApp?: string;
  selectionBefore?: string;
  selectedText?: string;
  selectionAfter?: string;
}

export interface VoiceDictionaryLearningInput {
  /** See {@link VoiceDictationRefinementInput.promptVersion}. */
  promptVersion?: string;
  debug?: boolean;
  source?: 'in_app' | 'external_overlay';
  rawTranscriptText?: string;
  beforeText: string;
  afterText: string;
  context?: VoiceDictionaryLearningContext;
  existingEntries?: VoiceDictionaryEntryState[];
  existingCandidates?: VoiceDictionaryCandidateState[];
}

/** JSON encoded in the user message of a refinement request. */
export type VoiceRefinerUserPayload =
  | { schemaName: 'dictation_refinement'; input: VoiceDictationRefinementInput }
  | { schemaName: 'dictation_dictionary_learning'; input: VoiceDictionaryLearningInput };

export interface VoiceRefineSystemMessage {
  role: 'system';
  content: string;
}

export interface VoiceRefineUserMessage {
  role: 'user';
  content: string;
}

export interface VoiceRefineRequest {
  /**
   * Routes warmup and the real request to the same upstream cache shard. Under
   * `promptOwner: 'server'` the client cannot derive it (it never sees the
   * prompt), so it omits the field and the server generates its own.
   */
  prompt_cache_key?: string;
  /**
   * `[system, user]` under client-owned prompts; `[user]` alone under
   * server-owned prompts, where voice-server supplies the system message.
   */
  messages: [VoiceRefineSystemMessage, VoiceRefineUserMessage] | [VoiceRefineUserMessage];
}

/**
 * Which endpoint a refine-shaped request arrived on. The envelope alone cannot
 * express this, but the two routes have different contracts, so the parser
 * needs it to reject cross-route payloads:
 *
 * - `refine` (`/api/voice/sessions/:id/refine`): both prompt owners are legal
 *   and both schemas are accepted.
 * - `dictionary_learning` (`/api/voice/dictionary-learning`): server-owned only,
 *   and the payload must be `dictation_dictionary_learning`. Without this the
 *   session-less route would accept a caller-supplied system prompt.
 */
export const VOICE_REFINE_ROUTES = ['refine', 'dictionary_learning'] as const;
export type VoiceRefineRoute = (typeof VOICE_REFINE_ROUTES)[number];

/** Cross-validated envelope + payload, with the prompt owner it implies. */
export interface VoiceRefineRequestWithPayload {
  request: VoiceRefineRequest;
  payload: VoiceRefinerUserPayload;
  /** Derived from the envelope: a system message means the client owns it. */
  promptOwner: VoicePromptOwner;
}

/** Shared HTTP error envelope used by voice-server. */
export interface VoiceErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export type VoiceParseResult<T> = { ok: true; value: T } | { ok: false; error: string };
