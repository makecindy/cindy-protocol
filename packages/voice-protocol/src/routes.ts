import { VOICE_SESSION_PATH } from './types';

/** Builds the authenticated refinement endpoint for one allocated voice session. */
export function makeVoiceRefinePath(sessionId: string, provider: string): string {
  return `${VOICE_SESSION_PATH}/${encodeURIComponent(sessionId)}/refine?provider=${encodeURIComponent(provider)}`;
}
