/**
 * slack-hook-protocol 阶段 14(群消息中继帧)测试:
 *   1. group.message 构造 -> 序列化 -> 解析 round-trip(全字段 / 最小字段)
 *   2. 字段校验: 必填、text/fileNames 至少其一、上限、threadId/chatName 显式 null
 *   3. 能力标识常量 group-relay-v1
 *   4. 老端兼容: 不认识 group.message 的端按未知类型拒收(丢帧不断连语义)
 */

import { describe, it, expect } from 'vitest';

import {
  HOOK_FEATURE_GROUP_RELAY,
  makeGroupMessage,
  parseHookMessage,
  serializeHookMessage,
  type GroupMessagePayload,
  type HookMessage,
} from '../index';

function roundTrip(message: HookMessage): HookMessage {
  const parsed = parseHookMessage(serializeHookMessage(message));
  expect(parsed.ok, parsed.ok ? '' : parsed.error).toBe(true);
  if (!parsed.ok) throw new Error('unreachable');
  expect(parsed.message).toEqual(message);
  return parsed.message;
}

function expectReject(mutated: unknown, keyword: string): void {
  const parsed = parseHookMessage(mutated);
  expect(parsed.ok).toBe(false);
  if (parsed.ok) throw new Error('unreachable');
  expect(parsed.error).toContain(keyword);
}

const FULL: GroupMessagePayload = {
  provider: 'telegram',
  chatId: '-1001234567890',
  threadId: '77',
  messageId: '4213',
  chatName: 'Cindy Dev',
  author: { name: '@user202', isBot: false },
  text: '昨天部署失败了',
  fileNames: ['error.log'],
  sentAt: 1_785_200_000_000,
};

describe('group.message(阶段 14)', () => {
  it('round-trip: 全字段与最小字段', () => {
    roundTrip(makeGroupMessage(FULL));
    roundTrip(
      makeGroupMessage({
        provider: 'telegram',
        chatId: '-900',
        threadId: null,
        messageId: '1',
        chatName: null,
        author: { name: 'Cindy(bot)', isBot: true },
        text: '看起来是连接池耗尽',
        sentAt: 1_785_200_000_001,
      }),
    );
  });

  it('纯附件消息: text 可为空但 fileNames 必须非空', () => {
    roundTrip(makeGroupMessage({ ...FULL, text: '', fileNames: ['photo.jpg'] }));
    const empty = makeGroupMessage({ ...FULL, text: '' });
    delete (empty.payload as Partial<GroupMessagePayload>).fileNames;
    expectReject(empty, 'text or fileNames');
  });

  it('字段校验: 必填与显式 null', () => {
    expectReject({ ...makeGroupMessage(FULL), payload: { ...FULL, chatId: '' } }, 'chatId');
    expectReject({ ...makeGroupMessage(FULL), payload: { ...FULL, messageId: '' } }, 'messageId');
    expectReject(
      { ...makeGroupMessage(FULL), payload: { ...FULL, author: { name: '' } } },
      'author.name',
    );
    expectReject({ ...makeGroupMessage(FULL), payload: { ...FULL, sentAt: 0 } }, 'sentAt');
    // threadId / chatName 必须显式 null, 不接受缺省。
    const noThread: Record<string, unknown> = { ...FULL };
    delete noThread.threadId;
    expectReject({ ...makeGroupMessage(FULL), payload: noThread }, 'threadId');
  });

  it('上限: 超长 text 与超量 fileNames 拒收', () => {
    expectReject(
      { ...makeGroupMessage(FULL), payload: { ...FULL, text: 'x'.repeat(8_193) } },
      'text',
    );
    expectReject(
      {
        ...makeGroupMessage(FULL),
        payload: { ...FULL, fileNames: Array.from({ length: 21 }, (_, i) => `f${i}`) },
      },
      'fileNames',
    );
    expectReject(
      { ...makeGroupMessage(FULL), payload: { ...FULL, fileNames: ['x'.repeat(257)] } },
      'fileNames',
    );
  });

  it('能力标识常量', () => {
    expect(HOOK_FEATURE_GROUP_RELAY).toBe('group-relay-v1');
  });

  it('provider 是开放集合: 非 telegram 值照常通过', () => {
    roundTrip(makeGroupMessage({ ...FULL, provider: 'discord' }));
  });
});
