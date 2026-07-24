import { describe, expect, it } from 'vitest';

import {
  MODERATION_STREAM_CREATE_LOGICAL_PATH,
  MODERATION_SUBMIT_LOGICAL_PATH,
  MODERATION_UPLOAD_LOGICAL_PATH,
  parseModerationGatewayJsonBody,
  parseModerationJsonSignRequest,
  parseModerationSignErrorResponse,
  parseModerationSignedJsonResponse,
  parseModerationSignedUploadResponse,
  parseModerationUploadSignRequest,
  type ModerationSubmitBody,
} from '../index';

const submitBody: ModerationSubmitBody = {
  business_code: 'maker-nickname',
  data_id: 'profile-nickname:member-1:mutation-1',
  items: [{ type: 'TEXT', data: 'Alice', content_id: 'mutation-1:text:0' }],
  user_info: { user_id: 'member-1' },
};

const signatureHeaders = {
  Authorization: 'HMAC-SHA256 Credential=test',
  'X-Timestamp': '1784810000',
  'X-Nonce': 'nonce',
  'Content-Type': 'application/json' as const,
};

describe('content moderation signing requests', () => {
  it('parses submit and stream request bodies', () => {
    const submit = parseModerationJsonSignRequest({
      logical_path: MODERATION_SUBMIT_LOGICAL_PATH,
      body: JSON.stringify(submitBody),
    });
    expect(submit).toEqual({
      ok: true,
      value: {
        logical_path: MODERATION_SUBMIT_LOGICAL_PATH,
        body: JSON.stringify(submitBody),
      },
    });
    expect(
      parseModerationGatewayJsonBody(MODERATION_SUBMIT_LOGICAL_PATH, JSON.stringify(submitBody)).ok,
    ).toBe(true);
    expect(
      parseModerationGatewayJsonBody(
        MODERATION_STREAM_CREATE_LOGICAL_PATH,
        JSON.stringify({
          business_code: 'stream-output',
          data_id: 'output:member-1:session-1:turn-1',
          items: [],
          user_info: { user_id: 'member-1' },
        }),
      ).ok,
    ).toBe(true);
  });

  it('rejects unknown routes, fields, business codes, and stream content', () => {
    expect(
      parseModerationJsonSignRequest({
        logical_path: '/api/unknown',
        body: JSON.stringify(submitBody),
      }).ok,
    ).toBe(false);
    expect(
      parseModerationGatewayJsonBody(
        MODERATION_SUBMIT_LOGICAL_PATH,
        JSON.stringify({ ...submitBody, callback_url: 'https://callback.invalid' }),
      ).ok,
    ).toBe(false);
    expect(
      parseModerationGatewayJsonBody(
        MODERATION_SUBMIT_LOGICAL_PATH,
        JSON.stringify({ ...submitBody, business_code: 'unknown' }),
      ).ok,
    ).toBe(false);
    expect(
      parseModerationGatewayJsonBody(
        MODERATION_STREAM_CREATE_LOGICAL_PATH,
        JSON.stringify({
          business_code: 'stream-output',
          data_id: 'output:member-1:session-1:turn-1',
          items: [{ type: 'TEXT', data: 'not allowed', content_id: 'c1' }],
          user_info: { user_id: 'member-1' },
        }),
      ).ok,
    ).toBe(false);
  });

  it('accepts only an empty upload-sign request', () => {
    expect(parseModerationUploadSignRequest({}).ok).toBe(true);
    expect(parseModerationUploadSignRequest({ filename: 'private.png' }).ok).toBe(false);
  });
});

describe('content moderation signing responses', () => {
  it('parses signed JSON and upload responses', () => {
    expect(
      parseModerationSignedJsonResponse(
        {
          gateway_base_url: 'https://moderation.example.com/gateway',
          logical_path: MODERATION_SUBMIT_LOGICAL_PATH,
          headers: signatureHeaders,
        },
        MODERATION_SUBMIT_LOGICAL_PATH,
      ).ok,
    ).toBe(true);
    expect(
      parseModerationSignedUploadResponse({
        gateway_base_url: 'https://moderation.example.com/gateway',
        logical_path: MODERATION_UPLOAD_LOGICAL_PATH,
        query: { folder: 'uploads/202607' },
        headers: {
          Authorization: 'HMAC-SHA256 Credential=test',
          'X-Timestamp': '1784810000',
          'X-Nonce': 'nonce',
        },
      }).ok,
    ).toBe(true);
  });

  it('rejects mismatched paths and header injection', () => {
    expect(
      parseModerationSignedJsonResponse(
        {
          gateway_base_url: 'https://moderation.example.com/gateway',
          logical_path: MODERATION_STREAM_CREATE_LOGICAL_PATH,
          headers: signatureHeaders,
        },
        MODERATION_SUBMIT_LOGICAL_PATH,
      ).ok,
    ).toBe(false);
    expect(
      parseModerationSignedUploadResponse({
        gateway_base_url: 'https://moderation.example.com/gateway',
        logical_path: MODERATION_UPLOAD_LOGICAL_PATH,
        query: { folder: 'uploads/202607' },
        headers: { ...signatureHeaders },
      }).ok,
    ).toBe(false);
  });

  it('parses the shared error envelope', () => {
    expect(
      parseModerationSignErrorResponse({
        error: { code: 'INVALID_REQUEST', message: 'Invalid signing request' },
      }).ok,
    ).toBe(true);
  });
});
