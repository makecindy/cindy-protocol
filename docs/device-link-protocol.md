# device-link-protocol — 设备互联中继层协议

> 包:`@cindy/device-link-protocol` · 协议版本 `PROTOCOL_VERSION = 1` · 传输:WebSocket(JSON 帧)
> 三方角色:**controller**(控制端,手机或另一台桌面)、**target**(被控端桌面)、**relay**(device-link server,哑中继)。

## 1. 协议模型:哑中继(dumb relay)

同账号的多台设备各自与 relay 保持一条 WS 长连接。控制端对被控端的一切操作(远程 IPC invoke、事件推送)都封装成统一信封,由 relay 按 `dst` 转发:

```mermaid
flowchart LR
    C["controller<br/>(手机 / 另一台桌面)"] -->|"invoke / link-open"| R["relay<br/>(哑中继, 只看路由头)"]
    R -->|"按 dst 转发"| T["target<br/>(被控端桌面)"]
    T -->|"invoke-result / push"| R
    R -->|"按 dst 转发"| C
```

**relay 是哑的**:只解析信封的路由头(`v / kind / id / src / dst`)与连接层 payload;隧道层 payload(invoke 的 channel/args、push 的事件内容)对 relay **完全不透明**——它不理解、不校验、不记录语义。这个设计决定了本包的准入边界(§2)。

## 2. 准入边界(本包装什么、不装什么)

本包是中继层协议的**单一权威来源**,只包含 relay 需要解析/校验的部分:

**包含**:信封与 kind 集合、路由语义(`ROUTED_KINDS` / `CONTROL_KINDS`)、协议常量、relay 错误码、连接层 payload(hello / hello-ack / presence 系列)。

**不包含**(留在客户端仓的完整 device-link 包中):

- 隧道层 payload 类型:`LinkOpenPayload` / `LinkAcceptPayload` / `LinkClosePayload` / `InvokePayload` / `InvokeResultPayload` / `PushPayload`——controller ↔ target 端到端,对 relay 不透明;
- `DeviceLinkError` 异常类与客户端本地错误码(`CHANNEL_NOT_ALLOWED` / `INVOKE_TIMEOUT` / `NOT_CONNECTED` 等)——客户端运行时概念;
- IPC channel 白名单(allowlist)、push topic 路由、WS 客户端状态机——纯客户端实现。

客户端完整协议在本包基础上 **extend**:`DeviceLinkErrorCode = RelayErrorCode | 客户端本地码`。

## 3. 常量

| 常量                   | 值    | 语义                                                                                          |
| ---------------------- | ----- | --------------------------------------------------------------------------------------------- |
| `PROTOCOL_VERSION`     | 1     | 整数,只升不降;不兼容改动 +1。两侧(relay 与客户端)必须同版本,不一致回 `VERSION_MISMATCH`       |
| `MAX_FRAME_BYTES`      | 2 MiB | 单帧最大字节数。relay 超限回 `PAYLOAD_TOO_LARGE` 并丢弃(不断连);发送方应先行拒绝/裁剪而非硬发 |
| `WS_MAX_PAYLOAD_BYTES` | 4 MiB | ws 库层硬上限兜底(超过直接断连),留余量给协议层先行优雅拒绝                                    |

## 4. 信封

```ts
interface Envelope {
  v: number; // PROTOCOL_VERSION
  kind: EnvelopeKind;
  id?: string; // requestId(req/resp 配对; relay-error 回带原帧 id)
  src?: string; // 源 deviceId —— server 在转发时填写,客户端传入值会被覆盖(防伪造)
  dst?: string; // 目标 deviceId(隧道层帧必填)
  payload?: unknown;
}
```

安全要点:**`src` 由 relay 填写**,客户端自称的 src 一律被覆盖——被控端信任的设备身份来自 relay 的账号鉴权,不来自帧内容。

## 5. kind 分层与路由语义

### 连接层(client ↔ relay,relay 解析 payload)

| kind               | 方向                       | 用途                                                                                       |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------ |
| `hello`            | client → relay             | 上线注册:`{ deviceName, platform, appVersion, remoteControlEnabled, busy, deviceInfo? }`   |
| `hello-ack`        | relay → client             | 注册应答:`{ serverProtocolVersion, deviceId, userId, capabilities? }`                      |
| `presence-set`     | client → relay             | 部分更新自身状态:`{ remoteControlEnabled?, busy? }`                                        |
| `presence-changed` | relay → 同账号在线设备广播 | 单设备 presence 快照(`PresenceSnapshot`)                                                   |
| `ping` / `pong`    | client ↔ relay             | 应用层心跳(20s),relay 借 ping 刷新 `lastSeenAt` / 路由 TTL                                 |
| `notify`           | client → relay             | 请求 relay 给本账号已注册推送 token 的移动设备发系统推送(`NotifyPayload`,relay 消费不转发) |

**`notify` 的能力协商(capability gate)**:老 relay 对未知 kind 静默丢弃(§9),`notify` 又是 fire-and-forget(成功无响应),发送方无法靠超时区分「已推送」与「黑洞」。因此 relay 在 `hello-ack.capabilities` 中声明 `'notify'`(常量 `SERVER_CAPABILITY_NOTIFY`),客户端**只有看到该声明才允许发送** `notify` 帧;`capabilities` 缺省(老 relay)= 空集 = 不发。失败路径回 `relay-error`:`RATE_LIMITED`(频控)/ `BAD_REQUEST`(payload 非法或字段超限,上限见 `NOTIFY_*_MAX_LENGTH` 常量)/ `INTERNAL`。推送 token 的注册/注销走 relay 的 REST 面(客户端 ↔ relay server 的接口契约,不在本包)。

### 隧道层(controller ↔ target,relay 只转发)

`link-open` / `link-accept` / `link-close` / `invoke` / `invoke-result` / `push` —— payload 对 relay 不透明,类型定义在客户端包。

### 错误

`relay-error`(relay → 发送方):`{ code: RelayErrorCode, message, dst? }`,`id` 回带原帧 id 便于配对。

### 路由语义(relay 的转发规则,协议的一部分)

```ts
// 需要 relay 按 dst 转发的帧
ROUTED_KINDS = { link-open, link-accept, link-close, invoke, invoke-result, push }

// 「发起控制」语义的帧:转发前 relay 必须校验目标设备 remoteControlEnabled === true
CONTROL_KINDS = { link-open, invoke }
```

`link-accept` / `invoke-result` / `push` 是被控端 → 控制端的**回程帧**,`link-close` 是双向解除——这三类**不受**被控开关限制:开关关掉后回程帧仍需送达以完成收尾,否则控制端会挂在半开链路上。

## 6. 错误码(`RelayErrorCode`,relay 自身产生)

| code                | 含义                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `DEVICE_OFFLINE`    | 目标设备不在线,或不属于本账号                                                                        |
| `REMOTE_DISABLED`   | 目标设备「允许被控」开关关闭                                                                         |
| `VERSION_MISMATCH`  | 协议版本不一致                                                                                       |
| `PAYLOAD_TOO_LARGE` | 单帧超限(见 `MAX_FRAME_BYTES`)                                                                       |
| `RATE_LIMITED`      | `notify` 频控命中。只有声明了 `notify` capability 的 relay 会产生;旧客户端不发 `notify`,不会收到本码 |
| `BAD_REQUEST`       | 帧格式非法                                                                                           |
| `INTERNAL`          | 中继内部错误                                                                                         |

客户端包的 `DeviceLinkErrorCode` 是本集合的超集(追加客户端本地码);relay 产生的码必须与本集合保持一致。

## 7. 连接层 payload 参考

- `HelloPayload`:`deviceName` / `platform` / `appVersion` / `remoteControlEnabled` / `busy` / `deviceInfo?`
- `HelloAckPayload`:`serverProtocolVersion` / `deviceId` / `userId` / `capabilities?`(server 可选能力集,append-only;老 server 缺省 = 空集)
- `PresenceSetPayload`:`remoteControlEnabled?` / `busy?`(部分更新)
- `NotifyPayload`:`category`(`session-done` / `session-error` / `session-needs-reply`)/ `title` / `body?` / `deepLink` / `collapseId` / `targetDeviceId?`。字段长度上限见 `NOTIFY_TITLE_MAX_LENGTH` 等常量;`body` 可放内容摘要(体验优先的产品决策)——正文经 APNs/FCM 第三方通道,由发送端裁剪长度与敏感度,relay 不落盘通知内容
- `DeviceInfo`:`cpuLabel?` / `memoryGb?` / `osVersion?` / `modelLabel?`(全部 best-effort 可缺省)
- `PresenceSnapshot`(presence-changed 广播与 REST 设备列表共用):`deviceId` / `online` / `deviceName` / `selfName?` / `deviceInfo?` / `platform` / `appVersion` / `lastSeenAt`(unix ms)/ `remoteControlEnabled` / `busy`

## 8. 安全语义小结

1. `src` 由 relay 覆写,客户端不可伪造来源设备。
2. 路由只在**同账号**设备集合内成立(`DEVICE_OFFLINE` 同时覆盖"不属于本账号",不区分回包,避免探测)。
3. `CONTROL_KINDS` 帧转发前强制校验目标 `remoteControlEnabled`;回程帧豁免(见 §5)。
4. 隧道内容 relay 不可见——权限控制(IPC channel 白名单、逐设备黑名单)全部在被控端本地执行,relay 被攻破也拿不到通道语义。

## 9. 版本纪律与本仓承载范围

- 本包是 relay 层协议**唯一**允许演进的地方:改 `PROTOCOL_VERSION`、kind 集合、信封字段、路由语义,只能在这里改,各消费方仓库同窗 bump submodule 指针。
- 新增 kind:老 relay 对未知 / 不应由 client 发起的 kind **静默丢弃**(debug 日志,不回错、不断连)——发送方表现为无响应超时,是静默黑洞。因此新增需要 relay 转发的 kind 实质上要求**两侧同步升级**(`EnvelopeKind` 集合与 `PROTOCOL_VERSION` 同步变更,drift 由协议互通集成测试兜底)。这一点与 slack-hook-protocol 的"type 开放集合、老端丢帧可降级"策略不同,注意区分。
- 例外:**relay 消费(不转发)的连接层新 kind** 可以不 bump `PROTOCOL_VERSION`,改用 `hello-ack.capabilities` 协商(如 `notify`,见 §5)——server 先升级并声明能力,客户端看到声明才发送;新客户端 + 老 server 的降级行为是「不发送」,老客户端 + 新 server 天然忽略新增的可选字段。这样避免了 version bump 造成的新老互踢。
- **本仓承载范围**:本包只承载**类型与常量**(信封、kind 集合、路由语义、连接层 payload),不含 parse 运行时校验与测试——relay 侧的帧校验由消费方(relay server)按本包定义实现,客户端包则在本包基础上 extend 隧道层类型。因此 CONTRIBUTING 的「三件套」要求对本包退化为「类型 + 消费方各自的校验/测试」;在本仓为 device-link 新增 kind 时,请在 PR 里写明两侧消费方的同步升级安排(见上一条)。
