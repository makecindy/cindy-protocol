# 贡献指南

[English](CONTRIBUTING.en.md) | **中文**

感谢你对 Cindy 协议仓库的关注。本仓库是客户端仓与服务端仓**共享线上协议的单一权威来源**,各消费方仓库以 git submodule 引用它——这意味着这里的每一行改动都是跨仓契约变更,流程和纪律比普通仓库更严格。

## 贡献范围

本仓库开源的首要目的:**服务端代码不开源,但服务端与客户端共用这部分协议**——把它公开,外部开发者才能完整 clone 客户端(本仓是其 git submodule)、在本地 `pnpm install` 并构建 / debug。换句话说,本仓更多是"让外部能在客户端上开发"的**前置依赖**,而非外部贡献的主战场。

按贡献类型分工:

- **文档 / 翻译**(如把 `docs/*.md` 译成英文)、**校验器(parse)缺陷修复**、**测试补充**、**工具 / CI**:欢迎外部直接提 PR,可独立评审合并,不需要服务端配合。
- **协议语义变更**(新消息类型 / 字段 / 信封 / 路由语义 / 常量):需要服务端 + 客户端协同实现,而**服务端闭源**——这类由内部维护者主导,走下面的两段式流程落地。外部若有想法,请先开一个[协议提案 issue](../../issues/new/choose)讨论,由内部实现。
- **安全问题**:见 [SECURITY.md](SECURITY.md)。

## 开发环境

- Node.js >= 22,pnpm 10.x
- `pnpm install` 安装依赖
- `pnpm test` 跑全部测试,`pnpm typecheck` 全部包 tsc 检查

## 我应该在哪个仓库提 PR?

- **只改客户端 / 服务端代码**:去对应消费方仓库,不需要动本仓库。消费方仓库 clone 时记得 `git clone --recurse-submodules`。
- **要改协议本身**(消息类型、字段、信封、路由语义、常量):在本仓库提 PR,走下面的两段式流程。

## 两段式协议变更流程

因为消费方仓库的 submodule 指针只能指向本仓库**已合并**的 commit,协议变更必须分两步:

1. **本仓库 PR**:协议改动 + parse 校验 + 测试 + 文档(`docs/` 对应章节)一起提交,说明动机与兼容性影响,等待合并;
2. **消费方仓库 PR**:本仓库 PR 合并后,再到消费方仓库提 PR——bump submodule 指针到新 commit,并附上消费方的适配改动。

> 直接在消费方仓库 PR 里把 submodule 指针指向你 fork 中的 commit 是行不通的:上游 CI 无法 fetch 到你 fork 里的对象。

## PR 约定

- **一个 PR 只做一个逻辑变更**:便于评审与回滚;协议改动与无关重构不要混在一起。
- **分支命名**:`<type>/<简短描述>`,`type` 与 commit 一致(`feat`/`fix`/`docs`/…),如 `feat/slack-hook-multi-team`、`fix/device-link-version-check`。
- **PR 描述**:写清动机与兼容性影响,并按仓库 PR 模板逐项勾选(协议变更尤其要过「三件套」)。
- **新增消息类型 / 字段落在哪、怎么扩展**:见对应协议文档的「扩展指南 / 版本纪律」小节——[slack-hook §9](docs/slack-hook-protocol.md)、[device-link §9](docs/device-link-protocol.md)、[voice](docs/voice-protocol.md)。

## 协议演进纪律(硬性)

1. **零 runtime 依赖**:本仓库任何包不得引入 runtime dependency。
2. **`device-link-protocol` 与 `voice-protocol` 必须 React Native 安全**:禁止 `node:*` 及任何 Node-only import(mobile 端直接编译这些包源码)。
3. **append-only 优先**:优先加可选字段 / 新消息类型,不改已有字段语义;每个新增可选字段必须写清"对端是旧版"时两侧各自的降级行为。
4. **各协议的兼容策略不同,不要套错**:
   - `slack-hook-protocol`:`type` 是开放集合,老端收到未知类型丢帧不断连——新消息类型天然向后兼容,但必须定义降级体验;
   - `device-link-protocol`:relay 对未知 kind 静默丢弃(发送方表现为超时黑洞)——新增需要转发的 kind 属于**两侧同步升级**的变更,`EnvelopeKind` 集合与 `PROTOCOL_VERSION` 必须同步调整。
   - `plugin-protocol`:manifest 与客户端 HTTP envelope 分别版本化。未知可选字段可忽略；不支持的 manifest 或 envelope 版本必须拒绝应用，客户端保留已有安装，不做部分更新。
   - `skill-protocol`:发布 manifest 与客户端 HTTP envelope 分别版本化。未知可选字段可忽略；不支持的版本必须拒绝发布/安装，客户端更新失败时保留已有 Skill。
   - `voice-protocol`:会话请求/响应允许未知字段并以可选字段做滚动升级;refiner 业务 payload 为防止项目 Key 被滥用而严格拒绝未知字段。缺省 `protocolVersion` 按 v1 解释,显式不支持的版本直接拒绝。
5. **不兼容改动必须升协议版本号**,并在 PR 里写明两个消费方仓库的升级时间窗安排。
6. **改协议必改三件套**:类型定义 + parse 运行时校验(错误信息带字段路径)+ 测试(至少覆盖 roundTrip 与坏帧拒收);涉及行为语义的同步更新 `docs/` 对应文档。

## 测试要求

- 新消息类型 / 新字段:补 roundTrip 用例 + 字段联动约束的拒收用例;
- 测试 fixture 一律使用中性占位值(`cindy` / `example.com` 等),禁止真实邮箱、真实组织名、内部系统标识。

## Commit 规范

见 [docs/commit-convention.md](docs/commit-convention.md)。

## 许可与贡献授权

本仓库以 [Apache License 2.0](LICENSE) 发布。除非另有书面说明,你有意提交至本仓库的任何贡献,均按 Apache-2.0 第 5 条以相同许可条款授权。
