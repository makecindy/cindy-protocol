# cindy-protocol

客户端仓库与服务端仓库**共享的线上协议**(wire protocol)单一权威来源。两侧以 git submodule 挂载本仓库,并把 `packages/*` 纳入各自的 pnpm workspace(源码直发,无构建产物)。

## 准入规则

只有**服务端真正需要解析/校验**的协议才进本仓库;纯客户端之间端到端、对服务端不透明的类型留在客户端仓库。

## 包清单

| 包 | 内容 | 消费方 |
|---|---|---|
| `@cindy/slack-hook-protocol` | hook server ↔ desktop 双工任务协议:信封、消息类型、运行时校验、构造器(自主仓 hook-protocol 包迁入改名) | desktop(hook-control)、slack-hook-server |
| `@cindy/device-link-protocol` | device-link 中继层协议:信封、路由语义(ROUTED/CONTROL kinds)、连接层 payload。隧道层 payload 对 relay 不透明,留在客户端 device-link 包 | desktop/mobile(device-link 包)、device-link-server |

## 协议文档

- [slack-hook-protocol](docs/slack-hook-protocol.md) — hook server ↔ desktop 双工任务协议(信封、21 种消息、可靠性与兼容策略)
- [device-link-protocol](docs/device-link-protocol.md) — 设备互联中继层协议(哑中继模型、路由语义、安全语义)

## 消费方式

主仓库挂 submodule(约定路径与仓库同名:`cindy-protocol/`,目录树上一眼可见指向本仓),`pnpm-workspace.yaml` 增加:

```yaml
packages:
  - "cindy-protocol/packages/*"
```

依赖照常写 `"@cindy/slack-hook-protocol": "workspace:*"`。

## 贡献

贡献流程(两段式协议变更)、协议演进纪律与测试要求见 [CONTRIBUTING.md](CONTRIBUTING.md);提交信息格式见 [Commit 规范](docs/commit-convention.md)。

## 许可证

本仓库以 [Apache License 2.0](LICENSE) 发布(版权方:X.D. Network Inc.,见 [NOTICE](NOTICE))。除非另有书面说明,你有意提交至本仓库的任何贡献,均按 Apache-2.0 第 5 条以相同许可条款授权。

## 变更纪律

- 协议是跨仓契约:**append-only 优先**,不兼容改动必须升协议版本号(如 device-link 的 `PROTOCOL_VERSION`),并在同一时间窗内 bump 两个主仓的 submodule 指针。
- 零运行时依赖是硬约束:本仓库的包不得引入任何 runtime dependency。其中 `device-link-protocol` 还必须保持 React Native 可编译(禁 Node-only import,mobile 端直接消费);`slack-hook-protocol` 面向 Node 环境(desktop main / hook server),允许 `node:*` 标准库。

## 迁移状态

- [ ] 主仓库(monorepo)尚未接线:desktop / slack-hook-server 仍在用主仓原 hook-protocol 包;device-link 两侧仍各持等价副本。接线时切 import 并删除原副本。
