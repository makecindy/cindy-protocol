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
  { enabled: false; provider?: never } | { enabled: true; provider: string };

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
  promptVersion: string;
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
  promptVersion: string;
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

export interface VoiceRefineRequest {
  prompt_cache_key?: string;
  messages: [{ role: 'system'; content: string }, { role: 'user'; content: string }];
}

/** Shared HTTP error envelope used by voice-server. */
export interface VoiceErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export type VoiceParseResult<T> = { ok: true; value: T } | { ok: false; error: string };
