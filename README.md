# cindy-protocol

[English](README.en.md) | **中文**

客户端仓库与服务端仓库**共享的线上协议**(wire protocol)单一权威来源。两侧以 git submodule 挂载本仓库,并把 `packages/*` 纳入各自的 pnpm workspace(源码直发,无构建产物)。

## 准入规则

只有**服务端真正需要解析/校验**的协议才进本仓库;纯客户端之间端到端、对服务端不透明的类型留在客户端仓库。

## 包清单

| 包                             | 内容                                                                                                                                  | 消费方                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `@cindy/slack-hook-protocol`   | hook server ↔ desktop 双工任务协议:信封、消息类型、运行时校验、构造器                                                                 | desktop(hook-control)、slack-hook-server            |
| `@cindy/device-link-protocol`  | device-link 中继层协议:信封、路由语义(ROUTED/CONTROL kinds)、连接层 payload。隧道层 payload 对 relay 不透明,留在客户端 device-link 包 | desktop/mobile(device-link 包)、device-link-server  |
| `@cindy/plugin-protocol`       | Ghost 包 `ghost.json` 类型与校验器、Desktop 所需 Plugin 列表/详情/下载 DTO 与响应解析器                                               | plugin-server；Desktop 在后续远程 Plugin 接入时消费 |
| `@cindy/skill-protocol`        | Skill 发布包 manifest、Desktop 所需 Skill 列表/详情/下载 DTO 与响应解析器                                                             | plugin-server Skill Domain；Desktop Skill 市场      |
| `@cindy/voice-protocol`        | desktop/mobile ↔ voice-server 语音控制面:会话、一次性 ticket、ASR 目标描述、refine payload 与运行时校验                               | desktop、mobile、voice-server                       |
| `@cindy/model-access-protocol` | model-access-server ↔ desktop/mobile 模型目录响应、价格币种与运行时校验                                                               | model-access-server、desktop/mobile 模型选择器      |

## 协议文档

- [slack-hook-protocol](docs/slack-hook-protocol.md) — hook server ↔ desktop 双工任务协议(信封、24 种消息、可靠性与兼容策略)
- [device-link-protocol](docs/device-link-protocol.md) — 设备互联中继层协议(哑中继模型、路由语义、安全语义)
- [plugin-protocol](docs/plugin-protocol.md) — Ghost manifest 与 Plugin HTTP 交付契约、版本边界和兼容策略
- [skill-protocol](docs/skill-protocol.md) — Skill 发布 manifest 与市场 HTTP 交付契约、Scope 和兼容策略
- [voice-protocol](docs/voice-protocol.md) — 语音控制面协议(会话、一次性 ticket、refine payload 与兼容策略)
- [model-access-protocol](docs/model-access-protocol.md) — 模型目录、价格币种与兼容策略

## 消费方式

消费方仓库挂 submodule(约定路径与仓库同名:`cindy-protocol/`,目录树上一眼可见指向本仓),`pnpm-workspace.yaml` 增加:

```yaml
packages:
  - 'cindy-protocol/packages/*'
```

依赖照常写 `"@cindy/slack-hook-protocol": "workspace:*"`。

所有协议包都是源码直发，本仓不产出构建产物。纯 Node 生产进程无法直接加载
`node_modules` 下的 TypeScript，因此服务端消费方要在构建期把用到的协议包内联进
自己的 bundle（`tsup` 的 `noExternal`）。

## 贡献

本仓开源的首要目的是**解锁外部本地开发**:服务端代码不开源,但服务端与客户端共用这部分协议——本仓作为客户端的 git submodule 公开出来,外部开发者才能完整 clone 客户端、在本地 `pnpm install` 并构建 / debug。也就是说,本仓更多是"让外部能在客户端上开发"的**前置依赖**,而非外部贡献的主战场。

按贡献类型分工:**文档 / 翻译、校验器(parse)缺陷修复、测试、工具**欢迎外部直接提 PR(可独立合并);**牵涉服务端语义的协议变更**由内部维护者走两段式流程落地(服务端闭源),外部有想法请先开 [协议提案 issue](../../issues/new/choose)。完整说明见 [CONTRIBUTING.md](CONTRIBUTING.md) 的「贡献范围」;提交信息格式见 [Commit 规范](docs/commit-convention.md)。

## 许可证

本仓库以 [Apache License 2.0](LICENSE) 发布(版权方:XD Inc.,见 [NOTICE](NOTICE))。除非另有书面说明,你有意提交至本仓库的任何贡献,均按 Apache-2.0 第 5 条以相同许可条款授权。

## 变更纪律

- 协议是跨仓契约:**append-only 优先**,不兼容改动必须升协议版本号(如 device-link 的 `PROTOCOL_VERSION`),并在同一时间窗内 bump 各消费方仓库的 submodule 指针。
- 零运行时依赖是硬约束:本仓库的包不得引入任何 runtime dependency。其中 `device-link-protocol`、`voice-protocol` 还必须保持 React Native 可编译(禁 Node-only import,mobile 端直接消费);`slack-hook-protocol` 面向 Node 环境(desktop main / hook server),允许 `node:*` 标准库。
