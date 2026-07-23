/** Stable Cindy-owned signing-service API paths. */
export const MODERATION_JSON_SIGN_PATH = '/api/moderation/sign/json' as const;
export const MODERATION_UPLOAD_SIGN_PATH = '/api/moderation/sign/upload' as const;

/** External moderation-gateway paths allowlisted by the signing service. */
export const MODERATION_SUBMIT_LOGICAL_PATH = '/api/v1/review/submit' as const;
export const MODERATION_STREAM_CREATE_LOGICAL_PATH = '/api/v1/review/stream/tasks' as const;
export const MODERATION_UPLOAD_LOGICAL_PATH = '/api/v1/upload/direct' as const;

export const MODERATION_JSON_LOGICAL_PATHS = [
  MODERATION_SUBMIT_LOGICAL_PATH,
  MODERATION_STREAM_CREATE_LOGICAL_PATH,
] as const;
export type ModerationJsonLogicalPath = (typeof MODERATION_JSON_LOGICAL_PATHS)[number];

export const MODERATION_BUSINESS_CODES = [
  'maker-input-t2t',
  'maker-input-t2m',
  'maker-avatar',
  'maker-nickname',
  'maker-sys-prompt',
] as const;
export type ModerationBusinessCode = (typeof MODERATION_BUSINESS_CODES)[number];

export interface ModerationItem {
  type: 'TEXT' | 'IMAGE';
  data: string;
  content_id: string;
}

export interface ModerationRequestExtra {
  scene?: string;
  agentKind?: string;
  modelId?: string;
}

interface ModerationGatewayBodyBase {
  data_id: string;
  user_info: { user_id: string };
  extra?: ModerationRequestExtra;
}

export interface ModerationSubmitBody extends ModerationGatewayBodyBase {
  business_code: ModerationBusinessCode;
  items: ModerationItem[];
}

export interface ModerationStreamCreateBody extends ModerationGatewayBodyBase {
  business_code: 'stream-output';
  items: [];
}

export type ModerationGatewayJsonBody = ModerationSubmitBody | ModerationStreamCreateBody;

export interface ModerationJsonSignRequest {
  logical_path: ModerationJsonLogicalPath;
  body: string;
}

export type ModerationUploadSignRequest = Record<string, never>;

export interface ModerationJsonSignatureHeaders {
  Authorization: string;
  'X-Timestamp': string;
  'X-Nonce': string;
  'Content-Type': 'application/json';
}

export interface ModerationUploadSignatureHeaders {
  Authorization: string;
  'X-Timestamp': string;
  'X-Nonce': string;
}

export interface ModerationSignedJsonResponse {
  gateway_base_url: string;
  logical_path: ModerationJsonLogicalPath;
  headers: ModerationJsonSignatureHeaders;
}

export interface ModerationSignedUploadResponse {
  gateway_base_url: string;
  logical_path: typeof MODERATION_UPLOAD_LOGICAL_PATH;
  query: { folder: string };
  headers: ModerationUploadSignatureHeaders;
}

export interface ModerationSignErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export type ModerationParseResult<T> = { ok: true; value: T } | { ok: false; error: string };
