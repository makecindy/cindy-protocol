# 贡献指南

感谢你对 Cindy 协议仓库的关注。本仓库是客户端仓与服务端仓**共享线上协议的单一权威来源**,两个主仓库以 git submodule 引用它——这意味着这里的每一行改动都是跨仓契约变更,流程和纪律比普通仓库更严格。

## 开发环境

- Node.js >= 22,pnpm 10.x
- `pnpm install` 安装依赖
- `pnpm test` 跑全部测试,`pnpm typecheck` 全部包 tsc 检查

## 我应该在哪个仓库提 PR?

- **只改客户端 / 服务端代码**:去对应主仓库,不需要动本仓库。主仓库 clone 时记得 `git clone --recurse-submodules`。
- **要改协议本身**(消息类型、字段、信封、路由语义、常量):在本仓库提 PR,走下面的两段式流程。

## 两段式协议变更流程

因为主仓库的 submodule 指针只能指向本仓库**已合并**的 commit,协议变更必须分两步:

1. **本仓库 PR**:协议改动 + parse 校验 + 测试 + 文档(`docs/` 对应章节)一起提交,说明动机与兼容性影响,等待合并;
2. **主仓库 PR**:本仓库 PR 合并后,再到主仓库提 PR——bump submodule 指针到新 commit,并附上消费方的适配改动。

> 直接在主仓库 PR 里把 submodule 指针指向你 fork 中的 commit 是行不通的:上游 CI 无法 fetch 到你 fork 里的对象。

## 协议演进纪律(硬性)

1. **零 runtime 依赖**:本仓库任何包不得引入 runtime dependency。
2. **`device-link-protocol` 必须 React Native 安全**:禁止 `node:*` 及任何 Node-only import(mobile 端直接编译此包源码)。
3. **append-only 优先**:优先加可选字段 / 新消息类型,不改已有字段语义;每个新增可选字段必须写清"对端是旧版"时两侧各自的降级行为。
4. **两个协议的兼容策略不同,不要套错**:
   - `slack-hook-protocol`:`type` 是开放集合,老端收到未知类型丢帧不断连——新消息类型天然向后兼容,但必须定义降级体验;
   - `device-link-protocol`:relay 对未知 kind 静默丢弃(发送方表现为超时黑洞)——新增需要转发的 kind 属于**两侧同步升级**的变更,`EnvelopeKind` 集合与 `PROTOCOL_VERSION` 必须同步调整。
5. **不兼容改动必须升协议版本号**,并在 PR 里写明两个主仓库的升级时间窗安排。
6. **改协议必改三件套**:类型定义 + parse 运行时校验(错误信息带字段路径)+ 测试(至少覆盖 roundTrip 与坏帧拒收);涉及行为语义的同步更新 `docs/` 对应文档。

## 测试要求

- 新消息类型 / 新字段:补 roundTrip 用例 + 字段联动约束的拒收用例;
- 测试 fixture 一律使用中性占位值(`cindy` / `example.com` 等),禁止真实邮箱、真实组织名、内部系统标识。

## Commit 规范

见 [docs/commit-convention.md](docs/commit-convention.md)。

## 许可与贡献授权

本仓库以 [Apache License 2.0](LICENSE) 发布。除非另有书面说明,你有意提交至本仓库的任何贡献,均按 Apache-2.0 第 5 条以相同许可条款授权。
