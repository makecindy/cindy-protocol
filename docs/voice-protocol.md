# voice-protocol

`@cindy/voice-protocol` 是 desktop、mobile 与 voice-server 之间语音控制面的单一协议来源。包以 TypeScript 源码直发、零运行依赖，并保持 React Native 可编译。

## 协议边界

协议包负责 Cindy 自有且服务端需要解析的线上契约：

- `POST /api/voice/sessions` 的会话申请与响应；
- 一次性 ASR ticket、过期时间和 WebSocket 目标描述；
- `protocolProfile`、客户端类型、refiner schema 与 prompt 归属等枚举；
- `POST /api/voice/sessions/:sessionId/refine` 的请求信封；
- `POST /api/voice/dictionary-learning` 的会话无关入口；
- 听写优化、词典学习两种 user payload；
- `{ error: { code, message } }` 错误信封和稳定路由构造器。

以下内容不属于本包：

- 豆包、Qwen、OpenAI 等上游的原生 WebSocket 帧；voice-server 对这些帧保持透明代理；
- Gateway API Key、JWT/JWKS 实现、Redis ticket 存储结构；
- 数据库、限流、计费和 provider/model allowlist。

## 版本与兼容性

当前 `VOICE_PROTOCOL_VERSION` 为 `1`。首次滚动接入期间，请求与响应里的 `protocolVersion` 为可选字段：缺省按 v1 解释，显式值只接受 `1`。这样新 server 可以先增加字段而不影响旧客户端，新客户端也能读取尚未升级的旧 server 响应。

协议演进遵循 append-only：新增可选字段时旧端忽略未知字段；修改已有字段语义、删除字段或收紧必填约束属于不兼容变更，必须升级版本并同步安排两个消费仓的升级窗口。

## Prompt 归属（`promptOwner`）

会话响应的 `refiner.promptOwner` 声明这次托管润色由谁提供 system prompt：

| 取值            | 客户端行为                                                                                  | 服务端行为                                              |
| --------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 缺省 / `client` | 发 `[system, user]` 两条消息，自带 prompt 与 `promptVersion`，并自行派生 `prompt_cache_key` | 直接使用客户端给的 prompt                               |
| `server`        | 只发 `[user]` 一条消息，省略 `promptVersion` 与 `prompt_cache_key`                          | 按 `schemaName` 注入自己的 prompt，并自行生成 cache key |

降级行为（append-only 要求逐项写明）：

- **新客户端 + 旧服务端**：响应里没有 `promptOwner`，客户端按 `client` 走历史行为，功能不受影响；
- **旧客户端 + 新服务端**：客户端仍发两条消息，服务端沿用其 prompt，不强制切换；
- 该字段只在 `refiner.enabled` 为 `true` 时允许出现，且只影响托管润色 —— BYOK 客户端直连上游，必须始终自带 prompt。

因此 `parseVoiceRefineRequest` 接受两种信封形态：`[system, user]` 与仅 `[user]`。user 消息恒为最后一条（它承载服务端据以分发的 `schemaName`），只给 system 而没有 user 属于非法请求。`VoiceDictationRefinementInput.promptVersion` 与 `VoiceDictionaryLearningInput.promptVersion` 的类型相应放宽为可选，但**具体是否允许出现由归属决定**——详见下文「组合解析」一节的字段约束表。

## 词典学习入口

`VOICE_DICTIONARY_LEARNING_PATH`（`POST /api/voice/dictionary-learning`）与 refine 共用 `VoiceRefineRequest` 信封和 `dictation_dictionary_learning` payload，但**不绑定会话**，仅凭账号令牌鉴权。

原因是触发时机：词典学习发生在用户改动已插入文本之后，此时 ASR 会话与其一次性 ticket 已经回收，`/api/voice/sessions/:sessionId/refine` 不再可用。该端点始终由服务端提供 prompt，不需要 `promptOwner` 协商；旧服务端没有这个路由，客户端按 404 静默跳过即可。

## 组合解析（服务端首选入口）

信封与 payload 的契约是**耦合**的：server-owned 信封才允许省略 `promptVersion`；词典学习路由必须拒绝调用方自带的 system prompt 与非词典学习 payload。分别调用两个 parser 无法表达这层耦合，会迫使业务层写零散的补充检查。

因此服务端应优先使用 `parseVoiceRefineRequestWithPayload(body, { route })`：它一次完成信封解析、prompt 归属推导（有 system 即 `client`）、以及按归属和路由收紧的 payload 校验，返回 `{ request, payload, promptOwner }`。

| route                 | 允许的归属          | 允许的 schema                      |
| --------------------- | ------------------- | ---------------------------------- |
| `refine`（缺省）      | `client` / `server` | 两种都可                           |
| `dictionary_learning` | 仅 `server`         | 仅 `dictation_dictionary_learning` |

`promptVersion` 与 `prompt_cache_key` 都严格跟随归属，两者的理由相同——它们标识的是「哪份 prompt」，而 server 归属下客户端从未见过那份 prompt：

| 字段                       | `client` 归属                                 | `server` 归属              |
| -------------------------- | --------------------------------------------- | -------------------------- |
| `input.promptVersion`      | 必填（标识客户端那份 prompt，参与 cache key） | **必须缺省**               |
| `request.prompt_cache_key` | 客户端自行派生                                | **必须缺省**，由服务端生成 |

放行调用方在 server 归属下给出的这两个字段，等于让它为自己没见过的 prompt 指定版本或缓存分片——服务端若信任校验后的结果继续转发，就成了攻击者可控的元数据。因此组合解析对两者一律拒收。

单独调用 `parseVoiceRefinerUserPayload` 时可传 `{ promptOwner, route }` 得到同样的收紧；两者都不传才保持宽松，供确实无法判定归属的调用方使用。其中 `route: 'dictionary_learning'` 本身就确立了归属：只传它也会按 server 归属校验，无需再传 `promptOwner`；显式传 `promptOwner: 'client'` 与该路由自相矛盾，会被拒收。

## 运行时校验

两端必须通过包内 parser 处理不可信输入：

- `parseCreateVoiceSessionRequest`
- `parseCreateVoiceSessionResponse`
- `parseVoiceRefineRequestWithPayload`（refine / 词典学习端点的首选入口，见上节）
- `parseVoiceRefineRequest`
- `parseVoiceRefinerUserPayloadJson`
- `parseVoiceErrorResponse`

解析失败返回 `{ ok: false, error }`，错误文本包含字段路径，不抛异常。业务层再把解析错误映射为本服务的 HTTP 错误码。

`parseVoiceRefinerUserPayloadJson` 在 `JSON.parse` 前先按 `VOICE_MAX_REFINER_PAYLOAD_CHARS`(64k 字符，与 refine 请求信封中 user message content 的上限一致）拒收超长原始输入——协议层的粗防 OOM 兜底；传输/部署层的 body 限额仍应独立设置。

Refiner 的业务 payload 使用严格字段集合，避免项目 Key 被未登记任务滥用；会话请求与响应允许额外字段，以支持 append-only 的滚动升级。
