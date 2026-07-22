<!-- 中文在上,English below. 删掉与本 PR 无关的小节。/ Delete sections that don't apply. -->

## 动机 / Motivation

<!-- 解决什么问题?为什么需要? / What does this solve and why? -->

## 变更类型 / Change type

- [ ] 协议变更(类型/字段/信封/路由语义/常量) / Protocol change (types/fields/envelope/routing/constants)
- [ ] 文档 / Docs
- [ ] 测试 / Tests
- [ ] 其他 / Other

## 兼容性影响 / Compatibility impact

<!-- append-only?需要升协议版本号吗?老端(旧版对端)的降级行为? / Append-only? Version bump needed? Degradation behavior when the peer is older? -->

## 「三件套」自查(协议变更必须全部勾选) / The "trio" (required for protocol changes)

- [ ] 类型定义 / Type definitions
- [ ] parse 运行时校验(错误信息带字段路径) / Runtime parse validation (errors carry the field path)
- [ ] 测试(至少 roundTrip + 坏帧拒收) / Tests (at least round-trip + bad-frame rejection)
- [ ] 文档(`docs/` 对应章节) / Docs (the relevant `docs/` section)

## 检查项 / Checklist

- [ ] 遵循 [CONTRIBUTING](../CONTRIBUTING.md) 的协议演进纪律 / Follows CONTRIBUTING's protocol-evolution discipline
- [ ] commit message 符合[规范](../docs/commit-convention.md) / Commit messages follow the convention
- [ ] 一个 PR 只做一个逻辑变更 / One logical change per PR
- [ ] 测试 fixture 使用中性占位值(无真实邮箱/组织名/内部标识) / Test fixtures use neutral placeholders
- [ ] `pnpm test` 与 `pnpm typecheck` 通过 / `pnpm test` and `pnpm typecheck` pass
