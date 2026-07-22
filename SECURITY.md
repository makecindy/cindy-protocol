# 安全策略 / Security Policy

## 中文

本仓库只包含**协议定义与运行时校验器**(TypeScript 类型 + 手写 parse 校验),
零运行时依赖,不含任何可运行的服务端。因此这里的"安全问题"主要指:

- 校验器缺陷:构造出的畸形帧能绕过 `parseHookMessage` /
  `validate*` / `parse*` 通过校验;
- 正则/解析在特定输入下的性能问题(如 ReDoS);
- 兼容性/降级规则被利用导致对端进入非预期状态。

**如何上报**:请直接在本仓库开一个 [GitHub Issue](../../issues),
标题带 `[security]` 前缀,附上可复现的最小帧/输入与预期 vs 实际行为。
若你认为该问题在公开前不宜披露,可改用 GitHub 的
[私密安全公告(Security Advisory)](../../security/advisories/new)。

我们会尽力及时响应。请勿在 issue 中粘贴任何真实凭证、真实用户数据或内部系统标识。

> 部署侧(运营 hook / relay / voice 等服务的具体实例)的安全问题不属于本仓库范围,
> 请通过对应服务的渠道上报。

## English

This repository contains only **protocol definitions and runtime validators**
(TypeScript types + hand-written parse validation), with zero runtime
dependencies and no runnable server. "Security issues" here therefore mean
primarily:

- Validator defects: a crafted malformed frame that passes `parseHookMessage` /
  `validate*` / `parse*` when it should be rejected;
- Performance issues in regex/parsing on specific inputs (e.g. ReDoS);
- Compatibility/degradation rules that can be abused to drive a peer into an
  unexpected state.

**How to report**: open a [GitHub Issue](../../issues) in this repository with a
`[security]` prefix in the title, including a minimal reproducing frame/input and
the expected vs. actual behavior. If you believe the issue should not be
disclosed publicly before a fix, use GitHub's
[private Security Advisory](../../security/advisories/new) instead.

We will do our best to respond promptly. Please do not paste real credentials,
real user data, or internal system identifiers into an issue.

> Security issues in a deployment (a specific running instance of the hook /
> relay / voice services) are out of scope for this repository; report those
> through that service's own channel.
